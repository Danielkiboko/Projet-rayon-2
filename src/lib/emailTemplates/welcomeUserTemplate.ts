export interface WelcomeUserEmailParams {
  displayName?: string;
  email: string;
  displayRole: string;
  rayonDisplay: string;
  roleToCreate: string;
  finalPassword: string;
  loginUrl: string;
  resetLink?: string | null;
  driverApkUrl: string;
}

export function buildWelcomeUserEmailHtml(p: WelcomeUserEmailParams): string {
  return `
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
              <h2 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Bienvenue, ${p.displayName || "Nouveau Partenaire"} ! 👋</h2>
              <p style="margin:0;font-size:15px;color:#a0b4c0;line-height:1.7;">
                Votre compte <strong style="color:#C7D300;">${p.displayRole}</strong> a été créé avec succès par l'administration de Rayons.net. Vous faites maintenant partie de notre réseau de partenaires.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 20px;">
              <div style="background:rgba(199,211,0,0.08);border:1px solid rgba(199,211,0,0.25);border-radius:10px;padding:20px;">
                <p style="margin:0 0 6px;font-size:11px;color:#8fa3b0;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Votre Rayon de rattachement</p>
                <p style="margin:0;font-size:16px;color:#C7D300;font-weight:700;">${p.rayonDisplay}</p>
              </div>
            </td>
          </tr>
          ${p.roleToCreate === "driver" ? `
          <tr>
            <td style="padding:0 40px 20px;">
              <div style="background:linear-gradient(135deg, rgba(199,211,0,0.15) 0%, rgba(15,29,39,0.95) 100%);border:2px solid #C7D300;border-radius:12px;padding:24px;text-align:center;">
                <div style="font-size:32px;margin-bottom:8px;">📲</div>
                <h3 style="margin:0 0 8px;font-size:18px;color:#ffffff;font-weight:700;">Application Mobile Livreur (Android)</h3>
                <p style="margin:0 0 16px;font-size:14px;color:#a0b4c0;line-height:1.5;">
                  Téléchargez l'application officielle sur votre smartphone Android pour recevoir vos livraisons en temps réel, naviguer via le GPS et valider vos encaissements.
                </p>
                <a href="${p.driverApkUrl}" style="display:inline-block;background-color:#C7D300;color:#0F1D27;padding:14px 28px;text-decoration:none;font-weight:800;font-size:14px;border-radius:8px;letter-spacing:0.5px;">
                  📥 Télécharger l'Application (.APK)
                </a>
                <p style="margin:12px 0 0;font-size:12px;color:#8fa3b0;">
                  Lien permanent : <br><a href="${p.driverApkUrl}" style="color:#C7D300;word-break:break-all;">${p.driverApkUrl}</a>
                </p>
              </div>
            </td>
          </tr>
          ` : ""}
          <tr>
            <td style="padding:0 40px 20px;">
              <h3 style="margin:0 0 16px;font-size:16px;color:#ffffff;font-weight:600;">🔐 Vos informations de connexion</h3>
              <table role="presentation" width="100%" style="background:#0F1D27;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,0.1);">
                <tr>
                  <td style="padding:14px 20px;border-bottom:1px solid rgba(255,255,255,0.08);">
                    <span style="font-size:12px;color:#8fa3b0;text-transform:uppercase;letter-spacing:0.5px;">Identifiant</span><br>
                    <strong style="font-size:15px;color:#ffffff;">${p.email}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 20px;">
                    <span style="font-size:12px;color:#8fa3b0;text-transform:uppercase;letter-spacing:0.5px;">Mot de passe temporaire</span><br>
                    <strong style="font-size:18px;color:#C7D300;letter-spacing:3px;font-family:monospace;">${p.finalPassword}</strong>
                    <p style="margin:6px 0 0;font-size:12px;color:#8fa3b0;">⚠️ Changez ce mot de passe dès votre première connexion</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="${p.loginUrl}" style="display:inline-block;background-color:#C7D300;color:#0F1D27;padding:16px 40px;text-decoration:none;font-weight:800;font-size:15px;border-radius:8px;letter-spacing:0.5px;">
                ${p.resetLink ? "🚀 Configurer mon mot de passe" : "🚀 Me connecter à Rayons.net"}
              </a>
              <p style="margin:16px 0 0;font-size:13px;color:#8fa3b0;">
                Ou copiez ce lien : <a href="${p.loginUrl}" style="color:#C7D300;">${p.loginUrl}</a>
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
  `;
}
