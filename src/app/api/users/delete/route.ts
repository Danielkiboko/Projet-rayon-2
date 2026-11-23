import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { SUPER_ADMIN_EMAILS } from '@/lib/serverAuth';
import { recordAuditLog } from '@/server/auditLog';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const callerUid = decodedToken.uid;
    const callerEmail = (decodedToken.email || '').toLowerCase().trim();
    const isSuperAdminEmail = SUPER_ADMIN_EMAILS.includes(callerEmail);

    const body = await req.json();
    const { uid, collectionName } = body;

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    const runWithTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`FIRESTORE_TIMEOUT:${label}`)), ms)
        ),
      ]);

    // Charger callerDoc (sauf si déjà SuperAdmin par email) et targetDoc en PARALLÈLE (1 seul aller-retour)
    let callerData: any = null;
    let targetDocSnap: any = null;
    try {
      const [callerSnap, tSnap] = await runWithTimeout(
        Promise.all([
          isSuperAdminEmail ? Promise.resolve(null) : adminDb.collection('users').doc(callerUid).get(),
          adminDb.collection('users').doc(uid).get(),
        ]),
        8000,
        'users.lookup'
      );
      if (callerSnap?.exists) callerData = callerSnap.data();
      targetDocSnap = tSnap;
    } catch (dbErr) {
      console.warn('Could not fetch caller/target doc from Firestore:', dbErr);
    }

    const firestoreRole = callerData?.role || null;
    const rawRole = (firestoreRole || decodedToken.role || '').toString().toUpperCase();
    const callerPositions: string[] = Array.isArray(callerData?.staffProfile?.positions)
      ? callerData.staffProfile.positions.map((p: any) => String(p).toUpperCase())
      : [];

    // Règle stricte : seuls l'Admin Principal (Super Admin) ou un membre Team ayant explicitement le statut d'Admin (SUB_ADMIN / ADMIN) peuvent supprimer un fournisseur.
    const STRICT_ADMIN_STATUS_ROLES = ['SUB_ADMIN', 'SUBADMIN', 'SOUS_ADMIN', 'SOUS_ADMIN_GENERAL', 'ADMIN'];
    const isSuperAdminCaller =
      isSuperAdminEmail ||
      rawRole === 'SUPER_ADMIN' ||
      rawRole === 'SUPERADMIN' ||
      callerData?.isSuperAdmin === true;
    const isSubAdminCaller =
      STRICT_ADMIN_STATUS_ROLES.includes(rawRole) ||
      callerPositions.some((p) => STRICT_ADMIN_STATUS_ROLES.includes(p)) ||
      callerData?.isAdmin === true;
    const isAuthorizedAdmin = isSuperAdminCaller || isSubAdminCaller;
    const isSupplierCaller = [
      'SUPPLIER', 'SUPPLIER_IMMO', 'SUPPLIER_MODE', 'SUPPLIER_CONNECT', 'SUPPLIER_SAVEURS', 'SUB_SUPPLIER', 'FOURNISSEUR'
    ].includes(rawRole) || callerData?.isSupplier === true;

    // CRITICAL SECURITY: The Super Admin can NEVER be deleted or revoked by anyone!
    if (targetDocSnap?.exists) {
      const targetData = targetDocSnap.data();
      const targetEmail = (targetData?.email || '').toLowerCase().trim();
      const targetRole = (targetData?.role || '').toString().toUpperCase();
      if (SUPER_ADMIN_EMAILS.includes(targetEmail) || targetRole === 'SUPER_ADMIN' || targetRole === 'SUPERADMIN') {
        return NextResponse.json({ 
          error: 'Action interdite : Le compte Super Administrateur (Directeur Général) ne peut jamais être révoqué ni supprimé.' 
        }, { status: 403 });
      }

      // Sub-Admins cannot delete other internal staff members
      if (isSubAdminCaller && !isSuperAdminCaller) {
        const staffRoles = [
          'SUB_ADMIN', 'SUBADMIN', 'ADMIN', 'ADMIN_FINANCE', 'ADMIN_DB', 'ADMIN_TECH', 'ADMIN_OPS',
          'GESTIONNAIRE_ADMIN', 'RESPONSABLE_LOGISTIQUE', 'RESPONSABLE_FINANCIER', 'RESPONSABLE_CATALOGUE', 'SUPPORT_CLIENT', 'STAFF'
        ];
        if (staffRoles.includes(targetRole) || targetData?.isInternalStaff) {
          return NextResponse.json({ 
            error: 'Action interdite : Seul le Super Administrateur peut révoquer ou supprimer un membre de l\'équipe administrative.' 
          }, { status: 403 });
        }
      }
    }

    if (!isAuthorizedAdmin) {
      // Si ce n'est pas un admin, vérifier si le demandeur est le parentSupplier du compte à supprimer
      if (isSupplierCaller) {
        const targetData = targetDocSnap?.data();
        if (!targetData || (targetData.parentSupplierId !== callerUid && targetData.createdBy !== callerUid)) {
          return NextResponse.json({ error: 'Forbidden: You can only delete your own sub-agents' }, { status: 403 });
        }
      } else {
        return NextResponse.json(
          { error: "Action réservée : seul l'Administrateur Principal ou un membre Team disposant du statut Admin peut supprimer un fournisseur." },
          { status: 403 }
        );
      }
    }

    // 1. Delete from Firebase Auth + fetch supplier products/properties REFS ONLY (.select() = 0 payload!) en PARALLÈLE
    const [authRes, productsSnapshot, propertiesSnapshot]: [any, any, any] = await Promise.all([
      adminAuth.deleteUser(uid).catch((authErr: any) => {
        if (authErr?.code !== 'auth/user-not-found') {
          console.warn('Auth deletion error (non-fatal):', authErr?.message);
        }
        return null;
      }),
      runWithTimeout<any>(
        adminDb.collection('products').where('supplierId', '==', uid).select().limit(200).get(),
        8000,
        'products.refs'
      ).catch((queryErr) => {
        console.warn('Could not fetch supplier product refs:', queryErr);
        return null;
      }),
      runWithTimeout<any>(
        adminDb.collection('properties').where('supplierId', '==', uid).select().limit(200).get(),
        8000,
        'properties.refs'
      ).catch((queryErr) => {
        console.warn('Could not fetch supplier property refs:', queryErr);
        return null;
      }),
    ]);
    void authRes;

    // 2. Delete from Firestore (users, suppliers, drivers, products, properties) in 1 fast atomic batch with timeout
    const batch = adminDb.batch();
    batch.delete(adminDb.collection('users').doc(uid));
    batch.delete(adminDb.collection('suppliers').doc(uid));
    batch.delete(adminDb.collection('drivers').doc(uid));
    
    const allowedCollections = ['users', 'suppliers', 'drivers'];
    if (collectionName && allowedCollections.includes(collectionName)) {
      batch.delete(adminDb.collection(collectionName).doc(uid));
    }

    productsSnapshot?.forEach((doc: any) => {
      batch.delete(doc.ref);
    });
    propertiesSnapshot?.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    try {
      await runWithTimeout(batch.commit(), 10000, 'delete.batch.commit');
    } catch (commitErr: any) {
      const msg = String(commitErr?.message || '');
      if (commitErr?.code === 8 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('FIRESTORE_TIMEOUT')) {
        return NextResponse.json(
          {
            error:
              "Firestore met trop de temps à répondre ou son quota quotidien est saturé. Le compte Auth a été révoqué ; réessayez dans quelques instants si la fiche reste visible.",
            code: 'FIRESTORE_TIMEOUT_OR_QUOTA',
          },
          { status: 503 }
        );
      }
      throw commitErr;
    }

    recordAuditLog({
      action: "USER_DELETED",
      caller: { uid: callerUid, email: callerEmail, role: rawRole },
      targetType: "user",
      targetId: uid,
      summary: `Compte utilisateur supprimé (${targetDocSnap?.data()?.email || uid}).`,
      metadata: { targetEmail: targetDocSnap?.data()?.email || null, collectionName: collectionName || "users" },
    });

    return NextResponse.json({ message: 'User and associated data deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
