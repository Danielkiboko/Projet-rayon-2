"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { formatEntryDate, formatRayonBadge } from "./financeHelpers";

export interface AdminShopAnalytics {
  invested: number;
  revenue: number;
  profit: number;
  marginPct: number;
  byRayon: Array<{
    rayon: string;
    count: number;
    invested: number;
    revenue: number;
    profit: number;
  }>;
}

interface AdminShopProfitTabProps {
  periodLabel: string;
  adminShopAnalytics: AdminShopAnalytics;
  periodAdminSales: Array<Record<string, any>>;
}

export function AdminShopProfitTab({
  periodLabel,
  adminShopAnalytics,
  periodAdminSales,
}: AdminShopProfitTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">
              Suivi Rentabilité — Propres Rayons de l&apos;Admin (Lecture Seule)
            </h2>
            <p className="text-xs text-gray-400">
              Seule la boutique officielle encaisse ses ventes. Ici, l&apos;Admin visualise uniquement la somme investie, le prix de vente et le gain net sur ses propres rayons ({periodLabel}).
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 whitespace-nowrap self-start">
            <ShieldCheck size={12} /> Exclusivement Rayons Admin
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">
              Somme Investie (Coût Produits)
            </span>
            <div className="text-2xl font-bold text-amber-300 mt-1 tabular-nums">
              ${adminShopAnalytics.invested.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-gray-500">Capital d&apos;achat sur les ventes livrées</span>
          </div>

          <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">
              Prix de Vente Total (Boutique Admin)
            </span>
            <div className="text-2xl font-bold text-white mt-1 tabular-nums">
              ${adminShopAnalytics.revenue.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-gray-500">{periodAdminSales.length} vente(s) livrée(s)</span>
          </div>

          <div className="bg-black/30 p-4 rounded-xl border border-emerald-500/20">
            <span className="text-[10px] text-emerald-300 uppercase font-semibold block">
              Gain Net Reçu (Marge)
            </span>
            <div className="text-2xl font-bold text-emerald-400 mt-1 tabular-nums">
              ${adminShopAnalytics.profit.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <span className="text-[11px] text-emerald-300/80">
              Marge moyenne : {adminShopAnalytics.marginPct}%
            </span>
          </div>
        </div>

        {adminShopAnalytics.byRayon.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {adminShopAnalytics.byRayon.map((r) => {
              const badge = formatRayonBadge(r.rayon);
              return (
                <div key={r.rayon} className="bg-black/20 p-3.5 rounded-xl border border-white/[0.06] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.badgeClass}`}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] text-gray-400">{r.count} vente(s)</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Investi :</span>
                    <span className="text-amber-300 font-semibold tabular-nums">${r.invested.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-400">
                    <span>Vendu :</span>
                    <span className="text-white font-semibold tabular-nums">${r.revenue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/[0.06] pt-1">
                    <span className="text-gray-300 font-semibold">Gain :</span>
                    <span className="text-emerald-400 font-bold tabular-nums">+${r.profit.toFixed(2)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            Détail des ventes sur vos propres rayons
          </h3>
          <span className="text-[11px] text-gray-500">Hors vendeurs tiers</span>
        </div>
        {periodAdminSales.length === 0 ? (
          <p className="p-6 text-center text-xs text-gray-500">
            Aucune vente livrée sur les propres rayons de l&apos;Admin pour cette période.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-black/25 text-[10px] uppercase text-gray-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Produit (Rayon)</th>
                  <th className="px-4 py-3 text-right">Investi</th>
                  <th className="px-4 py-3 text-right">Prix Vente</th>
                  <th className="px-4 py-3 text-right">Gain Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {periodAdminSales.map((s) => {
                  const badge = formatRayonBadge(s.rayon);
                  return (
                    <tr key={s.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-gray-400 font-mono whitespace-nowrap">
                        {formatEntryDate(s.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{s.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badge.badgeClass}`}>
                            {badge.label}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            Qté {s.quantity} · #{String(s.orderId || "").slice(-8)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-amber-300 tabular-nums font-medium">
                        ${Number(s.invested || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-white tabular-nums font-semibold">
                        ${Number(s.revenue || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-400 tabular-nums font-bold">
                        +${Number(s.profit || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
