"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

export interface StatusData {
  name: string;
  value: number;
  color?: string;
}

interface StatusPieChartProps {
  data: StatusData[];
  title?: string;
  subtitle?: string;
}

const COLORS: Record<string, string> = {
  LIVRE: "#22c55e",
  COMPLETED: "#22c55e",
  "PAYÉS ACTIFS": "#C7D300",
  "RÉSOLUES": "#22c55e",
  "LIVRÉES": "#22c55e",
  ARRIVED_AWAITING_PAYMENT: "#3b82f6",
  "ESSAI ACTIF": "#38bdf8",
  "EN COURS": "#38bdf8",
  ACCEPTED: "#eab308",
  PENDING: "#eab308",
  "EN ATTENTE": "#f59e0b",
  "OUVERTES": "#f59e0b",
  CANCELLED: "#ef4444",
  "IMPAYÉS / EXPIRÉS": "#ef4444",
  "ANNULÉES": "#ef4444",
  OCCUPÉES: "#3b82f6",
  DISPONIBLES: "#4b5563",
  SAVEURS: "#FF6B35",
  MODE: "#D4B08C",
  CONNECT: "#00B5A5",
  IMMO: "#4C6EF5",
  OTHER: "#8b5cf6",
};

const FALLBACK_PALETTE = ["#C7D300", "#38bdf8", "#f59e0b", "#ef4444", "#a855f7", "#10b981"];

const getColorForStatus = (item: StatusData, idx: number) => {
  if (item.color) return item.color;
  const upper = item.name.toUpperCase();
  return COLORS[upper] || FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0B151C] border border-white/15 px-3 py-2 rounded-xl shadow-2xl flex items-center gap-2.5">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: payload[0].payload.fill }}
        />
        <div>
          <p className="text-gray-400 text-[11px]">{payload[0].name}</p>
          <p className="text-white text-sm font-bold tabular-nums">{payload[0].value}</p>
        </div>
      </div>
    );
  }
  return null;
};

export default function StatusPieChart({
  data,
  title = "Répartition",
  subtitle,
}: StatusPieChartProps) {
  const nonZero = (data || []).filter((d) => d.value > 0);

  if (nonZero.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center bg-[#0F1A23] rounded-2xl border border-white/[0.08] p-5 text-center">
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-gray-500 text-xs mt-1">Aucune donnée à répartir pour le moment</p>
      </div>
    );
  }

  const dataWithColors = nonZero.map((item, idx) => ({
    ...item,
    fill: getColorForStatus(item, idx),
  }));

  return (
    <div className="w-full bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-5 flex flex-col shadow-md">
      <div className="mb-2">
        <h3 className="text-sm font-bold text-white uppercase tracking-wide">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1 w-full min-h-[230px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dataWithColors}
              cx="50%"
              cy="48%"
              innerRadius={52}
              outerRadius={76}
              paddingAngle={4}
              dataKey="value"
              animationDuration={900}
            >
              {dataWithColors.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: "11px", color: "#9ca3af" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
