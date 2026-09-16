import { NextResponse } from 'next/server';
import { adminAuth, adminDb, adminInitError } from '@/lib/firebase-admin';
import { sendMobiShastraSMS } from '@/lib/sms';
import nodemailer from 'nodemailer';

export async function POST(req: Request) {
  try {
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

    // Check latest role from Firestore first (source of truth), then fallback to token claim
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
    const isSuperAdminEmail = callerEmail === 'danielkiboko218@gmail.com';
    const isSuperAdminCaller = isSuperAdminEmail || rawRole === 'SUPER_ADMIN' || rawRole === 'SUPERADMIN';
    const isSubAdminCaller = ['SUB_ADMIN', 'SUBADMIN', 'ADMIN'].includes(rawRole);
    const isAdminCaller = isSuperAdminCaller || isSubAdminCaller;
    const isSupplierCaller = ['SUPPLIER', 'SUPPLIER_IMMO', 'SUB_SUPPLIER', 'SUPPLIER_MODE', 'SUPPLIER_CONNECT', 'SUPPLIER_SAVEURS', 'FOURNISSEUR'].includes(rawRole);

    if (!isAdminCaller && !isSupplierCaller) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges to create users' }, { status: 403 });
    }

    // 2. Parse request body
    const body = await req.json();
    const { email, password, displayName, roleToCreate, extraData = {}, notificationMethod, phoneNumber } = body;

    if (!email || !roleToCreate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 3. Enforce Creation Rules
    if (isSupplierCaller && !['driver', 'SUB_SUPPLIER'].includes(roleToCreate)) {
      return NextResponse.json({ error: 'Forbidden: Suppliers can only create drivers and sub-suppliers' }, { status: 403 });
    }
    
    // Non-super admins can NEVER create or promote someone to Super Admin!
    const roleUpper = roleToCreate.toUpperCase();
    if (!isSuperAdminCaller && (roleUpper === 'SUPER_ADMIN' || roleUpper === 'SUPERADMIN')) {
      return NextResponse.json({ error: 'Action interdite : Seul le Super Administrateur peut créer un Super Admin.' }, { status: 403 });
    }

    // Only Super Admin can create internal staff members (Sub Admin, Admin Finance, Admin DB, etc.)
    if (!isSuperAdminCaller && ['SUB_ADMIN', 'ADMIN_FINANCE', 'ADMIN_DB', 'ADMIN_TECH', 'ADMIN_OPS'].includes(roleUpper)) {
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
        return NextResponse.json({ error: 'Un compte avec cette adresse e-mail existe déjà.' }, { status: 409 });
      }
      throw createErr;
    }

    // 5. Set Custom Claims (Role & Creation lineage)
    const claims: any = {
      role: roleToCreate,
      createdBy: isSupplierCaller ? callerUid : (rawRole || 'superAdmin'),
    };
    if (extraData?.parentSupplierId) {
      claims.parentSupplierId = extraData.parentSupplierId;
    }
    await adminAuth.setCustomUserClaims(userRecord.uid, claims);

    let additionalData = { ...extraData };
    if (roleToCreate === 'supplier' || roleToCreate === 'SUPPLIER_IMMO' || roleToCreate === 'SUPPLIER_SAVEURS' || roleToCreate === 'SUPPLIER_MODE' || roleToCreate === 'SUPPLIER_CONNECT' || roleToCreate === 'SUPPLIER') {
      // Read trial duration from platform settings (default: 15 days per policy)
      let trialDays = 15;
      try {
        const settingsDoc = await adminDb.collection('settings').doc('platform').get();
        if (settingsDoc.exists) {
          const settingsData = settingsDoc.data();
          if (settingsData?.trialDurationDays && settingsData.trialDurationDays > 0) {
            trialDays = settingsData.trialDurationDays;
          }
        }
      } catch (settingsErr) {
        console.warn('Could not read platform settings, using default 15 days trial:', settingsErr);
      }
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + trialDays);
      additionalData.subscriptionStatus = 'TRIAL';
      additionalData.subscriptionEndDate = endDate;
      additionalData.trialPeriodDays = trialDays;
    }

    // 6. Save User Metadata in Firestore
    const userDocRef = adminDb.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      email,
      displayName,
      role: roleToCreate,
      createdBy: claims.createdBy,
      creatorRole: rawRole || 'superAdmin',
      createdAt: new Date(),
      status: 'active',
      ...additionalData
    }, { merge: true });

    // 7. Route to specific collections (drivers, suppliers) if needed
    if (['supplier', 'SUPPLIER', 'SUPPLIER_IMMO', 'SUPPLIER_SAVEURS'].includes(roleToCreate)) {
      await adminDb.collection('suppliers').doc(userRecord.uid).set({
        email,
        displayName,
        createdAt: new Date(),
        status: 'active'
      }, { merge: true });
    } else if (roleToCreate === 'driver') {
      await adminDb.collection('drivers').doc(userRecord.uid).set({
        supplierId: isSupplierCaller ? callerUid : 'admin',
        email,
        displayName,
        createdAt: new Date(),
        status: 'active'
      }, { merge: true });
    }

    // 8. Generate Password Reset Link for convenient onboarding
    let resetLink: string | null = null;
    try {
      resetLink = await adminAuth.generatePasswordResetLink(email);
    } catch (resetErr) {
      console.warn('Could not generate reset link:', resetErr);
    }

    // 8.5 Send Email with nodemailer
    if (notificationMethod === 'email' || !notificationMethod || notificationMethod === 'both') {
      try {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.hostinger.com',
          port: parseInt(process.env.SMTP_PORT || '465'),
          secure: true,
          auth: {
            user: process.env.SMTP_USER || 'admin@rayons.net',
            pass: process.env.SMTP_PASS || 'Kinoko88@'
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

        const mailOptions = {
          from: '"Rayons.net" <admin@rayons.net>',
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
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0F1D27 0%,#1a3040 100%);padding:40px 40px 30px;text-align:center;border-bottom:2px solid #C7D300;">
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#C7D300;letter-spacing:2px;">RAYONS.NET</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#8fa3b0;letter-spacing:1px;text-transform:uppercase;">La marketplace de référence</p>
            </td>
          </tr>

          <!-- Welcome -->
          <tr>
            <td style="padding:40px 40px 20px;">
              <h2 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Bienvenue, ${displayName || 'Nouveau Partenaire'} ! 👋</h2>
              <p style="margin:0;font-size:15px;color:#a0b4c0;line-height:1.7;">
                Votre compte <strong style="color:#C7D300;">${displayRole}</strong> a été créé avec succès par l'administration de Rayons.net. Vous faites maintenant partie de notre réseau de partenaires.
              </p>
            </td>
          </tr>

          <!-- Rayon Info -->
          <tr>
            <td style="padding:0 40px 20px;">
              <div style="background:rgba(199,211,0,0.08);border:1px solid rgba(199,211,0,0.25);border-radius:10px;padding:20px;">
                <p style="margin:0 0 6px;font-size:11px;color:#8fa3b0;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Votre Rayon de rattachement</p>
                <p style="margin:0;font-size:16px;color:#C7D300;font-weight:700;">${rayonDisplay}</p>
              </div>
            </td>
          </tr>

          <!-- Login Info -->
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

          <!-- CTA Button -->
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

          <!-- Footer -->
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

        await transporter.sendMail(mailOptions);
        console.log(`Welcome email sent successfully to ${email}`);
      } catch (emailErr) {
        console.error('Failed to send welcome email:', emailErr);
      }
    }


    // 9. Send SMS if requested
    if (notificationMethod === 'sms' && phoneNumber) {
      try {
        let customSenderId = undefined;
        const callerDoc = await adminDb.collection('users').doc(callerUid).get();
        if (callerDoc.exists) {
          const callerData = callerDoc.data();
          if (callerData?.displayName && callerData.displayName.toLowerCase().includes('laurent sumaili')) {
            customSenderId = 'MUTAMULIS';
          }
        }

        const message = `Bonjour ${displayName || ''}, votre compte Rayons a été créé. \nEmail: ${email}\n${resetLink ? `Activez votre compte ici: ${resetLink}` : `Mot de passe temporaire: ${finalPassword}`}\nLien: https://rayons.net`;
        await sendMobiShastraSMS({ mobileNo: phoneNumber, message, customSenderId });
        console.log(`SMS sent successfully to ${phoneNumber} with senderId ${customSenderId || 'default'}`);
      } catch (smsError) {
        console.error('Failed to send SMS:', smsError);
      }
    }

    return NextResponse.json({ 
      message: 'User created successfully', 
      uid: userRecord.uid,
      resetLink
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error creating user:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
