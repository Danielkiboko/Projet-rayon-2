import { NextResponse } from "next/server";
import { 
  sendEmail, 
  sendSMS, 
  getOrderCreatedEmail, 
  getOrderCreatedSMS, 
  getOrderStatusEmail, 
  getOrderStatusSMS 
} from "@/lib/notifications";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, orderId, category, status, supplierId, clientId, clientPhone: reqClientPhone, data } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing required fields (action)" }, { status: 400 });
    }

    let supplierEmail = "";
    let supplierPhone = "";
    let clientEmail = "";
    let clientPhone = reqClientPhone || "";

    // Fetch Supplier Details
    if (supplierId && supplierId !== "admin") {
      const supplierDoc = await getDoc(doc(db, "users", supplierId));
      if (supplierDoc.exists()) {
        supplierEmail = supplierDoc.data().email || "";
        supplierPhone = supplierDoc.data().phone || "";
      }
    } else if (supplierId === "admin") {
      supplierEmail = SUPER_ADMIN_EMAILS[0] || process.env.SMTP_USER || "admin@rayons.net";
    }

    // Fetch Client Details
    if (clientId) {
      const clientDoc = await getDoc(doc(db, "users", clientId));
      if (clientDoc.exists()) {
        clientEmail = clientDoc.data().email || "";
        if (!clientPhone) clientPhone = clientDoc.data().phone || "";
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
