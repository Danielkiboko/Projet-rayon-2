import { safeApiError } from "@/lib/sanitize";
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmail } from "@/lib/email";
import { sendMobiShastraSMS } from "@/lib/sms";
import { FieldValue } from "firebase-admin/firestore";
import { SUPER_ADMIN_EMAILS } from "@/lib/serverAuth";
import { requireCronOrAdminCaller } from "@/server/guards";
import {
  extractSubAdminRayons,
  getRayonType,
  getSubAdminRoleTitle,
  parseReportDate,
} from "@/lib/emailTemplates/dailyReportHelpers";
import { buildAdminEmail, buildSubAdminEmail } from "@/lib/emailTemplates/dailyReportTemplates";
import { buildSupplierDailyReport } from "@/lib/emailTemplates/supplierReportBuilder";

export async function GET(req: Request) {
  return handleDailyReports(req);
}

export async function POST(req: Request) {
  return handleDailyReports(req);
}

async function handleDailyReports(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    // Strictly require valid Authorization: Bearer CRON_SECRET or authenticated Admin
    const guard = await requireCronOrAdminCaller(req);
    if (!guard.ok) {
      console.warn("[DailyReport] ⛔ Unauthorized access attempt blocked.");
      return guard.errorResponse!;
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://rayons.net";
    const now = new Date();
    const periodParam = searchParams.get("period");
    const isMorningRun = periodParam === "yesterday" || (!periodParam && now.getHours() < 12);

    const reportTargetDate = isMorningRun
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
      : now;
    const periodStart = new Date(
      reportTargetDate.getFullYear(),
      reportTargetDate.getMonth(),
      reportTargetDate.getDate(),
      0, 0, 0, 0
    );
    const periodEnd = isMorningRun
      ? new Date(reportTargetDate.getFullYear(), reportTargetDate.getMonth(), reportTargetDate.getDate(), 23, 59, 59, 999)
      : now;

    const dateFormatted = reportTargetDate.toLocaleDateString("fr-FR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const isWithinPeriod = (date: Date | null) => !!date && date >= periodStart && date <= periodEnd;

    // Idempotency check
    const forceRun = searchParams.get("force") === "true";
    const reportDateKey = `${reportTargetDate.getFullYear()}-${String(reportTargetDate.getMonth() + 1).padStart(2, "0")}-${String(reportTargetDate.getDate()).padStart(2, "0")}`;
    const runRef = adminDb.collection("cron_runs").doc(`daily-report-${reportDateKey}`);

    if (!forceRun) {
      const existingRun = await runRef.get();
      if (existingRun.exists) {
        const runData = existingRun.data();
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: "already_sent_today",
          date: reportDateKey,
          previousRun: runData?.executedAt?.toDate?.()?.toISOString(),
        }, { status: 409 });
      }
    }

    await runRef.set({
      reportDate: reportDateKey,
      executedAt: FieldValue.serverTimestamp(),
      triggeredBy: forceRun ? "forced" : "cron",
    });

    // 1. Build suppliers, admins, and sub-admins maps
    const suppliersMap = new Map<string, any>();
    try {
      const suppliersSnap = await adminDb.collection("suppliers").get();
      suppliersSnap.forEach((doc: any) => {
        const d = doc.data();
        suppliersMap.set(doc.id, {
          id: doc.id, ...d,
          email: (d.email || "").trim(),
          phone: (d.phone || "").trim(),
          company: d.company || d.companyName || d.agencyName || d.displayName || d.name || "Partenaire",
          displayName: d.displayName || d.name || d.company || "Partenaire",
          senderId: d.senderId || d.customSenderId || d.smsSenderId,
          rayonType: getRayonType(d),
        });
      });
    } catch (err) {
      console.warn("[DailyReport] Warning fetching suppliers collection:", err);
    }

    const adminEmails = new Set<string>(SUPER_ADMIN_EMAILS);
    const subAdminsMap = new Map<string, any>();
    let newUsersCount = 0;

    try {
      const usersSnap = await adminDb.collection("users").get();
      usersSnap.forEach((doc: any) => {
        const d = doc.data();
        const role = (d.role || "").toString().toLowerCase();
        const roles = Array.isArray(d.roles) ? d.roles.map((r: any) => r.toString().toLowerCase()) : [];
        const isSupplier = role.includes("supplier") || role.includes("fournisseur") || role.includes("vendor")
          || roles.some((r: string) => r.includes("supplier") || r.includes("fournisseur"));
        const isAdmin = role === "admin" || role === "super_admin" || role === "superadmin"
          || roles.some((r: string) => r === "admin" || r === "super_admin");
        const isSubAdmin = !isAdmin && (
          role.includes("sub_admin") || role.includes("subadmin") || role.includes("admin_")
          || roles.some((r: string) => r.includes("sub_admin") || r.includes("subadmin") || r.includes("admin_"))
        );

        if (isAdmin && d.email) adminEmails.add(d.email.trim().toLowerCase());
        if (isSubAdmin && d.email) {
          subAdminsMap.set(doc.id, {
            id: doc.id,
            email: d.email.trim().toLowerCase(),
            name: d.displayName || d.name || [d.firstName, d.lastName].filter(Boolean).join(" ") || "Collaborateur",
            role: d.role || "SUB_ADMIN",
            roleTitle: getSubAdminRoleTitle(d.role),
            assignedRayons: extractSubAdminRayons(d),
          });
        }
        if (isSupplier) {
          const existing = suppliersMap.get(doc.id) || {};
          suppliersMap.set(doc.id, {
            ...existing, id: doc.id, ...d,
            email: (d.email || existing.email || "").trim(),
            phone: (d.phone || existing.phone || "").trim(),
            company: d.company || d.companyName || d.agencyName || existing.company || d.displayName || d.name || "Partenaire",
            displayName: d.displayName || d.name || existing.displayName || d.company || "Partenaire",
            senderId: d.senderId || existing.senderId,
            role: d.role || existing.role,
            rayonType: getRayonType({ ...existing, ...d }),
          });
        }
        if (isWithinPeriod(parseReportDate(d.createdAt))) newUsersCount++;
      });
    } catch (err) {
      console.warn("[DailyReport] Warning fetching users collection:", err);
    }

    const suppliersList = Array.from(suppliersMap.values());
    const subAdminsList = Array.from(subAdminsMap.values());
    suppliersList.forEach((s) => { if (s.email) adminEmails.delete(s.email.trim().toLowerCase()); });
    subAdminsList.forEach((sa) => { if (sa.email) adminEmails.delete(sa.email.trim().toLowerCase()); });
    SUPER_ADMIN_EMAILS.forEach((e) => adminEmails.add(e));
    adminEmails.add("daniel.k@telkosh.com");

    // 2. Fetch all collections once
    const [ordersSnap, paymentsSnap, tenantsSnap, propertiesSnap, productsSnap, visitsSnap] =
      await Promise.all([
        adminDb.collection("orders").get(),
        adminDb.collection("payments").get(),
        adminDb.collection("tenants").get(),
        adminDb.collection("properties").get(),
        adminDb.collection("products").get(),
        adminDb.collection("visits").get(),
      ]);

    const allOrders: any[] = [];
    const periodOrders: any[] = [];
    ordersSnap.forEach((doc: any) => {
      const data = doc.data();
      allOrders.push({ id: doc.id, ...data });
      if (isWithinPeriod(parseReportDate(data.createdAt))) periodOrders.push({ id: doc.id, ...data });
    });

    const allPayments: any[] = [];
    const periodPayments: any[] = [];
    paymentsSnap.forEach((doc: any) => {
      const data = doc.data();
      allPayments.push({ id: doc.id, ...data });
      if (isWithinPeriod(parseReportDate(data.createdAt))) periodPayments.push({ id: doc.id, ...data });
    });

    const allTenants: any[] = [];
    const periodTenants: any[] = [];
    let overdueTenantsCount = 0;
    tenantsSnap.forEach((doc: any) => {
      const data = doc.data();
      allTenants.push({ id: doc.id, ...data });
      if (isWithinPeriod(parseReportDate(data.createdAt))) periodTenants.push({ id: doc.id, ...data });
      if (data.status === "En retard" || data.status === "LATE") overdueTenantsCount++;
    });

    const allProperties: any[] = [];
    propertiesSnap.forEach((doc: any) => allProperties.push({ id: doc.id, ...doc.data() }));
    const allProducts: any[] = [];
    productsSnap.forEach((doc: any) => allProducts.push({ id: doc.id, ...doc.data() }));

    const allVisits: any[] = [];
    const periodVisits: any[] = [];
    visitsSnap.forEach((doc: any) => {
      const data = doc.data();
      allVisits.push({ id: doc.id, ...data });
      if (isWithinPeriod(parseReportDate(data.createdAt))) periodVisits.push({ id: doc.id, ...data });
    });

    // 3. Global admin metrics
    let globalSalesRevenue = 0;
    let globalRentRevenue = 0;
    const rayonBreakdown: Record<string, { count: number; revenue: number }> = {
      saveurs: { count: 0, revenue: 0 },
      mode: { count: 0, revenue: 0 },
      connect: { count: 0, revenue: 0 },
      immo: { count: 0, revenue: 0 },
    };

    periodOrders.forEach((o) => {
      const amount = Number(o.totalAmount || o.total || 0);
      globalSalesRevenue += amount;
      const r = (o.rayon || "saveurs").toLowerCase();
      if (!rayonBreakdown[r]) rayonBreakdown[r] = { count: 0, revenue: 0 };
      rayonBreakdown[r].count += 1;
      rayonBreakdown[r].revenue += amount;
    });

    periodPayments.forEach((p) => {
      const amount = Number(p.amount || 0);
      globalRentRevenue += amount;
      rayonBreakdown.immo.count += 1;
      rayonBreakdown.immo.revenue += amount;
    });

    const totalGlobalTurnover = globalSalesRevenue + globalRentRevenue;

    // 4. Send personalized reports to each supplier
    let suppliersNotified = 0;
    for (const supplier of suppliersList) {
      const { emailHtml, notifSummary, smsContent } = buildSupplierDailyReport({
        supplier, dateFormatted, baseUrl,
        allOrders, periodOrders, allPayments, periodPayments,
        allTenants, periodTenants, allProperties, allProducts, allVisits, periodVisits,
      });

      try {
        await adminDb.collection("inapp_notifications").add({
          supplierId: supplier.id,
          type: "system",
          title: `📊 Rapport Journalier (07h00) — ${dateFormatted}`,
          message: notifSummary,
          link: "/supplier",
          read: false,
          time: Date.now(),
          createdAt: FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.warn(`[DailyReport] In-app notif error (${supplier.id}):`, err);
      }

      const supEmail = supplier.email?.trim();
      if (supEmail && supEmail.includes("@")) {
        try {
          await sendEmail({ to: supEmail, subject: `📊 Rapport Journalier (${dateFormatted}) — Rayons`, html: emailHtml });
        } catch (err) {
          console.warn(`[DailyReport] Email error (${supEmail}):`, err);
        }
      }

      const supPhone = supplier.phone?.trim();
      if (supPhone) {
        try {
          const cleanPhone = supPhone.replace(/[^0-9]/g, "");
          const senderIdToUse = supplier.senderId ||
            (supplier.company?.toLowerCase().includes("mutamulis") || supplier.email === "sumaililaurent4@gmail.com"
              ? "MUTAMULIS" : "Rayon");
          await sendMobiShastraSMS({ mobileNo: cleanPhone, message: smsContent, customSenderId: senderIdToUse });
        } catch (err) {
          console.warn(`[DailyReport] SMS error (${supPhone}):`, err);
        }
      }
      suppliersNotified++;
    }

    // 5. Admin consolidated report
    const adminHtml = buildAdminEmail({
      dateFormatted, baseUrl, totalGlobalTurnover, globalSalesRevenue, globalRentRevenue,
      ordersCount: periodOrders.length, paymentsCount: periodPayments.length,
      tenantsCount: periodTenants.length, newUsersCount, rayonBreakdown,
      overdueTenantsCount, suppliersCount: suppliersList.length, suppliersNotified,
    });
    for (const email of Array.from(adminEmails)) {
      try {
        await sendEmail({ to: email, subject: `📈 Rapport Journalier Plateforme Rayons (07h00) — ${dateFormatted}`, html: adminHtml });
      } catch (err) {
        console.error(`[DailyReport] Admin email error (${email}):`, err);
      }
    }

    // 6. Sub-Admin operational reports
    let subAdminsNotified = 0;
    for (const subAdmin of subAdminsList) {
      if (!subAdmin.email) continue;
      try {
        const subAdminHtml = buildSubAdminEmail({
          dateFormatted, baseUrl, subAdminName: subAdmin.name, roleTitle: subAdmin.roleTitle,
          assignedRayons: subAdmin.assignedRayons, rayonBreakdown, totalGlobalTurnover,
          globalSalesRevenue, globalRentRevenue, ordersCount: periodOrders.length,
          paymentsCount: periodPayments.length, tenantsCount: periodTenants.length,
          newUsersCount, overdueTenantsCount,
        });
        const subject = subAdmin.assignedRayons?.length > 0
          ? `📋 Rapport Quotidien Rayons (${subAdmin.assignedRayons.map((r: string) => r.toUpperCase()).join(", ")}) — ${dateFormatted}`
          : `📊 Rapport de Coordination Opérationnelle (07h00) — ${dateFormatted}`;
        await sendEmail({ to: subAdmin.email, subject, html: subAdminHtml });
        subAdminsNotified++;
      } catch (err) {
        console.error(`[DailyReport] Sub-Admin email error (${subAdmin.email}):`, err);
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
      subAdminsCount: subAdminsList.length,
      subAdminsNotified,
      adminEmails: Array.from(adminEmails),
      subAdmins: subAdminsList.map((s) => ({ email: s.email, name: s.name, role: s.role, assignedRayons: s.assignedRayons })),
      metrics: {
        totalGlobalTurnover, globalSalesRevenue, globalRentRevenue,
        ordersCount: periodOrders.length, paymentsCount: periodPayments.length,
        newTenantsCount: periodTenants.length, newUsersToday: newUsersCount, rayonBreakdown,
      },
    });
  } catch (error: any) {
    console.error("[DailyReport] 🔥 Fatal error:", error);
    return NextResponse.json({ success: false, error: safeApiError(error, "Erreur interne") }, { status: 500 });
  }
}
