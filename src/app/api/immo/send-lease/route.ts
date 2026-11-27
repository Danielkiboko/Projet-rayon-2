import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { requireSupplierOrAdminCaller } from "@/server/guards";

export async function POST(req: Request) {
  try {
    const guard = await requireSupplierOrAdminCaller(req);
    if (!guard.ok) return guard.errorResponse!;

    const body = await req.json();
    const {
      tenantEmail,
      tenantName,
      agencyName = "Agence Immobilière",
      agencyPhone,
      agencyEmail,
      propertyName = "Logement",
      unitName,
      pdfBase64,
      rentAmount,
      currency = "USD",
      startDate,
    } = body;

    if (!tenantEmail || !pdfBase64) {
      return NextResponse.json(
        { error: "tenantEmail and pdfBase64 are required" },
        { status: 400 }
      );
    }

    const cleanEmail = tenantEmail.trim().toLowerCase();
    const cleanAgency = (agencyName || "Agence Immobilière").trim();

    const esc = (s: any) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const safeAgency = esc(cleanAgency);
    const safeTenant = esc(tenantName || "Cher locataire");
    const safeProperty = esc(propertyName);
    const safeUnit = unitName ? esc(unitName) : "";
    const safePhone = agencyPhone ? esc(agencyPhone) : "";
    const safeAgencyEmail = agencyEmail ? esc(agencyEmail) : "";
    const safeStartDate = startDate ? esc(startDate) : "";
    const safeCurrency = esc(currency);

    if (!process.env.SMTP_PASS) {
      return NextResponse.json(
        { error: "Configuration SMTP manquante sur le serveur (SMTP_PASS)." },
        { status: 500 }
      );
    }

    // Setup nodemailer with official SMTP (strict timeouts to prevent proxy 504)
    const smtpPort = Number(process.env.SMTP_PORT) || 465;
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.hostinger.com",
      port: smtpPort,
      secure: smtpPort === 465,
      connectionTimeout: 6000,
      greetingTimeout: 6000,
      socketTimeout: 8000,
      auth: {
        user: process.env.SMTP_USER || "no-reply@rayons.net",
        pass: process.env.SMTP_PASS,
      },
    });

    // Remove data URI prefix if present
    const cleanBase64 = pdfBase64.includes("base64,")
      ? pdfBase64.split("base64,")[1]
      : pdfBase64;

    const fileName = `Contrat_Bail_${(tenantName || "Locataire").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 28px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px;">
        <div style="border-bottom: 2px solid #4C6EF5; padding-bottom: 16px; margin-bottom: 24px;">
          <h1 style="color: #0F1D27; font-size: 22px; font-weight: 800; margin: 0;">${safeAgency.toUpperCase()}</h1>
          <p style="color: #4C6EF5; font-size: 13px; font-weight: 600; margin: 4px 0 0 0;">GESTION IMMOBILIÈRE & LOCATIVE</p>
        </div>

        <p style="color: #1a202c; font-size: 15px; font-weight: 600;">Bonjour ${safeTenant},</p>
        
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">
          Nous vous confirmons l'enregistrement officiel de votre contrat de bail auprès de notre agence <strong>${safeAgency}</strong> pour le bien suivant :
        </p>

        <div style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 10px; padding: 16px; margin: 20px 0;">
          <p style="margin: 4px 0; color: #2d3748; font-size: 14px;">🏠 <strong>Bien :</strong> ${safeProperty}${safeUnit ? ` (Unité / Porte : ${safeUnit})` : ""}</p>
          ${rentAmount ? `<p style="margin: 4px 0; color: #2d3748; font-size: 14px;">💰 <strong>Loyer mensuel :</strong> ${Number(rentAmount).toLocaleString()} ${safeCurrency}</p>` : ""}
          ${safeStartDate ? `<p style="margin: 4px 0; color: #2d3748; font-size: 14px;">📅 <strong>Prise d'effet :</strong> ${safeStartDate}</p>` : ""}
        </div>

        <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">
          📄 Votre <strong>Contrat de Bail officiel</strong> est joint à cet email au format PDF. Nous vous invitons à le conserver précieusement.
        </p>

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #718096;">
          <p style="margin: 2px 0;"><strong>${safeAgency}</strong></p>
          ${safePhone ? `<p style="margin: 2px 0;">Tél : ${safePhone}</p>` : ""}
          ${safeAgencyEmail ? `<p style="margin: 2px 0;">Email : ${safeAgencyEmail}</p>` : ""}
          <p style="margin-top: 8px; color: #a0aec0; font-size: 11px;">Plateforme technique sécurisée : Rayons.net</p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"${cleanAgency}" <${process.env.SMTP_USER || "no-reply@rayons.net"}>`,
      replyTo: agencyEmail || undefined,
      to: cleanEmail,
      subject: `Votre Contrat de Bail Officiel — ${propertyName} [${cleanAgency}]`,
      html: htmlContent,
      attachments: [
        {
          filename: fileName,
          content: Buffer.from(cleanBase64, "base64"),
          contentType: "application/pdf",
        },
      ],
    });

    console.log(`Lease PDF email sent to ${cleanEmail}, messageId: ${info.messageId}`);
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("Error sending lease email:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send lease email" },
      { status: 500 }
    );
  }
}
