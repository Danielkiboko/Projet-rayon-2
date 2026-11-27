import { safeApiError } from "@/lib/sanitize";
import { NextRequest, NextResponse } from "next/server";
import {
  translateText,
  translateBatch,
  translateToAllLanguages,
  normalizeLang,
} from "@/lib/autoTranslate";
import { adminDb, initFirebaseAdmin } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * POST /api/translate
 * Traduit dynamiquement des textes, messages de chat, ou libellés d'interface
 * en Français (fr), Anglais (en) ou Chinois Simplifié (zh).
 *
 * Sécurité :
 * - Rate-limit distribué (60 req/min/IP via Redis L2 + L1) contre abus CPU/quota.
 * - Contrôle strict de participation au chat avant toute écriture de `translations`.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimited = await enforceRateLimit(req, "translate", 60, 60);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const { text, texts, targetLang, allLanguages, chatId, messageId } = body || {};

    if (allLanguages && typeof text === "string") {
      const translations = await translateToAllLanguages(text.slice(0, 4000));

      // Si un chatId + messageId est fourni par un utilisateur authentifié, vérifier qu'il est participant du chat
      if (chatId && messageId) {
        const caller = await getServerCaller(req);
        if (caller) {
          try {
            await initFirebaseAdmin();
            const chatRef = adminDb.collection("chats").doc(String(chatId));
            const chatSnap = await chatRef.get();
            const chatData = chatSnap.exists ? chatSnap.data() || {} : null;
            const participants: string[] = Array.isArray(chatData?.participants) ? chatData.participants : [];
            const isParticipant =
              caller.isAdmin ||
              participants.includes(caller.uid) ||
              chatData?.clientId === caller.uid ||
              chatData?.supplierId === caller.uid ||
              (caller.parentSupplierId && chatData?.supplierId === caller.parentSupplierId);

            if (chatData && isParticipant) {
              await chatRef
                .collection("messages")
                .doc(String(messageId))
                .set({ translations }, { merge: true });
            }
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
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur lors de la traduction.") }, { status: 500 });
  }
}
