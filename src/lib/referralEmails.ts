/**
 * Templates HTML des emails du programme de parrainage Rayons.net
 */
import { REFERRAL_COMMISSION_USD, REFERRAL_DISCOUNT_USD, getAppUrl } from "./referralConfig";

const escapeHtml = (s: string) =>
  String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function layout(title: string, body: string, ctaLabel?: string, ctaUrl?: string) {
  const cta = ctaLabel && ctaUrl
    ? `<div style="text-align:center;margin:28px 0 8px;">
         <a href="${ctaUrl}" style="display:inline-block;background:#C7D300;color:#0F1D27;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:12px;font-size:14px;">${escapeHtml(ctaLabel)}</a>
       </div>`
    : "";
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;background:#f3f5f7;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
      <div style="background:#0F1D27;border-radius:20px 20px 0 0;padding:24px 28px;">
        <span style="color:#C7D300;font-weight:800;font-size:20px;letter-spacing:-0.5px;">Rayons.net</span>
        <span style="color:#9ca3af;font-size:12px;margin-left:8px;">Programme Partenaire</span>
      </div>
      <div style="background:#ffffff;border-radius:0 0 20px 20px;padding:28px;color:#1f2937;font-size:14px;line-height:1.6;">
        <h1 style="font-size:20px;margin:0 0 16px;color:#0F1D27;">${escapeHtml(title)}</h1>
        ${body}
        ${cta}
      </div>
      <p style="text-align:center;color:#9ca3af;font-size:11px;margin-top:16px;">© ${new Date().getFullYear()} Rayons.net — Kinshasa, RDC</p>
    </div>
  </body></html>`;
}

export function inviteEmail(params: { referrerName: string; code: string; link: string; personalMessage?: string }) {
  const { referrerName, code, link, personalMessage } = params;
  return {
    subject: `${referrerName} vous invite à vendre sur Rayons.net (-${REFERRAL_DISCOUNT_USD} USD)`,
    html: layout(
      `${escapeHtml(referrerName)} vous invite sur Rayons.net`,
      `<p>Bonjour,</p>
       <p><strong>${escapeHtml(referrerName)}</strong> vend déjà sur Rayons.net et vous invite à ouvrir votre boutique en ligne pour toucher des milliers de clients à Kinshasa.</p>
       ${personalMessage ? `<blockquote style="border-left:3px solid #C7D300;margin:16px 0;padding:8px 14px;color:#4b5563;background:#f9fafb;border-radius:6px;">${escapeHtml(personalMessage)}</blockquote>` : ""}
       <div style="background:#0F1D27;color:#fff;border-radius:14px;padding:18px;text-align:center;margin:20px 0;">
         <div style="font-size:12px;color:#9ca3af;">Votre code promo</div>
         <div style="font-size:26px;font-weight:800;letter-spacing:3px;color:#C7D300;margin-top:4px;">${escapeHtml(code)}</div>
         <div style="font-size:12px;color:#d1d5db;margin-top:6px;">${REFERRAL_DISCOUNT_USD} USD de réduction sur votre prochain mois d'abonnement</div>
       </div>`,
      "Créer ma boutique avec ce code",
      link
    ),
  };
}

export function newReferralEmail(params: { referrerName: string; filleulName: string }) {
  const { referrerName, filleulName } = params;
  return {
    subject: `🎉 ${filleulName} s'est inscrit avec votre code promo`,
    html: layout(
      "Nouveau filleul inscrit !",
      `<p>Bonjour ${escapeHtml(referrerName)},</p>
       <p><strong>${escapeHtml(filleulName)}</strong> vient de s'abonner sur Rayons.net avec votre code promo.</p>
       <p>Vous gagnez désormais <strong>${REFERRAL_COMMISSION_USD} USD à chaque paiement d'abonnement</strong> de ce partenaire, à vie.</p>`,
      "Voir mon espace parrainage",
      `${getAppUrl()}/supplier/referrals`
    ),
  };
}

export function commissionEmail(params: { referrerName: string; filleulName: string; amount: number; balance: number; isSignup: boolean }) {
  const { referrerName, filleulName, amount, balance, isSignup } = params;
  return {
    subject: `+${amount} USD de commission — ${isSignup ? "abonnement" : "réabonnement"} de ${filleulName}`,
    html: layout(
      `+${amount} USD de commission`,
      `<p>Bonjour ${escapeHtml(referrerName)},</p>
       <p>Votre filleul <strong>${escapeHtml(filleulName)}</strong> vient de ${isSignup ? "souscrire son abonnement" : "renouveler son abonnement"}.</p>
       <p>Une commission de <strong>${amount} USD</strong> a été ajoutée à votre solde de parrainage.</p>
       <p style="background:#f9fafb;border-radius:10px;padding:12px 14px;">Solde à recevoir : <strong>${balance.toFixed(2)} USD</strong></p>`,
      "Voir mes commissions",
      `${getAppUrl()}/supplier/referrals`
    ),
  };
}

export function payoutEmail(params: { referrerName: string; amount: number }) {
  return {
    subject: `💸 Versement de vos commissions de parrainage (${params.amount.toFixed(2)} USD)`,
    html: layout(
      "Vos commissions ont été versées",
      `<p>Bonjour ${escapeHtml(params.referrerName)},</p>
       <p>Rayons.net vient de vous verser <strong>${params.amount.toFixed(2)} USD</strong> de commissions de parrainage. Le montant apparaît dans votre livre de caisse.</p>
       <p>Merci de faire grandir la communauté Rayons.net !</p>`,
      "Voir mon espace parrainage",
      `${getAppUrl()}/supplier/referrals`
    ),
  };
}
