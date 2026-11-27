import nodemailer from "nodemailer";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  fromName?: string;
  attachments?: Array<{
    filename: string;
    content: string | Buffer;
    encoding?: string;
    contentType?: string;
  }>;
}

export function createSmtpTransporter() {
  const port = Number(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port,
    secure: port === 465,
    connectionTimeout: 6000,
    greetingTimeout: 6000,
    socketTimeout: 8000,
    auth: {
      user: process.env.SMTP_USER || "no-reply@rayons.net",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

export const sendEmail = async ({
  to,
  subject,
  html,
  replyTo,
  fromName = "Rayons.net",
  attachments,
}: SendEmailOptions) => {
  try {
    const transporter = createSmtpTransporter();
    const sender = process.env.SMTP_USER || "no-reply@rayons.net";

    const info = await transporter.sendMail({
      from: `"${fromName.replace(/"/g, "")}" <${sender}>`,
      to,
      replyTo,
      subject,
      html,
      attachments,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
