import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        { error: "Veuillez fournir une adresse email valide." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Verify user exists
    let userRecord: any;
    try {
      userRecord = await adminAuth.getUserByEmail(cleanEmail);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        return NextResponse.json(
          { error: "Aucun compte ne correspond à cette adresse email." },
          { status: 404 }
        );
      }
      throw err;
    }

    // Generate reset link
    const resetLink = await adminAuth.generatePasswordResetLink(cleanEmail);

    const displayName = userRecord.displayName || "Cher utilisateur";

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #edf2f7; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 28px;">
          <h1 style="color: #0F1D27; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.5px;">Rayons<span style="color: #C7D300;">.net</span></h1>
          <p style="color: #718096; font-size: 14px; margin-top: 6px;">Plateforme officielle</p>
        </div>

        <div style="background-color: #F8FAFC; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
          <p style="color: #1A202C; font-size: 16px; font-weight: 600; margin-top: 0;">Bonjour ${displayName},</p>
          <p style="color: #4A5568; font-size: 14px; line-height: 1.6; margin: 12px 0 0 0;">
            Vous avez demandé la réinitialisation du mot de passe de votre compte <strong>${cleanEmail}</strong>.
          </p>
          <p style="color: #4A5568; font-size: 14px; line-height: 1.6; margin: 8px 0 0 0;">
            Cliquez sur le bouton ci-dessous pour choisir votre nouveau mot de passe :
          </p>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetLink}" style="background-color: #0F1D27; color: #ffffff; padding: 14px 32px; font-size: 15px; font-weight: 700; text-decoration: none; border-radius: 50px; display: inline-block; box-shadow: 0 4px 12px rgba(15, 29, 39, 0.2);">
            Réinitialiser mon mot de passe
          </a>
        </div>

        <p style="color: #A0AEC0; font-size: 12px; line-height: 1.5; text-align: center; margin-top: 28px;">
          Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel ne sera pas modifié.
        </p>

        <hr style="border: none; border-top: 1px solid #EDF2F7; margin: 24px 0;" />
        
        <p style="color: #CBD5E0; font-size: 11px; word-break: break-all; text-align: center;">
          Lien de secours : ${resetLink}
        </p>
      </div>
    `;

    await sendEmail({
      to: cleanEmail,
      subject: "Réinitialisation de votre mot de passe — Rayons.net",
      html: emailHtml,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: error.message || "Une erreur est survenue lors de l'envoi de l'email." },
      { status: 500 }
    );
  }
}
