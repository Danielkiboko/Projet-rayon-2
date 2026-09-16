"use client";

import { motion } from "framer-motion";
import RevenueAreaChart from "@/modules/shared/components/charts/RevenueAreaChart";
import { ReactNode } from "react";
import { Lock, ArrowRight } from "lucide-react";

export interface KpiConfig {
  title: string;
  value: string | number;
  subtitle: string;
  subInfo: string;
  icon: any; // Lucide icon
  alertCondition?: boolean;
  onClick?: () => void;
}

export interface ActionConfig {
  title: string;
  description: string;
  buttonText: string;
  onClick: () => void;
  isPrimary?: boolean;
}

interface GenericDashboardProps<T> {
  loading: boolean;
  moduleName: string;
  kpis: KpiConfig[];
  chartData: any[];
  chartTitle: string;
  chartColor: string;
  recentItemsTitle?: string;
  recentItemsHeaders?: string[];
  recentItemsData?: T[];
  renderRecentRow?: (item: T) => ReactNode;
  emptyStateMessage?: string;
  actionsTitle: string;
  actions: ActionConfig[];
  rightColumnExtra?: ReactNode;
  bottomExtra?: ReactNode;
  isBlocked?: boolean;
}

export default function GenericDashboard<T>({
  loading,
  moduleName,
  kpis,
  chartData,
  chartTitle,
  chartColor,
  recentItemsTitle,
  recentItemsHeaders,
  recentItemsData,
  renderRecentRow,
  emptyStateMessage,
  actionsTitle,
  actions,
  rightColumnExtra,
  bottomExtra,
  isBlocked = false
}: GenericDashboardProps<T>) {

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] text-gray-400">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium animate-pulse">Chargement de votre {moduleName}...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Top Row KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          const isClickable = !isBlocked && !!kpi.onClick;
          return (
            <motion.div
              key={kpi.title}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.35 }}
              onClick={isClickable ? kpi.onClick : undefined}
              className={`bg-gradient-to-b from-[#131E27] to-[#0D151D] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between h-36 transition-all duration-300 shadow-md relative overflow-hidden group ${
                isClickable 
                  ? 'cursor-pointer hover:border-white/20 hover:scale-[1.015] active:scale-[0.99]' 
                  : ''
              } ${kpi.alertCondition ? 'border-orange-500/30' : ''}`}
            >
              <div className="absolute top-0 right-0 w-28 h-28 bg-emerald-500/[0.04] rounded-full blur-2xl -mr-10 -mt-10 group-hover:bg-emerald-500/[0.08] transition-colors" />
              
              <div className="flex justify-between items-start relative z-10">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{kpi.title}</h3>
                <div className={`p-2 rounded-xl border ${
                  kpi.alertCondition 
                    ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' 
                    : 'bg-white/5 border-white/5 text-gray-300 group-hover:text-emerald-400 group-hover:border-emerald-500/20'
                } transition-colors`}>
                  <Icon size={16} />
                </div>
              </div>
              
              <div className="relative z-10 my-1">
                <div className={`text-2xl lg:text-3xl font-extrabold tracking-tight ${kpi.alertCondition ? "text-orange-400" : "text-white"}`}>
                  {kpi.value}
                </div>
                <div className="text-[11px] text-gray-400 font-medium mt-0.5">{kpi.subtitle}</div>
              </div>

              <div className="pt-2 border-t border-white/[0.06] flex justify-between items-center text-[11px] text-gray-400 relative z-10">
                <span className="truncate">{kpi.subInfo}</span>
                {isClickable && (
                  <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-400 shrink-0 ml-1" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Charts) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 shadow-md">
            <RevenueAreaChart data={chartData} title={chartTitle} color={chartColor} />
          </div>
          
          {/* Recent Items Section */}
          {recentItemsTitle && recentItemsHeaders && recentItemsData && renderRecentRow && (
            <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-6 shadow-md">
              <h2 className="text-base font-bold text-white mb-5 flex items-center justify-between">
                <span>{recentItemsTitle}</span>
                <span className="text-xs text-gray-400 font-normal">{recentItemsData.length} enregistrement(s)</span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/[0.04] text-[11px] uppercase tracking-wider text-gray-400 font-semibold border-b border-white/[0.06]">
                      {recentItemsHeaders.map((h, i) => (
                        <th key={h} className={`p-3.5 ${i === 0 ? 'rounded-l-xl' : ''} ${i === recentItemsHeaders.length - 1 ? 'rounded-r-xl text-right' : ''}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm text-gray-300 divide-y divide-white/[0.04]">
                    {recentItemsData.length === 0 ? (
                      <tr>
                        <td colSpan={recentItemsHeaders.length} className="p-8 text-center text-gray-500 font-medium text-xs">
                          {emptyStateMessage || "Aucun élément récent à afficher."}
                        </td>
                      </tr>
                    ) : (
                      recentItemsData.map(renderRecentRow)
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (Actions) */}
        <div className="space-y-6">
          {rightColumnExtra}
          
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.35 }}
            className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-6 shadow-md relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/[0.04] rounded-full blur-3xl -mr-10 -mt-10" />
            
            <div className="flex items-center justify-between mb-4 relative z-10">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase">{actionsTitle}</h2>
              {isBlocked && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/15 text-red-300 border border-red-500/25 flex items-center gap-1">
                  <Lock size={10} />
                  Bloqué
                </span>
              )}
            </div>
            
            {actions.map((action, i) => {
              const handleActionClick = () => {
                if (isBlocked) {
                  window.location.href = '/supplier/finance';
                  return;
                }
                action.onClick();
              };

              return (
                <div 
                  key={i} 
                  className={`relative z-10 rounded-xl p-4 border transition-all ${
                    isBlocked
                      ? 'bg-red-950/20 border-red-500/20 hover:border-red-500/40 opacity-80'
                      : 'bg-white/[0.03] border-white/[0.06] hover:border-white/20 hover:bg-white/[0.06]'
                  } ${i !== actions.length - 1 ? 'mb-3.5' : ''}`}
                  onClick={handleActionClick}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                      {action.title}
                      {isBlocked && <Lock size={12} className="text-red-400 shrink-0" />}
                    </h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-3.5 leading-relaxed">
                    {action.description}
                  </p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleActionClick();
                    }}
                    className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                      isBlocked
                        ? 'bg-red-600/30 hover:bg-red-600/50 text-red-200 border border-red-500/30'
                        : action.isPrimary 
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/30' 
                          : 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                    }`}
                  >
                    {isBlocked ? (
                      <>
                        <Lock size={12} />
                        <span>Régulariser ($50) pour débloquer</span>
                      </>
                    ) : (
                      <>
                        <span>{action.buttonText}</span>
                        <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </motion.div>
        </div>
      </div>
      
      {bottomExtra}
    </div>
  );
}
