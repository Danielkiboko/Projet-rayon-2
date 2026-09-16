import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      chatId,
      senderId,
      productId,
      productName,
      brand,
      quantity,
      unitPrice,
      purchasePrice,
      deliveryFee,
      type
    } = body;

    if (!chatId) {
      return NextResponse.json({ error: "chatId est requis." }, { status: 400 });
    }

    if (!senderId) {
      return NextResponse.json({ error: "senderId est requis." }, { status: 400 });
    }

    const isHotel = type === "hotel";
    const qty = Math.max(1, Number(quantity) || 1);
    const uPrice = Number(unitPrice) || 0;

    if (!isHotel && uPrice <= 0) {
      return NextResponse.json(
        { error: "Le prix unitaire doit être supérieur à 0." },
        { status: 400 }
      );
    }

    let pPurchasePrice = Number(purchasePrice) || 0;
    let pBrand = brand || "";
    let pName = (productName || (isHotel ? "Séjour Hôtel" : "Produit")).trim();

    // Vérification du stock en base de données si productId fourni et non-hôtel
    if (productId && !isHotel) {
      try {
        const prodDoc = await adminDb.collection("products").doc(productId).get();
        if (prodDoc.exists) {
          const pData = prodDoc.data();
          const stock = Number(pData?.stock ?? 0);
          if (stock <= 0) {
            return NextResponse.json(
              { error: `Impossible d'émettre la facture : Le produit "${pName}" est en rupture totale de stock (0 pièce).` },
              { status: 400 }
            );
          }
          if (qty > stock) {
            return NextResponse.json(
              { error: `Stock insuffisant : Vous demandez ${qty} pièces alors qu'il n'y a que ${stock} pièce(s) disponible(s).` },
              { status: 400 }
            );
          }
          if (!pPurchasePrice && Number(pData?.purchasePrice) > 0) {
            pPurchasePrice = Number(pData.purchasePrice);
          }
          if (!pBrand && pData?.brand) {
            pBrand = pData.brand;
          }
          if (!pName || pName === "Produit") {
            pName = pData?.title?.fr || pData?.title?.en || pData?.title || pData?.name || pName;
          }
        }
      } catch (err) {
        console.warn("Could not verify product stock in send-proforma API:", err);
      }
    }

    const calculatedTotalProducts = Number((uPrice * qty).toFixed(2));
    const effectiveDeliveryFee = isHotel ? 0 : (Number(deliveryFee) >= 0 ? Number(deliveryFee) : 3);
    const costOfGoodsSold = Number((pPurchasePrice * qty).toFixed(2));
    const grossProfit = Number(((uPrice - pPurchasePrice) * qty).toFixed(2));

    // Construction propre du proforma SANS AUCUN CHAMP undefined
    const proformaPayload: Record<string, any> = {
      productId: productId || "",
      productName: pName,
      quantity: qty,
      unitPrice: uPrice,
      purchasePrice: pPurchasePrice,
      costOfGoodsSold: costOfGoodsSold,
      grossProfit: grossProfit,
      totalPrice: calculatedTotalProducts,
      price: calculatedTotalProducts, // Rétro-compatibilité
      deliveryFee: effectiveDeliveryFee,
      type: isHotel ? "hotel" : "product",
      status: "pending",
      supplierId: senderId
    };

    if (pBrand && pBrand.trim()) {
      proformaPayload.brand = pBrand.trim();
    }

    const messageData = {
      text: isHotel
        ? "Devis / Réservation Séjour Hôtel"
        : `Facture Proforma (${qty}x ${pName})`,
      senderId: senderId,
      createdAt: FieldValue.serverTimestamp(),
      type: "proforma",
      proforma: proformaPayload
    };

    // Écriture du message dans chats/{chatId}/messages
    const msgRef = await adminDb
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .add(messageData);

    // Mise à jour de la conversation parente
    const lastMsgText = isHotel
      ? "🏨 Devis Séjour envoyé"
      : `📄 Proforma envoyé : ${qty}x à $${uPrice.toFixed(2)}`;

    await adminDb.collection("chats").doc(chatId).set(
      {
        lastMessage: lastMsgText,
        updatedAt: FieldValue.serverTimestamp(),
        unreadClient: true
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      messageId: msgRef.id
    });
  } catch (error: any) {
    console.error("Erreur api send-proforma:", error);
    return NextResponse.json(
      { error: error?.message || "Erreur serveur lors de l'envoi de la facture proforma." },
      { status: 500 }
    );
  }
}
