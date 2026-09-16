import { db } from "./firebase";
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

/**
 * Système de certification et de vote client pour les produits
 * Règle : 
 * - Les produits Admin sont vérifiés d'office ("Certifié • Officiel Rayons").
 * - Les produits Fournisseurs doivent être votés par les clients. 
 * - Si note moyenne >= 4.0/5 avec au moins 3 votes : statut Vérifié accordé.
 * - Si note moyenne < 3.5/5 : le produit perd son statut vérifié et affiche sa cote d'alerte.
 */

export interface ProductVerificationStatus {
  isVerified: boolean;
  isAdminProduct: boolean;
  averageRating: number;
  ratingsCount: number;
  label: string;
  badgeType: "admin_official" | "community_verified" | "pending_evaluation" | "low_rating";
}

export function evaluateProductVerification(product: any): ProductVerificationStatus {
  if (!product) {
    return {
      isVerified: false,
      isAdminProduct: false,
      averageRating: 0,
      ratingsCount: 0,
      label: "Non certifié",
      badgeType: "pending_evaluation"
    };
  }

  // 1. Vérification stricte : Seul un produit DIRECTEMENT publié par l'Admin est "Certifié • Officiel Rayons".
  // Un produit créé par un fournisseur (même validé par l'admin) appartient au fournisseur et sa réputation dépend uniquement de la notation client.
  const isDirectAdminProduct = Boolean(
    (product.isAdminProduct === true || product.isOfficialRayons === true) &&
    (
      product.supplierEmail === "danielkiboko218@gmail.com" ||
      product.supplierId === "admin" ||
      product.supplierRole === "SUPER_ADMIN" ||
      product.supplierRole === "superAdmin"
    )
  );

  if (isDirectAdminProduct) {
    return {
      isVerified: true,
      isAdminProduct: true,
      averageRating: 5.0,
      ratingsCount: product.ratingsCount || 1,
      label: "Certifié • Officiel Rayons",
      badgeType: "admin_official"
    };
  }

  // 2. Produit Fournisseur : calcul selon les votes des clients
  const ratingsCount = Number(product.ratingsCount || 0);
  const averageRating = Number(product.averageRating || 0);

  // Si au moins 3 votes et note moyenne >= 4.0 : Vérifié
  if (ratingsCount >= 3 && averageRating >= 4.0) {
    return {
      isVerified: true,
      isAdminProduct: false,
      averageRating,
      ratingsCount,
      label: `Vérifié par les clients (${averageRating.toFixed(1)}/5)`,
      badgeType: "community_verified"
    };
  }

  // Si au moins 3 votes mais note moyenne < 3.5 : Mauvaise cote / non vérifié
  if (ratingsCount >= 3 && averageRating < 3.5) {
    return {
      isVerified: false,
      isAdminProduct: false,
      averageRating,
      ratingsCount,
      label: `Vigilance requise (${averageRating.toFixed(1)}/5)`,
      badgeType: "low_rating"
    };
  }

  // Moins de 3 avis : en cours d'évaluation
  return {
    isVerified: false,
    isAdminProduct: false,
    averageRating: averageRating > 0 ? averageRating : 0,
    ratingsCount,
    label: ratingsCount > 0 ? `${averageRating.toFixed(1)}/5 (${ratingsCount} avis)` : "En attente d'évaluation",
    badgeType: "pending_evaluation"
  };
}

/**
 * Enregistrement d'une note client sur un produit et recalcul automatique du statut
 */
export async function submitProductReview(params: {
  productId: string;
  clientId: string;
  clientName: string;
  rating: number; // 1 à 5
  comment?: string;
}): Promise<{ success: boolean; newAverage: number; isVerified: boolean }> {
  const { productId, clientId, clientName, rating, comment } = params;

  if (rating < 1 || rating > 5) {
    throw new Error("La note doit être comprise entre 1 et 5 étoiles.");
  }

  const productRef = doc(db, "products", productId);
  const productSnap = await getDoc(productRef);

  if (!productSnap.exists()) {
    throw new Error("Produit introuvable");
  }

  const currentData = productSnap.data();

  // Enregistrer le vote dans la sous-collection "reviews"
  await addDoc(collection(db, "products", productId, "reviews"), {
    clientId,
    clientName,
    rating,
    comment: comment || "",
    createdAt: serverTimestamp()
  });

  // Calculer la nouvelle moyenne
  const reviewsSnap = await getDocs(collection(db, "products", productId, "reviews"));
  let totalScore = 0;
  let count = 0;

  reviewsSnap.forEach((docSnap) => {
    const r = docSnap.data().rating;
    if (typeof r === "number") {
      totalScore += r;
      count += 1;
    }
  });

  const newAverage = count > 0 ? Math.round((totalScore / count) * 10) / 10 : rating;
  const isVerified = count >= 3 && newAverage >= 4.0;

  await updateDoc(productRef, {
    averageRating: newAverage,
    ratingsCount: count,
    isVerified: isVerified
  });

  return {
    success: true,
    newAverage,
    isVerified
  };
}
