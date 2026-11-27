import { enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { initFirebaseAdmin, adminDb } from "@/lib/firebase-admin";
import { getServerCaller, canActForSupplier } from "@/lib/serverAuth";

export async function POST(req: Request) {
  
  const _rl = await enforceRateLimit(req, "api:properties_update-status:POST", 20, 60);
  if (_rl) return _rl;let propertyId = "unknown";
  try {
    const caller = await getServerCaller(req);
    if (!caller) {
      return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
    }

    const body = await req.json();
    propertyId = body.propertyId;
    const { status, rejectionReason, supplierId, title } = body;

    if (!propertyId || !status) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    await initFirebaseAdmin();
    const db = adminDb;

    // 1. Vérifier les droits sur la propriété
    const propRef = db.collection("properties").doc(propertyId);
    const propSnap = await propRef.get();
    if (!propSnap.exists) {
      return NextResponse.json({ success: false, error: "Propriété introuvable." }, { status: 404 });
    }
    const propData = propSnap.data() || {};
    const ownerSupplierId = propData.supplierId || supplierId;

    // Seul un admin peut approuver ("Disponible") ou rejeter ("REJECTED") une annonce en modération
    if ((status === "Disponible" || status === "REJECTED") && !caller.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Seul un administrateur peut approuver ou rejeter un bien immobilier." },
        { status: 403 }
      );
    }

    if (!caller.isAdmin && !canActForSupplier(caller, ownerSupplierId)) {
      return NextResponse.json({ success: false, error: "Accès refusé." }, { status: 403 });
    }
    
    const updateData: any = { status };
    if (rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }
    
    await propRef.update(updateData);

    // 2. Envoyer la notification in-app au fournisseur
    if (supplierId) {
      let notifTitle = "";
      let notifMessage = "";

      const propertyTitle = title?.fr || title || 'Immobilier';

      if (status === "Disponible") {
        notifTitle = "Annonce Publiée";
        notifMessage = `Félicitations, votre bien "${propertyTitle}" est maintenant en ligne !`;
      } else if (status === "REJECTED") {
        notifTitle = "Annonce Rejetée";
        notifMessage = `Votre bien "${propertyTitle}" a été rejeté. Motif : ${rejectionReason || "Non spécifié"}`;
      }

      if (notifTitle) {
        await db.collection("inapp_notifications").add({
          supplierId: supplierId,
          type: "property",
          title: notifTitle,
          message: notifMessage,
          time: Date.now(),
          link: "/supplier/properties",
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating property status for propertyId " + propertyId + ":", error);
    return NextResponse.json({ success: false, error: error.message + ` (propertyId: ${propertyId})` }, { status: 500 });
  }
}
