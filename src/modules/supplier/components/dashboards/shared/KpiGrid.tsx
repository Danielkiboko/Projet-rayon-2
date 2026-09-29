"use client";

import { motion } from "framer-motion";

type KpiItem = {
  title: string;
  value: string;
  subtitle: string;
  subInfo: string;
  icon: any;
  highlightColor?: string; // e.g. "text-red-500", "text-amber-500", "text-blue-500"
  bgGradientColor?: string; // e.g. "bg-amber-500/5"
  hoverGradientColor?: string; // e.g. "hover:bg-amber-500/10"
};

interface KpiGridProps {
  kpis: KpiItem[];
  defaultHighlightColor?: string;
  defaultBgGradientColor?: string;
  defaultHoverGradientColor?: string;
}

export default function KpiGrid({ 
  kpis,
  defaultHighlightColor = "text-blue-500",
  defaultBgGradientColor = "bg-blue-500/5",
  defaultHoverGradientColor = "group-hover:bg-blue-500/10"
}: KpiGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      {kpis.map((kpi, idx) => {
        const Icon = kpi.icon;
        const highlightColor = kpi.highlightColor || defaultHighlightColor;
        const bgGradientColor = kpi.bgGradientColor || defaultBgGradientColor;
        const hoverGradientColor = kpi.hoverGradientColor || defaultHoverGradientColor;
        
        return (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            transition={{ delay: idx * 0.1, duration: 0.4 }}
            className="bg-[#0F1D27] border border-white/10 rounded-3xl p-5 flex flex-col justify-between h-32 hover:border-white/20 hover:shadow-xl hover:shadow-black/40 transition-all shadow-md relative overflow-hidden group cursor-pointer"
          >
            <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -mr-10 -mt-10 transition-colors ${bgGradientColor} ${hoverGradientColor}`} />
            <div className="flex justify-between items-start relative z-10">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">{kpi.title}</h3>
              <div className="p-2 rounded-xl bg-white/5 group-hover:bg-white/10 transition-colors">
                <Icon size={16} className={`${highlightColor} group-hover:scale-110 transition-transform`} />
              </div>
            </div>
            <div className="mt-2 relative z-10">
              <div className={`text-2xl sm:text-3xl font-black font-heading tabular-nums tracking-tight ${highlightColor !== defaultHighlightColor ? highlightColor : "text-white"}`}>
                {kpi.value}
              </div>
              <div className="text-[11px] text-gray-400 font-semibold mt-0.5 uppercase tracking-wider">{kpi.subtitle}</div>
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-xs text-gray-400 relative z-10">
              <span>{kpi.subInfo}</span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
