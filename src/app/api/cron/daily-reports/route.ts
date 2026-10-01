import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { sendMobiShastraSMS } from "@/lib/sms";
import { FieldValue } from "firebase-admin/firestore";

// ─── Security ────────────────────────────────────────────────────────────────
const CRON_SECRET = process.env.CRON_SECRET;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val.toDate && typeof val.toDate === "function") return val.toDate();
  if (val._seconds) return new Date(val._seconds * 1000);
  if (typeof val === "number") return new Date(val);
  if (typeof val === "string") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

type RayonType = "immo" | "mode" | "connect" | "saveurs" | "store";

function getRayonType(d: any): RayonType {
  // Priority 1: role field (most reliable in your Firestore)
  // Handles: SUPPLIER_IMMO, SUPPLIER_MODE, SUPPLIER_CONNECT, SUPPLIER_SAVEURS
  const role = (d.role || "").toLowerCase();
  if (role.includes("immo")) return "immo";
  if (role.includes("mode")) return "mode";
  if (role.includes("connect") || role.includes("tech")) return "connect";
  if (role.includes("food") || role.includes("saveur")) return "saveurs";

  // Priority 2: rayons array
  if (Array.isArray(d.rayons) && d.rayons.length > 0) {
    const r = d.rayons[0].toLowerCase();
    if (r === "immo") return "immo";
    if (r === "mode") return "mode";
    if (r === "connect") return "connect";
    if (r === "saveurs" || r === "food") return "saveurs";
  }

  // Priority 3: rayon field
  const rayon = (d.rayon || "").toLowerCase();
  if (rayon === "immo") return "immo";
  if (rayon === "mode") return "mode";
  if (rayon === "connect") return "connect";
  if (rayon === "saveurs" || rayon === "food") return "saveurs";

  return "store";
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(req: Request) {
  return handleDailyReports(req);
}

export async function POST(req: Request) {
  return handleDailyReports(req);
}

// ─── Core handler ─────────────────────────────────────────────────────────────

async function handleDailyReports(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get("secret");

    // ── 🔒 SECURITY: strictly block unauthorized calls when CRON_SECRET is set ──
    if (CRON_SECRET) {
      const isAuthorized =
        authHeader === `Bearer ${CRON_SECRET}` ||
        secretParam === CRON_SECRET;
      if (!isAuthorized) {
        console.warn("[DailyReport] ⛔ Unauthorized access attempt blocked.");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rayons.net";
    const now = new Date();
    const periodParam = searchParams.get("period");

    const isMorningRun = periodParam === "yesterday" || (!periodParam && now.getHours() < 12);

    let periodStart: Date;
    let periodEnd: Date;
    let reportTargetDate: Date;

    if (isMorningRun) {
      reportTargetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      periodStart = new Date(reportTargetDate.getFullYear(), reportTargetDate.getMonth(), reportTargetDate.getDate(), 0, 0, 0, 0);
      periodEnd   = new Date(reportTargetDate.getFullYear(), reportTargetDate.getMonth(), reportTargetDate.getDate(), 23, 59, 59, 999);
    } else {
      reportTargetDate = now;
      periodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      periodEnd   = now;
    }

    const dateFormatted = reportTargetDate.toLocaleDateString("fr-FR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const isWithinPeriod = (date: Date | null) =>
      !!date && date >= periodStart && date <= periodEnd;

    console.log(`[DailyReport] 📅 Generating reports for: ${dateFormatted} [${periodStart.toISOString()} → ${periodEnd.toISOString()}]`);

    // ─────────────────────────────────────────────────────────────────────────
    // 1. Build suppliers map
    // ─────────────────────────────────────────────────────────────────────────
    const suppliersMap = new Map<string, any>();

    try {
      const suppliersSnap = await adminDb.collection("suppliers").get();
      suppliersSnap.forEach((doc: any) => {
        const d = doc.data();
        suppliersMap.set(doc.id, {
          id: doc.id, ...d,
          email:       (d.email || "").trim(),
          phone:       (d.phone || "").trim(),
          company:     d.company || d.companyName || d.agencyName || d.displayName || d.name || "Partenaire",
          displayName: d.displayName || d.name || d.company || "Partenaire",
          senderId:    d.senderId || d.customSenderId || d.smsSenderId,
          rayonType:   getRayonType(d),
        });
      });
    } catch (err) {
      console.warn("[DailyReport] Warning fetching suppliers collection:", err);
    }

    const adminEmails = new Set<string>(["admin@rayons.net", "danielkiboko218@gmail.com"]);
    let newUsersCount = 0;

    try {
      const usersSnap = await adminDb.collection("users").get();
      usersSnap.forEach((doc: any) => {
        const d = doc.data();
        const role  = (d.role  || "").toString().toLowerCase();
        const roles = Array.isArray(d.roles) ? d.roles.map((r: any) => r.toString().toLowerCase()) : [];
        // Matches: supplier, SUPPLIER_IMMO, SUPPLIER_MODE, SUPPLIER_CONNECT, SUPPLIER_SAVEURS, fournisseur, vendor
        const isSupplier = role.includes("supplier") || role.includes("fournisseur") || role.includes("vendor")
          || roles.some((r: string) => r.includes("supplier") || r.includes("fournisseur"));
        const isAdmin    = role.includes("admin")    || roles.some((r: string) => r.includes("admin"));

        if (isAdmin && d.email) adminEmails.add(d.email.trim().toLowerCase());

        if (isSupplier) {
          const existing = suppliersMap.get(doc.id) || {};
          suppliersMap.set(doc.id, {
            ...existing, id: doc.id, ...d,
            email:       (d.email || existing.email || "").trim(),
            phone:       (d.phone || existing.phone || "").trim(),
            company:     d.company || d.companyName || d.agencyName || existing.company || d.displayName || d.name || "Partenaire",
            displayName: d.displayName || d.name || existing.displayName || d.company || "Partenaire",
            senderId:    d.senderId || existing.senderId,
            role:        d.role || existing.role,
            rayonType:   getRayonType({ ...existing, ...d }),
          });
        }

        const uDate = parseDate(d.createdAt);
        if (isWithinPeriod(uDate)) newUsersCount++;
      });
    } catch (err) {
      console.warn("[DailyReport] Warning fetching users collection:", err);
    }

    const suppliersList = Array.from(suppliersMap.values());
    console.log(`[DailyReport] Total suppliers detected: ${suppliersList.length}`);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Fetch all collections once (shared across all supplier loops)
    // ─────────────────────────────────────────────────────────────────────────
    const [ordersSnap, paymentsSnap, tenantsSnap, propertiesSnap, productsSnap, visitsSnap] =
      await Promise.all([
        adminDb.collection("orders").get(),
        adminDb.collection("payments").get(),
        adminDb.collection("tenants").get(),
        adminDb.collection("properties").get(),
        adminDb.collection("products").get(),
        adminDb.collection("visits").get(),
      ]);

    const allOrders: any[]    = [];
    const periodOrders: any[] = [];
    ordersSnap.forEach((doc: any) => {
      const data = doc.data();
      allOrders.push({ id: doc.id, ...data });
      if (isWithinPeriod(parseDate(data.createdAt))) periodOrders.push({ id: doc.id, ...data });
    });

    const allPayments: any[]    = [];
    const periodPayments: any[] = [];
    paymentsSnap.forEach((doc: any) => {
      const data = doc.data();
      allPayments.push({ id: doc.id, ...data });
      if (isWithinPeriod(parseDate(data.createdAt))) periodPayments.push({ id: doc.id, ...data });
    });

    const allTenants: any[]    = [];
    const periodTenants: any[] = [];
    let overdueTenantsCount    = 0;
    tenantsSnap.forEach((doc: any) => {
      const data = doc.data();
      allTenants.push({ id: doc.id, ...data });
      if (isWithinPeriod(parseDate(data.createdAt))) periodTenants.push({ id: doc.id, ...data });
      if (data.status === "En retard" || data.status === "LATE") overdueTenantsCount++;
    });

    const allProperties: any[] = [];
    propertiesSnap.forEach((doc: any) => allProperties.push({ id: doc.id, ...doc.data() }));

    const allProducts: any[] = [];
    productsSnap.forEach((doc: any) => allProducts.push({ id: doc.id, ...doc.data() }));

    const allVisits: any[]    = [];
    const periodVisits: any[] = [];
    visitsSnap.forEach((doc: any) => {
      const data = doc.data();
      allVisits.push({ id: doc.id, ...data });
      if (isWithinPeriod(parseDate(data.createdAt))) periodVisits.push({ id: doc.id, ...data });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Global admin metrics
    // ─────────────────────────────────────────────────────────────────────────
    let globalSalesRevenue = 0;
    let globalRentRevenue  = 0;
    const rayonBreakdown: Record<string, { count: number; revenue: number }> = {
      saveurs: { count: 0, revenue: 0 },
      mode:    { count: 0, revenue: 0 },
      connect: { count: 0, revenue: 0 },
      immo:    { count: 0, revenue: 0 },
    };

    periodOrders.forEach(o => {
      const amount = Number(o.totalAmount || o.total || 0);
      globalSalesRevenue += amount;
      const r = (o.rayon || "saveurs").toLowerCase();
      if (!rayonBreakdown[r]) rayonBreakdown[r] = { count: 0, revenue: 0 };
      rayonBreakdown[r].count   += 1;
      rayonBreakdown[r].revenue += amount;
    });

    periodPayments.forEach(p => {
      const amount = Number(p.amount || 0);
      globalRentRevenue           += amount;
      rayonBreakdown.immo.count   += 1;
      rayonBreakdown.immo.revenue += amount;
    });

    const totalGlobalTurnover = globalSalesRevenue + globalRentRevenue;

    // ─────────────────────────────────────────────────────────────────────────
    // 4. Send personalized reports to each supplier
    // ─────────────────────────────────────────────────────────────────────────
    let suppliersNotified = 0;

    for (const supplier of suppliersList) {
      const supId      = supplier.id;
      const supName    = supplier.company || supplier.displayName || "Partenaire";
      const supEmail   = supplier.email?.trim();
      const supPhone   = supplier.phone?.trim();
      const rayonType  = (supplier.rayonType || "store") as RayonType;

      let emailHtml    = "";
      let notifSummary = "";
      let smsContent   = "";

      // ══════════════════════════════════════════════════════════════
      // 🏢  IMMO Supplier — mirrors ImmoDashboard.tsx KPIs exactly
      // ══════════════════════════════════════════════════════════════
      if (rayonType === "immo") {

        // — Properties —
        const supProperties = allProperties.filter(p => p.supplierId === supId);
        let totalUnits = 0;
        supProperties.forEach(p => {
          if (p.immoDetails?.levels) {
            p.immoDetails.levels.forEach((lvl: any) => {
              if (lvl.units) lvl.units.forEach((u: any) => { totalUnits += (u.capacity || 1); });
            });
          } else {
            totalUnits += (p.stock || 1);
          }
        });

        // — Tenants —
        const supTenants = allTenants.filter(t =>
          t.supplierId === supId || t.agencyId === supId || t.ownerId === supId
        );
        let activeTenants   = 0;
        let totalRent       = 0;
        let lateRents       = 0;
        let lateRentAmount  = 0;
        let formerDebt      = 0;
        const lateTenantsList: any[] = [];

        supTenants.forEach(t => {
          if (t.status === "PARTI") {
            formerDebt += (t.debtAmount || 0);
          } else {
            activeTenants++;
            totalRent += (t.rentAmount || 0);
            let isLate = t.status === "LATE" || t.status === "En retard";
            if (!isLate && t.nextPayment) {
              const pd = new Date(t.nextPayment); pd.setHours(0, 0, 0, 0);
              const td = new Date();               td.setHours(0, 0, 0, 0);
              if (pd < td) isLate = true;
            }
            if (isLate) {
              lateRents++;
              lateRentAmount += (t.rentAmount || 0);
              lateTenantsList.push(t);
            }
          }
        });

        // — Payments —
        const isSupPayment = (p: any) =>
          p.supplierId === supId || p.agencyId === supId || p.ownerId === supId || p.bailleurId === supId;
        const supPeriodPayments = periodPayments.filter(isSupPayment);
        const supAllPayments    = allPayments.filter(p => isSupPayment(p) && p.status === "COMPLETED");
        const periodCollected   = supPeriodPayments.reduce((a, p) => a + Number(p.amount || 0), 0);
        const totalCollected    = supAllPayments.reduce((a, p) => a + Number(p.amount || 0), 0);

        // — New tenants / visits this period —
        const newTenantsPeriod = periodTenants.filter(t =>
          t.supplierId === supId || t.agencyId === supId || t.ownerId === supId
        );
        const pendingVisits    = allVisits.filter(v => v.supplierId === supId && v.status === "PENDING");
        const newVisitsPeriod  = periodVisits.filter(v => v.supplierId === supId);

        const occupancyRate = totalUnits > 0
          ? Math.min(Math.round((activeTenants / totalUnits) * 100), 100)
          : 0;
        const totalDebts = lateRentAmount + formerDebt;

        notifSummary = newTenantsPeriod.length > 0 || supPeriodPayments.length > 0
          ? `Bilan Immo du ${dateFormatted} : ${newTenantsPeriod.length} nouveau(x) bail(s), ${supPeriodPayments.length} loyer(s) encaissé(s) (+${periodCollected.toFixed(2)}$). Retards: ${lateRents}. Visites en attente: ${pendingVisits.length}.`
          : `Bilan Immo du ${dateFormatted} : Aucune nouvelle opération. ${activeTenants} locataire(s) actif(s) — taux d'occupation ${occupancyRate}%.`;

        emailHtml = buildImmoEmail({
          supName, dateFormatted, baseUrl,
          totalProperties: supProperties.length, totalUnits,
          activeTenants, occupancyRate,
          totalRent, totalCollected, periodCollected,
          paymentsCount: supPeriodPayments.length,
          lateRents, lateRentAmount, formerDebt, totalDebts,
          newTenantsPeriod: newTenantsPeriod.length,
          pendingVisits: pendingVisits.length,
          newVisitsPeriod: newVisitsPeriod.length,
          lateTenantsList: lateTenantsList.slice(0, 5),
        });

        smsContent = `Rayons Immo - ${dateFormatted.slice(0, 10)} | ${supName} : ${activeTenants} locataires, taux ${occupancyRate}%, +${periodCollected.toFixed(1)}$ encaissé. Retards: ${lateRents}. Visites att: ${pendingVisits.length}.`;

      } else {
        // ══════════════════════════════════════════════════════════════
        // 🛍️  STORE Supplier (mode / connect / saveurs)
        //     mirrors StoreSupplierDashboard.tsx KPIs exactly
        // ══════════════════════════════════════════════════════════════
        const rayonLabel  = rayonType === "mode" ? "Mode" : rayonType === "connect" ? "Connect" : "Saveurs";
        const rayonEmoji  = rayonType === "mode" ? "👗"   : rayonType === "connect" ? "📱"      : "🍽️";
        const accentColor = rayonType === "mode" ? "#D4B08C" : rayonType === "connect" ? "#00B5A5" : "#FF6B35";

        // — Products —
        const supProducts      = allProducts.filter(p => p.supplierId === supId);
        const lowStockProducts = supProducts.filter(p => {
          const stock = Number(p.stock ?? p.quantity ?? 0);
          return stock > 0 && stock < 10;
        });
        const outOfStock       = supProducts.filter(p => Number(p.stock ?? p.quantity ?? 0) <= 0);

        // — Orders —
        const isSupOrder = (o: any) =>
          o.supplierId === supId ||
          (Array.isArray(o.supplierIds) && o.supplierIds.includes(supId)) ||
          (Array.isArray(o.items) && o.items.some((it: any) => it.supplierId === supId));

        const supPeriodOrders = periodOrders.filter(isSupOrder);
        const supAllOrders    = allOrders.filter(isSupOrder);

        const activeOrders = supAllOrders.filter(o =>
          !["COMPLETED", "CANCELLED", "DELIVERED"].includes((o.status || "").toUpperCase())
        );
        const pendingDeliveries = supAllOrders.filter(o =>
          ["CONFIRMED", "PREPARING", "READY"].includes((o.status || "").toUpperCase())
        );

        // — Revenue —
        let periodRevenue = 0;
        let totalRevenue  = 0;
        const recentOrders: any[] = [];

        supPeriodOrders.forEach(o => {
          if (Array.isArray(o.items)) {
            const myItems = o.items.filter((it: any) => it.supplierId === supId);
            periodRevenue += myItems.length > 0
              ? myItems.reduce((acc: number, it: any) => acc + Number(it.price || 0) * Number(it.quantity || 1), 0)
              : Number(o.totalAmount || o.total || 0);
          } else {
            periodRevenue += Number(o.totalAmount || o.total || 0);
          }
          if (recentOrders.length < 5) recentOrders.push(o);
        });

        supAllOrders.filter(o => o.status === "COMPLETED").forEach(o => {
          totalRevenue += Number(o.totalAmount || o.total || 0);
        });

        notifSummary = supPeriodOrders.length > 0
          ? `Bilan ${rayonLabel} du ${dateFormatted} : ${supPeriodOrders.length} commande(s) (+${periodRevenue.toFixed(2)}$). ${activeOrders.length} active(s). ${pendingDeliveries.length} à expédier. Stock critique: ${lowStockProducts.length}.`
          : `Bilan ${rayonLabel} du ${dateFormatted} : Aucune commande. ${supProducts.length} produit(s) en ligne. ${activeOrders.length} commande(s) active(s).`;

        emailHtml = buildStoreEmail({
          supName, dateFormatted, baseUrl,
          rayonLabel, rayonEmoji, accentColor,
          totalProducts:     supProducts.length,
          lowStockProducts:  lowStockProducts.length,
          outOfStock:        outOfStock.length,
          activeOrders:      activeOrders.length,
          pendingDeliveries: pendingDeliveries.length,
          periodRevenue,
          totalRevenue,
          ordersToday:  supPeriodOrders.length,
          recentOrders,
        });

        smsContent = `Rayons ${rayonLabel} - ${dateFormatted.slice(0, 10)} | ${supName} : ${supPeriodOrders.length} cmd (+${periodRevenue.toFixed(1)}$), ${activeOrders.length} active(s), ${pendingDeliveries.length} à expédier. Stock critique: ${lowStockProducts.length}.`;
      }

      // ── A. In-app notification ──
      try {
        await adminDb.collection("inapp_notifications").add({
          supplierId: supId,
          type:       "system",
          title:      `📊 Rapport Journalier (07h00) — ${dateFormatted}`,
          message:    notifSummary,
          link:       "/supplier",
          read:       false,
          time:       Date.now(),
          createdAt:  FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.warn(`[DailyReport] In-app notif error (${supId}):`, err);
      }

      // ── B. Email ──
      if (supEmail && supEmail.includes("@")) {
        try {
          await sendEmail({
            to:      supEmail,
            subject: `📊 Rapport Journalier (${dateFormatted}) — Rayons`,
            html:    emailHtml,
          });
          console.log(`[DailyReport] ✅ Email → ${supEmail} (${supName}) [${rayonType}]`);
        } catch (err) {
          console.warn(`[DailyReport] Email error (${supEmail}):`, err);
        }
      }

      // ── C. SMS ──
      if (supPhone) {
        try {
          const cleanPhone    = supPhone.replace(/[^0-9]/g, "");
          const senderIdToUse = supplier.senderId ||
            (supplier.company?.toLowerCase().includes("mutamulis") || supplier.email === "sumaililaurent4@gmail.com"
              ? "MUTAMULIS" : "Rayon");
          await sendMobiShastraSMS({ mobileNo: cleanPhone, message: smsContent, customSenderId: senderIdToUse });
          console.log(`[DailyReport] ✅ SMS → ${supPhone}`);
        } catch (err) {
          console.warn(`[DailyReport] SMS error (${supPhone}):`, err);
        }
      }

      suppliersNotified++;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. Admin consolidated report
    // ─────────────────────────────────────────────────────────────────────────
    const adminHtml = buildAdminEmail({
      dateFormatted, baseUrl,
      totalGlobalTurnover, globalSalesRevenue, globalRentRevenue,
      ordersCount:    periodOrders.length,
      paymentsCount:  periodPayments.length,
      tenantsCount:   periodTenants.length,
      newUsersCount,
      rayonBreakdown,
      overdueTenantsCount,
      suppliersCount:    suppliersList.length,
      suppliersNotified,
    });

    for (const email of Array.from(adminEmails)) {
      try {
        await sendEmail({
          to:      email,
          subject: `📈 Rapport Journalier Plateforme Rayons (07h00) — ${dateFormatted}`,
          html:    adminHtml,
        });
        console.log(`[DailyReport] ✅ Admin report → ${email}`);
      } catch (err) {
        console.error(`[DailyReport] Admin email error (${email}):`, err);
      }
    }

    return NextResponse.json({
      success: true,
      edition: "07h00",
      date:    dateFormatted,
      periodStart: periodStart.toISOString(),
      periodEnd:   periodEnd.toISOString(),
      suppliersCount:    suppliersList.length,
      suppliersNotified,
      adminEmails: Array.from(adminEmails),
      metrics: {
        totalGlobalTurnover, globalSalesRevenue, globalRentRevenue,
        ordersCount:     periodOrders.length,
        paymentsCount:   periodPayments.length,
        newTenantsCount: periodTenants.length,
        newUsersToday:   newUsersCount,
        rayonBreakdown,
      },
    });

  } catch (error: any) {
    console.error("[DailyReport] 🔥 Fatal error:", error);
    return NextResponse.json({ success: false, error: error?.message || "Erreur interne" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🏢  EMAIL BUILDER — IMMO  (mirrors ImmoDashboard.tsx KPIs exactly)
// KPIs: Propriétés | Gain Prévu | Gain Reçu | Pertes & Dettes + late tenant list + pending visits
// ─────────────────────────────────────────────────────────────────────────────
interface ImmoEmailParams {
  supName: string; dateFormatted: string; baseUrl: string;
  totalProperties: number; totalUnits: number;
  activeTenants: number; occupancyRate: number;
  totalRent: number; totalCollected: number; periodCollected: number; paymentsCount: number;
  lateRents: number; lateRentAmount: number; formerDebt: number; totalDebts: number;
  newTenantsPeriod: number; pendingVisits: number; newVisitsPeriod: number;
  lateTenantsList: any[];
}

function buildImmoEmail(p: ImmoEmailParams): string {
  const debtAlert = p.totalDebts > 0
    ? `<div style="background-color:#fffaf0;border-left:4px solid #dd6b20;padding:14px 18px;border-radius:8px;margin-bottom:20px;">
        <p style="color:#9c4221;font-size:13px;font-weight:700;margin:0;">⚠️ Vigilance Recouvrement</p>
        <p style="color:#7b341e;font-size:13px;margin:6px 0 0;">
          ${p.lateRents} loyer(s) en retard (${p.lateRentAmount.toFixed(2)}$)${p.formerDebt > 0 ? ` + ${p.formerDebt.toFixed(2)}$ dettes anciens locataires` : ""}.
          Total à recouvrer : <strong>${p.totalDebts.toFixed(2)}$</strong>
        </p>
        ${p.lateTenantsList.length > 0 ? `
        <table style="width:100%;margin-top:10px;font-size:12px;border-collapse:collapse;">
          <tr style="background:#fde8d8;color:#7b341e;font-weight:700;">
            <td style="padding:6px 10px;">Locataire</td><td style="padding:6px 10px;">Propriété</td><td style="padding:6px 10px;text-align:right;">Montant</td>
          </tr>
          ${p.lateTenantsList.map(t => `
          <tr style="border-bottom:1px solid #fde8d8;">
            <td style="padding:5px 10px;color:#4a1a00;">${t.firstName || ""} ${t.lastName || ""}</td>
            <td style="padding:5px 10px;color:#6b2f00;">${t.propertyTitle || "-"}</td>
            <td style="padding:5px 10px;text-align:right;font-weight:700;color:#c05621;">${(t.rentAmount || 0).toFixed(2)}$</td>
          </tr>`).join("")}
        </table>` : ""}
      </div>`
    : "";

  const visitAlert = p.pendingVisits > 0
    ? `<div style="background-color:#ebf8ff;border-left:4px solid #2b6cb0;padding:14px 18px;border-radius:8px;margin-bottom:20px;">
        <p style="color:#2b6cb0;font-size:13px;font-weight:700;margin:0;">🏠 ${p.pendingVisits} demande(s) de visite en attente</p>
        <p style="color:#2c5282;font-size:12px;margin:4px 0 0;">${p.newVisitsPeriod > 0 ? `${p.newVisitsPeriod} nouvelle(s) aujourd'hui. ` : ""}Accédez à votre tableau de bord pour les valider.</p>
      </div>`
    : "";

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;border-bottom:1px solid #edf2f7;padding-bottom:18px;">
      <h1 style="color:#0F1D27;font-size:24px;font-weight:800;margin:0;">Rayons<span style="color:#C7D300;">.net</span></h1>
      <p style="color:#718096;font-size:12px;margin:4px 0 0;text-transform:uppercase;letter-spacing:1px;">🏢 Rapport Immo — 07h00</p>
    </div>
    <p style="font-size:16px;color:#1a202c;font-weight:600;margin-bottom:6px;">Bonjour ${p.supName},</p>
    <p style="color:#4a5568;font-size:14px;line-height:1.6;margin-bottom:24px;">Voici le bilan de votre <strong>parc immobilier</strong> pour la journée du <strong>${p.dateFormatted}</strong> :</p>
    <div style="background:linear-gradient(135deg,#0F1D27 0%,#1a365d 100%);border-radius:14px;padding:20px 24px;color:#fff;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <p style="font-size:12px;color:#a0aec0;margin:0;text-transform:uppercase;">Parc Immobilier</p>
          <p style="font-size:28px;font-weight:900;color:#C7D300;margin:6px 0 0;">${p.totalProperties} <span style="font-size:16px;font-weight:600;color:#cbd5e0;">bien(s)</span></p>
          <p style="font-size:13px;color:#e2e8f0;margin:4px 0 0;">${p.totalUnits} unité(s) au total</p>
        </div>
        <div style="text-align:right;">
          <p style="font-size:12px;color:#a0aec0;margin:0;text-transform:uppercase;">Taux d'Occupation</p>
          <p style="font-size:32px;font-weight:900;color:#68d391;margin:6px 0 0;">${p.occupancyRate}%</p>
          <p style="font-size:13px;color:#e2e8f0;margin:4px 0 0;">${p.activeTenants} locataire(s) actif(s)</p>
        </div>
      </div>
    </div>
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:20px;">
      <tr>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;width:33%;vertical-align:top;">
          <p style="color:#718096;font-size:11px;margin:0;text-transform:uppercase;font-weight:600;">Gain Prévu</p>
          <p style="color:#0F1D27;font-size:22px;font-weight:800;margin:6px 0 2px;">${p.totalRent.toFixed(2)}<span style="font-size:12px;color:#718096;"> $</span></p>
          <p style="color:#4a5568;font-size:11px;margin:0;">Revenus locatifs actifs</p>
        </td>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;width:33%;vertical-align:top;">
          <p style="color:#718096;font-size:11px;margin:0;text-transform:uppercase;font-weight:600;">Gain Reçu</p>
          <p style="color:#38a169;font-size:22px;font-weight:800;margin:6px 0 2px;">+${p.totalCollected.toFixed(2)}<span style="font-size:12px;"> $</span></p>
          <p style="color:#4a5568;font-size:11px;margin:0;">Cumul total encaissé</p>
          ${p.periodCollected > 0 ? `<p style="color:#38a169;font-size:11px;font-weight:700;margin:4px 0 0;">+${p.periodCollected.toFixed(2)}$ aujourd'hui (${p.paymentsCount} pmt)</p>` : ""}
        </td>
        <td style="background:${p.totalDebts > 0 ? "#fffaf0" : "#f8fafc"};border:1px solid ${p.totalDebts > 0 ? "#fbd38d" : "#e2e8f0"};border-radius:12px;padding:16px;width:33%;vertical-align:top;">
          <p style="color:#718096;font-size:11px;margin:0;text-transform:uppercase;font-weight:600;">Pertes &amp; Dettes</p>
          <p style="color:${p.totalDebts > 0 ? "#c05621" : "#38a169"};font-size:22px;font-weight:800;margin:6px 0 2px;">${p.totalDebts.toFixed(2)}<span style="font-size:12px;"> $</span></p>
          <p style="color:#4a5568;font-size:11px;margin:0;">${p.lateRents} retard(s) · Anciens: ${p.formerDebt.toFixed(2)}$</p>
        </td>
      </tr>
    </table>
    ${(p.newTenantsPeriod > 0 || p.paymentsCount > 0 || p.newVisitsPeriod > 0) ? `
    <div style="background:#f0fff4;border:1px solid #9ae6b4;border-radius:12px;padding:14px 18px;margin-bottom:20px;">
      <p style="color:#276749;font-size:13px;font-weight:700;margin:0 0 8px;">✅ Activité du jour</p>
      <ul style="margin:0;padding-left:18px;color:#2f855a;font-size:13px;line-height:1.8;">
        ${p.newTenantsPeriod > 0 ? `<li>${p.newTenantsPeriod} nouveau(x) bail(s) signé(s)</li>` : ""}
        ${p.paymentsCount > 0 ? `<li>${p.paymentsCount} loyer(s) encaissé(s) (+${p.periodCollected.toFixed(2)}$)</li>` : ""}
        ${p.newVisitsPeriod > 0 ? `<li>${p.newVisitsPeriod} nouvelle(s) demande(s) de visite</li>` : ""}
      </ul>
    </div>` : ""}
    ${debtAlert}
    ${visitAlert}
    <div style="text-align:center;margin:28px 0 20px;">
      <a href="${p.baseUrl}/supplier" style="background:#4C6EF5;color:#fff;padding:13px 30px;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;display:inline-block;margin-right:10px;">Mon tableau de bord</a>
      ${p.pendingVisits > 0 ? `<a href="${p.baseUrl}/supplier" style="background:#edf2f7;color:#2d3748;padding:13px 24px;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;display:inline-block;">Gérer visites (${p.pendingVisits})</a>` : ""}
    </div>
    <p style="color:#a0aec0;font-size:11px;text-align:center;margin:0;border-top:1px solid #edf2f7;padding-top:16px;">Rapport matinal automatique (07h00) — Rayons.net · Kinshasa, RDC</p>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 🛍️  EMAIL BUILDER — STORE (mode / connect / saveurs)
//     mirrors StoreSupplierDashboard.tsx KPIs exactly
// KPIs: Produits en vente | Commandes actives | Chiffre d'affaires | À expédier
// ─────────────────────────────────────────────────────────────────────────────
interface StoreEmailParams {
  supName: string; dateFormatted: string; baseUrl: string;
  rayonLabel: string; rayonEmoji: string; accentColor: string;
  totalProducts: number; lowStockProducts: number; outOfStock: number;
  activeOrders: number; pendingDeliveries: number;
  periodRevenue: number; totalRevenue: number;
  ordersToday: number; recentOrders: any[];
}

function buildStoreEmail(p: StoreEmailParams): string {
  const lowStockAlert = p.lowStockProducts > 0
    ? `<div style="background:#fff5f5;border-left:4px solid #fc8181;padding:14px 18px;border-radius:8px;margin-bottom:20px;">
        <p style="color:#c53030;font-size:13px;font-weight:700;margin:0;">⚠️ Signal Logistique : ${p.lowStockProducts} produit(s) en stock critique (&lt;10 pièces)</p>
        ${p.outOfStock > 0 ? `<p style="color:#742a2a;font-size:12px;margin:4px 0 0;">dont <strong>${p.outOfStock}</strong> en rupture totale (0 pièce).</p>` : ""}
        <p style="color:#9b2c2c;font-size:12px;margin:6px 0 0;">Réapprovisionnez rapidement pour éviter les indisponibilités.</p>
      </div>`
    : "";

  const recentOrdersRows = p.recentOrders.map(o => {
    const date   = o.createdAt ? (parseDate(o.createdAt)?.toLocaleDateString("fr-FR") ?? "-") : "-";
    const client = o.clientName || o.clientPhone || "Client";
    const amount = Number(o.totalAmount || o.total || 0).toFixed(2);
    const status = o.status || "EN COURS";
    const statusColor = ["COMPLETED", "DELIVERED"].includes(status) ? "#38a169"
      : status === "CANCELLED" ? "#e53e3e" : "#d97706";
    return `<tr style="border-bottom:1px solid #edf2f7;">
      <td style="padding:8px 10px;color:#718096;font-size:12px;">${date}</td>
      <td style="padding:8px 10px;color:#1a202c;font-size:13px;font-weight:600;">${client}</td>
      <td style="padding:8px 10px;color:${p.accentColor};font-size:13px;font-weight:700;text-align:right;">${amount}$</td>
      <td style="padding:8px 10px;text-align:right;"><span style="color:${statusColor};font-size:11px;font-weight:700;text-transform:uppercase;">${status}</span></td>
    </tr>`;
  }).join("");

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;border-bottom:1px solid #edf2f7;padding-bottom:18px;">
      <h1 style="color:#0F1D27;font-size:24px;font-weight:800;margin:0;">Rayons<span style="color:#C7D300;">.net</span></h1>
      <p style="color:#718096;font-size:12px;margin:4px 0 0;text-transform:uppercase;letter-spacing:1px;">${p.rayonEmoji} Rapport ${p.rayonLabel} — 07h00</p>
    </div>
    <p style="font-size:16px;color:#1a202c;font-weight:600;margin-bottom:6px;">Bonjour ${p.supName},</p>
    <p style="color:#4a5568;font-size:14px;line-height:1.6;margin-bottom:24px;">Voici le bilan de votre <strong>boutique ${p.rayonLabel}</strong> pour la journée du <strong>${p.dateFormatted}</strong> :</p>
    <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:20px;">
      <tr>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;width:25%;text-align:center;vertical-align:top;">
          <p style="color:#718096;font-size:10px;margin:0;text-transform:uppercase;font-weight:700;">Produits</p>
          <p style="color:#0F1D27;font-size:26px;font-weight:900;margin:6px 0 2px;">${p.totalProducts}</p>
          <p style="color:${p.lowStockProducts > 0 ? "#c05621" : "#38a169"};font-size:10px;margin:0;font-weight:600;">${p.lowStockProducts > 0 ? `⚠️ ${p.lowStockProducts} critique(s)` : "✅ Stocks OK"}</p>
        </td>
        <td style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:16px;width:25%;text-align:center;vertical-align:top;">
          <p style="color:#718096;font-size:10px;margin:0;text-transform:uppercase;font-weight:700;">Cmdes actives</p>
          <p style="color:#0F1D27;font-size:26px;font-weight:900;margin:6px 0 2px;">${p.activeOrders}</p>
          <p style="color:#4a5568;font-size:10px;margin:0;">En cours</p>
        </td>
        <td style="background:linear-gradient(135deg,#0F1D27 0%,#1a365d 100%);border-radius:12px;padding:16px;width:25%;text-align:center;vertical-align:top;">
          <p style="color:#a0aec0;font-size:10px;margin:0;text-transform:uppercase;font-weight:700;">CA Aujourd'hui</p>
          <p style="color:${p.accentColor};font-size:20px;font-weight:900;margin:6px 0 2px;">+${p.periodRevenue.toFixed(2)}<span style="font-size:11px;">$</span></p>
          <p style="color:#cbd5e0;font-size:10px;margin:0;">${p.ordersToday} cmde${p.ordersToday > 1 ? "s" : ""}</p>
          ${p.totalRevenue > 0 ? `<p style="color:#718096;font-size:10px;margin:4px 0 0;">Total: ${p.totalRevenue.toFixed(2)}$</p>` : ""}
        </td>
        <td style="background:${p.pendingDeliveries > 0 ? "#fffaf0" : "#f8fafc"};border:1px solid ${p.pendingDeliveries > 0 ? "#fbd38d" : "#e2e8f0"};border-radius:12px;padding:16px;width:25%;text-align:center;vertical-align:top;">
          <p style="color:#718096;font-size:10px;margin:0;text-transform:uppercase;font-weight:700;">À Expédier</p>
          <p style="color:${p.pendingDeliveries > 0 ? "#dd6b20" : "#38a169"};font-size:26px;font-weight:900;margin:6px 0 2px;">${p.pendingDeliveries}</p>
          <p style="color:#4a5568;font-size:10px;margin:0;">${p.pendingDeliveries > 0 ? "Action requise" : "Tout expédié ✅"}</p>
        </td>
      </tr>
    </table>
    ${lowStockAlert}
    ${p.recentOrders.length > 0 ? `
    <div style="margin-bottom:24px;">
      <h3 style="color:#0F1D27;font-size:14px;font-weight:700;margin:0 0 12px;">Commandes récentes (${p.ordersToday} aujourd'hui)</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#f1f5f9;color:#475569;font-size:11px;text-transform:uppercase;">
          <th style="padding:10px;text-align:left;border-radius:8px 0 0 0;">Date</th>
          <th style="padding:10px;text-align:left;">Client</th>
          <th style="padding:10px;text-align:right;">Montant</th>
          <th style="padding:10px;text-align:right;border-radius:0 8px 0 0;">Statut</th>
        </tr></thead>
        <tbody>${recentOrdersRows}</tbody>
      </table>
    </div>` : `
    <div style="background:#f8fafc;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="color:#718096;font-size:14px;margin:0;">Aucune commande enregistrée aujourd'hui.</p>
      <p style="color:#a0aec0;font-size:12px;margin:6px 0 0;">${p.totalProducts} produit(s) actif(s) sur votre boutique.</p>
    </div>`}
    <div style="text-align:center;margin:20px 0;">
      <a href="${p.baseUrl}/supplier/orders" style="background:${p.accentColor};color:#fff;padding:13px 28px;font-size:14px;font-weight:700;text-decoration:none;border-radius:10px;display:inline-block;margin-right:10px;">Gérer les commandes</a>
      <a href="${p.baseUrl}/supplier/products" style="background:#edf2f7;color:#2d3748;padding:13px 24px;font-size:14px;font-weight:600;text-decoration:none;border-radius:10px;display:inline-block;">Mes produits</a>
    </div>
    <p style="color:#a0aec0;font-size:11px;text-align:center;margin:0;border-top:1px solid #edf2f7;padding-top:16px;">Rapport matinal automatique (07h00) — Rayons.net · Kinshasa, RDC</p>
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// 👑  EMAIL BUILDER — ADMIN CONSOLIDATED
// ─────────────────────────────────────────────────────────────────────────────
interface AdminEmailParams {
  dateFormatted: string; baseUrl: string;
  totalGlobalTurnover: number; globalSalesRevenue: number; globalRentRevenue: number;
  ordersCount: number; paymentsCount: number; tenantsCount: number; newUsersCount: number;
  rayonBreakdown: Record<string, { count: number; revenue: number }>;
  overdueTenantsCount: number; suppliersCount: number; suppliersNotified: number;
}

function buildAdminEmail(p: AdminEmailParams): string {
  const rb = p.rayonBreakdown;
  const rayons = [
    { label: "🍽️ Rayon Saveurs", key: "saveurs" },
    { label: "👗 Rayon Mode",    key: "mode" },
    { label: "📱 Rayon Connect", key: "connect" },
    { label: "🏢 Rayon Immo",    key: "immo" },
  ];

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;padding:36px 28px;background:#ffffff;border:1px solid #cbd5e0;border-radius:16px;">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0F1D27;padding-bottom:16px;margin-bottom:24px;flex-wrap:wrap;gap:10px;">
      <div>
        <h1 style="color:#0F1D27;font-size:26px;font-weight:800;margin:0;">Rayons<span style="color:#C7D300;">.net</span></h1>
        <p style="color:#4a5568;font-size:13px;font-weight:600;margin:4px 0 0;">RAPPORT ADMINISTRATEUR CONSOLIDÉ</p>
      </div>
      <div style="text-align:right;">
        <span style="background:#ebf8ff;color:#2b6cb0;font-size:12px;font-weight:700;padding:6px 12px;border-radius:20px;">Édition 07h00</span>
        <p style="color:#718096;font-size:12px;margin:6px 0 0;">${p.dateFormatted}</p>
      </div>
    </div>
    <p style="color:#1a202c;font-size:15px;margin-bottom:20px;">Bonjour Daniel, voici le rapport financier consolidé de la plateforme pour la journée du <strong>${p.dateFormatted}</strong> :</p>
    <div style="background:linear-gradient(135deg,#0F1D27 0%,#1A365D 100%);border-radius:16px;padding:24px;color:#fff;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#cbd5e0;text-transform:uppercase;letter-spacing:1px;">Volume d'Affaires Global Encaissé</p>
      <p style="margin:8px 0 0;font-size:38px;font-weight:900;color:#C7D300;">+${p.totalGlobalTurnover.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $</p>
      <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.15);padding-top:14px;display:flex;gap:24px;flex-wrap:wrap;">
        <div><span style="color:#a0aec0;font-size:12px;">Ventes e-commerce :</span><span style="color:#fff;font-weight:700;font-size:14px;margin-left:6px;">${p.globalSalesRevenue.toFixed(2)} $</span></div>
        <div><span style="color:#a0aec0;font-size:12px;">Loyers immo :</span><span style="color:#fff;font-weight:700;font-size:14px;margin-left:6px;">${p.globalRentRevenue.toFixed(2)} $</span></div>
      </div>
    </div>
    <table style="width:100%;border-collapse:separate;border-spacing:10px;margin-bottom:24px;">
      <tr>
        <td style="background:#f7fafc;border:1px solid #edf2f7;border-radius:12px;padding:16px;width:25%;text-align:center;">
          <p style="margin:0;color:#718096;font-size:11px;text-transform:uppercase;font-weight:600;">Commandes</p>
          <p style="margin:6px 0 0;font-size:26px;font-weight:800;color:#0F1D27;">${p.ordersCount}</p>
        </td>
        <td style="background:#f7fafc;border:1px solid #edf2f7;border-radius:12px;padding:16px;width:25%;text-align:center;">
          <p style="margin:0;color:#718096;font-size:11px;text-transform:uppercase;font-weight:600;">Loyers émis</p>
          <p style="margin:6px 0 0;font-size:26px;font-weight:800;color:#0F1D27;">${p.paymentsCount}</p>
        </td>
        <td style="background:#f7fafc;border:1px solid #edf2f7;border-radius:12px;padding:16px;width:25%;text-align:center;">
          <p style="margin:0;color:#718096;font-size:11px;text-transform:uppercase;font-weight:600;">Nouveaux baux</p>
          <p style="margin:6px 0 0;font-size:26px;font-weight:800;color:#3182ce;">${p.tenantsCount}</p>
        </td>
        <td style="background:#f7fafc;border:1px solid #edf2f7;border-radius:12px;padding:16px;width:25%;text-align:center;">
          <p style="margin:0;color:#718096;font-size:11px;text-transform:uppercase;font-weight:600;">Inscriptions</p>
          <p style="margin:6px 0 0;font-size:26px;font-weight:800;color:#38a169;">+${p.newUsersCount}</p>
        </td>
      </tr>
    </table>
    <h3 style="color:#0F1D27;font-size:15px;font-weight:700;margin:0 0 12px;">Répartition par Rayon</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      <tr style="background:#f1f5f9;text-align:left;color:#475569;font-size:11px;text-transform:uppercase;">
        <th style="padding:10px 14px;border-radius:8px 0 0 8px;">Rayon</th>
        <th style="padding:10px 14px;text-align:center;">Opérations</th>
        <th style="padding:10px 14px;text-align:right;border-radius:0 8px 8px 0;">Chiffre d'Affaires</th>
      </tr>
      ${rayons.map(r => `<tr style="border-bottom:1px solid #edf2f7;">
        <td style="padding:11px 14px;font-weight:600;color:#0F1D27;">${r.label}</td>
        <td style="padding:11px 14px;text-align:center;color:#4a5568;">${rb[r.key]?.count || 0}</td>
        <td style="padding:11px 14px;text-align:right;font-weight:700;color:#38a169;">+${(rb[r.key]?.revenue || 0).toFixed(2)} $</td>
      </tr>`).join("")}
    </table>
    ${p.overdueTenantsCount > 0 ? `
    <div style="background:#fffaf0;border-left:4px solid #dd6b20;padding:14px 18px;border-radius:8px;margin-bottom:24px;">
      <p style="color:#9c4221;font-size:13px;font-weight:700;margin:0;">⚠️ Vigilance Recouvrement Immo</p>
      <p style="color:#7b341e;font-size:13px;margin:4px 0 0;">${p.overdueTenantsCount} locataire(s) avec échéance dépassée sur la plateforme.</p>
    </div>` : ""}
    <div style="background:#f7fafc;border:1px solid #edf2f7;border-radius:12px;padding:14px 18px;margin-bottom:24px;">
      <p style="color:#4a5568;font-size:13px;margin:0;">📧 Rapports personnalisés envoyés à <strong>${p.suppliersNotified}/${p.suppliersCount}</strong> partenaire(s).</p>
    </div>
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${p.baseUrl}/admin/dashboard" style="background:#0F1D27;color:#fff;padding:14px 32px;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;display:inline-block;">Ouvrir la console d'administration</a>
    </div>
    <p style="color:#a0aec0;font-size:11px;text-align:center;margin:0;border-top:1px solid #edf2f7;padding-top:16px;">Rapport automatique quotidien 07h00 • Rayons.net</p>
  </div>`;
}

// Cron Secret (optionnel)
