import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendSMS, sendEmail, getOrderStatusEmail, getOrderStatusSMS } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, driverId, driverName, driverPhone, amountCollected } = body;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "orderId est requis." },
        { status: 400 }
      );
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    let clientPhoneToNotify = "";
    let clientEmailToNotify = "";
    let orderNum = orderId.substring(0, 8).toUpperCase();
    let suppliersAffected: string[] = [];

    // 1. Transaction atomique : Mise à jour de la commande et enregistrement en caisse
    await adminDb.runTransaction(async (transaction: any) => {
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new Error("ORDER_NOT_FOUND");
      }

      const orderData = orderDoc.data() || {};
      clientPhoneToNotify = orderData.clientPhone || orderData.customerInfo?.phone || orderData.deliveryDetails?.recipientPhone || "";
      clientEmailToNotify = orderData.clientEmail || orderData.customerInfo?.email || "";

      const finalAmount = amountCollected !== undefined 
        ? Number(amountCollected) 
        : (Number(orderData.remainingBalance) || Number(orderData.totalAmount) || 0);

      const dName = driverName || orderData.driverName || "Livreur Rayon";
      const dPhone = driverPhone || orderData.driverPhone || "";
      const dId = driverId || orderData.driverId || "";

      // Mise à jour de la commande
      transaction.update(orderRef, {
        status: "COMPLETED",
        paymentStatus: "COLLECTED_BY_DRIVER",
        cashCollectedByDriver: true,
        cashHandedOverToSupplier: false,
        collectedAmount: finalAmount,
        collectedByDriverId: dId,
        collectedByDriverName: dName,
        collectedByDriverPhone: dPhone,
        deliveredAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2. Déterminer les montants par fournisseur et générer les écritures de caisse
      const items = Array.isArray(orderData.items) ? orderData.items : [];
      const supplierAmounts: Record<string, number> = {};

      if (items.length > 0) {
        for (const item of items) {
          const sId = item.supplierId || orderData.supplierId || "admin";
          const itemTotal = (Number(item.price) || 0) * (Number(item.quantity) || 1);
          supplierAmounts[sId] = (supplierAmounts[sId] || 0) + itemTotal;
        }
      } else {
        const fallbackSupplier = orderData.supplierId || "admin";
        supplierAmounts[fallbackSupplier] = finalAmount;
      }

      suppliersAffected = Object.keys(supplierAmounts);

      // Générer pour chaque fournisseur l'écriture dans supplier_transactions et accounting_ledger
      for (const sId of suppliersAffected) {
        const sAmount = supplierAmounts[sId] || finalAmount;

        // A. Écriture dans supplier_transactions (Livre de Caisse du fournisseur)
        const sTxRef = adminDb.collection("supplier_transactions").doc();
        transaction.set(sTxRef, {
          supplierId: sId,
          orderId: orderId,
          type: "INCOME",
          category: "Vente Livrée (Espèces Livreur)",
          amount: sAmount,
          currency: "USD",
          description: `Commande livrée #${orderNum} - Fonds encaissés par ${dName}`,
          referenceId: orderId,
          status: "PENDING_HANDOVER", // En attente de reversement physique en caisse
          driverId: dId,
          driverName: dName,
          driverPhone: dPhone,
          isPendingHandover: true,
          collectedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        });

        // B. Écriture formelle dans le grand livre comptable central
        const ledgerRef = adminDb.collection("accounting_ledger").doc();
        const rand = Math.floor(10000 + Math.random() * 90000);
        transaction.set(ledgerRef, {
          entryNumber: `ECR-${new Date().getFullYear()}-${rand}`,
          date: FieldValue.serverTimestamp(),
          journal: "CS",
          journalName: "Journal de Caisse (Espèces)",
          referencePiece: orderId,
          label: `Vente livrée #${orderNum} - Fonds perçus par le livreur ${dName} (En attente de versement)`,
          debit: sAmount,
          credit: 0,
          currency: "USD",
          actorType: sId === "admin" ? "ADMIN" : "SUPPLIER",
          supplierId: sId,
          category: "Vente Livrée",
          status: "VALIDATED"
        });
      }
    });

    // 3. Notification en arrière-plan au client
    Promise.resolve().then(async () => {
      try {
        if (clientPhoneToNotify) {
          const smsText = `Rayon : Votre commande #${orderNum} a été livrée avec succès ! Merci de votre confiance.`;
          await sendSMS(clientPhoneToNotify, smsText);
        }
        if (clientEmailToNotify) {
          await sendEmail(
            clientEmailToNotify,
            `Commande #${orderNum} livrée avec succès !`,
            getOrderStatusEmail(orderId, "COMPLETED")
          );
        }
      } catch (notifErr) {
        console.warn("Erreur envoi notification fin de livraison:", notifErr);
      }
    });

    return NextResponse.json({
      success: true,
      orderId,
      message: "Livraison validée et écriture enregistrée en direct dans le livre de caisse !"
    });

  } catch (error: any) {
    console.error("Erreur confirmation livraison & caisse:", error);

    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "Commande introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de la validation de la livraison." },
      { status: 500 }
    );
  }
}
