import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";
import { sendEmail } from "@/lib/notifications";

// Automated Cron will hit this route (e.g. every 5-10 minutes)
export async function GET(req: Request) {
  try {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const tsTenMinutesAgo = Timestamp.fromDate(tenMinutesAgo);

    // Get chats that have unread messages for more than 10 minutes and haven't been notified
    const q = query(
      collection(db, "chats"),
      where("lastMessageTime", "<", tsTenMinutesAgo),
      where("notified", "==", false)
    );

    const snap = await getDocs(q);
    
    if (snap.empty) {
      return NextResponse.json({ success: true, message: "No pending notifications." });
    }

    const tasks: Promise<any>[] = [];

    for (const chatDoc of snap.docs) {
      const data = chatDoc.data();
      const chatId = chatDoc.id;
      
      let targetUserId = "";
      let isSupplier = false;

      if (data.unreadSupplier) {
        targetUserId = data.supplierId;
        isSupplier = true;
      } else if (data.unreadClient) {
        targetUserId = data.clientId;
        isSupplier = false;
      } else {
        continue; // Should not happen but just in case
      }

      // Fetch user email
      const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", targetUserId)));
      if (!userDoc.empty) {
        const email = userDoc.docs[0].data().email;
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
      tasks.push(updateDoc(doc(db, "chats", chatId), { notified: true }));
    }

    await Promise.allSettled(tasks);

    return NextResponse.json({ success: true, message: `Dispatched ${tasks.length / 2} notifications.` });
  } catch (error: any) {
    console.error("Cron Notifications Error:", error);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
