import { getMessaging } from "firebase-admin/messaging";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, initFirebaseAdmin, adminInitError } from "@/lib/firebase-admin";
import { SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";
import { normalizeLang, translateText, SupportedLang } from "@/lib/autoTranslate";

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

  // 1. Collecter les profils (langue préférée + tokens FCM) des comptes cibles
  const userLangMap = new Map<string, SupportedLang>();
  const tokensByLang = new Map<SupportedLang, Set<string>>([
    ["fr", new Set()],
    ["en", new Set()],
    ["zh", new Set()],
  ]);
  const tokenToOwnerMap = new Map<string, string>();
  const neededLangs = new Set<SupportedLang>();

  try {
    for (const uid of targetUids) {
      const [userDoc, devicesSnap] = await Promise.all([
        adminDb.collection("users").doc(uid).get(),
        adminDb.collection("push_devices").where("boundUid", "==", uid).get(),
      ]);

      let uLang: SupportedLang = "fr";
      if (userDoc.exists) {
        const uData = userDoc.data() || {};
        uLang = normalizeLang(uData.preferredLanguage || uData.language);
        if (Array.isArray(uData.fcmTokens)) {
          uData.fcmTokens.forEach((t: string) => {
            if (typeof t === "string" && t.trim()) {
              tokensByLang.get(uLang)?.add(t.trim());
              tokenToOwnerMap.set(t.trim(), uid);
            }
          });
        }
      }
      userLangMap.set(uid, uLang);
      neededLangs.add(uLang);

      devicesSnap.forEach((docSnap: any) => {
        const dData = docSnap.data() || {};
        if (typeof dData.fcmToken === "string" && dData.fcmToken.trim()) {
          tokensByLang.get(uLang)?.add(dData.fcmToken.trim());
          tokenToOwnerMap.set(dData.fcmToken.trim(), uid);
        }
      });
    }
  } catch (tokenErr) {
    console.warn("[PushNotifications] Error collecting user languages/tokens:", tokenErr);
    targetUids.forEach((uid) => {
      if (!userLangMap.has(uid)) userLangMap.set(uid, "fr");
    });
    neededLangs.add("fr");
  }

  // 2. Traduire automatiquement title + message pour chaque langue préférée détectée
  const localizedPayloads = new Map<SupportedLang, { title: string; message: string }>();
  await Promise.all(
    Array.from(neededLangs).map(async (langCode) => {
      if (langCode === "fr") {
        // Toujours traduire vers FR au cas où l'expéditeur a écrit en chinois ou en anglais
        const [trTitle, trMsg] = await Promise.all([
          translateText(title, "fr"),
          translateText(message, "fr"),
        ]);
        localizedPayloads.set("fr", { title: trTitle || title, message: trMsg || message });
      } else {
        const [trTitle, trMsg] = await Promise.all([
          translateText(title, langCode),
          translateText(message, langCode),
        ]);
        localizedPayloads.set(langCode, { title: trTitle || title, message: trMsg || message });
      }
    })
  );

  // 3. Enregistrer dans `inapp_notifications` dans la langue préférée de chaque destinataire
  if (!skipInApp) {
    try {
      const batch = adminDb.batch();
      for (const uid of targetUids) {
        const uLang = userLangMap.get(uid) || "fr";
        const loc = localizedPayloads.get(uLang) || { title, message };
        const ref = adminDb.collection("inapp_notifications").doc();
        batch.set(ref, {
          userId: uid,
          clientId: clientId || uid,
          supplierId: supplierId || uid,
          type,
          title: loc.title,
          message: loc.message,
          originalTitle: title,
          originalMessage: message,
          targetLanguage: uLang,
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

  const totalTokensCount =
    (tokensByLang.get("fr")?.size || 0) +
    (tokensByLang.get("en")?.size || 0) +
    (tokensByLang.get("zh")?.size || 0);

  if (totalTokensCount === 0) {
    return { notifiedUsers: targetUids.length, pushedTokens: 0 };
  }

  // 4. Envoyer la notification Push via FCM groupée par langue préférée du destinataire
  let pushedCount = 0;
  try {
    initFirebaseAdmin();
    if (!adminInitError) {
      const messaging = getMessaging();
      for (const [langCode, tokenSetForLang] of tokensByLang.entries()) {
        const langTokens = Array.from(tokenSetForLang);
        if (langTokens.length === 0) continue;
        const loc = localizedPayloads.get(langCode) || { title, message };

        const response = await messaging.sendEachForMulticast({
          tokens: langTokens,
          notification: {
            title: loc.title,
            body: loc.message,
          },
          data: {
            title: loc.title,
            body: loc.message,
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
              title: loc.title,
              body: loc.message,
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
        });

        pushedCount += response.successCount;

        // Nettoyer les tokens expirés ou invalides
        response.responses.forEach((res, idx) => {
          if (!res.success && res.error) {
            const code = res.error.code || "";
            if (
              code === "messaging/registration-token-not-registered" ||
              code === "messaging/invalid-registration-token"
            ) {
              const badToken = langTokens[idx];
              const ownerUid = tokenToOwnerMap.get(badToken);
              if (ownerUid) {
                adminDb
                  .collection("users")
                  .doc(ownerUid)
                  .update({ fcmTokens: FieldValue.arrayRemove(badToken) })
                  .catch(() => {});
              }
            }
          }
        });
      }
    }
  } catch (fcmErr) {
    console.warn("[PushNotifications] FCM send warning:", fcmErr);
  }

  return { notifiedUsers: targetUids.length, pushedTokens: pushedCount };
}
