import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { sendMobiShastraSMS } from "@/lib/sms";
import { FieldValue } from "firebase-admin/firestore";

// Vercel Cron Secret (optionnel)
const CRON_SECRET = process.env.CRON_SECRET;

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate && typeof val.toDate === "function") return val.toDate();
  if (typeof val === "number") return new Date(val);
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export async function GET(req: Request) {
  return handleDailyReports(req);
}

export async function POST(req: Request) {
  return handleDailyReports(req);
}

async function handleDailyReports(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get("secret");

    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}` && secretParam !== CRON_SECRET) {
      console.log("[DailyReport] Cron secret check passed or skipped for internal execution.");
    }

    const now = new Date();
    const periodParam = searchParams.get("period"); // 'yesterday' | 'today' | auto

    // Détermination de la période de rapport :
    // Si le rapport tourne le matin à 7h (avant 12h00) ou si period === 'yesterday',
    // on dresse le bilan complet de la veille (J-1 de 00:00:00 à 23:59:59.999).
    // Si déclenché l'après-midi manuellement, on dresse le bilan du jour même (J).
    const isMorningRun = periodParam === "yesterday" || (!periodParam && now.getHours() < 12);

    let periodStart: Date;
    let periodEnd: Date;
    let reportTargetDate: Date;

    if (isMorningRun) {
      // Journée d'hier (J-1)
      reportTargetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      periodStart = new Date(reportTargetDate.getFullYear(), reportTargetDate.getMonth(), reportTargetDate.getDate(), 0, 0, 0, 0);
      periodEnd = new Date(reportTargetDate.getFullYear(), reportTargetDate.getMonth(), reportTargetDate.getDate(), 23, 59, 59, 999);
    } else {
      // Journée d'aujourd'hui (J)
      reportTargetDate = now;
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      periodEnd = now;
    }

    const dateFormatted = reportTargetDate.toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const isWithinPeriod = (date: Date | null) => {
      if (!date) return false;
      return date >= periodStart && date <= periodEnd;
    };

    console.log(`[DailyReport] Generating 07h00 reports for target date: ${dateFormatted} [${periodStart.toISOString()} -> ${periodEnd.toISOString()}]`);

    // ─────────────────────────────────────────────────────────────
    // 1. Récupération de TOUS les Fournisseurs (Multi-sources & Tous rôles)
    // ─────────────────────────────────────────────────────────────
    const suppliersMap = new Map<string, any>();

    // Source A : Collection "suppliers" (fournisseurs enregistrés)
    try {
      const suppliersSnap = await adminDb.collection("suppliers").get();
      suppliersSnap.forEach((doc: any) => {
        const d = doc.data();
        suppliersMap.set(doc.id, {
          id: doc.id,
          ...d,
          email: (d.email || "").trim(),
          phone: (d.phone || "").trim(),
          company: d.company || d.companyName || d.agencyName || d.displayName || d.name || "Partenaire",
          displayName: d.displayName || d.name || d.company || "Partenaire",
          senderId: d.senderId || d.customSenderId || d.smsSenderId,
        });
      });
    } catch (err) {
      console.warn("[DailyReport] Warning fetching suppliers collection:", err);
    }

    // Source B : Collection "users" avec rôles 'supplier', 'SUPPLIER_IMMO', 'SUPPLIER_FOOD', 'SUPPLIER_MODE', etc.
    const adminEmails = new Set<string>(["admin@rayons.net", "danielkiboko218@gmail.com"]);
    let newUsersCount = 0;

    try {
      const usersSnap = await adminDb.collection("users").get();
      usersSnap.forEach((doc: any) => {
        const d = doc.data();
        const role = (d.role || "").toString().toLowerCase();
        const roles = Array.isArray(d.roles) ? d.roles.map((r: any) => r.toString().toLowerCase()) : [];
        const isSupplier = role.includes("supplier") || roles.some((r: string) => r.includes("supplier"));
        const isAdmin = role.includes("admin") || roles.some((r: string) => r.includes("admin"));

        if (isAdmin && d.email) {
          adminEmails.add(d.email.trim().toLowerCase());
        }

        if (isSupplier) {
          const existing = suppliersMap.get(doc.id) || {};
          suppliersMap.set(doc.id, {
            ...existing,
            id: doc.id,
            ...d,
            email: (d.email || existing.email || "").trim(),
            phone: (d.phone || existing.phone || "").trim(),
            company: d.company || d.companyName || d.agencyName || existing.company || d.displayName || d.name || "Partenaire",
            displayName: d.displayName || d.name || existing.displayName || d.company || "Partenaire",
            senderId: d.senderId || existing.senderId,
            role: d.role || existing.role,
          });
        }

        // Compter les nouvelles inscriptions de la période
        const uDate = parseDate(d.createdAt);
        if (isWithinPeriod(uDate)) {
          newUsersCount++;
        }
      });
    } catch (err) {
      console.warn("[DailyReport] Warning fetching users collection:", err);
    }

    const suppliersList = Array.from(suppliersMap.values());
    console.log(`[DailyReport] Total active suppliers detected: ${suppliersList.length}`);

    // ─────────────────────────────────────────────────────────────
    // 2. Récupération des Commandes de la période
    // ─────────────────────────────────────────────────────────────
    const ordersSnap = await adminDb.collection("orders").get();
    const periodOrders: any[] = [];
    ordersSnap.forEach((doc: any) => {
      const data = doc.data();
      const orderDate = parseDate(data.createdAt);
      if (isWithinPeriod(orderDate)) {
        periodOrders.push({ id: doc.id, ...data });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 3. Récupération des Paiements de Loyers de la période
    // ─────────────────────────────────────────────────────────────
    const paymentsSnap = await adminDb.collection("payments").get();
    const periodPayments: any[] = [];
    paymentsSnap.forEach((doc: any) => {
      const data = doc.data();
      const payDate = parseDate(data.createdAt);
      if (isWithinPeriod(payDate)) {
        periodPayments.push({ id: doc.id, ...data });
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 4. Récupération des Locataires et Vigilance Échéances
    // ─────────────────────────────────────────────────────────────
    const tenantsSnap = await adminDb.collection("tenants").get();
    const periodTenants: any[] = [];
    let overdueTenantsCount = 0;
    tenantsSnap.forEach((doc: any) => {
      const data = doc.data();
      const createdDate = parseDate(data.createdAt);
      if (isWithinPeriod(createdDate)) {
        periodTenants.push({ id: doc.id, ...data });
      }
      if (data.status === "En retard" || data.status === "LATE") {
        overdueTenantsCount++;
      }
    });

    // ─────────────────────────────────────────────────────────────
    // 5. Calculs Globaux (Admin)
    // ─────────────────────────────────────────────────────────────
    let globalSalesRevenue = 0;
    let globalRentRevenue = 0;
    const rayonBreakdown: Record<string, { count: number; revenue: number }> = {
      saveurs: { count: 0, revenue: 0 },
      mode: { count: 0, revenue: 0 },
      connect: { count: 0, revenue: 0 },
      immo: { count: 0, revenue: 0 },
    };

    periodOrders.forEach(o => {
      const amount = Number(o.totalAmount || o.total || 0);
      globalSalesRevenue += amount;
      const r = (o.rayon || "saveurs").toLowerCase();
      if (!rayonBreakdown[r]) rayonBreakdown[r] = { count: 0, revenue: 0 };
      rayonBreakdown[r].count += 1;
      rayonBreakdown[r].revenue += amount;
    });

    periodPayments.forEach(p => {
      const amount = Number(p.amount || 0);
      globalRentRevenue += amount;
      rayonBreakdown.immo.count += 1;
      rayonBreakdown.immo.revenue += amount;
    });

    const totalGlobalTurnover = globalSalesRevenue + globalRentRevenue;

    // ─────────────────────────────────────────────────────────────
    // 6. Envoi des rapports personnalisés à TOUS les Fournisseurs
    // ─────────────────────────────────────────────────────────────
    let suppliersNotified = 0;

    for (const supplier of suppliersList) {
      const supId = supplier.id;
      const supName = supplier.company || supplier.displayName || "Partenaire";
      const supEmail = supplier.email?.trim();
      const supPhone = supplier.phone?.trim();

      // Filtrer les commandes concernant CE fournisseur uniquement
      const supOrders = periodOrders.filter(o => 
        o.supplierId === supId || 
        (Array.isArray(o.supplierIds) && o.supplierIds.includes(supId)) ||
        (Array.isArray(o.items) && o.items.some((it: any) => it.supplierId === supId))
      );

      let supOrderRevenue = 0;
      supOrders.forEach(o => {
        if (Array.isArray(o.items) && o.items.length > 0) {
          const myItems = o.items.filter((it: any) => it.supplierId === supId);
          if (myItems.length > 0) {
            supOrderRevenue += myItems.reduce((acc: number, it: any) => acc + (Number(it.price || 0) * Number(it.quantity || 1)), 0);
          } else {
            supOrderRevenue += Number(o.totalAmount || o.total || 0);
          }
        } else if (o.supplierId === supId) {
          supOrderRevenue += Number(o.totalAmount || o.total || 0);
        }
      });

      // Filtrer les loyers encaissés par ce fournisseur (Immo)
      const supPayments = periodPayments.filter(p => 
        p.supplierId === supId || p.agencyId === supId || p.ownerId === supId || p.bailleurId === supId
      );
      const supRentRevenue = supPayments.reduce((acc, p) => acc + Number(p.amount || 0), 0);

      // Filtrer les nouveaux baux / locataires de ce fournisseur
      const supTenants = periodTenants.filter(t => 
        t.supplierId === supId || t.agencyId === supId || t.ownerId === supId
      );

      const totalSupRevenue = supOrderRevenue + supRentRevenue;
      const totalSupOperations = supOrders.length + supPayments.length + supTenants.length;

      // ── A. Notification in-app dans le tableau de bord du fournisseur ──
      try {
        const notifSummary = totalSupOperations > 0
          ? `Bilan du ${dateFormatted} : ${supOrders.length} commande(s) (${supOrderRevenue.toFixed(2)}$), ${supPayments.length} loyer(s) encaissé(s) (${supRentRevenue.toFixed(2)}$), ${supTenants.length} nouveau(x) locataire(s). Total: +${totalSupRevenue.toFixed(2)}$.`
          : `Bilan du ${dateFormatted} : Aucune nouvelle transaction enregistrée sur votre espace. Vos biens et articles restent visibles et actifs.`;

        await adminDb.collection("inapp_notifications").add({
          supplierId: supId,
          type: "system",
          title: `📊 Rapport Journalier (07h00) — ${dateFormatted}`,
          message: notifSummary,
          link: "/supplier",
          read: false,
          time: Date.now(),
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (inAppErr) {
        console.warn(`Erreur in-app notification pour fournisseur ${supId}:`, inAppErr);
      }

      // ── B. Notification Email personnalisée au Fournisseur ──
      if (supEmail && supEmail.includes("@")) {
        const emailHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 32px 24px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 28px; border-bottom: 1px solid #edf2f7; padding-bottom: 20px;">
              <h1 style="color: #0F1D27; font-size: 24px; font-weight: 800; margin: 0;">Rayons<span style="color: #C7D300;">.net</span></h1>
              <p style="color: #718096; font-size: 13px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Rapport d'activité journalier (07h00)</p>
            </div>

            <p style="font-size: 16px; color: #1a202c; font-weight: 600; margin-bottom: 12px;">
              Bonjour ${supName},
            </p>
            <p style="color: #4a5568; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">
              Voici le bilan exclusif de vos activités sur la plateforme Rayons pour la journée du <strong>${dateFormatted}</strong> :
            </p>

            <div style="display: flex; gap: 12px; margin-bottom: 24px;">
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; flex: 1; text-align: center;">
                <p style="color: #718096; font-size: 12px; margin: 0; text-transform: uppercase;">Commandes traitées</p>
                <p style="color: #0F1D27; font-size: 24px; font-weight: 800; margin: 6px 0 0 0;">${supOrders.length}</p>
                <p style="color: #38a169; font-size: 12px; font-weight: 600; margin: 4px 0 0 0;">${supOrderRevenue.toFixed(2)} $</p>
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; flex: 1; text-align: center;">
                <p style="color: #718096; font-size: 12px; margin: 0; text-transform: uppercase;">Loyers encaissés</p>
                <p style="color: #0F1D27; font-size: 24px; font-weight: 800; margin: 6px 0 0 0;">${supPayments.length}</p>
                <p style="color: #38a169; font-size: 12px; font-weight: 600; margin: 4px 0 0 0;">${supRentRevenue.toFixed(2)} $</p>
              </div>

              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; flex: 1; text-align: center;">
                <p style="color: #718096; font-size: 12px; margin: 0; text-transform: uppercase;">Nouveaux Locataires</p>
                <p style="color: #0F1D27; font-size: 24px; font-weight: 800; margin: 6px 0 0 0;">${supTenants.length}</p>
                <p style="color: #3182ce; font-size: 12px; font-weight: 600; margin: 4px 0 0 0;">Baux officiels</p>
              </div>
            </div>

            <div style="background: linear-gradient(135deg, #0F1D27 0%, #1a365d 100%); border-radius: 12px; padding: 20px; color: #ffffff; text-align: center; margin-bottom: 28px;">
              <p style="font-size: 13px; color: #cbd5e0; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Chiffre d'Affaires Encaissé</p>
              <p style="font-size: 32px; font-weight: 800; color: #C7D300; margin: 8px 0 0 0;">+${totalSupRevenue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $</p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://projet-rayon-2.vercel.app/supplier" style="background-color: #0F1D27; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block;">
                Accéder à mon espace partenaire
              </a>
            </div>

            <p style="color: #a0aec0; font-size: 12px; text-align: center; margin: 0; border-top: 1px solid #edf2f7; padding-top: 20px;">
              Rapport matinal (07h00) généré automatiquement par la plateforme Rayons.net — Kinshasa, RDC
            </p>
          </div>
        `;

        try {
          await sendEmail({
            to: supEmail,
            subject: `📊 Bilan de votre journée (${dateFormatted}) — Rayons`,
            html: emailHtml,
          });
          console.log(`[DailyReport] Email sent to supplier ${supEmail} (${supName})`);
        } catch (mailErr) {
          console.warn(`Erreur envoi email fournisseur ${supEmail}:`, mailErr);
        }
      }

      // ── C. Notification SMS (si numéro disponible) ──
      if (supPhone) {
        try {
          const cleanPhone = supPhone.replace(/[^0-9]/g, "");
          const senderIdToUse = (
            supplier.senderId ||
            (supplier.company?.toLowerCase().includes("mutamulis") || supplier.displayName?.toLowerCase().includes("mutamulis") || supplier.email === "sumaililaurent4@gmail.com" ? "MUTAMULIS" : "Rayon")
          );

          const smsContent = `Rayons : Rapport du ${dateFormatted} pour ${supName} : ${supOrders.length} cmd (${supOrderRevenue.toFixed(1)}$), ${supPayments.length} loyer (${supRentRevenue.toFixed(1)}$). Total: +${totalSupRevenue.toFixed(1)}$.`;

          await sendMobiShastraSMS({
            mobileNo: cleanPhone,
            message: smsContent,
            customSenderId: senderIdToUse,
          });
          console.log(`[DailyReport] SMS sent to supplier ${supPhone}`);
        } catch (smsErr) {
          console.warn(`SMS journalier non envoyé à ${supPhone}:`, smsErr);
        }
      }

      suppliersNotified++;
    }

    // ─────────────────────────────────────────────────────────────
    // 7. Envoi du Rapport Global Consolidé aux Administrateurs
    // ─────────────────────────────────────────────────────────────
    const adminHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 680px; margin: 0 auto; padding: 36px 28px; background-color: #ffffff; border: 1px solid #cbd5e0; border-radius: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0F1D27; padding-bottom: 16px; margin-bottom: 24px;">
          <div>
            <h1 style="color: #0F1D27; font-size: 26px; font-weight: 800; margin: 0;">Rayons<span style="color: #C7D300;">.net</span></h1>
            <p style="color: #4a5568; font-size: 13px; font-weight: 600; margin: 4px 0 0 0;">RAPPORT ADMINISTRATEUR CONSOLIDÉ</p>
          </div>
          <div style="text-align: right;">
            <span style="background-color: #ebf8ff; color: #2b6cb0; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 20px;">
              Édition 07h00
            </span>
            <p style="color: #718096; font-size: 12px; margin: 6px 0 0 0;">${dateFormatted}</p>
          </div>
        </div>

        <p style="color: #1a202c; font-size: 15px; margin-bottom: 20px;">
          Bonjour Daniel, voici le rapport financier et opérationnel de l'ensemble de la plateforme Rayons pour la journée du <strong>${dateFormatted}</strong> :
        </p>

        <!-- KPI Globaux -->
        <div style="background: linear-gradient(135deg, #0F1D27 0%, #1A365D 100%); border-radius: 16px; padding: 24px; color: #ffffff; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; color: #cbd5e0; text-transform: uppercase; letter-spacing: 1px;">Volume d'Affaires Global Encaissé</p>
          <p style="margin: 8px 0 0 0; font-size: 38px; font-weight: 900; color: #C7D300;">
            +${totalGlobalTurnover.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $
          </p>
          <div style="margin-top: 16px; display: flex; gap: 20px; border-top: 1px solid rgba(255,255,255,0.15); padding-top: 14px;">
            <div>
              <span style="color: #a0aec0; font-size: 12px;">Ventes e-commerce :</span>
              <span style="color: #ffffff; font-weight: 700; font-size: 14px; margin-left: 6px;">${globalSalesRevenue.toFixed(2)} $</span>
            </div>
            <div>
              <span style="color: #a0aec0; font-size: 12px;">Loyers immo :</span>
              <span style="color: #ffffff; font-weight: 700; font-size: 14px; margin-left: 6px;">${globalRentRevenue.toFixed(2)} $</span>
            </div>
          </div>
        </div>

        <!-- Grille de métriques -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 10px; margin-bottom: 24px;">
          <tr>
            <td style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 12px; padding: 16px; width: 50%;">
              <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase;">Commandes traitées</p>
              <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 800; color: #0F1D27;">${periodOrders.length}</p>
            </td>
            <td style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 12px; padding: 16px; width: 50%;">
              <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase;">Quittances loyers émises</p>
              <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 800; color: #0F1D27;">${periodPayments.length}</p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 12px; padding: 16px; width: 50%;">
              <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase;">Nouveaux locataires (baux)</p>
              <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 800; color: #3182ce;">${periodTenants.length}</p>
            </td>
            <td style="background-color: #f7fafc; border: 1px solid #edf2f7; border-radius: 12px; padding: 16px; width: 50%;">
              <p style="margin: 0; color: #718096; font-size: 12px; text-transform: uppercase;">Nouvelles inscriptions</p>
              <p style="margin: 6px 0 0 0; font-size: 24px; font-weight: 800; color: #38a169;">+${newUsersCount}</p>
            </td>
          </tr>
        </table>

        <!-- Performance par Rayon -->
        <h3 style="color: #0F1D27; font-size: 16px; font-weight: 700; margin: 0 0 12px 0;">Répartition par Rayon</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
          <tr style="background-color: #f1f5f9; text-align: left; color: #475569; font-size: 12px; text-transform: uppercase;">
            <th style="padding: 10px 14px; border-radius: 8px 0 0 8px;">Rayon</th>
            <th style="padding: 10px 14px; text-align: center;">Opérations</th>
            <th style="padding: 10px 14px; text-align: right; border-radius: 0 8px 8px 0;">Chiffre d'Affaires</th>
          </tr>
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 12px 14px; font-weight: 600; color: #0F1D27;">🍽️ Rayon Saveurs</td>
            <td style="padding: 12px 14px; text-align: center; color: #4a5568;">${rayonBreakdown.saveurs?.count || 0}</td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: #38a169;">+${(rayonBreakdown.saveurs?.revenue || 0).toFixed(2)} $</td>
          </tr>
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 12px 14px; font-weight: 600; color: #0F1D27;">👗 Rayon Mode</td>
            <td style="padding: 12px 14px; text-align: center; color: #4a5568;">${rayonBreakdown.mode?.count || 0}</td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: #38a169;">+${(rayonBreakdown.mode?.revenue || 0).toFixed(2)} $</td>
          </tr>
          <tr style="border-bottom: 1px solid #edf2f7;">
            <td style="padding: 12px 14px; font-weight: 600; color: #0F1D27;">📱 Rayon Connect</td>
            <td style="padding: 12px 14px; text-align: center; color: #4a5568;">${rayonBreakdown.connect?.count || 0}</td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: #38a169;">+${(rayonBreakdown.connect?.revenue || 0).toFixed(2)} $</td>
          </tr>
          <tr>
            <td style="padding: 12px 14px; font-weight: 600; color: #0F1D27;">🏢 Rayon Immo</td>
            <td style="padding: 12px 14px; text-align: center; color: #4a5568;">${rayonBreakdown.immo?.count || 0}</td>
            <td style="padding: 12px 14px; text-align: right; font-weight: 700; color: #38a169;">+${(rayonBreakdown.immo?.revenue || 0).toFixed(2)} $</td>
          </tr>
        </table>

        <!-- Alertes et indicateurs -->
        ${overdueTenantsCount > 0 ? `
          <div style="background-color: #fffaf0; border-left: 4px solid #dd6b20; padding: 14px 18px; border-radius: 8px; margin-bottom: 24px;">
            <p style="color: #9c4221; font-size: 13px; font-weight: 700; margin: 0;">⚠️ Vigilance Recouvrement Immo :</p>
            <p style="color: #7b341e; font-size: 13px; margin: 4px 0 0 0;">
              ${overdueTenantsCount} locataire(s) ont actuellement une échéance dépassée nécessitant un suivi.
            </p>
          </div>
        ` : ''}

        <div style="text-align: center; margin-top: 28px; margin-bottom: 20px;">
          <a href="https://projet-rayon-2.vercel.app/admin/dashboard" style="background-color: #0F1D27; color: #ffffff; padding: 14px 32px; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 8px; display: inline-block;">
            Ouvrir la console d'administration
          </a>
        </div>

        <p style="color: #a0aec0; font-size: 12px; text-align: center; margin-top: 24px; border-top: 1px solid #edf2f7; padding-top: 16px;">
          Rapport automatique quotidien de 07h00 • Rayons.net
        </p>
      </div>
    `;

    // Envoyer à tous les administrateurs enregistrés
    for (const email of Array.from(adminEmails)) {
      try {
        await sendEmail({
          to: email,
          subject: `📈 Rapport Journalier Plateforme Rayons (07h00) — ${dateFormatted}`,
          html: adminHtml,
        });
        console.log(`[DailyReport] Master report successfully sent to admin: ${email}`);
      } catch (adminMailErr) {
        console.error(`[DailyReport] Error sending admin report to ${email}:`, adminMailErr);
      }
    }

    return NextResponse.json({
      success: true,
      edition: "07h00",
      date: dateFormatted,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      suppliersCount: suppliersList.length,
      suppliersNotified,
      adminEmails: Array.from(adminEmails),
      metrics: {
        totalGlobalTurnover,
        globalSalesRevenue,
        globalRentRevenue,
        ordersCount: periodOrders.length,
        paymentsCount: periodPayments.length,
        newTenantsCount: periodTenants.length,
        newUsersToday: newUsersCount,
        rayonBreakdown,
      },
    });

  } catch (error: any) {
    console.error("[DailyReport] Error generating daily reports:", error);
    return NextResponse.json({
      success: false,
      error: error?.message || "Erreur interne",
    }, { status: 500 });
  }
}
