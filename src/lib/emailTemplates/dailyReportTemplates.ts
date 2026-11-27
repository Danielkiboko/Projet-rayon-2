import { parseReportDate } from "./dailyReportHelpers";

export interface ImmoEmailParams {
  supName: string;
  dateFormatted: string;
  baseUrl: string;
  totalProperties: number;
  totalUnits: number;
  activeTenants: number;
  occupancyRate: number;
  totalRent: number;
  totalCollected: number;
  periodCollected: number;
  paymentsCount: number;
  lateRents: number;
  lateRentAmount: number;
  formerDebt: number;
  totalDebts: number;
  newTenantsPeriod: number;
  pendingVisits: number;
  newVisitsPeriod: number;
  lateTenantsList: Array<Record<string, unknown>>;
}

export function buildImmoEmail(p: ImmoEmailParams): string {
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
            <td style="padding:5px 10px;color:#4a1a00;">${String(t.name || `${t.firstName || ""} ${t.lastName || ""}`.trim() || "Locataire")}</td>
            <td style="padding:5px 10px;color:#6b2f00;">${String(t.propertyName || t.propertyTitle || "-")}</td>
            <td style="padding:5px 10px;text-align:right;font-weight:700;color:#c05621;">${Number(t.rentAmount || 0).toFixed(2)}$</td>
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

export interface StoreEmailParams {
  supName: string;
  dateFormatted: string;
  baseUrl: string;
  rayonLabel: string;
  rayonEmoji: string;
  accentColor: string;
  totalProducts: number;
  lowStockProducts: number;
  outOfStock: number;
  activeOrders: number;
  pendingDeliveries: number;
  periodRevenue: number;
  totalRevenue: number;
  ordersToday: number;
  recentOrders: Array<Record<string, unknown>>;
}

export function buildStoreEmail(p: StoreEmailParams): string {
  const lowStockAlert = p.lowStockProducts > 0
    ? `<div style="background:#fff5f5;border-left:4px solid #fc8181;padding:14px 18px;border-radius:8px;margin-bottom:20px;">
        <p style="color:#c53030;font-size:13px;font-weight:700;margin:0;">⚠️ Signal Logistique : ${p.lowStockProducts} produit(s) en stock critique (&lt;10 pièces)</p>
        ${p.outOfStock > 0 ? `<p style="color:#742a2a;font-size:12px;margin:4px 0 0;">dont <strong>${p.outOfStock}</strong> en rupture totale (0 pièce).</p>` : ""}
        <p style="color:#9b2c2c;font-size:12px;margin:6px 0 0;">Réapprovisionnez rapidement pour éviter les indisponibilités.</p>
      </div>`
    : "";

  const recentOrdersRows = p.recentOrders.map(o => {
    const date = o.createdAt ? (parseReportDate(o.createdAt)?.toLocaleDateString("fr-FR") ?? "-") : "-";
    const client = String(o.clientName || o.clientPhone || "Client");
    const amount = Number(o.totalAmount || o.total || 0).toFixed(2);
    const status = String(o.status || "EN COURS");
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

export interface AdminEmailParams {
  dateFormatted: string;
  baseUrl: string;
  totalGlobalTurnover: number;
  globalSalesRevenue: number;
  globalRentRevenue: number;
  ordersCount: number;
  paymentsCount: number;
  tenantsCount: number;
  newUsersCount: number;
  rayonBreakdown: Record<string, { count: number; revenue: number }>;
  overdueTenantsCount: number;
  suppliersCount: number;
  suppliersNotified: number;
}

export function buildAdminEmail(p: AdminEmailParams): string {
  const rb = p.rayonBreakdown;
  const rayons = [
    { label: "🍽️ Rayon Saveurs", key: "saveurs" },
    { label: "👗 Rayon Mode", key: "mode" },
    { label: "📱 Rayon Connect", key: "connect" },
    { label: "🏢 Rayon Immo", key: "immo" },
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

export interface SubAdminEmailParams {
  dateFormatted: string;
  baseUrl: string;
  subAdminName: string;
  roleTitle: string;
  assignedRayons: string[];
  rayonBreakdown: Record<string, { count: number; revenue: number }>;
  totalGlobalTurnover: number;
  globalSalesRevenue: number;
  globalRentRevenue: number;
  ordersCount: number;
  paymentsCount: number;
  tenantsCount: number;
  newUsersCount: number;
  overdueTenantsCount: number;
}

export function buildSubAdminEmail(p: SubAdminEmailParams): string {
  const allRayons = [
    { label: "🍽️ Rayon Saveurs", key: "saveurs" },
    { label: "👗 Rayon Mode", key: "mode" },
    { label: "📱 Rayon Connect", key: "connect" },
    { label: "🏢 Rayon Immo", key: "immo" },
  ];

  const hasSpecificRayons = Array.isArray(p.assignedRayons) && p.assignedRayons.length > 0;
  const displayedRayons = hasSpecificRayons
    ? allRayons.filter(r => p.assignedRayons.includes(r.key))
    : allRayons;

  const relevantRevenue = hasSpecificRayons
    ? displayedRayons.reduce((sum, r) => sum + (p.rayonBreakdown[r.key]?.revenue || 0), 0)
    : p.totalGlobalTurnover;

  const relevantOrders = hasSpecificRayons
    ? displayedRayons.reduce((sum, r) => sum + (p.rayonBreakdown[r.key]?.count || 0), 0)
    : p.ordersCount;

  const titleBadge = hasSpecificRayons
    ? `RAPPORT OPÉRATIONNEL — ${p.assignedRayons.map(r => r.toUpperCase()).join(" & ")}`
    : `RAPPORT DE COORDINATION & OPÉRATIONS`;

  const bannerTitle = hasSpecificRayons
    ? `Volume d'Affaires — Rayons Assignés`
    : `Volume d'Affaires Global de la Plateforme`;

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;max-width:680px;margin:0 auto;padding:36px 28px;background:#ffffff;border:1px solid #cbd5e0;border-radius:16px;">
    <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0F1D27;padding-bottom:16px;margin-bottom:24px;flex-wrap:wrap;gap:10px;">
      <div>
        <h1 style="color:#0F1D27;font-size:26px;font-weight:800;margin:0;">Rayons<span style="color:#C7D300;">.net</span></h1>
        <p style="color:#4a5568;font-size:12px;font-weight:700;letter-spacing:0.5px;margin:4px 0 0;text-transform:uppercase;">${titleBadge}</p>
      </div>
      <div style="text-align:right;">
        <span style="background:#edf2f7;color:#2d3748;font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;">${p.roleTitle}</span>
        <p style="color:#718096;font-size:12px;margin:6px 0 0;">${p.dateFormatted}</p>
      </div>
    </div>
    <p style="color:#1a202c;font-size:15px;margin-bottom:20px;">Bonjour <strong>${p.subAdminName}</strong>, voici votre synthèse opérationnelle ${hasSpecificRayons ? `pour vos rayons assignés (${p.assignedRayons.map(r => r.toUpperCase()).join(", ")})` : "de la plateforme"} pour la journée du <strong>${p.dateFormatted}</strong> :</p>
    <div style="background:linear-gradient(135deg,#0F1D27 0%,#2D3748 100%);border-radius:16px;padding:24px;color:#fff;margin-bottom:24px;">
      <p style="margin:0;font-size:12px;color:#cbd5e0;text-transform:uppercase;letter-spacing:1px;">${bannerTitle}</p>
      <p style="margin:8px 0 0;font-size:36px;font-weight:900;color:#C7D300;">+${relevantRevenue.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} $</p>
      <div style="margin-top:16px;border-top:1px solid rgba(255,255,255,0.15);padding-top:14px;display:flex;gap:24px;flex-wrap:wrap;">
        <div><span style="color:#a0aec0;font-size:12px;">Opérations / Commandes :</span><span style="color:#fff;font-weight:700;font-size:14px;margin-left:6px;">${relevantOrders}</span></div>
        ${!hasSpecificRayons || p.assignedRayons.includes("immo") ? `<div><span style="color:#a0aec0;font-size:12px;">Loyers immo :</span><span style="color:#fff;font-weight:700;font-size:14px;margin-left:6px;">${p.globalRentRevenue.toFixed(2)} $</span></div>` : ""}
      </div>
    </div>
    <table style="width:100%;border-collapse:separate;border-spacing:10px;margin-bottom:24px;">
      <tr>
        <td style="background:#f7fafc;border:1px solid #edf2f7;border-radius:12px;padding:16px;width:33%;text-align:center;">
          <p style="margin:0;color:#718096;font-size:11px;text-transform:uppercase;font-weight:600;">Commandes</p>
          <p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#0F1D27;">${relevantOrders}</p>
        </td>
        ${!hasSpecificRayons || p.assignedRayons.includes("immo") ? `
        <td style="background:#f7fafc;border:1px solid #edf2f7;border-radius:12px;padding:16px;width:33%;text-align:center;">
          <p style="margin:0;color:#718096;font-size:11px;text-transform:uppercase;font-weight:600;">Nouveaux Baux</p>
          <p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#3182ce;">${p.tenantsCount}</p>
        </td>` : ""}
        <td style="background:#f7fafc;border:1px solid #edf2f7;border-radius:12px;padding:16px;width:33%;text-align:center;">
          <p style="margin:0;color:#718096;font-size:11px;text-transform:uppercase;font-weight:600;">Inscriptions</p>
          <p style="margin:6px 0 0;font-size:24px;font-weight:800;color:#38a169;">+${p.newUsersCount}</p>
        </td>
      </tr>
    </table>
    <h3 style="color:#0F1D27;font-size:15px;font-weight:700;margin:0 0 12px;">Activité par Rayon ${hasSpecificRayons ? "(Assignés)" : ""}</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      <tr style="background:#f1f5f9;text-align:left;color:#475569;font-size:11px;text-transform:uppercase;">
        <th style="padding:10px 14px;border-radius:8px 0 0 8px;">Rayon</th>
        <th style="padding:10px 14px;text-align:center;">Opérations</th>
        <th style="padding:10px 14px;text-align:right;border-radius:0 8px 8px 0;">Volume d'Affaires</th>
      </tr>
      ${displayedRayons.map(r => `<tr style="border-bottom:1px solid #edf2f7;">
        <td style="padding:11px 14px;font-weight:600;color:#0F1D27;">${r.label}</td>
        <td style="padding:11px 14px;text-align:center;color:#4a5568;">${p.rayonBreakdown[r.key]?.count || 0}</td>
        <td style="padding:11px 14px;text-align:right;font-weight:700;color:#38a169;">+${(p.rayonBreakdown[r.key]?.revenue || 0).toFixed(2)} $</td>
      </tr>`).join("")}
    </table>
    ${(!hasSpecificRayons || p.assignedRayons.includes("immo")) && p.overdueTenantsCount > 0 ? `
    <div style="background:#fffaf0;border-left:4px solid #dd6b20;padding:14px 18px;border-radius:8px;margin-bottom:24px;">
      <p style="color:#9c4221;font-size:13px;font-weight:700;margin:0;">⚠️ Suivi Échéances Immo</p>
      <p style="color:#7b341e;font-size:13px;margin:4px 0 0;">${p.overdueTenantsCount} locataire(s) avec échéance dépassée à relancer.</p>
    </div>` : ""}
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${p.baseUrl}/admin/dashboard" style="background:#0F1D27;color:#fff;padding:14px 32px;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;display:inline-block;">Ouvrir la console d'administration</a>
    </div>
    <p style="color:#a0aec0;font-size:11px;text-align:center;margin:0;border-top:1px solid #edf2f7;padding-top:16px;">Rapport automatique quotidien 07h00 • Rayons.net Kinshasa, RDC</p>
  </div>`;
}
