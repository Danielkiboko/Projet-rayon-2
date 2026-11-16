import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { getServerCaller, canActForSupplier } from '@/lib/serverAuth';

export async function POST(req: Request) {
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const { productId, quantity, action } = await req.json();

    if (!productId || typeof quantity !== 'number' || !['decrement', 'increment'].includes(action)) {
      return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
    }

    const productRef = adminDb.collection('products').doc(productId);
    const productSnap = await productRef.get();
    if (!productSnap.exists) {
      return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
    }

    const productData = productSnap.data() || {};
    if (!canActForSupplier(caller, productData.supplierId || 'admin')) {
      return NextResponse.json({ error: "Non autorisé à modifier le stock de ce produit." }, { status: 403 });
    }
    
    const amount = action === 'decrement' ? -Math.abs(quantity) : Math.abs(quantity);

    await productRef.update({
      stock: FieldValue.increment(amount)
    });

    return NextResponse.json({ success: true, message: "Stock mis à jour avec succès." });

  } catch (error: any) {
    console.error("Erreur API update-stock:", error);
    return NextResponse.json({ error: error.message || "Erreur interne" }, { status: 500 });
  }
}
