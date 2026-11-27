import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";
import { enforceRateLimit } from "@/lib/rateLimit";

interface IncomingCartItem {
  id?: string;
  title?: string;
  price?: number;
  quantity?: number;
  image?: string;
  rayon?: string;
  supplierId?: string;
}

function sanitizeCartItems(rawItems: unknown) {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .slice(0, 20)
    .map((raw) => {
      const it = (raw || {}) as IncomingCartItem;
      const id = String(it.id || "").trim().slice(0, 120);
      const title = String(it.title || "Article Rayons").trim().slice(0, 140);
      const price = Number(it.price);
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(it.quantity) || 1)));
      const image = typeof it.image === "string" && it.image.trim().startsWith("http")
        ? it.image.trim().slice(0, 400)
        : typeof it.image === "string" && it.image.trim().startsWith("/")
        ? it.image.trim().slice(0, 200)
        : "";
      const rayon = String(it.rayon || "connect").trim().slice(0, 32);
      const supplierId = String(it.supplierId || "admin").trim().slice(0, 120);

      if (!id || !Number.isFinite(price) || price < 0) return null;
      return { id, title, price: Math.round(price * 100) / 100, quantity, image, rayon, supplierId };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

function computeItemsSignature(items: { id: string; quantity: number }[]): string {
  return items
    .map((it) => `${it.id}:${it.quantity}`)
    .sort()
    .join("|");
}

/**
 * GET /api/cart/sync
 * Restaure le panier serveur de l'utilisateur connecté (ex: clic depuis un email de relance sur un autre appareil).
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller?.uid) {
      return NextResponse.json({ success: true, items: [] }, { status: 200 });
    }

    const snap = await adminDb.collection("abandoned_carts").doc(`user_${caller.uid}`).get();
    if (!snap.exists) {
      return NextResponse.json({ success: true, items: [] }, { status: 200 });
    }

    const data = snap.data() || {};
    if (data.status === "CONVERTED" || !Array.isArray(data.items)) {
      return NextResponse.json({ success: true, items: [] }, { status: 200 });
    }

    return NextResponse.json({ success: true, items: data.items }, { status: 200 });
  } catch (error: any) {
    console.warn("[GET /api/cart/sync] Warning:", error?.message);
    return NextResponse.json({ success: true, items: [] }, { status: 200 });
  }
}

/**
 * POST /api/cart/sync
 * Synchronise le panier actif pour les rappels panier abandonné (Email + Push FCM).
 * - Client connecté : identifié de façon sécurisée par Firebase ID Token (`user_{uid}`).
 * - Visiteur invité : identifié uniquement si `deviceId` existe dans `push_devices` avec un token FCM ou un compte lié.
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimited = await enforceRateLimit(req, "cart_sync", 30, 60);
    if (rateLimited) return rateLimited;

    const body = await req.json().catch(() => ({}));
    const caller = await getServerCaller(req);
    const rawDeviceId = String(body.deviceId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 100);
    const lang = ["fr", "en", "zh"].includes(String(body.lang || "")) ? String(body.lang) : "fr";

    let userId: string | null = caller?.uid || null;
    let userEmail: string | null = caller?.email || null;
    let displayName = "Client";
    let deviceId: string | null = rawDeviceId || null;
    let guestFcmToken: string | null = null;

    if (userId) {
      const userSnap = await adminDb.collection("users").doc(userId).get();
      if (userSnap.exists) {
        const u = userSnap.data() || {};
        userEmail = String(u.email || userEmail || "").trim().toLowerCase() || null;
        displayName = String(u.displayName || u.name || "Client").trim().slice(0, 80);
      }
    } else if (deviceId) {
      // Vérifier que cet appareil est bien enregistré pour les notifications Push
      const devSnap = await adminDb.collection("push_devices").doc(deviceId).get();
      if (!devSnap.exists) {
        return NextResponse.json({ success: true, skipped: "guest_without_push" }, { status: 200 });
      }
      const d = devSnap.data() || {};
      if (d.boundUid) {
        userId = String(d.boundUid);
        userEmail = String(d.boundEmail || "").trim().toLowerCase() || null;
        displayName = String(d.boundName || "Client").trim().slice(0, 80);
      } else if (typeof d.fcmToken === "string" && d.fcmToken.trim()) {
        guestFcmToken = d.fcmToken.trim();
      } else {
        return NextResponse.json({ success: true, skipped: "guest_without_fcm_token" }, { status: 200 });
      }
    } else {
      return NextResponse.json({ success: true, skipped: "anonymous_no_target" }, { status: 200 });
    }

    const docId = userId ? `user_${userId}` : `dev_${deviceId}`;
    const cartRef = adminDb.collection("abandoned_carts").doc(docId);
    const items = sanitizeCartItems(body.items);

    // Si le panier est vidé, supprimer l'enregistrement pour stopper tout rappel
    if (items.length === 0) {
      await cartRef.delete().catch(() => {});
      return NextResponse.json({ success: true, cleared: true }, { status: 200 });
    }

    const subtotal = Math.round(items.reduce((acc, it) => acc + it.price * it.quantity, 0) * 100) / 100;
    const totalItems = items.reduce((acc, it) => acc + it.quantity, 0);
    const itemsSignature = computeItemsSignature(items);
    const nowMs = Date.now();

    const existingSnap = await cartRef.get();
    const existing = existingSnap.exists ? existingSnap.data() || {} : null;
    const isSameCart = Boolean(existing && existing.itemsSignature === itemsSignature && existing.status === "ACTIVE");

    if (isSameCart) {
      // Panier inchangé : ne pas réinitialiser les compteurs anti-spam ni updatedAtMs
      return NextResponse.json({ success: true, unchanged: true }, { status: 200 });
    }

    await cartRef.set(
      {
        userId: userId || null,
        email: userEmail || null,
        displayName,
        deviceId: deviceId || null,
        guestFcmToken: guestFcmToken || null,
        lang,
        items,
        subtotal,
        totalItems,
        itemsSignature,
        status: "ACTIVE",
        reminderCount: 0,
        lastRemindedAtMs: null,
        updatedAtMs: nowMs,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: existing?.createdAt || FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Si l'utilisateur vient de se connecter, nettoyer un éventuel ancien panier invité lié au même appareil
    if (userId && deviceId) {
      adminDb.collection("abandoned_carts").doc(`dev_${deviceId}`).delete().catch(() => {});
    }

    return NextResponse.json({ success: true, docId, totalItems, subtotal }, { status: 200 });
  } catch (error: any) {
    console.error("[POST /api/cart/sync ERROR]:", error);
    return NextResponse.json({ success: false, error: "Erreur de synchronisation panier." }, { status: 500 });
  }
}
