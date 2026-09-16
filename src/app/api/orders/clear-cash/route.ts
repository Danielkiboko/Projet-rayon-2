import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, supplierId } = body;

    if (!orderId || !supplierId) {
      return NextResponse.json(
        { success: false, error: "orderId et supplierId sont requis." },
        { status: 400 }
      );
    }

    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderNum = orderId.substring(0, 8).toUpperCase();

    await adminDb.runTransaction(async (transaction: any) => {
      // 1. TOUTES LES LECTURES EN PREMIER (Obligatoire dans Firestore)
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new Error("ORDER_NOT_FOUND");
      }

      // Lecture des transactions fournisseur existantes par orderId
      const txQuery = adminDb
        .collection("supplier_transactions")
        .where("orderId", "==", orderId)
        .where("supplierId", "==", supplierId);
      const txDocs = await transaction.get(txQuery);

      // Lecture des transactions fournisseur de secours par referenceId
      const refQuery = adminDb
        .collection("supplier_transactions")
        .where("referenceId", "==", orderId)
        .where("supplierId", "==", supplierId);
      const refDocs = await transaction.get(refQuery);

      // Extraire les données de la commande
      const orderData = orderDoc.data() || {};
      const dName = orderData.collectedByDriverName || orderData.driverName || "Livreur";

      // Calculer le montant spécifique au fournisseur
      const items = Array.isArray(orderData.items) ? orderData.items : [];
      const myItems = items.filter((item: any) => !item.supplierId || item.supplierId === supplierId);
      const itemsTotal = myItems.reduce((acc: number, item: any) => acc + ((Number(item.price) || 0) * (Number(item.quantity) || 1)), 0);

      let amount = itemsTotal > 0 
        ? itemsTotal 
        : (Number(orderData.collectedAmount) || Number(orderData.remainingBalance) || Number(orderData.totalAmount) || 0);

      // 2. TOUTES LES ÉCRITURES APRÈS LES LECTURES
      // A. Mettre à jour la commande
      transaction.update(orderRef, {
        cashHandedOverToSupplier: true,
        cashHandedOverAt: FieldValue.serverTimestamp(),
        paymentStatus: "PAID",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // B. Mettre à jour les transactions de caisse du fournisseur
      let updatedCount = 0;
      const updatedDocIds = new Set<string>();

      txDocs.forEach((d: any) => {
        updatedDocIds.add(d.id);
        updatedCount++;
        const txAmount = Number(d.data().amount);
        if (txAmount > 0) amount = txAmount;

        transaction.update(d.ref, {
          status: "COMPLETED",
          isPendingHandover: false,
          clearedAt: FieldValue.serverTimestamp(),
          description: `Commande livrée #${orderNum} - Espèces remises en caisse par ${dName}`,
        });
      });

      refDocs.forEach((d: any) => {
        if (!updatedDocIds.has(d.id)) {
          updatedDocIds.add(d.id);
          updatedCount++;
          const txAmount = Number(d.data().amount);
          if (txAmount > 0) amount = txAmount;

          transaction.update(d.ref, {
            status: "COMPLETED",
            isPendingHandover: false,
            clearedAt: FieldValue.serverTimestamp(),
            description: `Commande livrée #${orderNum} - Espèces remises en caisse par ${dName}`,
          });
        }
      });

      // C. Créer l'entrée si elle n'existait pas encore
      if (updatedCount === 0) {
        const newTxRef = adminDb.collection("supplier_transactions").doc();
        transaction.set(newTxRef, {
          supplierId: supplierId,
          orderId: orderId,
          type: "INCOME",
          category: "Vente Livrée (Remise Caisse)",
          amount: amount,
          currency: "USD",
          description: `Commande livrée #${orderNum} - Espèces remises en caisse par ${dName}`,
          referenceId: orderId,
          status: "COMPLETED",
          driverId: orderData.collectedByDriverId || orderData.driverId || "",
          driverName: dName,
          driverPhone: orderData.collectedByDriverPhone || orderData.driverPhone || "",
          isPendingHandover: false,
          clearedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      // D. Ajouter l'écriture de confirmation au journal de caisse central
      const ledgerRef = adminDb.collection("accounting_ledger").doc();
      const rand = Math.floor(10000 + Math.random() * 90000);
      transaction.set(ledgerRef, {
        entryNumber: `ECR-${new Date().getFullYear()}-${rand}`,
        date: FieldValue.serverTimestamp(),
        journal: "CS",
        journalName: "Journal de Caisse (Espèces)",
        referencePiece: orderId,
        label: `Reversement en caisse magasin de $${amount} - Remis par le livreur ${dName} (#${orderNum})`,
        debit: amount,
        credit: 0,
        currency: "USD",
        actorType: supplierId === "admin" ? "ADMIN" : "SUPPLIER",
        supplierId: supplierId,
        category: "Clôture Encaissement Livreur",
        status: "VALIDATED"
      });
    });

    return NextResponse.json({
      success: true,
      orderId,
      message: "Encaissement validé et intégré à votre caisse magasin avec succès !"
    });

  } catch (error: any) {
    console.error("Erreur clôture encaissement caisse:", error);

    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json(
        { success: false, code: "NOT_FOUND", message: "Commande introuvable." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || "Erreur serveur lors de la validation de la caisse." },
      { status: 500 }
    );
  }
}
