"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

export interface RevenueData {
  name: string;
  total: number;
  projected?: number;
}

interface RevenueAreaChartProps {
  data: RevenueData[];
  title?: string;
  subtitle?: string;
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
  heightClass?: string;
  decimals?: number;
  secondaryLabel?: string;
  primaryLabel?: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  valuePrefix = "$",
  valueSuffix = "",
  decimals = 2,
  primaryLabel = "Valeur",
  secondaryLabel = "Prévision",
}: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0B151C] border border-white/15 px-3.5 py-2.5 rounded-xl shadow-2xl">
        <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
        {payload.map((entry: any, idx: number) => {
          const val = Number(entry.value || 0);
          const formatted =
            decimals > 0
              ? val.toLocaleString("fr-FR", {
                  minimumFractionDigits: decimals,
                  maximumFractionDigits: decimals,
                })
              : Math.round(val).toLocaleString("fr-FR");
          return (
            <div key={idx} className="flex items-center gap-2 text-xs">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: entry.color || "#C7D300" }}
              />
              <span className="text-gray-300">
                {entry.dataKey === "projected" ? secondaryLabel : primaryLabel} :
              </span>
              <span className="text-white font-bold tabular-nums">
                {valuePrefix}
                {formatted}
                {valueSuffix}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

export default function RevenueAreaChart({
  data,
  title = "Évolution des revenus",
  subtitle,
  color = "#3b82f6",
  valuePrefix = "$",
  valueSuffix = "",
  heightClass = "h-72",
  decimals = 2,
  primaryLabel = "Réalisé",
  secondaryLabel = "Prévision",
}: RevenueAreaChartProps) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `areaGrad-${uid}`;
  const projectedGradientId = `areaGradProj-${uid}`;
  const hasProjected = Array.isArray(data) && data.some((d) => typeof d.projected === "number");

  if (!data || data.length === 0) {
    return (
      <div className={`w-full ${heightClass} flex flex-col items-center justify-center bg-[#0F1A23] rounded-2xl border border-white/[0.06] p-4 text-center`}>
        <p className="text-gray-400 text-sm font-medium">{title}</p>
        <p className="text-gray-500 text-xs mt-1">Pas assez de données pour tracer la courbe</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {(title || subtitle) && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
          <div>
            {title && <h3 className="text-sm sm:text-base font-bold text-white">{title}</h3>}
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {hasProjected && (
            <div className="flex items-center gap-3 text-[11px] text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                {primaryLabel}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                {secondaryLabel}
              </span>
            </div>
          )}
        </div>
      )}
      <div className={`${heightClass} w-full`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={projectedGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.28} />
                <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="name"
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              dy={8}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${valuePrefix}${value}${valueSuffix}`}
            />
            <Tooltip
              content={
                <CustomTooltip
                  valuePrefix={valuePrefix}
                  valueSuffix={valueSuffix}
                  decimals={decimals}
                  primaryLabel={primaryLabel}
                  secondaryLabel={secondaryLabel}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke={color}
              strokeWidth={2.5}
              fillOpacity={1}
              fill={`url(#${gradientId})`}
              animationDuration={900}
            />
            {hasProjected && (
              <Area
                type="monotone"
                dataKey="projected"
                stroke="#38bdf8"
                strokeWidth={2}
                strokeDasharray="5 4"
                fillOpacity={1}
                fill={`url(#${projectedGradientId})`}
                animationDuration={1100}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
