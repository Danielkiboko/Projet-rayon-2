import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendSMS, sendEmail, getOrderStatusEmail, getOrderStatusSMS } from "@/lib/notifications";
import { getServerCaller, canActForSupplier } from "@/lib/serverAuth";
import { dispatchAccountNotification } from "@/lib/pushNotifications";

export async function POST(req: NextRequest) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json(
        { success: false, error: "Authentification requise pour confirmer la livraison." },
        { status: 401 }
      );
    }

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
    let clientIdToNotify = "";
    const orderNum = orderId.substring(0, 8).toUpperCase();
    let suppliersAffected: string[] = [];
    let alreadyCompleted = false;

    // 1. Transaction atomique : Mise à jour de la commande et enregistrement en caisse
    await adminDb.runTransaction(async (transaction: any) => {
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new Error("ORDER_NOT_FOUND");
      }

      const orderData = orderDoc.data() || {};

      // Vérification d'autorisation : seul le livreur assigné, le fournisseur de la commande ou un admin peut confirmer
      const isAssignedDriver = orderData.driverId && orderData.driverId === caller.uid;
      const isUnassignedButCallerIsDriver = !orderData.driverId && (caller.role.includes("DRIVER") || caller.role.includes("LIVREUR") || caller.role.includes("CHAUFFEUR"));
      const isOrderSupplier = canActForSupplier(caller, orderData.supplierId || "");
      if (!caller.isAdmin && !isAssignedDriver && !isUnassignedButCallerIsDriver && !isOrderSupplier) {
        throw new Error("UNAUTHORIZED_DELIVERY_CONFIRMATION");
      }

      // Idempotence : si déjà livrée, ne pas dupliquer les écritures comptables
      if (orderData.status === "COMPLETED" && orderData.cashCollectedByDriver) {
        alreadyCompleted = true;
        return;
      }

      clientPhoneToNotify = orderData.clientPhone || orderData.customerInfo?.phone || orderData.deliveryDetails?.recipientPhone || "";
      clientEmailToNotify = orderData.clientEmail || orderData.customerInfo?.email || "";
      clientIdToNotify = orderData.clientId || "";

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

      // 2. Déterminer les montants par fournisseur et générer les écritures de caisse (avec Capital & Intérêts)
      const items = Array.isArray(orderData.items) ? orderData.items : [];
      const supplierAmounts: Record<string, number> = {};
      const supplierCapital: Record<string, number> = {};
      const supplierProfit: Record<string, number> = {};

      if (items.length > 0) {
        for (const item of items) {
          const sId = item.supplierId || orderData.supplierId || "admin";
          const itemQty = Number(item.quantity) || 1;
          const itemTotal = (Number(item.price) || 0) * itemQty;
          const itemCost = item.costOfGoodsSold !== undefined 
            ? Number(item.costOfGoodsSold) 
            : ((Number(item.purchasePrice) || 0) * itemQty);
          const itemMargin = item.grossProfit !== undefined 
            ? Number(item.grossProfit) 
            : (itemTotal - itemCost);

          supplierAmounts[sId] = (supplierAmounts[sId] || 0) + itemTotal;
          supplierCapital[sId] = (supplierCapital[sId] || 0) + itemCost;
          supplierProfit[sId] = (supplierProfit[sId] || 0) + itemMargin;
        }
      } else {
        const fallbackSupplier = orderData.supplierId || "admin";
        supplierAmounts[fallbackSupplier] = finalAmount;
        supplierCapital[fallbackSupplier] = Number(orderData.purchaseCost || 0);
        supplierProfit[fallbackSupplier] = Number(orderData.grossProfit !== undefined ? orderData.grossProfit : finalAmount);
      }

      suppliersAffected = Object.keys(supplierAmounts);

      // Générer pour chaque fournisseur l'écriture dans supplier_transactions et accounting_ledger
      for (const sId of suppliersAffected) {
        const sAmount = supplierAmounts[sId] || finalAmount;
        const sCapital = supplierCapital[sId] || 0;
        const sProfit = supplierProfit[sId] !== undefined ? supplierProfit[sId] : (sAmount - sCapital);

        // A. Écriture dans supplier_transactions (Livre de Caisse du fournisseur)
        const sTxRef = adminDb.collection("supplier_transactions").doc();
        transaction.set(sTxRef, {
          supplierId: sId,
          orderId: orderId,
          type: "INCOME",
          category: "Vente Livrée (Espèces Livreur)",
          amount: sAmount,
          capital: sCapital,
          profit: sProfit,
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

        // B. Écriture comptable strictement cloisonnée :
        //    - Boutique officielle Admin ("admin") -> accounting_ledger (PLATFORM_ADMIN)
        //    - Fournisseur tiers -> supplier_ledger (SUPPLIER_PRIVATE, jamais mélangé dans le Grand Livre Admin)
        const isAdminSale = sId === "admin";
        const ledgerRef = adminDb
          .collection(isAdminSale ? "accounting_ledger" : "supplier_ledger")
          .doc();
        const rand = Math.floor(10000 + Math.random() * 90000);
        transaction.set(ledgerRef, {
          entryNumber: `ECR-${new Date().getFullYear()}-${rand}`,
          date: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
          journal: "CS",
          journalName: "Journal de Caisse (Espèces)",
          referencePiece: orderId,
          label: `Vente livrée #${orderNum} - Fonds perçus par le livreur ${dName} (En attente de versement)`,
          debit: sAmount,
          credit: 0,
          currency: "USD",
          actorType: isAdminSale ? "ADMIN" : "SUPPLIER",
          accountingScope: isAdminSale ? "PLATFORM_ADMIN" : "SUPPLIER_PRIVATE",
          supplierId: sId,
          category: "Vente Livrée",
          status: "VALIDATED"
        });
      }
    });

    if (alreadyCompleted) {
      return NextResponse.json({
        success: true,
        orderId,
        alreadyCompleted: true,
        message: "Cette livraison a déjà été confirmée."
      });
    }

    // 3. Notification en arrière-plan au client et aux fournisseurs (SMS, Email & Push Mobile)
    Promise.resolve().then(async () => {
      try {
        if (clientIdToNotify && clientIdToNotify !== "GUEST") {
          await dispatchAccountNotification({
            userId: clientIdToNotify,
            clientId: clientIdToNotify,
            type: "delivery",
            title: "✅ Commande livrée avec succès !",
            message: `Votre commande #${orderNum} a été remise et confirmée. Merci pour votre confiance sur Rayons.net !`,
            link: `/order/${orderId}/tracking`,
            tag: `delivered-cli-${orderId}`,
          });
        }
        for (const sId of suppliersAffected) {
          await dispatchAccountNotification({
            userId: sId,
            supplierId: sId,
            type: "delivery",
            title: "💰 Vente livrée & encaissée !",
            message: `La commande #${orderNum} a été livrée au client et enregistrée dans votre livre de caisse.`,
            link: sId === "admin" ? "/admin/finance" : "/supplier/finance",
            tag: `delivered-sup-${orderId}-${sId}`,
          });
        }
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

    if (error.message === "UNAUTHORIZED_DELIVERY_CONFIRMATION") {
      return NextResponse.json(
        { success: false, code: "FORBIDDEN", error: "Non autorisé à confirmer cette livraison." },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de la validation de la livraison." },
      { status: 500 }
    );
  }
}
