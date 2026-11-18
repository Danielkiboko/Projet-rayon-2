import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller, canActForSupplier } from "@/lib/serverAuth";
import { dispatchAccountNotification } from "@/lib/pushNotifications";

/**
 * POST /api/push/notify
 * Déclenche une notification in-app + Push Mobile (FCM / Service Worker)
 * lorsqu'un utilisateur reçoit un message dans le chat ou un événement de compte.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.uid) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const body = await req.json();
    const { eventType, chatId, text, senderName: customSenderName } = body;

    if (eventType === "TEST_PUSH") {
      const targetUid = (body.targetUid && caller.isAdmin) ? String(body.targetUid) : caller.uid;
      const res = await dispatchAccountNotification({
        userId: targetUid,
        clientId: targetUid,
        supplierId: targetUid,
        type: "system",
        title: body.title || "🔔 Test Notification Push — Rayons.net",
        message:
          body.text ||
          "Votre système de notifications Push en temps réel fonctionne parfaitement sur cet appareil !",
        link: body.link || "/admin/dashboard",
        tag: `test-push-${Date.now()}`,
      });
      return NextResponse.json({
        success: true,
        ...res,
      });
    }

    if (eventType === "CHAT_MESSAGE") {
      if (!chatId || !text) {
        return NextResponse.json({ success: false, error: "chatId et text requis." }, { status: 400 });
      }

      const chatSnap = await adminDb.collection("chats").doc(String(chatId)).get();
      if (!chatSnap.exists) {
        return NextResponse.json({ success: false, error: "Conversation introuvable." }, { status: 404 });
      }

      const chat = chatSnap.data() || {};
      const isClientSender = caller.uid === chat.clientId;
      const isSupplierSender =
        caller.uid === chat.supplierId ||
        canActForSupplier(caller, chat.supplierId || "") ||
        caller.isAdmin;

      if (!isClientSender && !isSupplierSender) {
        return NextResponse.json({ success: false, error: "Non participant à cette conversation." }, { status: 403 });
      }

      const senderLabel =
        customSenderName ||
        (isClientSender
          ? chat.clientName || caller.data?.displayName || caller.email || "Client"
          : chat.supplierName || caller.data?.company || caller.data?.displayName || "Fournisseur Rayons");

      const recipientUid = isClientSender ? chat.supplierId || "admin" : chat.clientId;
      if (!recipientUid || recipientUid === caller.uid) {
        return NextResponse.json({ success: true, skipped: true });
      }

      const productContext = chat.productName || chat.propertyTitle ? ` (${chat.productName || chat.propertyTitle})` : "";
      const link = isClientSender
        ? `/supplier/messages?chatId=${encodeURIComponent(chatId)}`
        : `/dashboard?tab=messages&chatId=${encodeURIComponent(chatId)}`;

      const cleanPreview = String(text).trim().slice(0, 140);

      const res = await dispatchAccountNotification({
        userId: recipientUid,
        clientId: isClientSender ? undefined : recipientUid,
        supplierId: isClientSender ? recipientUid : undefined,
        type: "chat",
        title: `💬 Nouveau message de ${senderLabel}${productContext}`,
        message: cleanPreview,
        link,
        tag: `chat-${chatId}`,
      });

      return NextResponse.json({
        success: true,
        ...res,
      });
    }

    return NextResponse.json({ success: false, error: "eventType non supporté." }, { status: 400 });
  } catch (error: any) {
    console.error("[PUSH NOTIFY API ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
