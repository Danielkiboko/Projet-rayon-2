import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { FieldValue } from "firebase-admin/firestore";

// ─── Sécurité : Admin uniquement ─────────────────────────────────────────────
const SUPER_ADMIN_EMAIL = "danielkiboko218@gmail.com";
const ADMIN_ROLES = ["SUPER_ADMIN", "SUPERADMIN", "SUB_ADMIN", "ADMIN", "ADMIN_FINANCE", "ADMIN_OPS", "ADMIN_DB", "ADMIN_TECH"];

export async function POST(req: NextRequest) {
  // 1. Vérification du token Firebase
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ success: false, error: "Authentification requise." }, { status: 401 });
  }

  let callerUid = "";
  let callerEmail = "";
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.split("Bearer ")[1]);
    callerUid = decoded.uid;
    callerEmail = (decoded.email || "").toLowerCase().trim();
  } catch {
    return NextResponse.json({ success: false, error: "Token invalide." }, { status: 401 });
  }

  // 2. Vérification du rôle admin
  const callerDoc = await adminDb.collection("users").doc(callerUid).get();
  const callerRole = (callerDoc.data()?.role || "").toUpperCase();
  const isAdmin = callerEmail === SUPER_ADMIN_EMAIL || ADMIN_ROLES.includes(callerRole);
  if (!isAdmin) {
    return NextResponse.json({ success: false, error: "Accès réservé aux administrateurs." }, { status: 403 });
  }

  // 3. Lecture du corps de la requête
  const body = await req.json();
  const { subject, message, targetRayon = "all" } = body;

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ success: false, error: "Sujet et message sont requis." }, { status: 400 });
  }

  // 4. Récupération des fournisseurs ciblés
  const supplierRoles = ["SUPPLIER", "FOURNISSEUR", "SUPPLIER_IMMO", "SUPPLIER_MODE", "SUPPLIER_CONNECT", "SUPPLIER_SAVEURS", "SUB_SUPPLIER"];
  const snap1 = await adminDb.collection("users").where("role", "in", supplierRoles).get();
  const supplierRolesLower = supplierRoles.map(r => r.toLowerCase());
  const snap2 = await adminDb.collection("users").where("role", "in", supplierRolesLower).get();

  const seen = new Set<string>();
  const targets: { id: string; email: string; name: string }[] = [];

  const processDoc = (d: any) => {
    if (seen.has(d.id)) return;
    seen.add(d.id);
    const data = d.data();
    if (!data.email) return;

    if (targetRayon !== "all") {
      const role = (data.role || "").toLowerCase();
      const rayon = (data.rayon || "").toLowerCase();
      const rayons: string[] = Array.isArray(data.assignedRayons) ? data.assignedRayons.map((r: string) => r.toLowerCase()) : [];
      const service = (data.serviceAttached || "").toLowerCase();
      const matches = role.includes(targetRayon) || rayon === targetRayon || rayons.includes(targetRayon) || service === targetRayon;
      if (!matches) return;
    }

    targets.push({ id: d.id, email: data.email, name: data.displayName || data.name || "Fournisseur" });
  };

  snap1.forEach(processDoc);
  snap2.forEach(processDoc);

  if (targets.length === 0) {
    return NextResponse.json({ success: false, error: "Aucun fournisseur trouvé pour ce ciblage." }, { status: 404 });
  }

  // 5. Envoi email + notification in-app
  const results = { emailsSent: 0, emailsFailed: 0, notifsSent: 0 };
  const emailHtml = buildBroadcastEmailHtml({ subject, message });

  await Promise.allSettled(
    targets.map(async (target) => {
      try {
        await sendEmail({ to: target.email, subject: `[Rayons.net] ${subject}`, html: emailHtml });
        results.emailsSent++;
      } catch (err) {
        console.error(`Email failed for ${target.email}:`, err);
        results.emailsFailed++;
      }

      try {
        await adminDb.collection("inapp_notifications").add({
          userId: target.id,
          supplierId: target.id,
          type: "system",
          title: subject,
          message: message,
          link: "/supplier/messages",
          read: false,
          time: Date.now(),
          sentByAdmin: true,
          sentBy: callerEmail,
          createdAt: FieldValue.serverTimestamp(),
        });
        results.notifsSent++;
      } catch (err) {
        console.error(`In-app notif failed for ${target.id}:`, err);
      }
    })
  );

  // 6. Historique dans Firestore
  await adminDb.collection("admin_broadcasts").add({
    subject,
    message,
    targetRayon,
    targetCount: targets.length,
    emailsSent: results.emailsSent,
    emailsFailed: results.emailsFailed,
    sentBy: callerEmail,
    sentAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({
    success: true,
    message: `Message envoyé à ${results.emailsSent}/${targets.length} fournisseur(s).`,
    results,
  });
}

function buildBroadcastEmailHtml({ subject, message }: { subject: string; message: string }) {
  const messageHtml = message.replace(/\n/g, "<br/>");
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fb;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e 0%,#0f3460 100%);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">📢 Rayons.net</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.7);font-size:13px;">Message de l'Administration</p>
          </td>
        </tr>
        <tr>
          <td style="background:#0f3460;padding:16px 40px;">
            <p style="margin:0;color:#e94560;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Objet</p>
            <h2 style="margin:4px 0 0;color:#fff;font-size:18px;font-weight:700;">${subject}</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 20px;color:#444;font-size:15px;line-height:1.8;">${messageHtml}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:28px 0;"/>
            <p style="margin:0;color:#999;font-size:12px;">Ce message vous a été envoyé par l'équipe d'administration de Rayons.net.<br/>Connectez-vous à votre espace fournisseur pour plus de détails.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="margin:0;color:#bbb;font-size:11px;">© ${new Date().getFullYear()} Rayons.net</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
