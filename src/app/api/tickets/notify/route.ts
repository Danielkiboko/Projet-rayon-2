import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticketId, ticketNumber, subject, senderRole, senderName, message, recipientEmail, recipientName, recipientRole, action } = body;

    if (!ticketId || !ticketNumber) {
      return NextResponse.json({ error: "Missing ticket information" }, { status: 400 });
    }

    // 1. Notify Admin when a client or supplier opens a ticket or sends a reply
    if (senderRole !== "admin") {
      try {
        const adminHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #0b061c; color: #ffffff; padding: 24px; border-radius: 12px;">
            <div style="border-bottom: 1px solid #2a1f4d; padding-bottom: 16px; margin-bottom: 20px;">
              <span style="background-color: #8b5cf6; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold;">
                TICKET ${ticketNumber}
              </span>
              <h2 style="color: #ffffff; margin-top: 12px; font-size: 20px;">
                ${action === "create" ? "Nouveau ticket de support créé" : "Nouvelle réponse sur le ticket"}
              </h2>
            </div>
            
            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
              <strong>Expéditeur :</strong> ${senderName} (${senderRole === "client" ? "Client" : "Fournisseur"})
            </p>
            <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5;">
              <strong>Sujet :</strong> ${subject}
            </p>

            <div style="background-color: #1a103c; border-left: 4px solid #8b5cf6; padding: 14px 16px; margin: 16px 0; border-radius: 4px;">
              <p style="color: #e2e8f0; font-size: 14px; white-space: pre-wrap; margin: 0;">${message}</p>
            </div>

            <div style="margin-top: 24px; text-align: center;">
              <a href="https://rayons.net/admin/tickets" style="background-color: #8b5cf6; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                Accéder au Ticket dans l'espace Admin
              </a>
            </div>

            <p style="color: #64748b; font-size: 11px; margin-top: 24px; text-align: center; border-top: 1px solid #2a1f4d; padding-top: 12px;">
              Rayons.net Support Platform
            </p>
          </div>
        `;

        await sendEmail({
          to: "admin@rayons.net",
          subject: `[Support Rayon ${ticketNumber}] ${action === "create" ? "Nouveau ticket" : "Message de"} ${senderName}: ${subject}`,
          html: adminHtml,
        }).catch(err => console.warn("Admin email dispatch warning:", err.message));
      } catch (e) {
        console.warn("Failed sending email to admin:", e);
      }
    }

    // 2. Notify Client or Supplier when Admin replies or ticket is updated
    if (senderRole === "admin" && recipientEmail) {
      try {
        const portalUrl = recipientRole === "supplier" ? "https://rayons.net/supplier/tickets" : "https://rayons.net/dashboard/client";
        const userHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; color: #1e293b; padding: 24px; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="border-bottom: 2px solid #8b5cf6; padding-bottom: 16px; margin-bottom: 20px;">
              <span style="background-color: #8b5cf6; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold;">
                TICKET ${ticketNumber}
              </span>
              <h2 style="color: #0f172a; margin-top: 12px; font-size: 20px;">
                Réponse de l'équipe Support Rayons.net
              </h2>
            </div>
            
            <p style="color: #334155; font-size: 14px;">
              Bonjour <strong>${recipientName || ""}</strong>,
            </p>
            <p style="color: #334155; font-size: 14px;">
              Un conseiller du Support Rayons.net a répondu à votre demande concernant : <strong>"${subject}"</strong>.
            </p>

            <div style="background-color: #ffffff; border-left: 4px solid #8b5cf6; padding: 14px 16px; margin: 16px 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <p style="color: #1e293b; font-size: 14px; white-space: pre-wrap; margin: 0;">${message}</p>
            </div>

            <div style="margin-top: 24px; text-align: center;">
              <a href="${portalUrl}" style="background-color: #8b5cf6; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; display: inline-block;">
                Consulter et répondre sur Rayons.net
              </a>
            </div>

            <p style="color: #94a3b8; font-size: 11px; margin-top: 24px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              Cet email est envoyé automatiquement par la plateforme Rayons.net. Vous pouvez répondre directement depuis votre espace client/fournisseur.
            </p>
          </div>
        `;

        await sendEmail({
          to: recipientEmail,
          subject: `[Support Rayon ${ticketNumber}] Réponse de notre équipe : ${subject}`,
          html: userHtml,
        }).catch(err => console.warn("Recipient email dispatch warning:", err.message));
      } catch (e) {
        console.warn("Failed sending email to recipient:", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Ticket notify error:", error);
    return NextResponse.json({ error: error.message || "Internal error" }, { status: 500 });
  }
}
