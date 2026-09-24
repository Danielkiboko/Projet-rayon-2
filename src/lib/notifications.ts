// src/lib/notifications.ts
import { sendMobiShastraSMS } from "@/lib/sms";


export async function sendEmail(to: string, subject: string, text: string) {
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  
  if (!RESEND_API_KEY) {
    console.warn("Email ignoré : Clé Resend manquante.");
    return;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'noreply@rayons.net',
        to: to,
        subject: subject,
        text: text
      })
    });
    
    return await response.json();
  } catch (err) {
    console.error("Erreur d'envoi Email:", err);
  }
}

export async function sendSMS(phone: string, message: string, customSenderId?: string) {
  try {
    const result = await sendMobiShastraSMS({ mobileNo: phone, message, customSenderId });
    return result;
  } catch (err) {
    console.error("Erreur d'envoi SMS via lib/sms:", err);
  }
}

// Templates génériques

export function getOrderCreatedEmail(orderId: string, category: string) {
  return `Nouvelle commande reçue !
Identifiant: ${orderId}
Catégorie: ${category.toUpperCase()}

Veuillez consulter votre tableau de bord fournisseur pour plus de détails.`;
}

export function getOrderCreatedSMS(orderId: string) {
  return `Rayon : Vous avez reçu une nouvelle commande (${orderId.slice(0, 6)}). Vérifiez votre espace.`;
}

export function getOrderStatusEmail(orderId: string, status: string) {
  let message = "";
  if (status === "ACCEPTED") {
    message = "Votre commande a été acceptée et est en cours de livraison.";
  } else if (status === "ARRIVED_AWAITING_PAYMENT") {
    message = "Votre livreur est arrivé. Veuillez procéder au paiement si ce n'est pas déjà fait.";
  } else if (status === "COMPLETED") {
    message = "Votre commande est terminée. Merci d'avoir choisi Rayon !";
  } else {
    message = `Le statut de votre commande est maintenant : ${status}`;
  }

  return `Mise à jour de votre commande (${orderId})\n\n${message}`;
}

export function getOrderStatusSMS(orderId: string, status: string) {
  if (status === "ACCEPTED") return `Rayon: Commande ${orderId.slice(0,6)} en route!`;
  if (status === "ARRIVED_AWAITING_PAYMENT") return `Rayon: Le livreur est arrivé pour la commande ${orderId.slice(0,6)}.`;
  if (status === "COMPLETED") return `Rayon: Commande ${orderId.slice(0,6)} livrée. Merci !`;
  return `Rayon: Commande ${orderId.slice(0,6)} -> ${status}`;
}
