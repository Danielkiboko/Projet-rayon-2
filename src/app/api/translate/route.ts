import { NextRequest, NextResponse } from "next/server";
import {
  translateText,
  translateBatch,
  translateToAllLanguages,
  normalizeLang,
} from "@/lib/autoTranslate";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";

/**
 * POST /api/translate
 * Traduit dynamiquement des textes, messages de chat, ou libellés d'interface
 * en Français (fr), Anglais (en) ou Chinois Simplifié (zh).
 *
 * Modes supportés :
 * - { text: string, targetLang: "fr"|"en"|"zh" } -> { translated: string }
 * - { texts: string[], targetLang: "fr"|"en"|"zh" } -> { translations: string[] }
 * - { text: string, allLanguages: true, chatId?: string, messageId?: string } -> { translations: { fr, en, zh } }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, texts, targetLang, allLanguages, chatId, messageId } = body || {};

    if (allLanguages && typeof text === "string") {
      const translations = await translateToAllLanguages(text);

      // Si un chatId + messageId est fourni par un utilisateur authentifié, sauvegarder les traductions en BDD
      if (chatId && messageId) {
        const caller = await getServerCaller(req);
        if (caller) {
          try {
            await initFirebaseAdmin();
            await adminDb
              .collection("chats")
              .doc(String(chatId))
              .collection("messages")
              .doc(String(messageId))
              .set({ translations }, { merge: true });
          } catch (persistErr) {
            console.warn("[/api/translate] persist translations warning:", persistErr);
          }
        }
      }

      return NextResponse.json({ success: true, translations });
    }

    const lang = normalizeLang(targetLang);

    if (Array.isArray(texts)) {
      const limited = texts.slice(0, 150).map((t) => String(t || "").slice(0, 1200));
      const translations = await translateBatch(limited, lang);
      return NextResponse.json({ success: true, targetLang: lang, translations });
    }

    if (typeof text === "string") {
      const translated = await translateText(text.slice(0, 4000), lang);
      return NextResponse.json({ success: true, targetLang: lang, translated });
    }

    return NextResponse.json(
      { success: false, error: "Paramètre 'text' ou 'texts' requis." },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[/api/translate ERROR]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Erreur lors de la traduction." },
      { status: 500 }
    );
  }
}
