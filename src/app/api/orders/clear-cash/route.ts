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
    let orderNum = orderId.substring(0, 8).toUpperCase();

    await adminDb.runTransaction(async (transaction: any) => {
      const orderDoc = await transaction.get(orderRef);

      if (!orderDoc.exists) {
        throw new Error("ORDER_NOT_FOUND");
      }

      const orderData = orderDoc.data() || {};
      const dName = orderData.collectedByDriverName || orderData.driverName || "Livreur";
      const amount = Number(orderData.collectedAmount) || Number(orderData.remainingBalance) || Number(orderData.totalAmount) || 0;

      // 1. Clôturer le transfert d'argent sur la commande
      transaction.update(orderRef, {
        cashHandedOverToSupplier: true,
        cashHandedOverAt: FieldValue.serverTimestamp(),
        paymentStatus: "PAID",
        updatedAt: FieldValue.serverTimestamp(),
      });

      // 2. Mettre à jour les transactions de ce fournisseur liées à cette commande
      const txQuery = adminDb
        .collection("supplier_transactions")
        .where("orderId", "==", orderId)
        .where("supplierId", "==", supplierId);

      const txDocs = await transaction.get(txQuery);
      let matchedCount = 0;
      txDocs.forEach((d: any) => {
        matchedCount++;
        transaction.update(d.ref, {
          status: "COMPLETED",
          isPendingHandover: false,
          clearedAt: FieldValue.serverTimestamp(),
          description: `Commande livrée #${orderNum} - Espèces remises en caisse par ${dName}`,
        });
      });

      // Fallback si la transaction a été enregistrée avec referenceId au lieu de orderId
      if (matchedCount === 0) {
        const refQuery = adminDb
          .collection("supplier_transactions")
          .where("referenceId", "==", orderId)
          .where("supplierId", "==", supplierId);
        const refDocs = await transaction.get(refQuery);
        refDocs.forEach((d: any) => {
          transaction.update(d.ref, {
            status: "COMPLETED",
            isPendingHandover: false,
            clearedAt: FieldValue.serverTimestamp(),
            description: `Commande livrée #${orderNum} - Espèces remises en caisse par ${dName}`,
          });
        });
      }

      // 3. Ajouter l'écriture de confirmation dans le grand livre de caisse
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
      { success: false, error: "Erreur serveur lors de la validation de la caisse." },
      { status: 500 }
    );
  }
}
