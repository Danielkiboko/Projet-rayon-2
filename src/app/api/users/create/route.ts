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

    let callerRole = decodedToken.role;
    const callerUid = decodedToken.uid;
    const callerEmail = (decodedToken.email || '').toLowerCase().trim();

    // Bootstrap rule: If the caller is a designated superAdmin
    const isSuperAdminEmail = callerEmail === 'danielkiboko218@gmail.com';
    if (!callerRole && isSuperAdminEmail) {
      callerRole = 'superAdmin';
    }

    // Fallback to Firestore if token has no role claim
    if (!callerRole) {
      try {
        const userDoc = await adminDb.collection('users').doc(callerUid).get();
        if (userDoc.exists) {
          callerRole = userDoc.data()?.role;
        }
      } catch (dbErr) {
        console.warn('Could not fetch caller doc from Firestore:', dbErr);
      }
    }

    const normalizedRole = (callerRole || '').toString().toLowerCase();
    const isAdminCaller = isSuperAdminEmail || 
      ['superadmin', 'super_admin', 'admin', 'sub_admin'].includes(normalizedRole);
    const isSupplierCaller = ['supplier', 'supplier_immo', 'sub_supplier'].includes(normalizedRole);

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
    if (normalizedRole === 'admin' && roleToCreate === 'superAdmin') {
      return NextResponse.json({ error: 'Forbidden: Admins cannot create super admins' }, { status: 403 });
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
        userRecord = await adminAuth.getUserByEmail(email);
        if (finalPassword) {
          try {
            await adminAuth.updateUser(userRecord.uid, { password: finalPassword, displayName });
          } catch (upErr) {
            console.warn('Could not update existing user credentials:', upErr);
          }
        }
      } else {
        throw createErr;
      }
    }

    // 5. Set Custom Claims (Role & Creation lineage)
    const claims: any = {
      role: roleToCreate,
      createdBy: isSupplierCaller ? callerUid : (callerRole || 'superAdmin'),
    };
    if (extraData?.parentSupplierId) {
      claims.parentSupplierId = extraData.parentSupplierId;
    }
    await adminAuth.setCustomUserClaims(userRecord.uid, claims);

    let additionalData = { ...extraData };
    if (roleToCreate === 'supplier' || roleToCreate === 'SUPPLIER_IMMO' || roleToCreate === 'SUPPLIER_SAVEURS') {
      // Read trial duration from platform settings (default: 30 days)
      let trialDays = 30;
      try {
        const settingsDoc = await adminDb.collection('settings').doc('platform').get();
        if (settingsDoc.exists) {
          const settingsData = settingsDoc.data();
          if (settingsData?.trialDurationDays && settingsData.trialDurationDays > 0) {
            trialDays = settingsData.trialDurationDays;
          }
        }
      } catch (settingsErr) {
        console.warn('Could not read platform settings, using default 30 days trial:', settingsErr);
      }
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + trialDays);
      additionalData.subscriptionStatus = 'TRIAL';
      additionalData.subscriptionEndDate = endDate;
    }

    // 6. Save User Metadata in Firestore
    const userDocRef = adminDb.collection('users').doc(userRecord.uid);
    await userDocRef.set({
      uid: userRecord.uid,
      email,
      displayName,
      role: roleToCreate,
      createdBy: claims.createdBy,
      creatorRole: callerRole || 'superAdmin',
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
            pass: process.env.SMTP_PASS || 'Daniel88'
          }
        });

        const rayonName = extraData?.rayonName || 'Non défini';
        const displayRole = roleToCreate === 'driver' ? 'Livreur' : 
                            roleToCreate === 'supplier' ? 'Fournisseur' : roleToCreate;
        
        const mailOptions = {
          from: '"Rayons.net" <admin@rayons.net>',
          to: email,
          subject: 'Bienvenue sur Rayons.net !',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2 style="color: #C7D300;">Bonjour ${displayName || ''}, bienvenue sur Rayons.net !</h2>
              <p>Votre compte a été créé avec succès par l'administration.</p>
              
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Rôle :</strong> ${displayRole}</p>
                <p style="margin: 5px 0;"><strong>Rayon de rattachement :</strong> ${rayonName}</p>
              </div>

              <h3>Vos informations de connexion :</h3>
              <p><strong>Identifiant (Email) :</strong> ${email}</p>
              <p><strong>Mot de passe temporaire :</strong> <span style="background: #eee; padding: 3px 6px; letter-spacing: 1px;">${finalPassword}</span></p>
              
              <div style="margin-top: 30px;">
                ${resetLink ? 
                  `<a href="${resetLink}" style="background-color: #C7D300; color: #0F1D27; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">Configurer mon mot de passe et me connecter</a>` : 
                  `<a href="https://rayons.net/login" style="background-color: #C7D300; color: #0F1D27; padding: 10px 20px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">Se connecter</a>`
                }
              </div>
              
              <p style="margin-top: 40px; font-size: 0.9em; color: #666;">
                Merci de rejoindre la plateforme !<br>
                L'équipe Rayons.net
              </p>
            </div>
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
