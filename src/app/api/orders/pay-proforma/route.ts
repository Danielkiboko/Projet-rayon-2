import { NextRequest, NextResponse } from "next/server";
import admin from "firebase-admin";

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
      : undefined;

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  } catch (error) {
    console.error("Firebase Admin initialization error:", error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { chatId, messageId, clientId, clientName, clientPhone, clientAddress } = body;

    if (!chatId || !messageId || !clientId) {
      return NextResponse.json(
        { error: "chatId, messageId et clientId sont requis" },
        { status: 400 }
      );
    }

    const db = admin.firestore();

    // 1. Fetch chat message inside a transaction to prevent duplicates
    const messageRef = db.collection("chats").doc(chatId).collection("messages").doc(messageId);
    const chatRef = db.collection("chats").doc(chatId);

    const result = await db.runTransaction(async (transaction) => {
      const msgDoc = await transaction.get(messageRef);

      if (!msgDoc.exists) {
        throw new Error("Message proforma introuvable");
      }

      const msgData = msgDoc.data();
      const proforma = msgData?.proforma;

      if (!proforma) {
        throw new Error("Ce message ne contient pas de proforma valide");
      }

      // DUPLICATE PREVENTION: If already paid, return existing orderId immediately
      if (proforma.status === "paid" && proforma.orderId) {
        return {
          alreadyPaid: true,
          orderId: proforma.orderId,
          proforma
        };
      }

      const isHotel = proforma.type === "hotel";
      const supplierId = msgData.senderId || proforma.supplierId || "admin";
      const orderId = `CMD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

      if (isHotel) {
        // Réservation hôtel
        const hotelBookingRef = db.collection("hotel_bookings").doc(orderId);
        transaction.set(hotelBookingRef, {
          id: orderId,
          propertyTitle: proforma.productName || "Séjour Hôtel",
          supplierId: supplierId,
          clientId: clientId,
          clientName: clientName || "Client",
          clientPhone: clientPhone || "",
          nightsCount: proforma.quantity || 1,
          totalPrice: proforma.price || 0,
          status: "CONFIRMED",
          chatId: chatId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        // Commande e-commerce : envoyée au circuit des livreurs Rayons
        const orderRef = db.collection("orders").doc(orderId);
        transaction.set(orderRef, {
          id: orderId,
          clientId: clientId,
          clientName: clientName || "Client",
          clientPhone: clientPhone || "",
          clientAddress: clientAddress || "Kinshasa",
          supplierId: supplierId,
          supplierIds: [supplierId],
          chatId: chatId,
          items: [{
            productId: proforma.productId || null,
            productName: proforma.productName || "Produit",
            quantity: Number(proforma.quantity) || 1,
            price: Number(proforma.price) || 0,
          }],
          subtotal: Number(proforma.price) || 0,
          deliveryFee: Number(proforma.deliveryFee) || 3,
          totalAmount: Number(proforma.price) || 0, // Montant produit à régler à la livraison
          remainingBalance: Number(proforma.price) || 0,
          currency: "$",
          paymentMethod: "CASH_ON_DELIVERY",
          paymentStatus: "DELIVERY_PAID", // La livraison est payée d'avance
          status: "CONFIRMED_AWAITING_DRIVER", // Prêt pour acceptation par un livreur
          deliveryDetails: {
            city: "Kinshasa",
            address: clientAddress || "Adresse client",
            recipientName: clientName || "Client",
            recipientPhone: clientPhone || ""
          },
          clientLocation: {
            lat: -4.322447, // Kinshasa par défaut
            lng: 15.307045,
            city: "Kinshasa"
          },
          source: "PROFORMA_CHAT",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      // 2. Mettre à jour le statut du proforma
      transaction.update(messageRef, {
        "proforma.status": "paid",
        "proforma.orderId": orderId,
        "proforma.paidAt": admin.firestore.FieldValue.serverTimestamp()
      });

      // 3. Mettre à jour le chat principal
      transaction.set(chatRef, {
        lastMessage: isHotel 
          ? `🏨 Réservation confirmée (#${orderId})`
          : `✅ Paiement livraison confirmé (#${orderId})`,
        lastMessageTime: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        unreadSupplier: true,
        unreadClient: false
      }, { merge: true });

      // 4. Ajouter un message de confirmation dans la conversation
      const confirmationMessageRef = chatRef.collection("messages").doc();
      transaction.set(confirmationMessageRef, {
        text: isHotel
          ? `🎉 Félicitations ! Votre réservation de séjour pour "${proforma.productName}" est confirmée (#${orderId}). L'établissement prépare votre arrivée.`
          : `🎉 Paiement de livraison reçu ! La commande #${orderId} a été confirmée et transmise aux livreurs disponibles. Vous pouvez suivre l'état d'avancement en temps réel.`,
        senderId: "system",
        type: "system_order_confirmation",
        orderId: orderId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        alreadyPaid: false,
        orderId,
        proforma
      };
    });

    // 5. Décrémenter le stock hors transaction si productId est fourni
    if (result.proforma?.productId && !result.alreadyPaid) {
      try {
        const prodRef = db.collection("products").doc(result.proforma.productId);
        await prodRef.update({
          stock: admin.firestore.FieldValue.increment(-(result.proforma.quantity || 1))
        });
      } catch (stockErr) {
        console.warn("Stock decrement warning:", stockErr);
      }
    }

    return NextResponse.json({
      success: true,
      alreadyPaid: result.alreadyPaid,
      orderId: result.orderId,
      message: result.alreadyPaid ? "Commande déjà payée" : "Commande créée et transmise aux livreurs"
    });
  } catch (error: any) {
    console.error("Erreur api pay-proforma:", error);
    return NextResponse.json(
      { error: error.message || "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}
