import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

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

    // Check latest role from Firestore first
    let firestoreRole: string | null = null;
    try {
      const userDoc = await adminDb.collection('users').doc(callerUid).get();
      if (userDoc.exists) {
        firestoreRole = userDoc.data()?.role;
      }
    } catch (dbErr) {
      console.warn('Could not fetch caller doc from Firestore:', dbErr);
    }

    const rawRole = (firestoreRole || decodedToken.role || '').toString().toUpperCase();
    const isSuperAdminCaller = callerEmail === "danielkiboko218@gmail.com" || rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN';
    const isSubAdminCaller = ['SUB_ADMIN', 'SUBADMIN', 'ADMIN'].includes(rawRole);
    const isAuthorizedAdmin = isSuperAdminCaller || isSubAdminCaller;
    const isSupplierCaller = ['SUPPLIER', 'SUPPLIER_IMMO', 'SUB_SUPPLIER'].includes(rawRole);

    const body = await req.json();
    const { uid, collectionName } = body;

    if (!uid) {
      return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
    }

    // CRITICAL SECURITY: The Super Admin can NEVER be deleted or revoked by anyone!
    let targetDocSnap: any = null;
    try {
      targetDocSnap = await adminDb.collection('users').doc(uid).get();
      if (targetDocSnap.exists) {
        const targetData = targetDocSnap.data();
        const targetEmail = (targetData?.email || '').toLowerCase().trim();
        const targetRole = (targetData?.role || '').toString().toUpperCase();
        if (targetEmail === 'danielkiboko218@gmail.com' || targetRole === 'SUPER_ADMIN' || targetRole === 'SUPERADMIN') {
          return NextResponse.json({ 
            error: 'Action interdite : Le compte Super Administrateur (Directeur Général) ne peut jamais être révoqué ni supprimé.' 
          }, { status: 403 });
        }

        // Sub-Admins cannot delete other internal staff members
        if (isSubAdminCaller && !isSuperAdminCaller) {
          const staffRoles = ['SUB_ADMIN', 'SUBADMIN', 'ADMIN', 'ADMIN_FINANCE', 'ADMIN_DB', 'ADMIN_TECH', 'ADMIN_OPS'];
          if (staffRoles.includes(targetRole) || targetData?.isInternalStaff) {
            return NextResponse.json({ 
              error: 'Action interdite : Un Sous-Administrateur ne peut pas révoquer ni supprimer un membre de l\'équipe administrative.' 
            }, { status: 403 });
          }
        }
      }
    } catch (err: any) {
      console.warn('Error checking target user before deletion:', err);
    }

    if (!isAuthorizedAdmin) {
      // Si ce n'est pas un admin, vérifier si le demandeur est le parentSupplier du compte à supprimer
      if (isSupplierCaller) {
        const targetData = targetDocSnap?.data();
        if (!targetData || (targetData.parentSupplierId !== callerUid && targetData.createdBy !== callerUid)) {
          return NextResponse.json({ error: 'Forbidden: You can only delete your own sub-agents' }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: 'Forbidden: Insufficient permissions to delete users' }, { status: 403 });
      }
    }

    // 1. Delete from Firebase Auth
    try {
      await adminAuth.deleteUser(uid);
    } catch (authErr: any) {
      if (authErr.code !== 'auth/user-not-found') {
        console.warn('Auth deletion error (non-fatal):', authErr.message);
      }
    }

    // 2. Delete from Firestore (users, suppliers, drivers)
    const batch = adminDb.batch();
    batch.delete(adminDb.collection('users').doc(uid));
    batch.delete(adminDb.collection('suppliers').doc(uid));
    batch.delete(adminDb.collection('drivers').doc(uid));
    
    if (collectionName) {
      batch.delete(adminDb.collection(collectionName).doc(uid));
    }

    // 3. Delete products and properties associated with this supplier
    try {
      const [productsSnapshot, propertiesSnapshot] = await Promise.all([
        adminDb.collection('products').where('supplierId', '==', uid).get(),
        adminDb.collection('properties').where('supplierId', '==', uid).get()
      ]);

      productsSnapshot.forEach((doc: any) => {
        batch.delete(doc.ref);
      });

      propertiesSnapshot.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
    } catch (queryErr) {
      console.warn('Could not fetch supplier products or properties:', queryErr);
    }

    await batch.commit();

    return NextResponse.json({ message: 'User and associated data deleted successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
