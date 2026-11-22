import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { requireAnyStaffPermission } from "@/server/guards";
import { recordAuditLog } from "@/server/auditLog";
import { dispatchAccountNotification } from "@/lib/pushNotifications";

const ALLOWED_CRM_TAGS = ["VIP", "FIDÈLE", "PRO", "À RELANCER", "À SURVEILLER"];

function toIso(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw?.toDate === "function") return raw.toDate().toISOString();
  if (typeof raw?.seconds === "number") return new Date(raw.seconds * 1000).toISOString();
  if (typeof raw?._seconds === "number") return new Date(raw._seconds * 1000).toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * GET /api/admin/clients/crm
 * - Sans ?uid : retourne la carte agrégée (commandes & total dépensé par client) pour le tableau CRM.
 * - Avec ?uid=... : retourne la Fiche Client 360° complète (commandes, tickets SAV, KPIs, notes & tags CRM).
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireAnyStaffPermission(req, ["clients.view", "clients.manage"]);
    if (!guard.ok) return guard.errorResponse!;

    const uid = req.nextUrl.searchParams.get("uid")?.trim();

    if (!uid) {
      const ordersSnap = await adminDb.collection("orders").limit(1000).get();
      const statsByClient: Record<string, { ordersCount: number; totalSpentUSD: number; lastOrderAt: string | null }> = {};

      ordersSnap.forEach((docSnap: any) => {
        const o = docSnap.data() || {};
        const st = String(o.status || "").toUpperCase();
        if (st === "CANCELLED") return;
        const cId = o.clientId || o.userId || o.customerId;
        if (!cId) return;

        if (!statsByClient[cId]) {
          statsByClient[cId] = { ordersCount: 0, totalSpentUSD: 0, lastOrderAt: null };
        }
        statsByClient[cId].ordersCount += 1;
        statsByClient[cId].totalSpentUSD += Number(o.totalAmount || o.subtotal || 0);
        const iso = toIso(o.createdAt);
        if (iso && (!statsByClient[cId].lastOrderAt || iso > statsByClient[cId].lastOrderAt!)) {
          statsByClient[cId].lastOrderAt = iso;
        }
      });

      return NextResponse.json({ success: true, statsByClient });
    }

    // Fiche Client 360° détaillée
    const [userSnap, ordersByClientId, ordersByUserId, ticketsByUser] = await Promise.all([
      adminDb.collection("users").doc(uid).get(),
      adminDb.collection("orders").where("clientId", "==", uid).limit(100).get(),
      adminDb.collection("orders").where("userId", "==", uid).limit(100).get(),
      adminDb.collection("tickets").where("userId", "==", uid).limit(50).get(),
    ]);

    const userData = userSnap.exists ? userSnap.data() || {} : {};
    const orderMap = new Map<string, any>();

    const collectOrder = (docSnap: any) => {
      if (orderMap.has(docSnap.id)) return;
      const o = docSnap.data() || {};
      orderMap.set(docSnap.id, {
        id: docSnap.id,
        status: String(o.status || "PENDING").toUpperCase(),
        totalAmount: Number(o.totalAmount || o.subtotal || 0),
        currency: o.currency || "USD",
        itemsCount: Array.isArray(o.items) ? o.items.length : 1,
        rayon: o.rayon || o.category || "marketplace",
        createdAt: toIso(o.createdAt),
      });
    };

    ordersByClientId.forEach(collectOrder);
    ordersByUserId.forEach(collectOrder);

    const orders = Array.from(orderMap.values()).sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );

    const nonCancelledOrders = orders.filter((o) => o.status !== "CANCELLED");
    const totalSpentUSD = nonCancelledOrders.reduce((acc, o) => acc + o.totalAmount, 0);
    const avgBasketUSD = nonCancelledOrders.length > 0 ? totalSpentUSD / nonCancelledOrders.length : 0;

    const tickets: any[] = [];
    ticketsByUser.forEach((docSnap: any) => {
      const t = docSnap.data() || {};
      tickets.push({
        id: docSnap.id,
        subject: t.subject || t.title || "Requête client",
        status: t.status || "open",
        createdAt: toIso(t.createdAt),
      });
    });
    tickets.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    return NextResponse.json({
      success: true,
      profile: {
        id: uid,
        crmTags: Array.isArray(userData.crmTags) ? userData.crmTags : [],
        crmNote: typeof userData.crmNote === "string" ? userData.crmNote : "",
        isSuspended: Boolean(userData.isSuspended || String(userData.status || "").toUpperCase() === "SUSPENDED"),
        suspendedReason: userData.suspendedReason || "",
        address: userData.address || "",
      },
      summary: {
        ordersCount: nonCancelledOrders.length,
        totalSpentUSD,
        avgBasketUSD,
        lastOrderAt: nonCancelledOrders[0]?.createdAt || null,
        ticketsCount: tickets.length,
        openTicketsCount: tickets.filter((t) => t.status !== "closed" && t.status !== "resolved").length,
      },
      orders: orders.slice(0, 20),
      tickets: tickets.slice(0, 15),
    });
  } catch (error: any) {
    console.error("[ADMIN CLIENTS CRM GET ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/clients/crm
 * Actions CRM sécurisées sur un client :
 * - UPDATE_CRM : tags & note interne
 * - TOGGLE_SUSPEND : suspendre / réactiver sans supprimer l'historique
 * - SEND_MESSAGE : notification Push + In-App directe au client
 */
export async function PATCH(req: NextRequest) {
  try {
    const guard = await requireAnyStaffPermission(req, ["clients.manage"]);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;

    const body = await req.json();
    const { action, uid } = body;

    if (!uid || typeof uid !== "string") {
      return NextResponse.json({ success: false, error: "Identifiant client requis." }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ success: false, error: "Client introuvable." }, { status: 404 });
    }
    const existing = userSnap.data() || {};

    if (action === "UPDATE_CRM") {
      const rawTags: string[] = Array.isArray(body.crmTags) ? body.crmTags : [];
      const cleanTags = Array.from(
        new Set(rawTags.map((t) => String(t).toUpperCase().trim()).filter((t) => ALLOWED_CRM_TAGS.includes(t)))
      );
      const cleanNote = String(body.crmNote || "").trim().slice(0, 1000);

      await userRef.set(
        {
          crmTags: cleanTags,
          crmNote: cleanNote,
          crmUpdatedAt: FieldValue.serverTimestamp(),
          crmUpdatedBy: guard.caller.email || guard.caller.uid,
        },
        { merge: true }
      );

      recordAuditLog({
        action: "SETTINGS_UPDATED",
        caller: guard.caller,
        targetType: "user",
        targetId: uid,
        summary: `Mise à jour CRM client ${existing.displayName || existing.email || uid} (Tags: ${cleanTags.join(", ") || "aucun"})`,
        metadata: { crmTags: cleanTags },
      });

      return NextResponse.json({ success: true, crmTags: cleanTags, crmNote: cleanNote });
    }

    if (action === "TOGGLE_SUSPEND") {
      const nextSuspended = Boolean(body.isSuspended);
      const reason = String(body.reason || "").trim().slice(0, 300);

      await userRef.set(
        {
          isSuspended: nextSuspended,
          status: nextSuspended ? "SUSPENDED" : "ACTIVE",
          suspendedReason: nextSuspended ? reason || "Suspendu par l'administration" : "",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      recordAuditLog({
        action: "SETTINGS_UPDATED",
        caller: guard.caller,
        targetType: "user",
        targetId: uid,
        summary: nextSuspended
          ? `Compte client suspendu : ${existing.displayName || existing.email || uid}`
          : `Compte client réactivé : ${existing.displayName || existing.email || uid}`,
        metadata: { isSuspended: nextSuspended, reason },
      });

      return NextResponse.json({ success: true, isSuspended: nextSuspended });
    }

    if (action === "SEND_MESSAGE") {
      const title = String(body.title || "").trim().slice(0, 120);
      const message = String(body.message || "").trim().slice(0, 500);
      if (!title || !message) {
        return NextResponse.json({ success: false, error: "Titre et message requis." }, { status: 400 });
      }

      await dispatchAccountNotification({
        userId: uid,
        type: "system",
        title,
        message,
        link: "/dashboard",
      });

      recordAuditLog({
        action: "PUSH_CAMPAIGN_SENT",
        caller: guard.caller,
        targetType: "user",
        targetId: uid,
        summary: `Notification directe envoyée au client ${existing.displayName || existing.email || uid} : "${title}"`,
      });

      return NextResponse.json({ success: true, message: "Notification envoyée au client." });
    }

    return NextResponse.json({ success: false, error: "Action CRM non reconnue." }, { status: 400 });
  } catch (error: any) {
    console.error("[ADMIN CLIENTS CRM PATCH ERROR]:", error);
    return NextResponse.json({ success: false, error: error.message || "Erreur serveur" }, { status: 500 });
  }
}
