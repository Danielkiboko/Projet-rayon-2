import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { SUPER_ADMIN_EMAILS } from '@/lib/serverAuth';
import { ensureReferralCode } from '@/lib/referrals';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Non autorisé: Jeton manquant' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error: any) {
      return NextResponse.json({ error: 'Jeton invalide' }, { status: 401 });
    }

    const callerUid = decodedToken.uid;
    const callerEmail = (decodedToken.email || '').toLowerCase().trim();

    // Vérifier les droits du demandeur (SuperAdmin ou Admin requis)
    let firestoreRole: string | null = null;
    try {
      const userDoc = await adminDb.collection('users').doc(callerUid).get();
      if (userDoc.exists) {
        firestoreRole = userDoc.data()?.role;
      }
    } catch (dbErr) {
      console.warn('Erreur lecture rôle:', dbErr);
    }

    const rawRole = (firestoreRole || decodedToken.role || '').toString().toUpperCase();
    const isSuperAdminCaller = SUPER_ADMIN_EMAILS.includes(callerEmail) || rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN';
    const isSubAdminCaller = ['SUB_ADMIN', 'SUBADMIN', 'ADMIN'].includes(rawRole);
    const isAuthorizedAdmin = isSuperAdminCaller || isSubAdminCaller;

    if (!isAuthorizedAdmin) {
      return NextResponse.json({ error: 'Action interdite : Seul un Administrateur peut promouvoir ou convertir un compte.' }, { status: 403 });
    }

    const body = await req.json();
    const { uid, newRole, extraData = {} } = body;

    if (!uid || !newRole) {
      return NextResponse.json({ error: 'Paramètres manquants : uid et newRole requis' }, { status: 400 });
    }

    const targetUserDoc = await adminDb.collection('users').doc(uid).get();
    if (!targetUserDoc.exists) {
      return NextResponse.json({ error: 'Utilisateur introuvable dans la base' }, { status: 404 });
    }

    const targetData = targetUserDoc.data() || {};
    const targetEmail = (targetData.email || '').toLowerCase().trim();

    // Protection SuperAdmin
    if (SUPER_ADMIN_EMAILS.includes(targetEmail)) {
      return NextResponse.json({ error: 'Impossible de modifier le rôle du Super Administrateur.' }, { status: 403 });
    }

    // Seul le Super Admin peut créer/promouvoir en Super Admin ou Staff interne sensible
    const targetRoleUpper = newRole.toString().toUpperCase();
    if (!isSuperAdminCaller && ['SUPER_ADMIN', 'SUPERADMIN', 'ADMIN_FINANCE', 'ADMIN_DB', 'ADMIN_TECH'].includes(targetRoleUpper)) {
      return NextResponse.json({ error: 'Seul le Super Administrateur peut attribuer ce niveau de privilèges.' }, { status: 403 });
    }

    // 1. Mettre à jour les Custom Claims dans Firebase Auth
    const claims = {
      role: newRole,
      promotedBy: callerUid,
      promotedAt: Date.now(),
    };
    try {
      await adminAuth.setCustomUserClaims(uid, claims);
    } catch (claimErr: any) {
      console.warn('Erreur mise à jour claims Firebase Auth:', claimErr);
    }

    // 2. Mettre à jour le document Firestore
    const updatePayload: any = {
      role: newRole,
      updatedAt: new Date(),
      promotedBy: callerUid,
      promotedAt: new Date(),
      ...extraData,
    };

    if (newRole === 'PARTNER') {
      updatePayload.isPartner = true;
      updatePayload.role = 'PARTNER';
      updatePayload.status = 'active';
      
      let pCode = targetData.partnerCode || targetData.referralCode;
      if (!pCode) {
        try {
          pCode = await ensureReferralCode(uid);
        } catch {
          const baseCode = (targetData.displayName || targetData.name || 'PARTNER')
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, 6);
          pCode = `RAY-${baseCode || 'PART'}${Math.floor(100 + Math.random() * 900)}`;
        }
      }
      updatePayload.partnerCode = pCode;
      updatePayload.referralCode = pCode;
      updatePayload.partnerBalance = targetData.partnerBalance || 0;
      updatePayload.partnerTotalEarned = targetData.partnerTotalEarned || 0;
    }

    if (newRole.toString().startsWith('SUPPLIER')) {
      const selectedRayon = extraData.rayon || targetData.rayon || 'connect';
      const company = extraData.company || extraData.companyName || targetData.company || targetData.companyName || targetData.displayName || targetData.name || 'Boutique Fournisseur';
      
      const trialDays = 15;
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + trialDays);

      updatePayload.isSupplier = true;
      updatePayload.role = 'SUPPLIER';
      updatePayload.status = 'active';
      updatePayload.isBlocked = false;
      updatePayload.rayon = selectedRayon;
      updatePayload.assignedRayons = extraData.assignedRayons || [selectedRayon];
      updatePayload.serviceAttached = selectedRayon;
      updatePayload.company = company;
      updatePayload.companyName = company;
      updatePayload.displayName = company;
      updatePayload.subscriptionStatus = 'TRIAL';
      updatePayload.subscriptionEndDate = trialEnd;
      updatePayload.trialPeriodDays = trialDays;
      updatePayload.adminCustomTrial = true;

      // Also guarantee creation/merge in suppliers/{uid}
      await adminDb.collection('suppliers').doc(uid).set({
        email: targetEmail,
        displayName: company,
        company: company,
        companyName: company,
        rayon: selectedRayon,
        status: 'active',
        isBlocked: false,
        subscriptionStatus: 'TRIAL',
        subscriptionEndDate: trialEnd,
        trialPeriodDays: trialDays,
        adminCustomTrial: true,
        createdAt: targetData.createdAt || new Date(),
        updatedAt: new Date(),
      }, { merge: true });
    }

    await adminDb.collection('users').doc(uid).set(updatePayload, { merge: true });

    return NextResponse.json({ 
      success: true, 
      message: `Compte converti avec succès en ${newRole} !`,
      newRole 
    });
  } catch (error: any) {
    console.error('Erreur lors de la promotion du client:', error);
    return NextResponse.json({ error: error.message || 'Erreur serveur' }, { status: 500 });
  }
}

