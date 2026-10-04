"use client";

import { motion } from "framer-motion";
import { Package, FileText, Hotel, ShieldCheck, Clock, CheckCircle2 } from "lucide-react";

interface ClientQuickStatsProps {
  ordersCount: number;
  activeOrdersCount: number;
  proformasCount: number;
  hotelsCount: number;
  visitsCount: number;
  onSelectTab: (tab: "orders" | "proformas" | "hotels" | "visits" | "messages" | "tickets") => void;
}

export default function ClientQuickStats({
  ordersCount,
  activeOrdersCount,
  proformasCount,
  hotelsCount,
  visitsCount,
  onSelectTab,
}: ClientQuickStatsProps) {
  const stats = [
    {
      id: "orders",
      title: "Commandes en cours",
      value: activeOrdersCount,
      subtext: `${ordersCount} commande${ordersCount > 1 ? "s" : ""} au total`,
      icon: Package,
      color: "from-blue-600/20 to-blue-500/10 text-blue-400 border-blue-500/20",
      activeBadge: activeOrdersCount > 0 ? `${activeOrdersCount} active(s)` : "À jour",
      tab: "orders" as const,
    },
    {
      id: "proformas",
      title: "Devis & Proformas",
      value: proformasCount,
      subtext: proformasCount > 0 ? "Prêts à être réglés" : "Aucun devis en attente",
      icon: FileText,
      color: "from-amber-600/20 to-amber-500/10 text-amber-400 border-amber-500/20",
      activeBadge: proformasCount > 0 ? "Action requise" : "0 en attente",
      tab: "proformas" as const,
    },
    {
      id: "reservations",
      title: "Séjours & Visites",
      value: hotelsCount + visitsCount,
      subtext: `${hotelsCount} hôtel(s) • ${visitsCount} visite(s)`,
      icon: Hotel,
      color: "from-emerald-600/20 to-emerald-500/10 text-emerald-400 border-emerald-500/20",
      activeBadge: hotelsCount + visitsCount > 0 ? "Confirmé" : "Planifier",
      tab: "hotels" as const,
    },
    {
      id: "protection",
      title: "Rayons Trade Assurance",
      value: "100%",
      subtext: "Paiements & Livraisons protégés",
      icon: ShieldCheck,
      color: "from-[#C7D300]/20 to-[#C7D300]/5 text-[#C7D300] border-[#C7D300]/30",
      activeBadge: "Garantie VIP",
      tab: "orders" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.button
            key={stat.id}
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelectTab(stat.tab)}
            className={`p-4 rounded-2xl bg-gradient-to-br ${stat.color} border text-left transition-all hover:scale-[1.02] active:scale-98 shadow-sm flex flex-col justify-between group cursor-pointer relative overflow-hidden`}
          >
            <div className="flex items-center justify-between w-full mb-3">
              <div className="w-10 h-10 rounded-xl bg-black/30 backdrop-blur-sm border border-white/10 flex items-center justify-center shrink-0">
                <Icon size={20} />
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-black/40 border border-white/10 text-gray-300">
                {stat.activeBadge}
              </span>
            </div>

            <div>
              <div className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-0.5">
                {stat.value}
              </div>
              <div className="text-xs font-semibold text-gray-200 group-hover:text-white transition-colors truncate">
                {stat.title}
              </div>
              <div className="text-[11px] text-gray-400 truncate mt-0.5">
                {stat.subtext}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
