import { getMessaging } from "firebase-admin/messaging";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, initFirebaseAdmin, adminInitError } from "@/lib/firebase-admin";
import { SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";

export interface DispatchPushParams {
  userId: string;
  title: string;
  message: string;
  type?: "order" | "booking" | "delivery" | "review" | "chat" | "system" | "COMMISSION_CREDITED";
  link?: string;
  clientId?: string;
  supplierId?: string;
  skipInApp?: boolean;
  tag?: string;
}

/**
 * Résout les UIDs cibles (si userId === "admin", cible les comptes Super Admin).
 */
async function resolveTargetUserIds(rawUserId: string): Promise<string[]> {
  if (!rawUserId || rawUserId === "GUEST") return [];

  if (rawUserId !== "admin") {
    return [rawUserId];
  }

  const adminUids = new Set<string>();
  try {
    const [byRoleSnap, byEmailSnap] = await Promise.all([
      adminDb.collection("users").where("role", "in", ["SUPER_ADMIN", "superAdmin", "ADMIN"]).limit(10).get(),
      SUPER_ADMIN_EMAILS.length > 0
        ? adminDb.collection("users").where("email", "in", SUPER_ADMIN_EMAILS.slice(0, 10)).get()
        : Promise.resolve({ docs: [] } as any),
    ]);

    byRoleSnap.docs.forEach((d: any) => adminUids.add(d.id));
    byEmailSnap.docs.forEach((d: any) => adminUids.add(d.id));
  } catch (e) {
    console.warn("[PushNotifications] Could not resolve admin UIDs:", e);
  }

  return Array.from(adminUids);
}

/**
 * Crée une notification dans `inapp_notifications` ET envoie une notification Push (FCM)
 * à tous les téléphones/appareils associés au compte (même si l'utilisateur s'est déconnecté sur le téléphone).
 */
export async function dispatchAccountNotification(params: DispatchPushParams): Promise<{
  notifiedUsers: number;
  pushedTokens: number;
}> {
  const {
    userId,
    title,
    message,
    type = "system",
    link = "/",
    clientId,
    supplierId,
    skipInApp = false,
    tag,
  } = params;

  const targetUids = await resolveTargetUserIds(userId);
  if (targetUids.length === 0) {
    return { notifiedUsers: 0, pushedTokens: 0 };
  }

  const nowMs = Date.now();

  // 1. Enregistrer dans `inapp_notifications` pour chaque UID cible
  if (!skipInApp) {
    try {
      const batch = adminDb.batch();
      for (const uid of targetUids) {
        const ref = adminDb.collection("inapp_notifications").doc();
        batch.set(ref, {
          userId: uid,
          clientId: clientId || uid,
          supplierId: supplierId || uid,
          type,
          title,
          message,
          link,
          read: false,
          seen: false,
          time: nowMs,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    } catch (inAppErr) {
      console.warn("[PushNotifications] In-app notification write warning:", inAppErr);
    }
  }

  // 2. Collecter tous les tokens FCM des appareils liés à ces comptes (même déconnectés)
  const tokenSet = new Set<string>();
  const tokenToOwnerMap = new Map<string, string>();

  try {
    for (const uid of targetUids) {
      const [userDoc, devicesSnap] = await Promise.all([
        adminDb.collection("users").doc(uid).get(),
        adminDb.collection("push_devices").where("boundUid", "==", uid).get(),
      ]);

      if (userDoc.exists) {
        const uData = userDoc.data() || {};
        if (Array.isArray(uData.fcmTokens)) {
          uData.fcmTokens.forEach((t: string) => {
            if (typeof t === "string" && t.trim()) {
              tokenSet.add(t.trim());
              tokenToOwnerMap.set(t.trim(), uid);
            }
          });
        }
      }

      devicesSnap.forEach((docSnap: any) => {
        const dData = docSnap.data() || {};
        if (typeof dData.fcmToken === "string" && dData.fcmToken.trim()) {
          tokenSet.add(dData.fcmToken.trim());
          tokenToOwnerMap.set(dData.fcmToken.trim(), uid);
        }
      });
    }
  } catch (tokenErr) {
    console.warn("[PushNotifications] Error collecting FCM tokens:", tokenErr);
  }

  const tokens = Array.from(tokenSet);
  if (tokens.length === 0) {
    return { notifiedUsers: targetUids.length, pushedTokens: 0 };
  }

  // 3. Envoyer la notification Push via Firebase Cloud Messaging (Admin SDK)
  let pushedCount = 0;
  try {
    initFirebaseAdmin();
    if (!adminInitError) {
      const messaging = getMessaging();
      const response = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title,
          body: message,
        },
        data: {
          title,
          body: message,
          url: link,
          link,
          type,
          tag: tag || `rayons-${type}-${nowMs}`,
        },
        webpush: {
          headers: {
            Urgency: "high",
          },
          notification: {
            title,
            body: message,
            icon: "/icon-512.png",
            badge: "/icon.png",
            vibrate: [200, 100, 200],
            tag: tag || `rayons-${type}-${nowMs}`,
            renotify: true,
          },
          fcmOptions: {
            link,
          },
        },
        android: {
          priority: "high",
          notification: {
            sound: "default",
            priority: "max",
          },
        },
      });

      pushedCount = response.successCount;

      // Nettoyer les tokens expirés ou invalides
      const invalidTokens: string[] = [];
      response.responses.forEach((res, idx) => {
        if (!res.success && res.error) {
          const code = res.error.code || "";
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalidTokens.push(tokens[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        for (const badToken of invalidTokens) {
          const ownerUid = tokenToOwnerMap.get(badToken);
          if (ownerUid) {
            adminDb
              .collection("users")
              .doc(ownerUid)
              .update({
                fcmTokens: FieldValue.arrayRemove(badToken),
              })
              .catch(() => {});
          }
        }
      }
    }
  } catch (fcmErr) {
    console.warn("[PushNotifications] FCM multicast warning:", fcmErr);
  }

  return { notifiedUsers: targetUids.length, pushedTokens: pushedCount };
}
