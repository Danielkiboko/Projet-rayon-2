import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";

/**
 * POST /api/push/register
 * Associe durablement un téléphone / appareil au compte connecté (`boundUid`)
 * et enregistre son jeton FCM (`fcmToken`) pour les notifications Push même après déconnexion.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller || !caller.uid) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const body = await req.json();
    const rawDeviceId = String(body.deviceId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
    const deviceId = rawDeviceId || `dev_${caller.uid.slice(0, 10)}_${Date.now().toString(36)}`;
    const fcmToken = typeof body.fcmToken === "string" && body.fcmToken.trim() ? body.fcmToken.trim() : null;
    const platform = String(body.platform || "mobile_web").slice(0, 60);
    const userAgent = String(body.userAgent || req.headers.get("user-agent") || "").slice(0, 250);

    const deviceRef = adminDb.collection("push_devices").doc(deviceId);
    const existingSnap = await deviceRef.get();
    const existingData = existingSnap.exists ? existingSnap.data() || {} : {};

    const deviceSecret =
      typeof existingData.deviceSecret === "string" && existingData.deviceSecret.length >= 16
        ? existingData.deviceSecret
        : randomBytes(24).toString("hex");

    const devicePayload: Record<string, any> = {
      deviceId,
      boundUid: caller.uid,
      boundEmail: caller.email || caller.data?.email || "",
      boundName: caller.data?.displayName || caller.data?.company || caller.data?.name || caller.email || "Utilisateur Rayons",
      boundRole: caller.role || caller.data?.role || "CLIENT",
      deviceSecret,
      platform,
      userAgent,
      active: true,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (fcmToken) {
      devicePayload.fcmToken = fcmToken;
    }

    await deviceRef.set(devicePayload, { merge: true });

    // Enregistrer aussi le token FCM sur la fiche utilisateur
    const userUpdate: Record<string, any> = {
      lastBoundDeviceId: deviceId,
      lastMobileConnectedAt: FieldValue.serverTimestamp(),
    };
    if (fcmToken) {
      userUpdate.fcmTokens = FieldValue.arrayUnion(fcmToken);
    }
    await adminDb.collection("users").doc(caller.uid).set(userUpdate, { merge: true });

    return NextResponse.json({
      success: true,
      boundUid: caller.uid,
      boundEmail: devicePayload.boundEmail,
      boundName: devicePayload.boundName,
      boundRole: devicePayload.boundRole,
      deviceId,
      deviceSecret,
    });
  } catch (error: any) {
    console.error("[PUSH REGISTER POST ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

/**
 * GET /api/push/register?uid=...&deviceId=...&deviceSecret=...&since=...
 * Permet à un téléphone lié à un compte de continuer à recevoir ses notifications
 * (messages, ventes, commandes, alertes) même si la session a été déconnectée.
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

    // Récupérer les notifications récentes de ce compte (inapp_notifications)
    const [byUserSnap, byClientSnap, bySupplierSnap] = await Promise.all([
      adminDb.collection("inapp_notifications").where("userId", "==", uid).limit(25).get(),
      adminDb.collection("inapp_notifications").where("clientId", "==", uid).limit(25).get(),
      adminDb.collection("inapp_notifications").where("supplierId", "==", uid).limit(25).get(),
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
