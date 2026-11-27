import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { sendSMS } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { getServerCaller } from "@/lib/serverAuth";
import { dispatchAccountNotification } from "@/lib/pushNotifications";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * GET / POST /api/cron/check-leases
 * 1. Rappels automatiques de loyers à J-3, J0 (jour J) et J+5 (retard) avec anti-spam par échéance,
 *    au nom du propriétaire/agence (Email + SMS + Push).
 * 2. Alerte Push temps réel au bailleur lorsqu'un loyer bascule en retard (J+5).
 * 3. Contrôle automatique des abonnements fournisseurs expirés.
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = (process.env.CRON_SECRET || "").trim();
    const authHeader = request.headers.get("authorization") || "";
    const querySecret = request.nextUrl.searchParams.get("secret") || "";
    const hasValidCronSecret =
      Boolean(cronSecret && cronSecret !== "REMPLACEZ_PAR_VOTRE_SECRET") &&
      (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret);

    if (!hasValidCronSecret) {
      const caller = await getServerCaller(request);
      if (!caller || !caller.isAdmin) {
        return new NextResponse("Unauthorized", { status: 401 });
      }
    }

    const now = new Date();
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);

    // 1. Récupérer les locataires actifs / en retard
    const tenantsSnapshot = await adminDb.collection("tenants").limit(500).get();

    const notifications: string[] = [];
    const sendPromises: Promise<any>[] = [];
    const agencyNameCache = new Map<string, { name: string; phone: string; email: string }>();

    const getAgencyMeta = async (supplierId: string) => {
      if (!supplierId) return { name: "Votre Propriétaire", phone: "", email: "" };
      if (agencyNameCache.has(supplierId)) return agencyNameCache.get(supplierId)!;
      try {
        const uSnap = await adminDb.collection("users").doc(supplierId).get();
        const u = uSnap.exists ? uSnap.data() || {} : {};
        const meta = {
          name: String(u.companyName || u.company || u.displayName || "Votre Propriétaire").trim(),
          phone: String(u.phone || "").trim(),
          email: String(u.email || "").trim(),
        };
        agencyNameCache.set(supplierId, meta);
        return meta;
      } catch {
        return { name: "Votre Propriétaire", phone: "", email: "" };
      }
    };

    for (const docSnap of tenantsSnapshot.docs) {
      const data = docSnap.data() || {};
      if (data.status === "PARTI" || !data.nextPayment) continue;

      const nextPaymentStr = String(data.nextPayment).split("T")[0];
      const dueDate = new Date(nextPaymentStr);
      if (Number.isNaN(dueDate.getTime())) continue;
      dueDate.setHours(0, 0, 0, 0);

      const diffDays = Math.round((dueDate.getTime() - todayMidnight.getTime()) / (24 * 60 * 60 * 1000));

      // Basculer automatiquement en statut "En retard" dès que la date est dépassée
      if (diffDays < 0 && data.status !== "En retard" && data.status !== "LATE") {
        sendPromises.push(
          docSnap.ref.set({ status: "En retard", updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        );
      }

      // Palier de rappel anti-spam : J-3, J0, J+5
      let stage: "J-3" | "J0" | "J+5" | null = null;
      if (diffDays === 3) stage = "J-3";
      else if (diffDays === 0) stage = "J0";
      else if (diffDays <= -5) stage = "J+5";

      if (!stage) continue;

      const reminderKey = `${nextPaymentStr}:${stage}`;
      const sentKeys: string[] = Array.isArray(data.sentReminderKeys) ? data.sentReminderKeys : [];
      if (sentKeys.includes(reminderKey)) {
        continue; // Déjà rappelé pour cette échéance et ce palier -> zéro spam !
      }

      const tenantName = String(data.name || data.tenantName || "Locataire").trim();
      const tenantPhone = String(data.phone || data.tenantPhone || "").trim();
      const tenantEmail = String(data.email || data.tenantEmail || "").trim();
      const rentAmount = Number(data.rentAmount || 0);
      const propertyName = String(data.propertyName || "votre logement");
      const supplierId = String(data.supplierId || "");
      const agency = await getAgencyMeta(supplierId);
      const dueDateFr = dueDate.toLocaleDateString("fr-FR");
      const contactHint = agency.phone ? ` Contact : ${agency.phone}.` : "";

      let smsMessage = "";
      let emailSubject = "";
      let emailHeadline = "";

      if (stage === "J-3") {
        smsMessage = `${agency.name}: Bonjour ${tenantName}, rappel amical : votre loyer de $${rentAmount} (${propertyName}) arrive à échéance dans 3 jours (${dueDateFr}).${contactHint}`;
        emailSubject = `Rappel de loyer dans 3 jours ($${rentAmount}) — ${agency.name}`;
        emailHeadline = "Votre loyer arrive à échéance dans 3 jours";
      } else if (stage === "J0") {
        smsMessage = `${agency.name}: Bonjour ${tenantName}, votre loyer de $${rentAmount} (${propertyName}) arrive à échéance aujourd'hui (${dueDateFr}). Merci de procéder au règlement.${contactHint}`;
        emailSubject = `Échéance loyer aujourd'hui ($${rentAmount}) — ${agency.name}`;
        emailHeadline = "Votre loyer arrive à échéance aujourd’hui";
      } else {
        smsMessage = `${agency.name} (URGENT): Bonjour ${tenantName}, votre loyer de $${rentAmount} prévu le ${dueDateFr} est en retard. Merci de régulariser votre situation.${contactHint}`;
        emailSubject = `URGENT : Loyer en retard ($${rentAmount}) — ${agency.name}`;
        emailHeadline = "Rappel urgent : votre loyer est en retard";
      }

      if (tenantPhone) {
        sendPromises.push(sendSMS(tenantPhone, smsMessage).catch(() => {}));
        notifications.push(`SMS [${stage}] à ${tenantPhone}`);
      }

      if (tenantEmail && tenantEmail.includes("@")) {
        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;background:#0F1D27;color:#F8FAFC;border-radius:16px;overflow:hidden;border:1px solid #1E3343;">
            <div style="padding:20px 26px;background:#0B161E;border-bottom:1px solid #1E3343;">
              <div style="font-size:18px;font-weight:800;color:#FFFFFF;">${escapeHtml(agency.name)}</div>
              <div style="font-size:11px;color:#94A3B8;margin-top:2px;">Gestion Locative · ${escapeHtml(propertyName)}</div>
            </div>
            <div style="padding:26px;">
              <h2 style="margin:0 0 10px;font-size:18px;color:${stage === "J+5" ? "#FCA5A5" : "#FFFFFF"};">${escapeHtml(emailHeadline)}</h2>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#CBD5E1;">
                Bonjour <strong>${escapeHtml(tenantName)}</strong>,<br/>
                Votre loyer de <strong>$${rentAmount} USD</strong> pour <strong>${escapeHtml(propertyName)}</strong> a pour date d&apos;échéance le <strong>${escapeHtml(dueDateFr)}</strong>.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">
                Merci de bien vouloir contacter directement <strong>${escapeHtml(agency.name)}</strong> pour le règlement et la réception de votre quittance de loyer.
              </p>
              ${
                agency.phone || agency.email
                  ? `<div style="margin-top:18px;padding:12px 16px;background:#0B161E;border:1px solid #1E3343;border-radius:10px;font-size:12px;color:#CBD5E1;">
                      ${agency.phone ? `<div>Tél : <strong>${escapeHtml(agency.phone)}</strong></div>` : ""}
                      ${agency.email ? `<div>Email : <strong>${escapeHtml(agency.email)}</strong></div>` : ""}
                    </div>`
                  : ""
              }
            </div>
          </div>
        `;
        sendPromises.push(sendEmail({ to: tenantEmail, subject: emailSubject, html }).catch(() => {}));
        notifications.push(`Email [${stage}] à ${tenantEmail}`);
      }

      // Alerte bailleur en cas de retard J+5
      if (stage === "J+5" && supplierId) {
        sendPromises.push(
          dispatchAccountNotification({
            userId: supplierId,
            supplierId,
            type: "system",
            title: `⚠️ Loyer impayé : ${tenantName}`,
            message: `${tenantName} (${propertyName}) a un loyer de $${rentAmount} en retard depuis le ${dueDateFr}. Une relance automatique a été envoyée.`,
            link: "/supplier/tenants",
            tag: `landlord-late-${docSnap.id}-${nextPaymentStr}`,
          }).catch(() => {})
        );
      }

      // Mémoriser le rappel envoyé pour anti-spam
      const nextSentKeys = [...sentKeys.slice(-11), reminderKey];
      sendPromises.push(
        docSnap.ref.set(
          {
            sentReminderKeys: nextSentKeys,
            lastAutoReminderStage: stage,
            lastAutoReminderAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        )
      );
    }

    // 2. Contrôle automatique des échéances d'abonnements & dépôts des fournisseurs
    try {
      const suppliersSnapshot = await adminDb
        .collection("users")
        .where("role", "in", ["SUPPLIER", "supplier", "SUPPLIER_IMMO", "supplier_immo", "SUPPLIER_SAVEURS"])
        .get();

      suppliersSnapshot.forEach((docSnap: any) => {
        const sData = docSnap.data();
        if (!sData.subscriptionEndDate) return;

        const endDate = sData.subscriptionEndDate?.toDate
          ? sData.subscriptionEndDate.toDate()
          : new Date(sData.subscriptionEndDate);

        if (now > endDate && sData.subscriptionStatus !== "SUSPENDED_PAYMENT" && !sData.isBlocked) {
          sendPromises.push(
            adminDb.collection("users").doc(docSnap.id).update({
              subscriptionStatus: "SUSPENDED_PAYMENT",
              isBlocked: true,
              blockedAt: now.toISOString(),
            })
          );

          const supPhone = sData.phone;
          const supName = sData.displayName || sData.company || "Partenaire";
          const supMessage = `URGENT: Bonjour ${supName}, votre période sur Rayons.net est arrivée à échéance. Votre compte a été suspendu (publications et messages verrouillés). Veuillez régulariser votre dépôt mensuel ($50) pour débloquer votre compte.`;

          if (supPhone) {
            sendPromises.push(sendSMS(supPhone, supMessage).catch(() => {}));
            notifications.push(`SMS Blocage Fournisseur à ${supPhone}`);
          }
          if (sData.email) {
            sendPromises.push(
              sendEmail({
                to: sData.email,
                subject: "Suspension de Compte Fournisseur — Rayons.net",
                html: `<p>${escapeHtml(supMessage)}</p>`,
              }).catch(() => {})
            );
            notifications.push(`Email Blocage Fournisseur à ${sData.email}`);
          }
        }
      });
    } catch (supErr) {
      console.error("Erreur vérification fournisseurs dans Cron:", supErr);
    }

    await Promise.allSettled(sendPromises);

    return NextResponse.json({
      success: true,
      message: `Cron exécuté avec succès. ${notifications.length} notifications et vérifications traitées.`,
      logs: notifications,
    });
  } catch (error: any) {
    console.error("Erreur Cron check-leases:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
