import { GoogleGenAI } from "@google/genai";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase-admin";

export type SupportedLang = "fr" | "en" | "zh";

const LANG_NAMES: Record<SupportedLang, string> = {
  fr: "French",
  en: "English",
  zh: "Simplified Chinese (简体中文)",
};

const GOOGLE_TL_MAP: Record<SupportedLang, string> = {
  fr: "fr",
  en: "en",
  zh: "zh-CN",
};

// Cache mémoire serveur pour des traductions instantanées sur les répétitions
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 6000;

function getCacheKey(text: string, targetLang: SupportedLang): string {
  return `${targetLang}::${text}`;
}

function setCache(key: string, value: string) {
  if (translationCache.size >= MAX_CACHE_SIZE) {
    // Purger les 500 entrées les plus anciennes d'un coup
    let removed = 0;
    for (const k of translationCache.keys()) {
      translationCache.delete(k);
      if (++removed >= 500) break;
    }
  }
  translationCache.set(key, value);
}

/**
 * Normalise un code langue vers "fr" | "en" | "zh".
 */
export function normalizeLang(raw?: string | null): SupportedLang {
  const val = String(raw || "").toLowerCase().trim();
  if (val.startsWith("zh") || val === "cn" || val === "chinese" || val === "chinois") return "zh";
  if (val.startsWith("en") || val === "english" || val === "anglais") return "en";
  return "fr";
}

/**
 * Détecte rapidement si le texte contient des caractères chinois.
 */
function hasChineseChars(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

/**
 * Traduction rapide via Google Translate HTTPS endpoint (sans clé API requise).
 */
async function translateViaGooglePublic(text: string, targetLang: SupportedLang): Promise<string | null> {
  try {
    const tl = GOOGLE_TL_MAP[targetLang];
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && Array.isArray(data[0])) {
      const translated = data[0]
        .map((chunk: any) => (Array.isArray(chunk) ? chunk[0] : ""))
        .join("")
        .trim();
      return translated || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Traduit un texte unique vers targetLang (fr | en | zh).
 * Utilise Google Translate public en priorité (très rapide, fiable) puis Gemini en renfort.
 */
export async function translateText(text: string, targetLang: SupportedLang): Promise<string> {
  const clean = String(text || "").trim();
  if (!clean) return "";

  // Ne pas traduire des emails, URLs, codes promo ou nombres purs
  if (/^[\d\s$€£.,:+/%-]+$/.test(clean) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) || /^https?:\/\//i.test(clean)) {
    return clean;
  }

  // Si on demande du chinois et que le texte est déjà majoritairement chinois
  if (targetLang === "zh" && hasChineseChars(clean) && !/[a-zA-Z]{4,}/.test(clean)) {
    return clean;
  }

  const cacheKey = getCacheKey(clean, targetLang);
  const cached = translationCache.get(cacheKey);
  if (cached) return cached;

  // 1. Essai rapide via Google Translate HTTPS
  const gTranslated = await translateViaGooglePublic(clean, targetLang);
  if (gTranslated) {
    setCache(cacheKey, gTranslated);
    return gTranslated;
  }

  // 2. Fallback via Gemini API si disponible
  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Translate the following text into ${LANG_NAMES[targetLang]}. Return ONLY the translated text without quotes, explanations, or markdown formatting. Preserve emojis, brand names (Rayons.net, M-Pesa, Starlink), amounts, and placeholders.\n\nText:\n${clean}`,
        config: { temperature: 0.1 },
      });
      const out = (response.text || "").trim();
      if (out) {
        setCache(cacheKey, out);
        return out;
      }
    } catch (err) {
      console.warn("[autoTranslate] Gemini fallback warning:", err);
    }
  }

  return clean;
}

/**
 * Traduit un lot de textes en parallèle avec déduplication et découpage optimal par saut de ligne.
 * Beaucoup plus rapide et fiable en chinois/anglais que les séparateurs textuels altérés par Google.
 */
export async function translateBatch(texts: string[], targetLang: SupportedLang): Promise<string[]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const results: string[] = new Array(texts.length);
  const uniqueMissingMap = new Map<string, number[]>();

  for (let i = 0; i < texts.length; i++) {
    const clean = String(texts[i] || "").trim();
    if (!clean) {
      results[i] = "";
      continue;
    }
    if (
      /^[\d\s$€£.,:+/%-]+$/.test(clean) ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean) ||
      /^https?:\/\//i.test(clean) ||
      (targetLang === "zh" && hasChineseChars(clean) && !/[a-zA-Z]{4,}/.test(clean))
    ) {
      results[i] = clean;
      continue;
    }

    const cached = translationCache.get(getCacheKey(clean, targetLang));
    if (cached) {
      results[i] = cached;
    } else {
      const existing = uniqueMissingMap.get(clean);
      if (existing) {
        existing.push(i);
      } else {
        uniqueMissingMap.set(clean, [i]);
      }
    }
  }

  if (uniqueMissingMap.size === 0) return results;

  const singleLineEntries: Array<{ text: string; indices: number[] }> = [];
  const multiLineEntries: Array<{ text: string; indices: number[] }> = [];

  for (const [text, indices] of uniqueMissingMap.entries()) {
    if (text.includes("\n")) {
      multiLineEntries.push({ text, indices });
    } else {
      singleLineEntries.push({ text, indices });
    }
  }

  // Construire des paquets respectant une limite de caractères sûre pour GET (~1500 chars encodés, max 25 lignes)
  const chunks: Array<Array<{ text: string; indices: number[] }>> = [];
  let currentChunk: Array<{ text: string; indices: number[] }> = [];
  let currentChars = 0;

  for (const entry of singleLineEntries) {
    const projected = currentChars + entry.text.length + 1;
    if (currentChunk.length >= 25 || (currentChunk.length > 0 && projected > 1400)) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentChars = 0;
    }
    currentChunk.push(entry);
    currentChars += entry.text.length + 1;
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  const assignResult = (entry: { text: string; indices: number[] }, translated: string) => {
    const finalVal = (translated || entry.text).trim();
    setCache(getCacheKey(entry.text, targetLang), finalVal);
    for (const idx of entry.indices) {
      results[idx] = finalVal;
    }
  };

  // Exécuter les paquets en parallèle (jusqu'à 4 requêtes simultanées)
  const CONCURRENCY = 4;
  for (let i = 0; i < chunks.length; i += CONCURRENCY) {
    const wave = chunks.slice(i, i + CONCURRENCY);
    await Promise.all(
      wave.map(async (chunk) => {
        if (chunk.length === 1) {
          const tr = await translateText(chunk[0].text, targetLang);
          assignResult(chunk[0], tr);
          return;
        }

        // Le saut de ligne pur est préservé 1-pour-1 par Google Translate dans toutes les langues (FR/EN/ZH)
        const joined = chunk.map((c) => c.text).join("\n");
        const translatedJoined = await translateViaGooglePublic(joined, targetLang);
        const lines = translatedJoined
          ? translatedJoined.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0)
          : [];

        if (lines.length === chunk.length) {
          for (let j = 0; j < chunk.length; j++) {
            assignResult(chunk[j], lines[j]);
          }
          return;
        }

        // Repli en 2 sous-groupes parallèles si le découpage diffère (très rare)
        const individual = await Promise.all(chunk.map((c) => translateText(c.text, targetLang)));
        for (let j = 0; j < chunk.length; j++) {
          assignResult(chunk[j], individual[j]);
        }
      })
    );
  }

  // Traduire les éventuels textes multi-lignes en parallèle
  if (multiLineEntries.length > 0) {
    await Promise.all(
      multiLineEntries.map(async (entry) => {
        const tr = await translateText(entry.text, targetLang);
        assignResult(entry, tr);
      })
    );
  }

  return results;
}

/**
 * Traduit un texte vers les 3 langues de la plateforme : fr, en, zh.
 */
export async function translateToAllLanguages(
  text: string
): Promise<{ fr: string; en: string; zh: string }> {
  const clean = String(text || "").trim();
  if (!clean) return { fr: "", en: "", zh: "" };

  const [fr, en, zh] = await Promise.all([
    translateText(clean, "fr"),
    translateText(clean, "en"),
    translateText(clean, "zh"),
  ]);

  return { fr, en, zh };
}

/**
 * Récupère la langue de préférence d'un compte utilisateur depuis Firestore.
 * Fallback : settings/platform.defaultLanguage -> "fr".
 */
export async function getUserPreferredLanguage(uid?: string | null): Promise<SupportedLang> {
  try {
    await initFirebaseAdmin();
    if (uid && uid !== "admin" && uid !== "superAdmin") {
      const userSnap = await adminDb.collection("users").doc(uid).get();
      if (userSnap.exists) {
        const data = userSnap.data() || {};
        if (data.preferredLanguage) {
          return normalizeLang(data.preferredLanguage);
        }
        if (data.language) {
          return normalizeLang(data.language);
        }
      }
    }
    const settingsSnap = await adminDb.collection("settings").doc("platform").get();
    if (settingsSnap.exists) {
      const defLang = settingsSnap.data()?.defaultLanguage;
      if (defLang) return normalizeLang(defLang);
    }
  } catch (err) {
    console.warn("[getUserPreferredLanguage] fallback to fr:", err);
  }
  return "fr";
}
