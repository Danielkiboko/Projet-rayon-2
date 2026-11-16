import { NextResponse } from "next/server";
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

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const notifIpWindow = new Map<string, { count: number; firstAt: number }>();

function isNotifRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = notifIpWindow.get(ip);
  if (!entry || now - entry.firstAt > RATE_LIMIT_WINDOW_MS) {
    notifIpWindow.set(ip, { count: 1, firstAt: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count += 1;
  return false;
}

export async function POST(req: Request) {
  try {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(",")[0].trim() : "unknown";
    if (isNotifRateLimited(ip)) {
      return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
    }

    const body = await req.json();
    const { action, orderId, category, status, supplierId, clientId, clientPhone: reqClientPhone } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing required fields (action)" }, { status: 400 });
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

    // 3. NEW_VISIT_REQUEST : Notify Supplier
    if (action === "NEW_VISIT_REQUEST") {
      const propertyTitle = body.propertyTitle || "Un bien immobilier";
      if (supplierEmail) {
        tasks.push(sendEmail(
          supplierEmail,
          `Nouvelle demande de visite !`,
          `Un client souhaite visiter votre bien : ${propertyTitle}. Connectez-vous sur votre tableau de bord (onglet Messages) pour lui répondre et organiser la visite.`
        ));
      }
      if (supplierPhone) {
        tasks.push(sendSMS(supplierPhone, `Rayon: Nouvelle demande de visite pour ${propertyTitle}. Vérifiez vos messages sur la plateforme.`));
      }
    }

    // 3. PROPERTY_APPROVED : Notify Supplier
    if (action === "PROPERTY_APPROVED") {
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
