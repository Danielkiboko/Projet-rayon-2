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

// In-memory translation cache to keep backend broadcasts & chats instant and cost-free on repeats
const translationCache = new Map<string, string>();
const MAX_CACHE_SIZE = 3000;

function getCacheKey(text: string, targetLang: SupportedLang): string {
  return `${targetLang}::${text}`;
}

function setCache(key: string, value: string) {
  if (translationCache.size >= MAX_CACHE_SIZE) {
    const firstKey = translationCache.keys().next().value;
    if (firstKey) translationCache.delete(firstKey);
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
 * Détecte rapidement si le texte contient majoritairement des caractères chinois.
 */
function hasChineseChars(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}

/**
 * Fallback rapide via Google Translate HTTPS endpoint (sans clé API requise).
 */
async function translateViaGooglePublic(text: string, targetLang: SupportedLang): Promise<string | null> {
  try {
    const tl = GOOGLE_TL_MAP[targetLang];
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
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
 * Traduit un lot de textes en une seule passe optimisée vers targetLang.
 */
export async function translateBatch(texts: string[], targetLang: SupportedLang): Promise<string[]> {
  if (!Array.isArray(texts) || texts.length === 0) return [];

  const results: string[] = new Array(texts.length);
  const missingIndices: number[] = [];
  const missingTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const clean = String(texts[i] || "").trim();
    if (!clean) {
      results[i] = "";
      continue;
    }
    const cached = translationCache.get(getCacheKey(clean, targetLang));
    if (cached) {
      results[i] = cached;
    } else {
      missingIndices.push(i);
      missingTexts.push(clean);
    }
  }

  if (missingTexts.length === 0) return results;

  // Traduire en lots parallèles (jusqu'à 8 simultanés via séparateur ou appels parallèles)
  const CHUNK_SIZE = 12;
  const DELIMITER = "\n[[[RAYONS_SEP]]]\n";

  for (let start = 0; start < missingTexts.length; start += CHUNK_SIZE) {
    const chunkTexts = missingTexts.slice(start, start + CHUNK_SIZE);
    const chunkIndices = missingIndices.slice(start, start + CHUNK_SIZE);

    if (chunkTexts.length === 1) {
      const tr = await translateText(chunkTexts[0], targetLang);
      results[chunkIndices[0]] = tr;
      continue;
    }

    // Essayer la traduction groupée via séparateur unique pour minimiser les requêtes réseau
    const joined = chunkTexts.join(DELIMITER);
    const translatedJoined = await translateViaGooglePublic(joined, targetLang);
    const parts = translatedJoined ? translatedJoined.split(/\s*\[\[\[RAYONS_SEP\]\]\]\s*/) : [];

    if (parts.length === chunkTexts.length) {
      for (let j = 0; j < chunkTexts.length; j++) {
        const tr = (parts[j] || chunkTexts[j]).trim();
        setCache(getCacheKey(chunkTexts[j], targetLang), tr);
        results[chunkIndices[j]] = tr;
      }
    } else {
      // Repli en parallèle élément par élément si le séparateur a été altéré
      const individual = await Promise.all(chunkTexts.map((txt) => translateText(txt, targetLang)));
      for (let j = 0; j < chunkTexts.length; j++) {
        results[chunkIndices[j]] = individual[j];
      }
    }
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
