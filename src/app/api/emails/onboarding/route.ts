import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email, name, password, role, company } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Differentiate label based on role
    const isSubAgent = role === 'SUB_SUPPLIER' || role === 'sub_supplier';
    const isImmo = role === 'SUPPLIER_IMMO';
    const isSaveurs = role === 'SUPPLIER_SAVEURS';
    const isMode = role === 'SUPPLIER_MODE' || role === 'SUPPLIER' || role === 'supplier';

    let roleLabel = 'Fournisseur';
    let rayonLabel = 'Rayons.net';
    let accentColor = '#C7D300';
    let welcomeText = `Votre compte <strong style="color:#C7D300;">Fournisseur</strong> a été créé avec succès. Vous faites maintenant partie du réseau Rayons.net.`;
    let trialText = `Votre période d'essai de <strong>15 jours</strong> démarre aujourd'hui. Profitez-en pour explorer votre tableau de bord.`;

    if (isSubAgent) {
      roleLabel = 'Sous-Agent';
      welcomeText = `Votre compte <strong style="color:#C7D300;">Sous-Agent</strong> a été créé par votre fournisseur. Vous pouvez désormais gérer les activités déléguées.`;
      trialText = '';
    } else if (isImmo) {
      roleLabel = 'Fournisseur Immo';
      rayonLabel = 'Rayon Immo — Immobilier & Hôtellerie';
      welcomeText = `Votre compte <strong style="color:#C7D300;">Fournisseur Immo</strong> a été créé. Publiez vos propriétés et gérez vos locations & ventes.`;
    } else if (isSaveurs) {
      roleLabel = 'Fournisseur Saveurs';
      rayonLabel = 'Rayon Saveurs — Restauration & Traiteur';
      welcomeText = `Votre compte <strong style="color:#C7D300;">Fournisseur Saveurs</strong> a été créé. Publiez vos menus et gérez vos commandes.`;
    }

    const year = new Date().getFullYear();

    const htmlContent = `
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
              <h2 style="margin:0 0 12px;font-size:22px;color:#ffffff;">Bienvenue, ${name || 'Nouveau Partenaire'} ! 👋</h2>
              <p style="margin:0;font-size:15px;color:#a0b4c0;line-height:1.7;">${welcomeText}</p>
            </td>
          </tr>

          <!-- Rayon Info -->
          ${rayonLabel !== 'Rayons.net' ? `
          <tr>
            <td style="padding:0 40px 20px;">
              <div style="background:rgba(199,211,0,0.08);border:1px solid rgba(199,211,0,0.25);border-radius:10px;padding:20px;">
                <p style="margin:0 0 6px;font-size:11px;color:#8fa3b0;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Votre Rayon de rattachement</p>
                <p style="margin:0;font-size:16px;color:#C7D300;font-weight:700;">${rayonLabel}</p>
                ${company ? `<p style="margin:6px 0 0;font-size:13px;color:#8fa3b0;">Entreprise : <strong style="color:#fff;">${company}</strong></p>` : ''}
              </div>
            </td>
          </tr>` : ''}

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
                    <strong style="font-size:18px;color:#C7D300;letter-spacing:3px;font-family:monospace;">${password}</strong>
                    <p style="margin:6px 0 0;font-size:12px;color:#8fa3b0;">⚠️ Changez ce mot de passe dès votre première connexion</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${trialText ? `
          <!-- Trial Info -->
          <tr>
            <td style="padding:0 40px 20px;">
              <div style="background:rgba(199,211,0,0.05);border-left:3px solid #C7D300;border-radius:0 8px 8px 0;padding:16px 20px;">
                <p style="margin:0;font-size:14px;color:#a0b4c0;line-height:1.6;">⏱️ ${trialText}</p>
              </div>
            </td>
          </tr>` : ''}

          <!-- CTA Button -->
          <tr>
            <td style="padding:0 40px 40px;text-align:center;">
              <a href="https://rayons.net/login" style="display:inline-block;background-color:#C7D300;color:#0F1D27;padding:16px 40px;text-decoration:none;font-weight:800;font-size:15px;border-radius:8px;letter-spacing:0.5px;">
                🚀 Accéder à mon espace
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#0F1D27;padding:24px 40px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);">
              <p style="margin:0 0 6px;font-size:13px;color:#8fa3b0;">Des questions ? Contactez-nous à <a href="mailto:admin@rayons.net" style="color:#C7D300;">admin@rayons.net</a></p>
              <p style="margin:0;font-size:12px;color:#4a6070;">© ${year} Rayons.net — Tous droits réservés</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    await sendEmail({
      to: email,
      subject: `Bienvenue sur Rayons.net — Votre compte ${roleLabel} est prêt !`,
      html: htmlContent,
    });

    return NextResponse.json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("Failed to send onboarding email:", error);
    return NextResponse.json({ error: error.message || "Failed to send email" }, { status: 500 });
  }
}

