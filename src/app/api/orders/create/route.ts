import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { getDeliveryFeeForCommune } from "@/lib/kinshasaDelivery";

export async function POST(req: NextRequest) {
  try {
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

    const clientId = authenticatedUid || body.clientId || "GUEST";

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

    const commune = deliveryDetails.commune || "Gombe";
    const city = deliveryDetails.city || "Kinshasa";
    const deliveryFee = deliveryDetails.deliveryFee !== undefined 
      ? Number(deliveryDetails.deliveryFee) 
      : getDeliveryFeeForCommune(commune);

    // 3. Normalisation de la liste des articles
    let orderItems: any[] = [];
    if (Array.isArray(items) && items.length > 0) {
      orderItems = items.map((it: any) => ({
        id: it.id || it.productId,
        productId: it.productId || it.id,
        title: it.title || "Article",
        price: Number(it.price) || 0,
        quantity: Math.max(1, Number(it.quantity) || 1),
        image: it.image || it.imageUrl || "/images/placeholder.png",
        supplierId: it.supplierId || "admin",
        rayon: it.rayon || it.category || "connect"
      }));
    } else if (product) {
      const q = Math.max(1, Number(quantity) || 1);
      const unitP = Number(product.price) || 0;
      orderItems = [
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
    const fullAddress = `${deliveryDetails.address.trim()}, ${commune}, ${city}`;

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
      totalAmount,
      remainingBalance: totalAmount,
      currency,
      items: orderItems,
      deliveryDetails: {
        city,
        commune,
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

    // 8. Notifications in-app pour le client et les fournisseurs
    const notifBatch = adminDb.batch();
    if (clientId !== "GUEST") {
      const clientNotifRef = adminDb.collection("inapp_notifications").doc();
      notifBatch.set(clientNotifRef, {
        userId: clientId,
        clientId,
        type: "order",
        title: "Commande validée avec succès 🎉",
        message: `Votre commande #${orderId.slice(-6)} (${primaryTitle} - $${totalAmount.toFixed(2)}) est enregistrée. Un livreur va prendre en charge la livraison à ${commune}.`,
        link: `/order/${orderId}/tracking`,
        read: false,
        time: Date.now(),
        createdAt: FieldValue.serverTimestamp()
      });
    }

    for (const supId of supplierIds) {
      if (supId && supId !== "admin") {
        const supNotifRef = adminDb.collection("inapp_notifications").doc();
        notifBatch.set(supNotifRef, {
          userId: supId,
          supplierId: supId,
          type: "order",
          title: "Nouvelle commande reçue 📦",
          message: `Nouvelle commande #${orderId.slice(-6)} de ${clientName} (${commune}) pour un montant de $${subtotal.toFixed(2)}.`,
          link: "/supplier/orders",
          read: false,
          time: Date.now(),
          createdAt: FieldValue.serverTimestamp()
        });
      }
    }

    await notifBatch.commit().catch((err: any) => console.warn("[OrderCreate] Notification batch warn:", err));

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

