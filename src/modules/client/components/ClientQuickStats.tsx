"use client";

import { motion } from "framer-motion";
import { Package, FileText, Hotel, MessageSquare } from "lucide-react";

interface ClientQuickStatsProps {
  ordersCount: number;
  activeOrdersCount: number;
  proformasCount: number;
  hotelsCount: number;
  visitsCount: number;
  unreadMessagesCount?: number;
  onSelectTab: (tab: "orders" | "proformas" | "hotels" | "visits" | "messages" | "tickets" | "profile") => void;
}

export default function ClientQuickStats({
  ordersCount,
  activeOrdersCount,
  proformasCount,
  hotelsCount,
  visitsCount,
  unreadMessagesCount = 0,
  onSelectTab,
}: ClientQuickStatsProps) {
  const stats = [
    {
      id: "orders",
      title: "Commandes en cours",
      value: activeOrdersCount,
      subtext: `${ordersCount} commande${ordersCount > 1 ? "s" : ""} au total`,
      icon: Package,
      iconBg: "bg-blue-50 text-blue-600 border border-blue-200/60",
      cardBorder: "hover:border-blue-300",
      badgeCls: activeOrdersCount > 0 ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-100 text-gray-600 border-gray-200",
      activeBadge: activeOrdersCount > 0 ? `${activeOrdersCount} active(s)` : "À jour",
      tab: "orders" as const,
    },
    {
      id: "proformas",
      title: "Devis & Proformas",
      value: proformasCount,
      subtext: proformasCount > 0 ? "Prêts à être réglés" : "Aucun devis en attente",
      icon: FileText,
      iconBg: "bg-amber-50 text-amber-600 border border-amber-200/60",
      cardBorder: "hover:border-amber-300",
      badgeCls: proformasCount > 0 ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse font-bold" : "bg-gray-100 text-gray-600 border-gray-200",
      activeBadge: proformasCount > 0 ? `${proformasCount} en attente` : "0 en attente",
      tab: "proformas" as const,
    },
    {
      id: "reservations",
      title: "Séjours & Visites",
      value: hotelsCount + visitsCount,
      subtext: `${hotelsCount} hôtel(s) • ${visitsCount} visite(s)`,
      icon: Hotel,
      iconBg: "bg-emerald-50 text-emerald-600 border border-emerald-200/60",
      cardBorder: "hover:border-emerald-300",
      badgeCls: hotelsCount + visitsCount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-200",
      activeBadge: hotelsCount + visitsCount > 0 ? "Confirmé" : "Planifier",
      tab: "hotels" as const,
    },
    {
      id: "messages",
      title: "Messagerie Vendeurs",
      value: unreadMessagesCount,
      subtext: unreadMessagesCount > 0 ? "Nouveaux messages reçus" : "Discussions & négociations directes",
      icon: MessageSquare,
      iconBg: "bg-orange-50 text-[#FF6600] border border-orange-200/60",
      cardBorder: "hover:border-orange-300",
      badgeCls: unreadMessagesCount > 0 ? "bg-red-50 text-red-600 border-red-200 animate-pulse font-bold" : "bg-gray-100 text-gray-600 border-gray-200",
      activeBadge: unreadMessagesCount > 0 ? `${unreadMessagesCount} non lu(s)` : "En direct",
      tab: "messages" as const,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <motion.button
            key={stat.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => onSelectTab(stat.tab)}
            className={`p-4 sm:p-5 rounded-2xl bg-white border border-gray-200/90 text-left transition-all hover:shadow-md hover:scale-[1.01] active:scale-99 flex flex-col justify-between group cursor-pointer relative shadow-xs ${stat.cardBorder}`}
          >
            {/* Top row: Icon + Status Badge */}
            <div className="flex items-center justify-between w-full mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${stat.iconBg}`}>
                <Icon size={20} />
              </div>
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${stat.badgeCls}`}>
                {stat.activeBadge}
              </span>
            </div>

            {/* Bottom: Numbers and titles */}
            <div>
              <div className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight mb-1">
                {stat.value}
              </div>
              <div className="font-bold text-gray-800 text-xs sm:text-sm mb-0.5 group-hover:text-primary transition-colors">
                {stat.title}
              </div>
              <div className="text-[11px] text-gray-400 font-medium truncate">
                {stat.subtext}
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
