import { parseReportDate, RayonType } from "./dailyReportHelpers";
import { buildImmoEmail, buildStoreEmail } from "./dailyReportTemplates";

export interface SupplierReportInput {
  supplier: Record<string, any>;
  dateFormatted: string;
  baseUrl: string;
  allOrders: any[];
  periodOrders: any[];
  allPayments: any[];
  periodPayments: any[];
  allTenants: any[];
  periodTenants: any[];
  allProperties: any[];
  allProducts: any[];
  allVisits: any[];
  periodVisits: any[];
}

export interface SupplierReportPayload {
  emailHtml: string;
  notifSummary: string;
  smsContent: string;
}

export function buildSupplierDailyReport(input: SupplierReportInput): SupplierReportPayload {
  const {
    supplier,
    dateFormatted,
    baseUrl,
    allOrders,
    periodOrders,
    allPayments,
    periodPayments,
    allTenants,
    periodTenants,
    allProperties,
    allProducts,
    allVisits,
    periodVisits,
  } = input;

  const supId = supplier.id;
  const supName = supplier.company || supplier.displayName || "Partenaire";
  const rayonType = (supplier.rayonType || "store") as RayonType;

  if (rayonType === "immo") {
    const supProperties = allProperties.filter((p) => p.supplierId === supId);
    let totalUnits = 0;
    supProperties.forEach((p) => {
      if (p.immoDetails?.levels) {
        p.immoDetails.levels.forEach((lvl: any) => {
          if (lvl.units) lvl.units.forEach((u: any) => { totalUnits += u.capacity || 1; });
        });
      } else {
        totalUnits += p.stock || 1;
      }
    });

    const supTenants = allTenants.filter(
      (t) => t.supplierId === supId || t.agencyId === supId || t.ownerId === supId
    );
    let activeTenants = 0;
    let totalRent = 0;
    let lateRents = 0;
    let lateRentAmount = 0;
    let formerDebt = 0;
    const lateTenantsList: any[] = [];

    supTenants.forEach((t) => {
      if (t.status === "PARTI") {
        formerDebt += t.debtAmount || 0;
      } else {
        activeTenants++;
        totalRent += t.rentAmount || 0;
        let isLate = t.status === "LATE" || t.status === "En retard";
        if (!isLate && t.nextPayment) {
          const pd = new Date(t.nextPayment);
          pd.setHours(0, 0, 0, 0);
          const td = new Date();
          td.setHours(0, 0, 0, 0);
          if (pd < td) isLate = true;
        }
        if (isLate) {
          lateRents++;
          lateRentAmount += t.rentAmount || 0;
          lateTenantsList.push(t);
        }
      }
    });

    const isSupPayment = (p: any) =>
      p.supplierId === supId || p.agencyId === supId || p.ownerId === supId || p.bailleurId === supId;
    const supPeriodPayments = periodPayments.filter(isSupPayment);
    const supAllPayments = allPayments.filter((p) => isSupPayment(p) && p.status === "COMPLETED");
    const periodCollected = supPeriodPayments.reduce((a, p) => a + Number(p.amount || 0), 0);
    const totalCollected = supAllPayments.reduce((a, p) => a + Number(p.amount || 0), 0);

    const newTenantsPeriod = periodTenants.filter(
      (t) => t.supplierId === supId || t.agencyId === supId || t.ownerId === supId
    );
    const pendingVisits = allVisits.filter((v) => v.supplierId === supId && v.status === "PENDING");
    const newVisitsPeriod = periodVisits.filter((v) => v.supplierId === supId);

    const occupancyRate =
      totalUnits > 0 ? Math.min(Math.round((activeTenants / totalUnits) * 100), 100) : 0;
    const totalDebts = lateRentAmount + formerDebt;

    const notifSummary =
      newTenantsPeriod.length > 0 || supPeriodPayments.length > 0
        ? `Bilan Immo du ${dateFormatted} : ${newTenantsPeriod.length} nouveau(x) bail(s), ${supPeriodPayments.length} loyer(s) encaissé(s) (+${periodCollected.toFixed(2)}$). Retards: ${lateRents}. Visites en attente: ${pendingVisits.length}.`
        : `Bilan Immo du ${dateFormatted} : Aucune nouvelle opération. ${activeTenants} locataire(s) actif(s) — taux d'occupation ${occupancyRate}%.`;

    const emailHtml = buildImmoEmail({
      supName,
      dateFormatted,
      baseUrl,
      totalProperties: supProperties.length,
      totalUnits,
      activeTenants,
      occupancyRate,
      totalRent,
      totalCollected,
      periodCollected,
      paymentsCount: supPeriodPayments.length,
      lateRents,
      lateRentAmount,
      formerDebt,
      totalDebts,
      newTenantsPeriod: newTenantsPeriod.length,
      pendingVisits: pendingVisits.length,
      newVisitsPeriod: newVisitsPeriod.length,
      lateTenantsList: lateTenantsList.slice(0, 5),
    });

    const smsContent = `Rayons Immo - ${dateFormatted.slice(0, 10)} | ${supName} : ${activeTenants} locataires, taux ${occupancyRate}%, +${periodCollected.toFixed(1)}$ encaissé. Retards: ${lateRents}. Visites att: ${pendingVisits.length}.`;

    return { emailHtml, notifSummary, smsContent };
  }

  // Store supplier (mode / connect / saveurs)
  const rayonLabel = rayonType === "mode" ? "Mode" : rayonType === "connect" ? "Connect" : "Saveurs";
  const rayonEmoji = rayonType === "mode" ? "👗" : rayonType === "connect" ? "📱" : "🍽️";
  const accentColor = rayonType === "mode" ? "#D4B08C" : rayonType === "connect" ? "#00B5A5" : "#FF6B35";

  const supProducts = allProducts.filter((p) => p.supplierId === supId);
  const lowStockProducts = supProducts.filter((p) => {
    const stock = Number(p.stock ?? p.quantity ?? 0);
    return stock > 0 && stock < 10;
  });
  const outOfStock = supProducts.filter((p) => Number(p.stock ?? p.quantity ?? 0) <= 0);

  const isSupOrder = (o: any) =>
    o.supplierId === supId ||
    (Array.isArray(o.supplierIds) && o.supplierIds.includes(supId)) ||
    (Array.isArray(o.items) && o.items.some((it: any) => it.supplierId === supId));

  const supPeriodOrders = periodOrders.filter(isSupOrder);
  const supAllOrders = allOrders.filter(isSupOrder);

  const activeOrders = supAllOrders.filter(
    (o) => !["COMPLETED", "CANCELLED", "DELIVERED"].includes((o.status || "").toUpperCase())
  );
  const pendingDeliveries = supAllOrders.filter((o) =>
    ["CONFIRMED", "PREPARING", "READY"].includes((o.status || "").toUpperCase())
  );

  let periodRevenue = 0;
  let totalRevenue = 0;
  const recentOrders: any[] = [];

  supPeriodOrders.forEach((o) => {
    if (Array.isArray(o.items)) {
      const myItems = o.items.filter((it: any) => it.supplierId === supId);
      periodRevenue +=
        myItems.length > 0
          ? myItems.reduce((acc: number, it: any) => acc + Number(it.price || 0) * Number(it.quantity || 1), 0)
          : Number(o.totalAmount || o.total || 0);
    } else {
      periodRevenue += Number(o.totalAmount || o.total || 0);
    }
    if (recentOrders.length < 5) recentOrders.push(o);
  });

  supAllOrders
    .filter((o) => o.status === "COMPLETED")
    .forEach((o) => {
      totalRevenue += Number(o.totalAmount || o.total || 0);
    });

  const notifSummary =
    supPeriodOrders.length > 0
      ? `Bilan ${rayonLabel} du ${dateFormatted} : ${supPeriodOrders.length} commande(s) (+${periodRevenue.toFixed(2)}$). ${activeOrders.length} active(s). ${pendingDeliveries.length} à expédier. Stock critique: ${lowStockProducts.length}.`
      : `Bilan ${rayonLabel} du ${dateFormatted} : Aucune commande. ${supProducts.length} produit(s) en ligne. ${activeOrders.length} commande(s) active(s).`;

  const emailHtml = buildStoreEmail({
    supName,
    dateFormatted,
    baseUrl,
    rayonLabel,
    rayonEmoji,
    accentColor,
    totalProducts: supProducts.length,
    lowStockProducts: lowStockProducts.length,
    outOfStock: outOfStock.length,
    activeOrders: activeOrders.length,
    pendingDeliveries: pendingDeliveries.length,
    periodRevenue,
    totalRevenue,
    ordersToday: supPeriodOrders.length,
    recentOrders,
  });

  const smsContent = `Rayons ${rayonLabel} - ${dateFormatted.slice(0, 10)} | ${supName} : ${supPeriodOrders.length} cmd (+${periodRevenue.toFixed(1)}$), ${activeOrders.length} active(s), ${pendingDeliveries.length} à expédier. Stock critique: ${lowStockProducts.length}.`;

  // Keep parseReportDate referenced only if needed by callers
  void parseReportDate;

  return { emailHtml, notifSummary, smsContent };
}
