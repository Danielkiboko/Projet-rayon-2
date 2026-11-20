import { NextRequest, NextResponse } from "next/server";
import { getMessaging } from "firebase-admin/messaging";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, initFirebaseAdmin, adminInitError } from "@/lib/firebase-admin";
import { SUPER_ADMIN_EMAILS, ADMIN_ROLES } from "@/lib/serverAuth";
import { requireAnyStaffPermission } from "@/server/guards";
import { normalizeLang, translateText, SupportedLang } from "@/lib/autoTranslate";

function classifyUserRole(u: any): "ADMIN" | "SUPPLIER" | "PARTNER" | "DRIVER" | "CLIENT" {
  const email = String(u?.email || "").toLowerCase().trim();
  const role = String(u?.role || "").toUpperCase().trim();
  if (
    SUPER_ADMIN_EMAILS.includes(email) ||
    ADMIN_ROLES.includes(role) ||
    role.includes("ADMIN") ||
    role.includes("STAFF") ||
    u?.isInternalStaff === true
  ) {
    return "ADMIN";
  }
  if (role === "PARTNER" || u?.isPartner === true || u?.accountType === "PARTNER") {
    return "PARTNER";
  }
  if (role.includes("DRIVER") || role.includes("LIVREUR") || role.includes("CHAUFFEUR")) {
    return "DRIVER";
  }
  if (
    role.includes("SUPPLIER") ||
    role.includes("FOURNISSEUR") ||
    u?.isSupplier === true ||
    u?.accountType === "SUPPLIER"
  ) {
    return "SUPPLIER";
  }
  return "CLIENT";
}

function getUserRayons(u: any): string[] {
  const set = new Set<string>();
  if (Array.isArray(u?.assignedRayons)) {
    u.assignedRayons.forEach((r: any) => typeof r === "string" && set.add(r.toLowerCase()));
  }
  if (typeof u?.rayon === "string" && u.rayon) {
    set.add(u.rayon.toLowerCase());
  }
  const role = String(u?.role || "").toLowerCase();
  if (role.includes("immo") || u?.businessType === "IMMOBILIER") set.add("immo");
  if (role.includes("saveur") || u?.businessType === "RESTAURATION") set.add("saveurs");
  if (role.includes("mode")) set.add("mode");
  if (role.includes("connect")) set.add("connect");
  return Array.from(set);
}

/**
 * GET /api/admin/push-campaigns
 * Retourne les compteurs de téléchargements/installations de l'application,
 * la répartition des appareils joignables par Push, l'annuaire pour le ciblage personnalisé
 * et l'historique des campagnes Push.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAnyStaffPermission(req, ["clients.manage", "suppliers.manage", "settings.system"]);
    if (!guard.ok) return guard.errorResponse!;

    const [devicesSnap, usersSnap, driversSnap, campaignsSnap] = await Promise.all([
      adminDb.collection("push_devices").limit(500).get(),
      adminDb.collection("users").limit(600).get(),
      adminDb.collection("drivers").limit(200).get(),
      adminDb.collection("push_campaigns").limit(60).get(),
    ]);

    const usersMap = new Map<string, any>();
    const usersDirectory: any[] = [];
    const audienceCounts = {
      clients: 0,
      suppliers: 0,
      partners: 0,
      drivers: 0,
      admins: 0,
    };

    usersSnap.forEach((docSnap: any) => {
      const d = docSnap.data() || {};
      const category = classifyUserRole(d);
      usersMap.set(docSnap.id, { id: docSnap.id, ...d, category });

      if (category === "CLIENT") audienceCounts.clients++;
      else if (category === "SUPPLIER") audienceCounts.suppliers++;
      else if (category === "PARTNER") audienceCounts.partners++;
      else if (category === "DRIVER") audienceCounts.drivers++;
      else if (category === "ADMIN") audienceCounts.admins++;

      usersDirectory.push({
        uid: docSnap.id,
        name: d.companyName || d.company || d.displayName || d.name || d.email || "Utilisateur",
        email: d.email || "",
        role: category,
        rayon: d.rayon || (Array.isArray(d.assignedRayons) ? d.assignedRayons[0] : "") || "",
        hasInstalledApp: Boolean(d.hasInstalledApp),
      });
    });

    const platformCounts = { android: 0, ios: 0, desktop: 0 };
    let installedAppsCount = 0;
    let pushEnabledDevicesCount = 0;
    const seenDriverUidsInDevices = new Set<string>();
    const devicesList: any[] = [];

    devicesSnap.forEach((docSnap: any) => {
      const d = docSnap.data() || {};
      const os = String(d.osPlatform || "desktop").toLowerCase();
      if (os === "android") platformCounts.android++;
      else if (os === "ios") platformCounts.ios++;
      else platformCounts.desktop++;

      const isInstalled = Boolean(d.isInstalledApp || os === "android" || os === "ios");
      if (isInstalled) installedAppsCount++;

      const isPushActive = Boolean(d.pushEnabled || d.fcmToken || d.active !== false);
      if (isPushActive) pushEnabledDevicesCount++;

      if (d.boundUid) seenDriverUidsInDevices.add(d.boundUid);

      const linkedUser = d.boundUid ? usersMap.get(d.boundUid) : null;
      const resolvedRole = linkedUser?.category || classifyUserRole({ role: d.boundRole, email: d.boundEmail });

      const updatedMs = d.updatedAt?.toMillis
        ? d.updatedAt.toMillis()
        : d.updatedAt?.seconds
        ? d.updatedAt.seconds * 1000
        : Date.now();

      devicesList.push({
        deviceId: docSnap.id,
        boundUid: d.boundUid || null,
        boundName: linkedUser?.companyName || linkedUser?.displayName || d.boundName || "Appareil Mobile",
        boundEmail: linkedUser?.email || d.boundEmail || "",
        boundRole: resolvedRole,
        osPlatform: os,
        isInstalledApp: Boolean(d.isInstalledApp),
        pushEnabled: isPushActive,
        hasFcmToken: Boolean(d.fcmToken),
        updatedAt: new Date(updatedMs).toISOString(),
        updatedMs,
      });
    });

    // Compter aussi les livreurs ayant téléchargé l'APK Livreur dédiée
    driversSnap.forEach((docSnap: any) => {
      if (!seenDriverUidsInDevices.has(docSnap.id)) {
        installedAppsCount++;
        pushEnabledDevicesCount++;
        platformCounts.android++;
      }
    });

    devicesList.sort((a, b) => b.updatedMs - a.updatedMs);

    const campaigns: any[] = [];
    campaignsSnap.forEach((docSnap: any) => {
      const d = docSnap.data() || {};
      const sentMs = d.sentAt?.toMillis
        ? d.sentAt.toMillis()
        : d.sentAt?.seconds
        ? d.sentAt.seconds * 1000
        : d.time || Date.now();
      campaigns.push({
        id: docSnap.id,
        campaignType: d.campaignType || "COMMUNIQUE",
        audience: d.audience || "ALL",
        title: d.title || "",
        message: d.message || "",
        promoCode: d.promoCode || null,
        discountLabel: d.discountLabel || null,
        link: d.link || "/",
        notifiedUsersCount: Number(d.notifiedUsersCount) || 0,
        pushedDevicesCount: Number(d.pushedDevicesCount) || 0,
        sentBy: d.sentBy || "Admin",
        sentAt: new Date(sentMs).toISOString(),
        sentMs,
      });
    });

    campaigns.sort((a, b) => b.sentMs - a.sentMs);

    return NextResponse.json({
      success: true,
      telemetry: {
        installedAppsCount,
        totalDevicesCount: devicesSnap.size + driversSnap.size,
        pushEnabledDevicesCount,
        byPlatform: platformCounts,
        byAudience: audienceCounts,
      },
      devices: devicesList.slice(0, 100),
      usersDirectory: usersDirectory.sort((a, b) => a.name.localeCompare(b.name)),
      campaigns,
    });
  } catch (error: any) {
    console.error("[ADMIN PUSH CAMPAIGNS GET ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/push-campaigns
 * Envoie un Push Central (Communiqué, Promotion Client, Promotion Admin/Pro)
 * ou un Push Personnalisé vers un compte précis.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireAnyStaffPermission(req, ["clients.manage", "suppliers.manage", "settings.system"]);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;
    const caller = guard.caller;

    const body = await req.json();
    const {
      campaignType = "COMMUNIQUE", // "COMMUNIQUE" | "PROMO_CLIENT" | "PROMO_PRO_ADMIN" | "PERSONALIZED"
      audience = "ALL", // "ALL" | "CLIENTS" | "SUPPLIERS_ALL" | "SUPPLIERS_IMMO" | "SUPPLIERS_MODE" | "SUPPLIERS_CONNECT" | "SUPPLIERS_SAVEURS" | "PARTNERS" | "DRIVERS" | "ADMINS" | "SINGLE_USER"
      targetUid,
      title,
      message,
      promoCode,
      discountLabel,
      link,
    } = body;

    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json(
        { success: false, error: "Le titre et le message du Push sont obligatoires." },
        { status: 400 }
      );
    }

    if (audience === "SINGLE_USER" && !targetUid) {
      return NextResponse.json(
        { success: false, error: "Veuillez sélectionner le destinataire du Push personnalisé." },
        { status: 400 }
      );
    }

    const cleanTitle = String(title).trim();
    const cleanMessage = String(message).trim();
    const cleanPromo = promoCode ? String(promoCode).trim().toUpperCase() : null;
    const cleanDiscount = discountLabel ? String(discountLabel).trim() : null;

    // Construire le message enrichi si une promotion est attachée
    const formattedPushBody = [
      cleanDiscount ? `[Offre ${cleanDiscount}]` : "",
      cleanMessage,
      cleanPromo ? `Code promo : ${cleanPromo}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const defaultLink =
      link?.trim() ||
      (campaignType === "PROMO_CLIENT"
        ? "/"
        : audience === "PARTNERS"
        ? "/partner"
        : audience.startsWith("SUPPLIERS")
        ? "/supplier"
        : "/dashboard");

    // 1. Sélectionner les utilisateurs cibles selon `audience`
    const [usersSnap, devicesSnap] = await Promise.all([
      adminDb.collection("users").get(),
      adminDb.collection("push_devices").get(),
    ]);

    const targetUserIds = new Set<string>();
    const tokenSet = new Set<string>();

    const matchesAudience = (uData: any, uid: string): boolean => {
      if (audience === "SINGLE_USER") return uid === targetUid;
      const cat = classifyUserRole(uData);
      if (audience === "ALL") return true;
      if (audience === "CLIENTS") return cat === "CLIENT";
      if (audience === "PARTNERS") return cat === "PARTNER";
      if (audience === "DRIVERS") return cat === "DRIVER";
      if (audience === "ADMINS") return cat === "ADMIN";
      if (audience === "SUPPLIERS_ALL") return cat === "SUPPLIER";
      if (audience.startsWith("SUPPLIERS_")) {
        if (cat !== "SUPPLIER") return false;
        const targetRayon = audience.replace("SUPPLIERS_", "").toLowerCase();
        return getUserRayons(uData).includes(targetRayon);
      }
      return false;
    };

    const userLangMap = new Map<string, SupportedLang>();
    const tokensByLang = new Map<SupportedLang, Set<string>>([
      ["fr", new Set()],
      ["en", new Set()],
      ["zh", new Set()],
    ]);
    const neededLangs = new Set<SupportedLang>();

    usersSnap.forEach((docSnap: any) => {
      const u = docSnap.data() || {};
      if (matchesAudience(u, docSnap.id)) {
        targetUserIds.add(docSnap.id);
        const uLang = normalizeLang(u.preferredLanguage || u.language);
        userLangMap.set(docSnap.id, uLang);
        neededLangs.add(uLang);
        if (Array.isArray(u.fcmTokens)) {
          u.fcmTokens.forEach((t: string) => {
            if (typeof t === "string" && t.trim()) {
              tokenSet.add(t.trim());
              tokensByLang.get(uLang)?.add(t.trim());
            }
          });
        }
      }
    });

    // Inclure également les appareils liés dans `push_devices`
    devicesSnap.forEach((docSnap: any) => {
      const d = docSnap.data() || {};
      const bUid = d.boundUid;
      let includeDevice = false;
      let devLang: SupportedLang = "fr";

      if (bUid && targetUserIds.has(bUid)) {
        includeDevice = true;
        devLang = userLangMap.get(bUid) || "fr";
      } else if (!bUid && (audience === "ALL" || audience === "CLIENTS") && campaignType !== "PROMO_PRO_ADMIN") {
        // Visiteur mobile ayant installé l'app -> reçoit les promos clients et push globaux
        includeDevice = true;
        devLang = normalizeLang(d.preferredLanguage || d.language);
      }

      if (includeDevice && typeof d.fcmToken === "string" && d.fcmToken.trim()) {
        tokenSet.add(d.fcmToken.trim());
        tokensByLang.get(devLang)?.add(d.fcmToken.trim());
        neededLangs.add(devLang);
      }
    });

    const uidsList = Array.from(targetUserIds);
    const nowMs = Date.now();

    // Traduire la campagne une fois par langue requise (FR / EN / 中文)
    if (neededLangs.size === 0) neededLangs.add("fr");
    const localizedCampaign = new Map<SupportedLang, { title: string; body: string }>();
    await Promise.all(
      Array.from(neededLangs).map(async (langCode) => {
        const [trTitle, trBody] = await Promise.all([
          translateText(cleanTitle, langCode),
          translateText(formattedPushBody, langCode),
        ]);
        localizedCampaign.set(langCode, {
          title: trTitle || cleanTitle,
          body: trBody || formattedPushBody,
        });
      })
    );

    // 2. Créer les notifications dans `inapp_notifications` dans la langue de préférence de chaque compte
    const notifType =
      campaignType === "COMMUNIQUE"
        ? "broadcast"
        : campaignType === "PROMO_CLIENT" || campaignType === "PROMO_PRO_ADMIN"
        ? "system"
        : "chat";

    for (let i = 0; i < uidsList.length; i += 400) {
      const chunk = uidsList.slice(i, i + 400);
      const batch = adminDb.batch();
      for (const uid of chunk) {
        const uLang = userLangMap.get(uid) || "fr";
        const loc = localizedCampaign.get(uLang) || { title: cleanTitle, body: formattedPushBody };
        const ref = adminDb.collection("inapp_notifications").doc();
        batch.set(ref, {
          userId: uid,
          clientId: uid,
          supplierId: uid,
          type: notifType,
          campaignType,
          title: loc.title,
          message: loc.body,
          originalTitle: cleanTitle,
          originalMessage: formattedPushBody,
          targetLanguage: uLang,
          promoCode: cleanPromo,
          discountLabel: cleanDiscount,
          link: defaultLink,
          read: false,
          seen: false,
          sentByAdmin: true,
          sentBy: caller.email || "Administration Rayons.net",
          time: nowMs,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      await batch.commit();
    }

    // 3. Envoyer via Firebase Cloud Messaging (FCM) par langue préférée
    const allTokens = Array.from(tokenSet);
    let fcmSuccessCount = 0;

    if (allTokens.length > 0) {
      try {
        initFirebaseAdmin();
        if (!adminInitError) {
          const messaging = getMessaging();
          for (const [langCode, langTokenSet] of tokensByLang.entries()) {
            const langTokens = Array.from(langTokenSet);
            if (langTokens.length === 0) continue;
            const loc = localizedCampaign.get(langCode) || { title: cleanTitle, body: formattedPushBody };

            for (let i = 0; i < langTokens.length; i += 450) {
              const tokenChunk = langTokens.slice(i, i + 450);
              const res = await messaging.sendEachForMulticast({
                tokens: tokenChunk,
                notification: {
                  title: loc.title,
                  body: loc.body,
                },
                data: {
                  title: loc.title,
                  body: loc.body,
                  url: defaultLink,
                  link: defaultLink,
                  campaignType,
                  promoCode: cleanPromo || "",
                },
                webpush: {
                  headers: { Urgency: "high" },
                  notification: {
                    title: loc.title,
                    body: loc.body,
                    icon: "/icon-512.png",
                    badge: "/icon.png",
                    vibrate: [200, 100, 200],
                    renotify: true,
                  },
                  fcmOptions: {
                    link: defaultLink,
                  },
                },
              });
              fcmSuccessCount += res.successCount;
            }
          }
        }
      } catch (fcmErr) {
        console.warn("[ADMIN PUSH CAMPAIGN] FCM multicast warning:", fcmErr);
      }
    }

    // 4. Enregistrer la campagne dans `push_campaigns`
    const campaignDoc = await adminDb.collection("push_campaigns").add({
      campaignType,
      audience,
      targetUid: audience === "SINGLE_USER" ? targetUid : null,
      title: cleanTitle,
      message: formattedPushBody,
      promoCode: cleanPromo,
      discountLabel: cleanDiscount,
      link: defaultLink,
      notifiedUsersCount: uidsList.length,
      pushedDevicesCount: Math.max(fcmSuccessCount, uidsList.length),
      sentBy: caller.email || caller.uid,
      time: nowMs,
      sentAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      campaignId: campaignDoc.id,
      notifiedUsersCount: uidsList.length,
      pushedDevicesCount: Math.max(fcmSuccessCount, uidsList.length),
      message: `Push envoyé avec succès à ${uidsList.length} compte(s) !`,
    });
  } catch (error: any) {
    console.error("[ADMIN PUSH CAMPAIGNS POST ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
