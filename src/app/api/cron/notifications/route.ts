import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { sendEmail } from "@/lib/notifications";
import { getServerCaller } from "@/lib/serverAuth";

const CRON_SECRET = process.env.CRON_SECRET;

// Automated Cron will hit this route (e.g. every 5-10 minutes)
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const hasValidCronSecret =
      Boolean(CRON_SECRET && CRON_SECRET !== "REMPLACEZ_PAR_VOTRE_SECRET") &&
      authHeader === `Bearer ${CRON_SECRET}`;

    if (!hasValidCronSecret) {
      const caller = await getServerCaller(req);
      if (!caller || !caller.isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const tsTenMinutesAgo = Timestamp.fromDate(tenMinutesAgo);

    // Get chats that have unread messages for more than 10 minutes and haven't been notified
    const snap = await adminDb
      .collection("chats")
      .where("lastMessageTime", "<", tsTenMinutesAgo)
      .where("notified", "==", false)
      .get();
    
    if (snap.empty) {
      return NextResponse.json({ success: true, message: "No pending notifications." });
    }

    const tasks: Promise<any>[] = [];

    for (const chatDoc of snap.docs) {
      const data = chatDoc.data();
      const chatId = chatDoc.id;
      
      let targetUserId = "";

      if (data.unreadSupplier) {
        targetUserId = data.supplierId;
      } else if (data.unreadClient) {
        targetUserId = data.clientId;
      } else {
        continue; // Should not happen but just in case
      }

      // Fetch user email
      const userSnap = await adminDb.collection("users").doc(targetUserId).get();
      if (userSnap.exists) {
        const email = userSnap.data()?.email;
        if (email) {
          const propertyName = data.propertyTitle || data.productName || "un produit";
          tasks.push(sendEmail(
            email,
            `Nouveau message non lu sur Rayon`,
            `Vous avez reçu un message concernant ${propertyName}. Connectez-vous sur la plateforme pour y répondre.`
          ));
        }
      }

      // Mark as notified
      tasks.push(adminDb.collection("chats").doc(chatId).update({ notified: true }));
    }

    await Promise.allSettled(tasks);

    return NextResponse.json({ success: true, message: `Dispatched ${tasks.length / 2} notifications.` });
  } catch (error: any) {
    console.error("Cron Notifications Error:", error);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
