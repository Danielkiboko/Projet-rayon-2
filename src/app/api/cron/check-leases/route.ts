import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sendEmail, sendSMS } from '@/lib/notifications';

// Cron Secret (Optionnel, pour sécuriser l'appel de la route)
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  try {
    // 1. Vérification de sécurité (si configuré)
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // 2. Date du jour
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    // Pour notifier 3 jours avant
    const inThreeDays = new Date();
    inThreeDays.setDate(now.getDate() + 3);
    const inThreeDaysStr = inThreeDays.toISOString().split('T')[0];

    // 3. Récupérer les locataires (en statut actif/pending)
    const tenantsSnapshot = await adminDb.collection('tenants')
      .where('status', 'in', ['ACTIVE', 'LATE', 'PENDING'])
      .get();

    const notifications: string[] = [];
    
    // Tableau des promesses d'envoi pour traiter en parallèle
    const sendPromises: Promise<any>[] = [];

    tenantsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (!data.nextPayment) return;

      const nextPaymentStr = data.nextPayment.split('T')[0]; // Format YYYY-MM-DD

      let message = "";
      let isLate = false;

      // Condition 1 : C'est le jour J
      if (nextPaymentStr === todayStr) {
        message = `Bonjour ${data.tenantName}, votre loyer de ${data.rentAmount}$ arrive à échéance aujourd'hui. Merci de procéder au paiement.`;
      } 
      // Condition 2 : 3 jours avant
      else if (nextPaymentStr === inThreeDaysStr) {
        message = `Bonjour ${data.tenantName}, ceci est un rappel amical. Votre loyer de ${data.rentAmount}$ sera dû dans 3 jours (${nextPaymentStr}).`;
      } 
      // Condition 3 : En retard (la date est passée et le statut n'est pas "PAID")
      else if (new Date(nextPaymentStr) < now) {
        isLate = true;
        message = `URGENT: Bonjour ${data.tenantName}, votre loyer de ${data.rentAmount}$ prévu le ${nextPaymentStr} est en retard. Merci de régulariser la situation immédiatement.`;
        
        // Mettre à jour le statut en LATE dans la base si ce n'est pas déjà fait
        if (data.status !== 'LATE') {
          adminDb.collection('tenants').doc(doc.id).update({ status: 'LATE' });
        }
      }

      if (message) {
        // Envoi SMS via MobiShastra
        if (data.tenantPhone) {
          sendPromises.push(sendSMS(data.tenantPhone, message));
          notifications.push(`SMS à ${data.tenantPhone}`);
        }
        
        // Envoi Email
        if (data.tenantEmail) {
          sendPromises.push(sendEmail(data.tenantEmail, 'Rappel de Loyer - Rayons', message));
          notifications.push(`Email à ${data.tenantEmail}`);
        }
      }
    });

    // 4. Contrôle automatique des échéances d'abonnements & dépôts des fournisseurs
    try {
      const suppliersSnapshot = await adminDb.collection('users')
        .where('role', 'in', ['SUPPLIER', 'supplier', 'SUPPLIER_IMMO', 'supplier_immo', 'SUPPLIER_SAVEURS'])
        .get();

      suppliersSnapshot.forEach((docSnap: any) => {
        const sData = docSnap.data();
        if (!sData.subscriptionEndDate) return;

        const endDate = sData.subscriptionEndDate?.toDate 
          ? sData.subscriptionEndDate.toDate() 
          : new Date(sData.subscriptionEndDate);

        // Si l'échéance est dépassée et que le fournisseur n'est pas déjà suspendu
        if (now > endDate && sData.subscriptionStatus !== 'SUSPENDED_PAYMENT' && !sData.isBlocked) {
          adminDb.collection('users').doc(docSnap.id).update({
            subscriptionStatus: 'SUSPENDED_PAYMENT',
            isBlocked: true,
            blockedAt: now.toISOString()
          });

          const supPhone = sData.phone;
          const supName = sData.displayName || sData.company || "Partenaire";
          const supMessage = `URGENT: Bonjour ${supName}, votre période sur Rayons.net est arrivée à échéance. Votre compte a été suspendu (publications et messages verrouillés). Veuillez régulariser votre dépôt mensuel ($50) pour débloquer votre compte.`;

          if (supPhone) {
            sendPromises.push(sendSMS(supPhone, supMessage));
            notifications.push(`SMS Blocage Fournisseur à ${supPhone}`);
          }
          if (sData.email) {
            sendPromises.push(sendEmail(sData.email, 'Suspension de Compte Fournisseur - Rayons.net', supMessage));
            notifications.push(`Email Blocage Fournisseur à ${sData.email}`);
          }
        }
      });
    } catch (supErr) {
      console.error("Erreur vérification fournisseurs dans Cron:", supErr);
    }

    // Attendre que tous les envois soient terminés
    await Promise.all(sendPromises);

    return NextResponse.json({ 
      success: true, 
      message: `Cron exécuté avec succès. ${notifications.length} notifications et vérifications traitées.`,
      logs: notifications
    });

  } catch (error: any) {
    console.error('Erreur Cron check-leases:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// par l'API /api/notifications.

