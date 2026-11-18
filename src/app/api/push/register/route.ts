import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";

function detectOsPlatform(ua: string): "android" | "ios" | "desktop" {
  const lower = (ua || "").toLowerCase();
  if (lower.includes("android")) return "android";
  if (lower.includes("iphone") || lower.includes("ipad") || lower.includes("ipod")) return "ios";
  return "desktop";
}

/**
 * POST /api/push/register
 * Associe durablement un téléphone / appareil au compte connecté (`boundUid`),
 * enregistre la télémétrie d'installation de l'application (`isInstalledApp`, `osPlatform`, `pushEnabled`)
 * et stocke le jeton FCM (`fcmToken`) pour les notifications Push même après déconnexion.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    const body = await req.json().catch(() => ({}));

    const rawDeviceId = String(body.deviceId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
    if (!rawDeviceId && !caller?.uid) {
      return NextResponse.json({ success: false, error: "deviceId requis." }, { status: 400 });
    }

    const deviceId = rawDeviceId || `dev_${caller!.uid.slice(0, 10)}_${Date.now().toString(36)}`;
    const fcmToken = typeof body.fcmToken === "string" && body.fcmToken.trim() ? body.fcmToken.trim() : null;
    const userAgent = String(body.userAgent || req.headers.get("user-agent") || "").slice(0, 250);
    const osPlatform = body.osPlatform || detectOsPlatform(userAgent);
    const platform = String(body.platform || (osPlatform === "desktop" ? "desktop" : "mobile")).slice(0, 60);
    const isInstalledApp = Boolean(body.isInstalledApp);
    const pushEnabled = Boolean(body.pushEnabled || fcmToken);

    const deviceRef = adminDb.collection("push_devices").doc(deviceId);
    const existingSnap = await deviceRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() || {} : {};

    const deviceSecret =
      typeof existingData.deviceSecret === "string" && existingData.deviceSecret.length >= 16
        ? existingData.deviceSecret
        : randomBytes(24).toString("hex");

    // Préserver le compte lié à ce téléphone même si la requête est envoyée hors session
    const boundUid = caller?.uid || existingData.boundUid || null;
    const boundEmail = caller?.email || caller?.data?.email || existingData.boundEmail || "";
    const boundName =
      caller?.data?.companyName ||
      caller?.data?.company ||
      caller?.data?.displayName ||
      caller?.data?.name ||
      existingData.boundName ||
      boundEmail ||
      "Visiteur Mobile";
    const boundRole = String(caller?.role || caller?.data?.role || existingData.boundRole || "CLIENT").toUpperCase();
    const boundRayon =
      caller?.data?.rayon ||
      (Array.isArray(caller?.data?.assignedRayons) ? caller?.data?.assignedRayons[0] : null) ||
      existingData.boundRayon ||
      null;

    // Une fois installée (PWA standalone / appinstalled), la propriété reste true
    const finalIsInstalledApp = Boolean(isInstalledApp || existingData.isInstalledApp);

    const devicePayload: Record<string, any> = {
      deviceId,
      boundUid,
      boundEmail,
      boundName,
      boundRole,
      boundRayon,
      deviceSecret,
      platform,
      osPlatform,
      isInstalledApp: finalIsInstalledApp,
      pushEnabled: Boolean(pushEnabled || existingData.pushEnabled),
      userAgent,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (!existingSnap.exists) {
      devicePayload.createdAt = FieldValue.serverTimestamp();
    }
    if (finalIsInstalledApp && !existingData.installedAt) {
      devicePayload.installedAt = FieldValue.serverTimestamp();
    }
    if (fcmToken) {
      devicePayload.fcmToken = fcmToken;
    }

    await deviceRef.set(devicePayload, { merge: true });

    // Si un utilisateur est connecté, synchroniser aussi sur sa fiche `users/{uid}`
    if (caller?.uid) {
      const userUpdate: Record<string, any> = {
        lastBoundDeviceId: deviceId,
        lastMobileConnectedAt: FieldValue.serverTimestamp(),
        hasInstalledApp: finalIsInstalledApp,
      };
      if (fcmToken) {
        userUpdate.fcmTokens = FieldValue.arrayUnion(fcmToken);
      }
      await adminDb.collection("users").doc(caller.uid).set(userUpdate, { merge: true });
    }

    return NextResponse.json({
      success: true,
      boundUid,
      boundEmail,
      boundName,
      boundRole,
      deviceId,
      deviceSecret,
      isInstalledApp: finalIsInstalledApp,
    });
  } catch (error: any) {
    console.error("[PUSH REGISTER POST ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

/**
 * GET /api/push/register?uid=...&deviceId=...&deviceSecret=...&since=...
 * Permet à un téléphone lié en interne à un compte de continuer à recevoir ses notifications
 * (messages, ventes, commandes, communiqués, promotions) même si la session a été déconnectée.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = (searchParams.get("uid") || "").trim();
    const deviceId = (searchParams.get("deviceId") || "").replace(/[^A-Za-z0-9_-]/g, "").trim();
    const deviceSecret = (searchParams.get("deviceSecret") || "").trim();
    const since = Number(searchParams.get("since")) || Date.now() - 5 * 60 * 1000;

    if (!uid || !deviceId || !deviceSecret) {
      return NextResponse.json({ success: false, error: "Paramètres d'appareil manquants." }, { status: 400 });
    }

    const deviceSnap = await adminDb.collection("push_devices").doc(deviceId).get();
    if (!deviceSnap.exists) {
      return NextResponse.json({ success: false, error: "Appareil non enregistré." }, { status: 403 });
    }

    const deviceData = deviceSnap.data() || {};
    if (deviceData.boundUid !== uid || deviceData.deviceSecret !== deviceSecret) {
      return NextResponse.json({ success: false, error: "Jeton d'appareil non valide." }, { status: 403 });
    }

    // Récupérer toutes les notifications non lues de ce compte (inapp_notifications)
    const [byUserSnap, byClientSnap, bySupplierSnap] = await Promise.all([
      adminDb.collection("inapp_notifications").where("userId", "==", uid).where("read", "==", false).get(),
      adminDb.collection("inapp_notifications").where("clientId", "==", uid).where("read", "==", false).get(),
      adminDb.collection("inapp_notifications").where("supplierId", "==", uid).where("read", "==", false).get(),
    ]);

    const itemsMap = new Map<string, any>();
    const allDocs = [...byUserSnap.docs, ...byClientSnap.docs, ...bySupplierSnap.docs];

    for (const d of allDocs) {
      if (itemsMap.has(d.id)) continue;
      const data = d.data() || {};
      const timeMs =
        Number(data.time) ||
        (data.createdAt?.toMillis ? data.createdAt.toMillis() : data.createdAt?.seconds ? data.createdAt.seconds * 1000 : 0);

      if (!data.read && timeMs > since) {
        itemsMap.set(d.id, {
          id: d.id,
          title: data.title || "Notification Rayons.net",
          message: data.message || "",
          type: data.type || "system",
          link: data.link || "/login",
          time: timeMs,
        });
      }
    }

    const notifications = Array.from(itemsMap.values()).sort((a, b) => a.time - b.time);

    return NextResponse.json({
      success: true,
      notifications,
      serverTime: Date.now(),
    });
  } catch (error: any) {
    console.error("[PUSH REGISTER GET ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
