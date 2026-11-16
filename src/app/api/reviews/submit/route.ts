import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { initFirebaseAdmin, adminDb } from "@/lib/firebase-admin";
import { getServerCaller } from "@/lib/serverAuth";

export async function POST(req: Request) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json(
        { success: false, error: "Vous devez être connecté pour publier un avis." },
        { status: 401 }
      );
    }

    const body = await req.json();
    const {
      targetType = "property", // "property" | "product"
      targetId,
      clientId,
      clientName = "Client Rayons",
      clientEmail,
      rating,
      comment = "",
    } = body;

    const effectiveClientId = caller.isAdmin && clientId ? clientId : caller.uid;

    if (!targetId || typeof rating !== "number") {
      return NextResponse.json(
        { success: false, error: "Champs requis manquants (targetId, rating)" },
        { status: 400 }
      );
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: "La note doit être comprise entre 1 et 5 étoiles." },
        { status: 400 }
      );
    }

    await initFirebaseAdmin();
    const db = adminDb;

    const collectionName = targetType === "product" ? "products" : "properties";
    const targetRef = db.collection(collectionName).doc(targetId);
    const targetSnap = await targetRef.get();

    if (!targetSnap.exists) {
      return NextResponse.json(
        { success: false, error: `${targetType === "product" ? "Produit" : "Bien"} introuvable.` },
        { status: 404 }
      );
    }

    const targetData = targetSnap.data() || {};

    // 1. Enregistrer l'avis (un seul avis par utilisateur et par produit/bien pour éviter le bourrage de notes)
    const reviewsRef = targetRef.collection("reviews");
    await reviewsRef.doc(effectiveClientId).set({
      clientId: effectiveClientId,
      clientName: clientName.trim(),
      clientEmail: clientEmail || caller.email || null,
      rating: Math.round(rating),
      comment: (comment || "").trim(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // 2. Recalculer la note moyenne et le nombre d'avis
    const allReviewsSnap = await reviewsRef.get();
    let totalScore = 0;
    let count = 0;

    allReviewsSnap.forEach((docSnap: any) => {
      const r = docSnap.data().rating;
      if (typeof r === "number") {
        totalScore += r;
        count += 1;
      }
    });

    const newAverage = count > 0 ? Math.round((totalScore / count) * 10) / 10 : rating;

    const updatePayload: any = {
      averageRating: newAverage,
      ratingsCount: count,
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (targetType === "product") {
      updatePayload.isVerified = count >= 3 && newAverage >= 4.0;
    }

    await targetRef.update(updatePayload);

    // 3. Notification in-app au propriétaire / fournisseur si existant
    if (targetData.supplierId && targetData.supplierId !== "admin") {
      const targetTitle = targetData.title?.fr || targetData.title || (targetType === "product" ? "Produit" : "Bien");
      await db.collection("inapp_notifications").add({
        supplierId: targetData.supplierId,
        type: "review",
        title: "Nouvel avis client ⭐",
        message: `${clientName} a attribué ${rating}★ à "${targetTitle}" : "${comment ? comment.slice(0, 80) : 'Aucun commentaire'}"`,
        time: Date.now(),
        link: targetType === "product" ? `/supplier/products` : `/supplier/properties`,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      success: true,
      newAverage,
      ratingsCount: count,
    });
  } catch (error: any) {
    console.error("Error submitting review:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Erreur serveur lors de la soumission de l'avis." },
      { status: 500 }
    );
  }
}
