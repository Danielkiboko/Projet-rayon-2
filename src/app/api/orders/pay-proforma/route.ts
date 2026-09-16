import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

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

    const messageRef = adminDb.collection("chats").doc(chatId).collection("messages").doc(messageId);
    const chatRef = adminDb.collection("chats").doc(chatId);

    const result = await adminDb.runTransaction(async (transaction: any) => {
      // 1. ALL READS FIRST (Strict Firestore rule)
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

      // Calcul des montants avec prise en compte du nombre de produits
      const qty = Math.max(1, Number(proforma.quantity) || 1);
      const unitP = Number(proforma.unitPrice) || (Number(proforma.price) / qty) || 0;
      const totalP = Number(proforma.totalPrice) || (qty * unitP) || Number(proforma.price) || 0;
      const deliveryF = Number(proforma.deliveryFee ?? (isHotel ? 0 : 3));

      // Vérification du stock avant toute écriture
      let prodRef = null;
      let prodDoc = null;
      if (proforma.productId && !isHotel) {
        prodRef = adminDb.collection("products").doc(proforma.productId);
        prodDoc = await transaction.get(prodRef);
        if (prodDoc.exists) {
          const currentStock = Number(prodDoc.data()?.stock ?? 0);
          if (currentStock < qty) {
            throw new Error(`Stock insuffisant : Il ne reste que ${currentStock} pièce(s) disponible(s) en stock pour ce produit.`);
          }
        }
      }

      // 2. ALL WRITES AFTER READS
      if (isHotel) {
        // Réservation hôtel
        const hotelBookingRef = adminDb.collection("hotel_bookings").doc(orderId);
        transaction.set(hotelBookingRef, {
          id: orderId,
          propertyTitle: proforma.productName || "Séjour Hôtel",
          supplierId: supplierId,
          clientId: clientId,
          clientName: clientName || "Client",
          clientPhone: clientPhone || "",
          nightsCount: qty,
          totalPrice: totalP,
          status: "CONFIRMED",
          chatId: chatId,
          createdAt: FieldValue.serverTimestamp()
        });
      } else {
        // Commande e-commerce : envoyée au circuit des livreurs Rayons
        const orderRef = adminDb.collection("orders").doc(orderId);
        const purchasePrice = Number(prodDoc?.data()?.purchasePrice ?? proforma.purchasePrice ?? 0);
        const costOfGoodsSold = Number((purchasePrice * qty).toFixed(2));
        const grossProfit = Number((totalP - costOfGoodsSold).toFixed(2));

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
            quantity: qty,
            price: unitP, // Prix unitaire
            purchasePrice: purchasePrice, // Prix d'achat unitaire (Capital investi)
            costOfGoodsSold: costOfGoodsSold, // Coût total d'achat
            grossProfit: grossProfit, // Bénéfice / Intérêt net
            total: totalP, // Montant total pour cette ligne d'articles
          }],
          subtotal: totalP,
          deliveryFee: deliveryF,
          totalAmount: totalP, // Montant exact des articles à payer au livreur
          remainingBalance: totalP, // Solde restant à percevoir en espèces par le livreur
          purchaseCost: costOfGoodsSold, // Capital total investi
          grossProfit: grossProfit, // Intérêts nets totaux
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
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        });

        // Décrémenter le stock atomiquement dans la transaction
        if (prodRef && prodDoc?.exists) {
          transaction.update(prodRef, {
            stock: FieldValue.increment(-qty),
            updatedAt: FieldValue.serverTimestamp()
          });
        }
      }

      // 3. Mettre à jour le statut du proforma
      transaction.update(messageRef, {
        "proforma.status": "paid",
        "proforma.orderId": orderId,
        "proforma.paidAt": FieldValue.serverTimestamp()
      });

      // 4. Mettre à jour le chat principal
      transaction.set(chatRef, {
        lastMessage: isHotel 
          ? `🏨 Réservation confirmée (#${orderId})`
          : `✅ Paiement livraison confirmé (#${orderId})`,
        lastMessageTime: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        unreadSupplier: true,
        unreadClient: false
      }, { merge: true });

      // 5. Ajouter un message de confirmation dans la conversation
      const confirmationMessageRef = chatRef.collection("messages").doc();
      transaction.set(confirmationMessageRef, {
        text: isHotel
          ? `🎉 Félicitations ! Votre réservation de séjour pour "${proforma.productName}" est confirmée (#${orderId}). L'établissement prépare votre arrivée.`
          : `🎉 Paiement de livraison reçu ! La commande #${orderId} (${qty}x ${proforma.productName}, total: $${totalP}) a été confirmée et transmise aux livreurs disponibles. Vous pouvez suivre la livraison en direct.`,
        senderId: "system",
        type: "system_order_confirmation",
        orderId: orderId,
        createdAt: FieldValue.serverTimestamp()
      });

      return {
        alreadyPaid: false,
        orderId,
        proforma
      };
    });

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
