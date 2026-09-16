import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { sendSMS, sendEmail, getOrderStatusEmail, getOrderStatusSMS } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, driverId, driverName, driverPhone, driverVehicle } = body;

    if (!orderId || !driverId) {
      return NextResponse.json(
        { success: false, error: "orderId et driverId sont requis." },
        { status: 400 }
      );
    }

    const orderRef = adminDb.collection("orders").doc(orderId);

    let clientPhoneToNotify = "";
    let clientEmailToNotify = "";
    let orderNum = orderId.substring(0, 8).toUpperCase();

    // 1. Transaction atomique stricte pour éliminer tout risque de doublon / course critique
    const result = await adminDb.runTransaction(async (transaction: any) => {
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new Error("ORDER_NOT_FOUND");
      }

      const orderData = orderDoc.data() || {};
      clientPhoneToNotify = orderData.clientPhone || orderData.customerInfo?.phone || orderData.deliveryDetails?.recipientPhone || "";
      clientEmailToNotify = orderData.clientEmail || orderData.customerInfo?.email || "";

      // Si le statut a déjà progressé ou si un autre livreur est déjà assigné
      if (orderData.status !== "CONFIRMED_AWAITING_DRIVER") {
        // Idempotence : si c'est déjà ce même livreur qui l'a acceptée (ex: double-clic rapide)
        if (orderData.driverId === driverId) {
          return { alreadyAcceptedByYou: true, orderId };
        }
        throw new Error("ORDER_ALREADY_ACCEPTED");
      }

      if (orderData.driverId && orderData.driverId !== driverId) {
        throw new Error("ORDER_ALREADY_ASSIGNED");
      }

      // Vérification d'affiliation : un livreur créé par un fournisseur ne peut accepter que les courses de son fournisseur
      const driverDocRef = adminDb.collection("drivers").doc(driverId);
      const driverSnap = await transaction.get(driverDocRef);
      let driverSupplierId = driverSnap.data()?.supplierId;

      if (!driverSupplierId || driverSupplierId === "admin") {
        const userDocRef = adminDb.collection("users").doc(driverId);
        const userSnap = await transaction.get(userDocRef);
        const uData = userSnap.data();
        if (uData?.supplierId && uData.supplierId !== "admin") {
          driverSupplierId = uData.supplierId;
        } else if (uData?.parentSupplierId) {
          driverSupplierId = uData.parentSupplierId;
        } else if (uData?.createdBy && uData.createdBy !== "admin" && uData.createdBy !== "superAdmin") {
          driverSupplierId = uData.createdBy;
        }
      }

      if (driverSupplierId && driverSupplierId !== "admin" && driverSupplierId !== "superAdmin") {
        const orderSupplierId = orderData.supplierId;
        const orderSupplierIds = Array.isArray(orderData.supplierIds) ? orderData.supplierIds : [];
        if (orderSupplierId !== driverSupplierId && !orderSupplierIds.includes(driverSupplierId)) {
          throw new Error("UNAUTHORIZED_SUPPLIER_MISSION");
        }
      }

      // Assignation atomique exclusive au premier livreur
      transaction.update(orderRef, {
        status: "ACCEPTED",
        driverId: driverId,
        driverName: driverName || "Livreur Rayon",
        driverPhone: driverPhone || "",
        driverVehicle: driverVehicle || "",
        acceptedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { alreadyAcceptedByYou: false, orderId };
    });

    // 2. Notification en arrière-plan au client (sans bloquer la réponse rapide)
    if (!result.alreadyAcceptedByYou && (clientPhoneToNotify || clientEmailToNotify)) {
      Promise.resolve().then(async () => {
        try {
          if (clientPhoneToNotify) {
            const smsText = `Rayon : Votre commande #${orderNum} a été acceptée par le livreur ${driverName || 'Rayon'}. Il est en route !`;
            await sendSMS(clientPhoneToNotify, smsText);
          }
          if (clientEmailToNotify) {
            await sendEmail(
              clientEmailToNotify,
              `Votre commande #${orderNum} est en route !`,
              getOrderStatusEmail(orderId, "ACCEPTED")
            );
          }
        } catch (notifErr) {
          console.warn("Erreur envoi notification acceptation course:", notifErr);
        }
      });
    }

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      alreadyAcceptedByYou: result.alreadyAcceptedByYou,
      message: result.alreadyAcceptedByYou 
        ? "Vous avez déjà accepté cette mission." 
        : "Mission acceptée avec succès !"
    });

  } catch (error: any) {
    console.error("Erreur acceptation mission livreur:", error);

    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "Commande introuvable." },
        { status: 404 }
      );
    }

    if (error.message === "UNAUTHORIZED_SUPPLIER_MISSION") {
      return NextResponse.json(
        { 
          success: false, 
          code: "UNAUTHORIZED", 
          message: "Action non autorisée : cette course n'appartient pas au fournisseur auquel vous êtes affilié." 
        },
        { status: 403 }
      );
    }

    if (error.message === "ORDER_ALREADY_ACCEPTED" || error.message === "ORDER_ALREADY_ASSIGNED") {
      return NextResponse.json(
        { 
          success: false, 
          code: "ALREADY_ACCEPTED", 
          message: "Cette course vient d'être acceptée par un autre livreur." 
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Erreur serveur lors de l'acceptation de la course." },
      { status: 500 }
    );
  }
}
