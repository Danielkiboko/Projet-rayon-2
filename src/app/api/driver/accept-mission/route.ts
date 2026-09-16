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
