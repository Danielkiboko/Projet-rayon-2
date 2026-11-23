import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { SUPER_ADMIN_EMAILS } from '@/lib/serverAuth';
import { recordAuditLog } from '@/server/auditLog';
import { purgeUserAccountCompletely } from '@/lib/purgeUserAccount';
import { cacheDel } from '@/lib/cache';

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

    // Suppression hermétique et définitive (Auth + tokens + users/suppliers/drivers/referrals + produits/biens/abonnements/push/sous-agents)
    let purgeResult;
    try {
      purgeResult = await purgeUserAccountCompletely(uid, { collectionName });
      await cacheDel(
        "admin:suppliers:list:v1",
        "catalog:public:v1:home",
        "catalog:public:v1:mode",
        "catalog:public:v1:connect",
        "catalog:public:v1:saveurs",
        "catalog:public:v1:immo"
      );
    } catch (commitErr: any) {
      const msg = String(commitErr?.message || '');
      if (commitErr?.code === 8 || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('FIRESTORE_TIMEOUT')) {
        return NextResponse.json(
          {
            error:
              "Firestore met trop de temps à répondre ou son quota quotidien est saturé. Le compte Auth a été supprimé ; réessayez dans quelques instants si la fiche reste visible.",
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
      summary: `Compte supprimé définitivement et purgé (${targetDocSnap?.data()?.email || uid}).`,
      metadata: {
        targetEmail: targetDocSnap?.data()?.email || null,
        collectionName: collectionName || "users",
        ...purgeResult,
      },
    });

    return NextResponse.json({
      message: 'Compte et toutes les données associées supprimés définitivement.',
      purgeResult,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
