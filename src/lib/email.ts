import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, html }: { to: string; subject: string; html: string }) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: Number(process.env.SMTP_PORT) || 465,
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: {
        user: process.env.SMTP_USER || 'admin@rayons.net',
        pass: process.env.SMTP_PASS || 'Kinoko88@',
      },
    });

    const info = await transporter.sendMail({
      from: `"Rayons.net" <${process.env.SMTP_USER || 'admin@rayons.net'}>`,
      to,
      subject,
      html,
    });

    console.log("Email sent: %s", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
