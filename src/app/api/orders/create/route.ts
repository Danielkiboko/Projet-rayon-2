import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getDeliveryFeeForCommune, isNegotiatedDeliveryCommune } from "@/lib/kinshasaDelivery";
import { dispatchAccountNotification } from "@/lib/pushNotifications";
import { enforceRateLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  try {
    // Protection anti-spam / rafale lors des pics à 3 000+ utilisateurs (15 commandes / minute / IP)
    const rateLimited = await enforceRateLimit(req, "orders:create", 15, 60);
    if (rateLimited) return rateLimited;

    const body = await req.json();
    const {
      items,
      product,
      quantity = 1,
      clientName,
      clientPhone,
      clientEmail,
      deliveryDetails,
      paymentMethod = "CASH_ON_DELIVERY",
      mobileMoneyOperator,
      currency = "USD",
      notes
    } = body;

    // 1. Authentification optionnelle (support Invité / GUEST)
    let authenticatedUid: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
        authenticatedUid = decoded.uid;
      } catch {
        // Token expiré ou invalide, on continue en mode non-authentifié si autorisé
      }
    }

    // Sécurité anti-usurpation : jamais faire confiance à body.clientId sans token Firebase vérifié
    const clientId = authenticatedUid || "GUEST";

    // 2. Validation des coordonnées requises
    if (!clientName?.trim()) {
      return NextResponse.json({ success: false, error: "Le nom du client est requis." }, { status: 400 });
    }
    if (!clientPhone?.trim()) {
      return NextResponse.json({ success: false, error: "Le numéro de téléphone est requis." }, { status: 400 });
    }
    if (!deliveryDetails?.address?.trim()) {
      return NextResponse.json({ success: false, error: "L'adresse de livraison est requise." }, { status: 400 });
    }

    const commune = String(deliveryDetails.commune || "Gombe").trim();
    const deliveryFeeNegotiated = isNegotiatedDeliveryCommune(commune);
    const customDestination = String(deliveryDetails.customDestination || "").trim();
    const city = deliveryFeeNegotiated && customDestination
      ? customDestination
      : (deliveryDetails.city || "Kinshasa");
    const officialCommuneFee = getDeliveryFeeForCommune(commune);
    const deliveryFee = deliveryFeeNegotiated
      ? 0
      : (deliveryDetails.deliveryFee !== undefined && Number(deliveryDetails.deliveryFee) >= officialCommuneFee
          ? Number(deliveryDetails.deliveryFee)
          : officialCommuneFee);

    // 3. Normalisation de la liste des articles
    let rawItems: any[] = [];
    if (Array.isArray(items) && items.length > 0) {
      rawItems = items.map((it: any) => ({
        id: it.id || it.productId,
        productId: it.productId || it.id,
        title: it.title || "Article",
        price: Math.max(0, Number(it.price) || 0),
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
        image: it.image || it.imageUrl || "/images/placeholder.png",
        supplierId: it.supplierId || "admin",
        rayon: it.rayon || it.category || "connect"
      }));
    } else if (product) {
      const q = Math.max(1, Math.floor(Number(quantity) || 1));
      const unitP = Math.max(0, Number(product.price) || 0);
      rawItems = [
        {
          id: product.id,
          productId: product.id,
          title: product.title?.fr || product.title?.en || product.title || "Article",
          price: unitP,
          quantity: q,
          image: product.imageUrl || product.image || "/images/placeholder.png",
          supplierId: product.supplierId || "admin",
          rayon: product.rayon || product.category || "connect"
        }
      ];
    } else {
      return NextResponse.json({ success: false, error: "Aucun article fourni dans la commande." }, { status: 400 });
    }

    // 3b. Vérification serveur STRICTE des prix et fournisseurs réels depuis Firestore (anti-falsification de prix)
    const orderItems: any[] = [];
    for (const it of rawItems) {
      const prodId = String(it.productId || "").trim();
      if (!prodId) {
        return NextResponse.json(
          { success: false, error: "Identifiant produit manquant dans la commande." },
          { status: 400 }
        );
      }

      const prodSnap = await adminDb.collection("products").doc(prodId).get();
      if (!prodSnap.exists) {
        return NextResponse.json(
          { success: false, error: `L'article "${it.title || prodId}" est introuvable ou n'est plus disponible.` },
          { status: 400 }
        );
      }

      const pData = prodSnap.data() || {};
      if (pData.status === "REJECTED" || pData.status === "ARCHIVED_DELETION" || pData.isHidden === true) {
        return NextResponse.json(
          { success: false, error: `L'article "${it.title || prodId}" n'est plus disponible à la vente.` },
          { status: 400 }
        );
      }

      const verifiedPrice = Number(pData.price);
      if (!Number.isFinite(verifiedPrice) || verifiedPrice <= 0) {
        return NextResponse.json(
          { success: false, error: `Prix officiel invalide pour l'article "${it.title || prodId}".` },
          { status: 400 }
        );
      }

      const verifiedSupplierId = pData.supplierId || it.supplierId || "admin";
      const verifiedTitle = pData.title?.fr || pData.title?.en || pData.title || pData.name || it.title;
      const verifiedPurchasePrice = Math.max(0, Number(pData.purchasePrice) || 0);
      const costOfGoodsSold = Number((verifiedPurchasePrice * it.quantity).toFixed(2));
      const itemNetProfit = Number(((verifiedPrice - verifiedPurchasePrice) * it.quantity).toFixed(2));
      const isAdminProduct = Boolean(
        pData.isAdminProduct ||
          pData.isOfficialRayons ||
          pData.isOfficialAdminStore ||
          verifiedSupplierId === "admin"
      );
      const rawImage = typeof it.image === "string" ? it.image : "";
      const safeImage = rawImage.startsWith("data:") ? "" : rawImage.slice(0, 400);

      orderItems.push({
        ...it,
        id: prodId,
        productId: prodId,
        title: verifiedTitle,
        price: verifiedPrice,
        purchasePrice: verifiedPurchasePrice,
        costOfGoodsSold,
        netProfit: itemNetProfit,
        isAdminProduct,
        image: safeImage,
        supplierId: verifiedSupplierId,
      });
    }

    // 4. Calculs des montants
    const subtotal = orderItems.reduce((acc, it) => acc + (it.price * it.quantity), 0);
    const totalAmount = subtotal + deliveryFee;

    // Collecte des identifiants fournisseurs concernés
    const supplierIds = Array.from(new Set(orderItems.map((it) => it.supplierId).filter(Boolean)));
    const primarySupplierId = supplierIds[0] || "admin";
    const primaryTitle = orderItems.length === 1 
      ? orderItems[0].title 
      : `${orderItems[0].title} (+${orderItems.length - 1} autre(s))`;

    // 5. Génération du numéro de commande unique
    const orderId = `CMD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;
    const fullAddress = deliveryFeeNegotiated
      ? `${deliveryDetails.address.trim()}${customDestination ? `, ${customDestination}` : ""} (Livraison à convenir avec le vendeur)`
      : `${deliveryDetails.address.trim()}, ${commune}, ${city}`;

    const orderData = {
      id: orderId,
      orderNumber: orderId,
      clientId,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail?.trim() || null,
      supplierId: primarySupplierId,
      supplierIds,
      productTitle: primaryTitle,
      quantity: orderItems.reduce((sum, it) => sum + it.quantity, 0),
      unitPrice: orderItems.length === 1 ? orderItems[0].price : 0,
      subtotal,
      deliveryFee,
      deliveryFeeNegotiated,
      deliveryFeeLabel: deliveryFeeNegotiated ? "À convenir avec le vendeur" : `$${deliveryFee}`,
      totalAmount,
      remainingBalance: totalAmount,
      currency,
      items: orderItems,
      deliveryDetails: {
        city,
        commune,
        customDestination: customDestination || null,
        deliveryFeeNegotiated,
        address: deliveryDetails.address.trim(),
        recipientName: clientName.trim(),
        recipientPhone: clientPhone.trim(),
        fullAddress
      },
      paymentMethod,
      mobileMoneyOperator: mobileMoneyOperator || null,
      paymentStatus: paymentMethod === "CASH_ON_DELIVERY" ? "PAYMENT_ON_DELIVERY" : "AWAITING_PAYMENT",
      status: "CONFIRMED_AWAITING_DRIVER",
      clientLocation: {
        city,
        commune
      },
      notes: notes?.trim() || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };

    // 6. Sauvegarde atomique en base via Firebase Admin
    await adminDb.collection("orders").doc(orderId).set(orderData);

    // 7. Décrémenter les stocks des produits commandés
    for (const item of orderItems) {
      if (item.productId) {
        try {
          const prodRef = adminDb.collection("products").doc(item.productId);
          await prodRef.update({
            stock: FieldValue.increment(-item.quantity)
          });
        } catch (stockErr) {
          console.warn(`[OrderCreate] Warn updating stock for product ${item.productId}:`, stockErr);
        }
      }
    }

    // 8. Notifications in-app + Push Mobile pour le client et les fournisseurs + clôture du panier abandonné
    const pushTasks: Promise<any>[] = [];
    if (clientId !== "GUEST") {
      pushTasks.push(
        adminDb
          .collection("abandoned_carts")
          .doc(`user_${clientId}`)
          .set(
            {
              status: "CONVERTED",
              convertedOrderId: orderId,
              convertedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          )
          .catch(() => {})
      );
      pushTasks.push(
        dispatchAccountNotification({
          userId: clientId,
          clientId,
          type: "order",
          title: "Commande validée avec succès 🎉",
          message: `Votre commande #${orderId.slice(-6)} (${primaryTitle} - $${totalAmount.toFixed(2)}) est enregistrée. Un livreur va prendre en charge la livraison à ${commune}.`,
          link: `/order/${orderId}/tracking`,
          tag: `order-client-${orderId}`,
        })
      );
    }

    for (const supId of supplierIds) {
      if (supId) {
        pushTasks.push(
          dispatchAccountNotification({
            userId: supId,
            supplierId: supId,
            type: "order",
            title: "💰 Nouvelle vente ! Commande reçue 📦",
            message: `Nouvelle commande #${orderId.slice(-6)} de ${clientName} (${commune}) pour $${subtotal.toFixed(2)} (${primaryTitle}).`,
            link: supId === "admin" ? "/admin/orders" : "/supplier/orders",
            tag: `order-sup-${orderId}-${supId}`,
          })
        );
      }
    }

    await Promise.allSettled(pushTasks);

    return NextResponse.json({
      success: true,
      orderId,
      order: orderData,
      message: "Commande créée avec succès."
    }, { status: 201 });

  } catch (error: any) {
    console.error("[OrderCreate] Erreur création de commande:", error);
    return NextResponse.json({
      success: false,
      error: error.message || "Erreur interne lors de la création de la commande."
    }, { status: 500 });
  }
}

