import { isProtectedSuperAdminEmail } from "@/server/guards";
import { enforceRateLimit } from "@/lib/rateLimit";
import { safeApiError } from "@/lib/sanitize";
import { NextResponse } from 'next/server';
import { adminAuth, adminDb, adminInitError } from '@/lib/firebase-admin';
import { sendMobiShastraSMS } from '@/lib/sms';
import nodemailer from 'nodemailer';
import { SUPER_ADMIN_EMAILS } from '@/lib/serverAuth';
import { getPermanentDriverApkUrl } from '@/lib/constants';
import { ensureReferralCode, attachReferral } from '@/lib/referrals';
import { cacheDel } from '@/lib/cache';

export async function POST(req: Request) {
  try {
  const _rl = await enforceRateLimit(req, "api:users_create:POST", 20, 60);
  if (_rl) return _rl;
    // 1. Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: No token provided' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      if (!adminAuth || typeof adminAuth.verifyIdToken !== 'function') {
         throw new Error(`Firebase admin is not properly initialized. adminAuth.verifyIdToken is missing. Init error: ${adminInitError?.message || adminInitError || 'Unknown'}`);
      }
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error: any) {
      console.error('Verify ID token error:', error);
      return NextResponse.json({ error: `Unauthorized: Invalid token. Details: ${error.message}` }, { status: 401 });
    }

    const callerUid = decodedToken.uid;
    const callerEmail = (decodedToken.email || '').toLowerCase().trim();
    const isSuperAdminEmail = isProtectedSuperAdminEmail(callerEmail);

    // Check latest role from Firestore (skip extra read if already Super Admin by verified email)
    let firestoreRole: string | null = null;
    let callerDocData: any = null;
    if (!isSuperAdminEmail) {
      try {
        const userDoc = await Promise.race([
          adminDb.collection('users').doc(callerUid).get(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('CALLER_LOOKUP_TIMEOUT')), 6000)),
        ]);
        if (userDoc.exists) {
          callerDocData = userDoc.data();
          firestoreRole = callerDocData?.role;
        }
      } catch (dbErr) {
        console.warn('Could not fetch caller doc from Firestore:', dbErr);
      }
    }

    const rawRole = (firestoreRole || decodedToken.role || '').toString().toUpperCase();
    const callerPositions: string[] = Array.isArray(callerDocData?.staffProfile?.positions)
      ? callerDocData.staffProfile.positions.map((p: any) => String(p).toUpperCase())
      : [];
    const callerPermissions: string[] = Array.isArray(callerDocData?.staffProfile?.permissions)
      ? callerDocData.staffProfile.permissions
      : [];

    const isSuperAdminCaller =
      isSuperAdminEmail ||
      rawRole === 'SUPER_ADMIN' ||
      rawRole === 'SUPERADMIN' ||
      callerDocData?.isSuperAdmin === true;
    const isSubAdminCaller =
      ['SUB_ADMIN', 'SUBADMIN', 'SOUS_ADMIN', 'SOUS_ADMIN_GENERAL', 'ADMIN', 'GESTIONNAIRE_ADMIN'].includes(rawRole) ||
      callerPositions.some((p) => ['SUB_ADMIN', 'SUBADMIN', 'ADMIN', 'GESTIONNAIRE_ADMIN'].includes(p)) ||
      callerPermissions.includes('suppliers.manage');
    const isAdminCaller = isSuperAdminCaller || isSubAdminCaller;
    const isSupplierCaller = ['SUPPLIER', 'SUPPLIER_IMMO', 'SUB_SUPPLIER', 'SUPPLIER_MODE', 'SUPPLIER_CONNECT', 'SUPPLIER_SAVEURS', 'FOURNISSEUR'].includes(rawRole) || callerDocData?.isSupplier === true;
    const isPartnerCaller = rawRole === 'PARTNER' || callerDocData?.isPartner === true;

    if (!isAdminCaller && !isSupplierCaller && !isPartnerCaller) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to create users' }, { status: 403 });
    }

    // 2. Parse request body
    const body = await req.json();
    const { email, password, displayName, roleToCreate, extraData = {}, notificationMethod, phoneNumber } = body;

    if (!email || !roleToCreate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Enforce Creation Rules
    if (isPartnerCaller) {
      const allowedSupplierRoles = ['supplier', 'SUPPLIER', 'SUPPLIER_IMMO', 'SUPPLIER_SAVEURS', 'SUPPLIER_MODE', 'SUPPLIER_CONNECT'];
      if (!allowedSupplierRoles.includes(roleToCreate)) {
        return NextResponse.json({ error: 'Action interdite : Les partenaires peuvent uniquement enregistrer des boutiques et fournisseurs.' }, { status: 403 });
      }
    }

    if (isSupplierCaller && !['driver', 'SUB_SUPPLIER'].includes(roleToCreate)) {
      return NextResponse.json({ error: 'Forbidden: Suppliers can only create drivers and sub-suppliers' }, { status: 403 });
    }
    
    // Non-super admins can NEVER create or promote someone to Super Admin!
    const roleUpper = roleToCreate.toUpperCase();
    if (!isSuperAdminCaller && (roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN')) {
      return NextResponse.json({ error: 'Action interdite : Seul le Super Administrateur peut créer un Super Admin.' }, { status: 403 });
    }

    // Only Super Admin can create internal staff members (Sub Admin, Admin Finance, Admin DB, etc.)
    const staffAndAdminRoles = [
      'ADMIN', 'SUB_ADMIN', 'SUBADMIN', 'SOUS_ADMIN', 'SOUS_ADMIN_GENERAL',
      'ADMIN_FINANCE', 'ADMIN_DB', 'ADMIN_TECH', 'ADMIN_OPS', 'STAFF', 'FONCTIONNAIRE',
      'GESTIONNAIRE_ADMIN', 'RESPONSABLE_LOGISTIQUE', 'RESPONSABLE_FINANCIER',
      'RESPONSABLE_CATALOGUE', 'SUPPORT_CLIENT'
    ];
    if (!isSuperAdminCaller && staffAndAdminRoles.includes(roleUpper)) {
      return NextResponse.json({ error: 'Action interdite : Seul le Super Administrateur peut nommer des collaborateurs internes.' }, { status: 403 });
    }

    // 4. Create or Retrieve the User in Firebase Auth
    const finalPassword = password || Math.random().toString(36).slice(-10) + "A1@";
    let userRecord;
    try {
      userRecord = await adminAuth.createUser({
        email,
        password: finalPassword,
        displayName,
      });
    } catch (createErr: any) {
      if (createErr.code === 'auth/email-already-exists') {
        // Auto-nettoyage sécurisé des comptes Auth orphelins (déjà supprimés de Firestore mais restés coincés dans Firebase Auth)
        const normalizedNewEmail = String(email || '').trim().toLowerCase();
        if (isAdminCaller && normalizedNewEmail && !isProtectedSuperAdminEmail(normalizedNewEmail)) {
          try {
            const existingAuth = await adminAuth.getUserByEmail(normalizedNewEmail);
            const existingUserDoc = await adminDb.collection('users').doc(existingAuth.uid).get();
            const existingData = existingUserDoc.exists ? existingUserDoc.data() || {} : null;
            const isOrphanOrDeleted =
              !existingUserDoc.exists ||
              existingData?.isDeleted === true ||
              existingData?.deletionStatus === 'DELETED';

            if (isOrphanOrDeleted) {
              await adminAuth.revokeRefreshTokens(existingAuth.uid).catch(() => {});
              await adminAuth.deleteUser(existingAuth.uid);
              userRecord = await adminAuth.createUser({
                email,
                password: finalPassword,
                displayName,
              });
            } else {
              return NextResponse.json({ error: 'Un compte actif avec cette adresse e-mail existe déjà.' }, { status: 409 });
            }
          } catch (cleanupErr: any) {
            console.warn('[users/create] Orphan Auth cleanup warning:', cleanupErr?.message);
            return NextResponse.json({ error: 'Un compte avec cette adresse e-mail existe déjà.' }, { status: 409 });
          }
        } else {
          return NextResponse.json({ error: 'Un compte avec cette adresse e-mail existe déjà.' }, { status: 409 });
        }
      } else {
        throw createErr;
      }
    }

    // 5. Set Custom Claims (Role & Creation lineage)
    const claims: any = {
      role: roleToCreate,
      createdBy: isPartnerCaller ? callerUid : (isSupplierCaller ? callerUid : (rawRole || 'superAdmin')),
    };
    if (isPartnerCaller) {
      claims.referredByPartnerId = callerUid;
    }
    if (isSupplierCaller) {
      claims.parentSupplierId = callerUid;
    } else if (extraData?.parentSupplierId) {
      claims.parentSupplierId = extraData.parentSupplierId;
    }
    await adminAuth.setCustomUserClaims(userRecord.uid, claims);

    const additionalData: Record<string, any> = { ...(extraData || {}) };
    // Prevent mass-assignment of privileged or financial fields via extraData
    const forbiddenExtraFields = [
      'uid', 'email', 'role', 'accountType', 'isSuperAdmin', 'isAdmin',
      'isInternalStaff', 'isPartner', 'partnerBalance', 'partnerTotalEarned',
      'referralBalance', 'referralTotalEarned', 'referralPaidTotal',
      'createdBy', 'creatorRole', 'subscriptionStatus', 'subscriptionEndDate'
    ];
    for (const key of forbiddenExtraFields) {
      delete additionalData[key];
    }
    if (!isSuperAdminCaller) {
      delete additionalData.staffProfile;
      delete additionalData.partnerProfile;
    }

    let partnerRefCode: string | null = null;

    if (isPartnerCaller) {
      try {
        partnerRefCode = await ensureReferralCode(callerUid);
      } catch (e) {
        console.warn('Could not ensure partner referral code:', e);
        partnerRefCode = callerDocData?.referralCode || callerDocData?.partnerCode || null;
      }
      additionalData.referredByPartnerId = callerUid;
      additionalData.referredBy = callerUid;
      additionalData.partnerReferral = true;
      additionalData.referralCodeUsed = partnerRefCode;
      additionalData.supplierId = 'admin'; // Managed directly by Central Administration
      additionalData.isCentralCatalog = true;
      additionalData.isSupplier = true;
      additionalData.companyName = additionalData.companyName || additionalData.company || displayName;
      additionalData.createdBy = callerUid;
      additionalData.creatorRole = 'PARTNER';
    }

    if (roleToCreate === 'driver') {
      const assignedSupplierId = isSupplierCaller ? callerUid : (extraData?.supplierId || 'admin');
      additionalData.supplierId = assignedSupplierId;
      additionalData.parentSupplierId = isSupplierCaller ? callerUid : (extraData?.parentSupplierId || null);
      additionalData.createdBy = claims.createdBy;
    } else if (roleToCreate === 'SUB_SUPPLIER' && isSupplierCaller) {
      additionalData.parentSupplierId = callerUid;
      additionalData.supplierId = callerUid;
      additionalData.createdBy = callerUid;
    } else if (roleToCreate === 'supplier' || roleToCreate === 'SUPPLIER_IMMO' || roleToCreate === 'SUPPLIER_SAVEURS' || roleToCreate === 'SUPPLIER_MODE' || roleToCreate === 'SUPPLIER_CONNECT' || roleToCreate === 'SUPPLIER') {
      additionalData.accountType = 'SUPPLIER';
      additionalData.isSupplier = true;
      additionalData.companyName = additionalData.companyName || additionalData.company || displayName;
      if (isAdminCaller && (extraData?.isOfficialAdminStore || extraData?.isAdminSupplier)) {
        additionalData.subscriptionStatus = 'ACTIVE';
        additionalData.subscriptionEndDate = null;
        additionalData.depositAmount = 0;
        additionalData.isOfficialAdminStore = true;
        additionalData.isAdminSupplier = true;
        additionalData.isBlocked = false;
      } else {
        delete additionalData.isOfficialAdminStore;
        delete additionalData.isAdminSupplier;
        // Read trial duration from platform settings (3s max timeout, default: 15 days)
        let trialDays = 15;
        try {
          const settingsDoc = await Promise.race([
            adminDb.collection('settings').doc('platform').get(),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('SETTINGS_TIMEOUT')), 3000)),
          ]);
          if (settingsDoc.exists) {
            const settingsData = settingsDoc.data();
            if (settingsData?.trialDurationDays && settingsData.trialDurationDays > 0) {
              trialDays = settingsData.trialDurationDays;
            }
          }
        } catch (settingsErr) {
          console.warn('Could not read platform settings quickly, using default 15 days trial:', settingsErr);
        }
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + trialDays);
        additionalData.subscriptionStatus = 'TRIAL';
        additionalData.subscriptionEndDate = endDate;
        additionalData.trialPeriodDays = trialDays;
      }
    }

    if (roleUpper === 'PARTNER') {
      let partnerCode = null;
      try {
        partnerCode = await ensureReferralCode(userRecord.uid);
      } catch (refErr) {
        console.warn('Could not generate partner code:', refErr);
      }
      additionalData.accountType = 'PARTNER';
      additionalData.isPartner = true;
      additionalData.partnerCode = partnerCode;
      additionalData.referralCode = partnerCode;
      additionalData.partnerBalance = 0;
      additionalData.partnerTotalEarned = 0;
      delete additionalData.rayon;
      delete additionalData.assignedRayons;
      delete additionalData.serviceAttached;
      delete additionalData.company;
      delete additionalData.companyName;
    } else if (['STAFF', 'SUB_ADMIN', 'GESTIONNAIRE_ADMIN', 'RESPONSABLE_LOGISTIQUE', 'RESPONSABLE_FINANCIER', 'RESPONSABLE_CATALOGUE', 'SUPPORT_CLIENT', 'ADMIN_FINANCE', 'ADMIN_DB', 'ADMIN_OPS'].includes(roleUpper)) {
      additionalData.accountType = 'STAFF';
      additionalData.isInternalStaff = true;
      delete additionalData.rayon;
      delete additionalData.assignedRayons;
      delete additionalData.serviceAttached;
      delete additionalData.company;
      delete additionalData.companyName;
    }

    // 6 & 7. Save User Metadata + Role Collection in ONE atomic batch (1 seul aller-retour Firestore au lieu de 2-3!)
    const runWithTimeout = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`FIRESTORE_TIMEOUT:${label}`)), ms)
        ),
      ]);

    const isSupplierRoleToCreate = [
      'supplier', 'SUPPLIER', 'SUPPLIER_IMMO', 'SUPPLIER_SAVEURS', 'SUPPLIER_MODE', 'SUPPLIER_CONNECT'
    ].includes(roleToCreate);

    const writeBatch = adminDb.batch();
    const userDocRef = adminDb.collection('users').doc(userRecord.uid);
    writeBatch.set(userDocRef, {
      ...additionalData,
      uid: userRecord.uid,
      email,
      displayName,
      role: roleToCreate,
      createdBy: claims.createdBy,
      creatorRole: isPartnerCaller ? 'PARTNER' : (rawRole || 'superAdmin'),
      createdAt: new Date(),
      status: 'active',
    }, { merge: true });

    if (isSupplierRoleToCreate) {
      writeBatch.set(adminDb.collection('suppliers').doc(userRecord.uid), {
        email,
        displayName,
        companyName: additionalData.companyName || displayName,
        rayon: additionalData.rayon || null,
        createdAt: new Date(),
        status: 'active',
        referredByPartnerId: isPartnerCaller ? callerUid : (additionalData.referredByPartnerId || null),
      }, { merge: true });
    } else if (roleToCreate === 'driver') {
      const assignedSupplierId = isSupplierCaller ? callerUid : (extraData?.supplierId || 'admin');
      writeBatch.set(adminDb.collection('drivers').doc(userRecord.uid), {
        driverId: userRecord.uid,
        supplierId: assignedSupplierId,
        parentSupplierId: isSupplierCaller ? callerUid : null,
        createdBy: claims.createdBy,
        email,
        displayName,
        appDownloadUrl: getPermanentDriverApkUrl(),
        createdAt: new Date(),
        status: 'active',
      }, { merge: true });
    }

    // Lancer le batch Firestore + la génération du lien mot de passe EN PARALLÈLE !
    let resetLink: string | null = null;
    try {
      const [, linkRes] = await Promise.all([
        runWithTimeout(writeBatch.commit(), 10000, 'users.batch.commit'),
        adminAuth.generatePasswordResetLink(email).catch((resetErr: any) => {
          console.warn('Could not generate reset link:', resetErr);
          return null;
        }),
      ]);
      resetLink = linkRes;
    } catch (fsWriteErr: any) {
      const msg = String(fsWriteErr?.message || '');
      const isQuota =
        fsWriteErr?.code === 8 ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('Quota exceeded') ||
        msg.includes('FIRESTORE_TIMEOUT');
      if (isQuota) {
        console.error('Firestore write quota/timeout during user creation:', fsWriteErr);
        return NextResponse.json(
          {
            error:
              "Firestore met trop de temps à répondre ou son quota quotidien d'écriture est saturé (RESOURCE_EXHAUSTED). Le compte Auth a été créé avec son rôle ; réessayez dans quelques secondes.",
            code: 'FIRESTORE_QUOTA_EXCEEDED',
            uid: userRecord.uid,
          },
          { status: 503 }
        );
      }
      throw fsWriteErr;
    }

    if (isSupplierRoleToCreate) {

      // If created by partner, attach referral relation immediately
      if (isPartnerCaller) {
        let attachedOk = false;
        if (partnerRefCode) {
          try {
            const attachRes = await attachReferral({
              filleulId: userRecord.uid,
              code: partnerRefCode,
              filleulName: displayName || email,
              filleulEmail: email,
            });
            attachedOk = Boolean(attachRes?.attached);
          } catch (attachErr) {
            console.warn('Partner auto-referral attach error:', attachErr);
          }
        }
        // Fallback direct dans la collection referrals si attachReferral n'a pas pu créer la relation
        if (!attachedOk) {
          try {
            const { FieldValue } = await import('firebase-admin/firestore');
            const relRef = adminDb.collection('referrals').doc(userRecord.uid);
            const relSnap = await relRef.get();
            if (!relSnap.exists) {
              await relRef.set({
                filleulId: userRecord.uid,
                filleulName: displayName || email,
                filleulEmail: email.toLowerCase().trim(),
                referrerId: callerUid,
                referrerName: callerDocData?.displayName || callerDocData?.name || callerEmail || 'Partenaire',
                code: partnerRefCode || '',
                rayon: additionalData.rayon || 'connect',
                totalCommissions: 0,
                paymentsCount: 0,
                createdAt: FieldValue.serverTimestamp(),
              });
              await adminDb.collection('users').doc(callerUid).set({
                referralCount: FieldValue.increment(1),
              }, { merge: true });
            }
          } catch (fallbackErr) {
            console.warn('Partner fallback referral creation error:', fallbackErr);
          }
        }
      }
    }

    // 8.5 Send Email & SMS with strict timeouts (never block/timeout HTTP response on slow SMTP)
    const runWithSoftTimeout = async <T,>(task: Promise<T>, ms = 4000): Promise<{ done: boolean; value?: T }> => {
      return Promise.race([
        task.then((value) => ({ done: true, value })).catch((err) => {
          console.error('[users/create] Notification background error:', err);
          return { done: true, value: undefined };
        }),
        new Promise<{ done: boolean }>((resolve) => setTimeout(() => resolve({ done: false }), ms)),
      ]);
    };

    const notificationTasks: Promise<any>[] = [];

    if ((notificationMethod === 'email' || !notificationMethod || notificationMethod === 'both') && process.env.SMTP_PASS) {
      const smtpPort = Number(process.env.SMTP_PORT) || 465;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.hostinger.com',
        port: smtpPort,
        secure: smtpPort === 465,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 7000,
        auth: {
          user: process.env.SMTP_USER || 'no-reply@rayons.net',
          pass: process.env.SMTP_PASS || ''
        }
      });

      const rayonName = extraData?.rayonName || extraData?.rayon || 'Rayons.net';
      const rayonLabels: Record<string, string> = {
        immo: 'Rayon Immo — Immobilier & Hôtellerie',
        mode: 'Rayon Mode — Vêtements & Accessoires',
        connect: 'Rayon Connect — Services & Tech',
        saveurs: 'Rayon Saveurs — Restauration & Traiteur',
      };
      const rayonDisplay = rayonLabels[rayonName] || rayonName;

      const roleLabels: Record<string, string> = {
        driver: 'Livreur',
        supplier: 'Fournisseur',
        SUPPLIER_IMMO: 'Fournisseur — Rayon Immo',
        SUPPLIER_MODE: 'Fournisseur — Rayon Mode',
        SUPPLIER_CONNECT: 'Fournisseur — Rayon Connect',
        SUPPLIER_SAVEURS: 'Fournisseur — Rayon Saveurs',
        SUB_SUPPLIER: 'Sous-Fournisseur',
      };
      const displayRole = roleLabels[roleToCreate] || roleToCreate;

      const loginUrl = resetLink || 'https://rayons.net/login';
      const driverApkUrl = getPermanentDriverApkUrl();

      const mailOptions = {
        from: `"Rayons.net" <${process.env.SMTP_USER || 'no-reply@rayons.net'}>`,
        to: email,
        subject: `Bienvenue sur Rayons.net — Votre compte ${displayRole} est prêt !`,
        html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#0F1D27;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F1D27;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="600" style="max-width:600px;width:100%;background-color:#1a2d3d;border-radius:16px;overflow:hidden;border:1px solid rgba(199,211,0,0.2);">
          <tr>
            <td style="background:linear-gradient(135deg,#0F1D27 0%,#1a3040 100%);padding:40px 40px 30px;text-align:center;border-bottom:2px solid #C7D300;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#C7D300;letter-spacing:2px;">RAYONS.NET</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#8fa3b0;letter-spacing:1px;text-transform:uppercase;">La marketplace de référence</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 40px 20px;">
              <h2 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Bienvenue, ${displayName || 'Nouveau Partenaire'} ! 👋</h2>
              <p style="margin:0;font-size:15px;color:#a0b4c0;line-height:1.7;">
                Votre compte <strong style="color:#C7D300;">${displayRole}</strong> a été créé avec succès par l'administration de Rayons.net. Vous faites maintenant partie de notre réseau de partenaires.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 20px;">
              <div style="background:rgba(199,211,0,0.08);border:1px solid rgba(199,211,0,0.25);border-radius:10px;padding:20px;">
                <p style="margin:0 0 6px;font-size:11px;color:#8fa3b0;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Votre Rayon de rattachement</p>
                <p style="margin:0;font-size:16px;color:#C7D300;font-weight:700;">${rayonDisplay}</p>
              </div>
            </td>
          </tr>
          ${roleToCreate === 'driver' ? `
          <tr>
            <td style="padding:0 40px 20px;">
              <div style="background:linear-gradient(135deg, rgba(199,211,0,0.15) 0%, rgba(15,29,39,0.95) 100%);border:2px solid #C7D300;border-radius:12px;padding:24px;text-align:center;">
                <div style="font-size:32px;margin-bottom:8px;">📲</div>
                <h3 style="margin:0 0 8px;font-size:18px;color:#ffffff;font-weight:700;">Application Mobile Livreur (Android)</h3>
                <p style="margin:0 0 16px;font-size:14px;color:#a0b4c0;line-height:1.5;">
                  Téléchargez l'application officielle sur votre smartphone Android pour recevoir vos livraisons en temps réel, naviguer via le GPS et valider vos encaissements.
                </p>
                <a href="${driverApkUrl}" style="display:inline-block;background-color:#C7D300;color:#0F1D27;padding:14px 28px;text-decoration:none;font-weight:800;font-size:14px;border-radius:8px;letter-spacing:0.5px;">
                  📥 Télécharger l'Application (.APK)
                </a>
                <p style="margin:12px 0 0;font-size:12px;color:#8fa3b0;">
                  Lien permanent : <br><a href="${driverApkUrl}" style="color:#C7D300;word-break:break-all;">${driverApkUrl}</a>
                </p>
              </div>
            </td>
          </tr>
          ` : ''}
          <tr>
            <td style="padding:0 40px 20px;">
              <h3 style="margin:0 0 16px;font-size:16px;color:#ffffff;font-weight:600;">🔐 Vos informations de connexion</h3>
              <table role="presentation" width="100%" style="background:#0F1D27;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <span style="font-size:12px;color:#8fa3b0;text-transform:uppercase;letter-spacing:0.5px;">Identifiant</span><br>
                    <strong style="font-size:15px;color:#ffffff;">${email}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;">
                    <span style="font-size:12px;color:#8fa3b0;text-transform:uppercase;letter-spacing:0.5px;">Mot de passe temporaire</span><br>
                    <strong style="font-size:18px;color:#C7D300;letter-spacing:3px;font-family:monospace;">${finalPassword}</strong>
                    <p style="margin:6px 0 0;font-size:12px;color:#8fa3b0;">⚠️ Changez ce mot de passe dès votre première connexion</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="${loginUrl}" style="display:inline-block;background-color:#C7D300;color:#0F1D27;padding:16px 40px;text-decoration:none;font-weight:800;font-size:15px;border-radius:8px;letter-spacing:0.5px;">
                ${resetLink ? '🚀 Configurer mon mot de passe' : '🚀 Me connecter à Rayons.net'}
              </a>
              <p style="margin:16px 0 0;font-size:13px;color:#8fa3b0;">
                Ou copiez ce lien : <a href="${loginUrl}" style="color:#C7D300;">${loginUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#0F1D27;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0 0 6px;font-size:13px;color:#8fa3b0;">Des questions ? Contactez-nous à <a href="mailto:admin@rayons.net" style="color:#C7D300;">admin@rayons.net</a></p>
              <p style="margin:0;font-size:12px;color:#4a6070;">© ${new Date().getFullYear()} Rayons.net — Tous droits réservés</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
        `
      };

      notificationTasks.push(
        transporter
          .sendMail(mailOptions)
          .then(() => console.log(`Welcome email sent successfully to ${email}`))
          .catch((emailErr) => console.error('Failed to send welcome email:', emailErr))
      );
    }

    // 9. Send SMS if requested
    if ((notificationMethod === 'sms' || notificationMethod === 'both') && phoneNumber) {
      notificationTasks.push(
        (async () => {
          try {
            let customSenderId = undefined;
            const callerData = callerDocData;
            if (
              callerData?.senderId ||
              callerData?.customSenderId ||
              callerData?.smsSenderId ||
              (callerData?.displayName && (callerData.displayName.toLowerCase().includes('laurent') || callerData.displayName.toLowerCase().includes('mutamulis'))) ||
              (callerData?.lastName && callerData.lastName.toLowerCase().includes('sumaili')) ||
              callerData?.email === 'sumaililaurent4@gmail.com'
            ) {
              customSenderId = callerData?.senderId || callerData?.customSenderId || callerData?.smsSenderId || 'MUTAMULIS';
            }

            const driverApkUrl = getPermanentDriverApkUrl();
            const appLinkSms = roleToCreate === 'driver' ? `\nApp mobile Livreur: ${driverApkUrl}` : '';
            const message = `Bonjour ${displayName || ''}, votre compte Rayons a été créé.\nEmail: ${email}\n${resetLink ? `Activez votre compte: ${resetLink}` : `Mot de passe temporaire: ${finalPassword}`}${appLinkSms}\nLien: https://rayons.net`;
            await sendMobiShastraSMS({ mobileNo: phoneNumber, message, customSenderId });
            console.log(`SMS sent successfully to ${phoneNumber} with senderId ${customSenderId || 'default'}`);
          } catch (smsError) {
            console.error('Failed to send SMS:', smsError);
          }
        })()
      );
    }

    // Ne jamais bloquer l'interface plus de 1.5 seconde pour l'envoi SMTP/SMS (l'envoi continue en arrière-plan)
    if (notificationTasks.length > 0) {
      await runWithSoftTimeout(Promise.allSettled(notificationTasks), 1500);
    }

    await cacheDel("admin:suppliers:list:v1");

    return NextResponse.json({ 
      message: 'User created successfully', 
      uid: userRecord.uid,
      resetLink,
      appDownloadUrl: roleToCreate === 'driver' ? getPermanentDriverApkUrl() : undefined
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: safeApiError(error, "Erreur interne du serveur.") }, { status: 500 });
  }
}
