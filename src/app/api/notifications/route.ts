import { safeApiError } from "@/lib/sanitize";
import { NextRequest, NextResponse } from "next/server";
import { 
  sendEmail, 
  sendSMS, 
  getOrderCreatedEmail, 
  getOrderCreatedSMS, 
  getOrderStatusEmail, 
  getOrderStatusSMS 
} from "@/lib/notifications";
import { adminDb } from "@/lib/firebase-admin";
import { SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";
import { dispatchAccountNotification } from "@/lib/pushNotifications";
import { requireAuthenticatedCaller, isOperationalCaller } from "@/server/guards";
import { hasStaffPermission } from "@/domain/permissions";
import { isSupplier, isSuperAdmin } from "@/domain/roles";
import { enforceRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    const rateLimited = await enforceRateLimit(req, "api:notifications", 10, 60);
    if (rateLimited) return rateLimited;

    // Authentification obligatoire pour éviter tout abus de relais Email/SMS/Push
    const guard = await requireAuthenticatedCaller(req);
    if (!guard.ok || !guard.caller) return guard.errorResponse!;
    const caller = guard.caller;
    const callerSubject = { ...(caller.data || {}), email: caller.email, role: caller.role };

    const body = await req.json();
    const { action, orderId, category, status, supplierId, clientId, clientPhone: reqClientPhone } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing required fields (action)" }, { status: 400 });
    }

    // Vérification stricte de l'autorité par type d'action
    if (action === "PROPERTY_APPROVED") {
      if (!isSuperAdmin(callerSubject) && !hasStaffPermission(callerSubject, "properties.moderate")) {
        return NextResponse.json({ error: "Action réservée aux modérateurs catalogue / admin." }, { status: 403 });
      }
    }
    if (action === "ORDER_STATUS_CHANGED") {
      if (!isOperationalCaller(caller)) {
        return NextResponse.json({ error: "Action réservée aux livreurs, fournisseurs ou administrateurs." }, { status: 403 });
      }
      if (!orderId) {
        return NextResponse.json({ error: "orderId requis." }, { status: 400 });
      }
    }
    if (action === "VISIT_VALIDATED") {
      if (!caller.isAdmin && !isSupplier(callerSubject)) {
        return NextResponse.json({ error: "Action réservée aux fournisseurs immobiliers ou administrateurs." }, { status: 403 });
      }
    }
    if (action === "ORDER_CREATED" && !orderId) {
      return NextResponse.json({ error: "orderId requis." }, { status: 400 });
    }

    // Verify order exists when orderId is provided to prevent open SMS/Email relay abuse
    let orderData: Record<string, any> | null = null;
    if (orderId) {
      const orderSnap = await adminDb.collection("orders").doc(String(orderId)).get();
      if (!orderSnap.exists) {
        return NextResponse.json({ error: "Order not found" }, { status: 404 });
      }
      orderData = orderSnap.data() || null;
    }

    let supplierEmail = "";
    let supplierPhone = "";
    let clientEmail = "";
    let clientPhone = orderData?.clientPhone || orderData?.deliveryDetails?.recipientPhone || reqClientPhone || "";

    // Fetch Supplier Details via Admin SDK
    const effectiveSupplierId = supplierId || orderData?.supplierId;
    if (effectiveSupplierId && effectiveSupplierId !== "admin") {
      const supplierDoc = await adminDb.collection("users").doc(String(effectiveSupplierId)).get();
      if (supplierDoc.exists) {
        supplierEmail = supplierDoc.data()?.email || "";
        supplierPhone = supplierDoc.data()?.phone || "";
      }
    } else if (effectiveSupplierId === "admin") {
      supplierEmail = SUPER_ADMIN_EMAILS[0] || process.env.SMTP_USER || "admin@rayons.net";
    }

    // Fetch Client Details via Admin SDK
    const effectiveClientId = clientId || orderData?.clientId;
    if (effectiveClientId && effectiveClientId !== "GUEST") {
      const clientDoc = await adminDb.collection("users").doc(String(effectiveClientId)).get();
      if (clientDoc.exists) {
        clientEmail = clientDoc.data()?.email || "";
        if (!clientPhone) clientPhone = clientDoc.data()?.phone || "";
      }
    }

    const tasks: Promise<any>[] = [];

    // 1. ORDER_CREATED : Notify Supplier
    if (action === "ORDER_CREATED") {
      if (effectiveSupplierId) {
        tasks.push(
          dispatchAccountNotification({
            userId: String(effectiveSupplierId),
            supplierId: String(effectiveSupplierId),
            type: "order",
            title: `💰 Nouvelle commande Rayons (${category || "Général"})`,
            message: `Vous avez reçu la commande #${String(orderId || "").slice(-6)}.`,
            link: effectiveSupplierId === "admin" ? "/admin/orders" : "/supplier/orders",
            tag: `notif-order-${orderId}`,
          })
        );
      }
      if (supplierEmail) {
        tasks.push(sendEmail(
          supplierEmail, 
          `Nouvelle commande Rayon - ${category || 'Général'}`, 
          getOrderCreatedEmail(orderId, category || 'Général')
        ));
      }
      if (supplierPhone) {
        tasks.push(sendSMS(supplierPhone, getOrderCreatedSMS(orderId)));
      }
    }

    // 2. ORDER_STATUS_CHANGED : Notify Client
    if (action === "ORDER_STATUS_CHANGED" && status) {
      if (effectiveClientId && effectiveClientId !== "GUEST") {
        tasks.push(
          dispatchAccountNotification({
            userId: String(effectiveClientId),
            clientId: String(effectiveClientId),
            type: "order",
            title: "📦 Mise à jour de votre commande Rayons",
            message: `Le statut de votre commande #${String(orderId || "").slice(-6)} est passé à : ${status}.`,
            link: orderId ? `/order/${orderId}/tracking` : "/orders",
            tag: `notif-status-${orderId}-${status}`,
          })
        );
      }
      if (clientEmail) {
        tasks.push(sendEmail(
          clientEmail,
          `Mise à jour de votre commande Rayon`,
          getOrderStatusEmail(orderId, status)
        ));
      }
      if (clientPhone) {
        tasks.push(sendSMS(clientPhone, getOrderStatusSMS(orderId, status)));
      }
    }

    // 3. NEW_VISIT_REQUEST / NEW_HOTEL_BOOKING : Notify Supplier
    if (action === "NEW_VISIT_REQUEST" || action === "NEW_HOTEL_BOOKING") {
      const isHotel = action === "NEW_HOTEL_BOOKING";
      const propertyTitle = body.propertyTitle || (isHotel ? "Un hôtel / hébergement" : "Un bien immobilier");
      if (effectiveSupplierId) {
        tasks.push(
          dispatchAccountNotification({
            userId: String(effectiveSupplierId),
            supplierId: String(effectiveSupplierId),
            type: "booking",
            title: isHotel ? "🏨 Nouvelle réservation hôtelière !" : "🏡 Nouvelle demande de visite !",
            message: isHotel
              ? `Un client souhaite réserver : ${propertyTitle}. Consultez vos messages.`
              : `Un client souhaite visiter : ${propertyTitle}. Consultez vos messages.`,
            link: "/supplier/messages",
          })
        );
      }
      if (supplierEmail) {
        tasks.push(sendEmail(
          supplierEmail,
          isHotel ? `Nouvelle réservation hôtelière !` : `Nouvelle demande de visite !`,
          isHotel
            ? `Un client souhaite réserver dans votre établissement : ${propertyTitle}. Connectez-vous sur votre tableau de bord (onglet Messages) pour confirmer la réservation.`
            : `Un client souhaite visiter votre bien : ${propertyTitle}. Connectez-vous sur votre tableau de bord (onglet Messages) pour lui répondre et organiser la visite.`
        ));
      }
      if (supplierPhone) {
        tasks.push(sendSMS(
          supplierPhone,
          isHotel
            ? `Rayon: Nouvelle reservation pour ${propertyTitle}. Verifiez vos messages sur la plateforme.`
            : `Rayon: Nouvelle demande de visite pour ${propertyTitle}. Verifiez vos messages sur la plateforme.`
        ));
      }
    }

    // 3b. VISIT_VALIDATED : Notify Visitor
    if (action === "VISIT_VALIDATED" && body.data?.visitorPhone) {
      const { visitorPhone, propertyTitle, requestedDate } = body.data;
      tasks.push(
        sendSMS(
          String(visitorPhone),
          `Rayons Immo: Votre visite pour ${propertyTitle || "le bien"} (${requestedDate || "date confirmée"}) a ete validee par l'agence.`
        )
      );
    }

    // 4. PROPERTY_APPROVED : Notify Supplier
    if (action === "PROPERTY_APPROVED") {
      if (effectiveSupplierId) {
        tasks.push(
          dispatchAccountNotification({
            userId: String(effectiveSupplierId),
            supplierId: String(effectiveSupplierId),
            type: "system",
            title: "✅ Votre annonce immobilière est publiée",
            message: "Votre bien immobilier a été approuvé et est désormais visible sur Rayons.net.",
            link: "/supplier/properties",
          })
        );
      }
      if (supplierEmail) {
        tasks.push(sendEmail(
          supplierEmail,
          `Votre annonce immobilière est publiée`,
          `Félicitations, votre annonce immobilière a été approuvée et est désormais visible par tous les clients sur Rayons.NET.`
        ));
      }
      if (supplierPhone) {
        tasks.push(sendSMS(supplierPhone, `Rayon: Votre annonce immobilière est publiée avec succès.`));
      }
    }

    await Promise.allSettled(tasks);
    return NextResponse.json({ success: true, message: "Notifications dispatched" });

  } catch (error: any) {
    console.error("Erreur API Notifications:", error);
    return NextResponse.json({ error: safeApiError(error, "Erreur interne du serveur.") }, { status: 500 });
  }
}
