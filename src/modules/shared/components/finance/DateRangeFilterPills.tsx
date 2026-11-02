"use client";

import React from "react";
import { Calendar } from "lucide-react";
import { useDatePeriodFilter } from "@/hooks/useDatePeriodFilter";

interface DateRangeFilterPillsProps {
  filter: ReturnType<typeof useDatePeriodFilter>;
}

export default function DateRangeFilterPills({ filter }: DateRangeFilterPillsProps) {
  const {
    periodFilter,
    getPeriodLabel,
    selectedCalendarDate,
    calendarStartDate,
    calendarEndDate,
    showRangePicker,
    setShowRangePicker,
    resetToToday,
    selectSingleDate,
    selectRangeStart,
    selectRangeEnd,
  } = filter;

  return (
    <div className="bg-white/3 border border-white/8 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/5 text-gray-400 rounded-lg shrink-0">
          <Calendar size={16} />
        </div>
        <div>
          <p className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
            Période comptable
          </p>
          <h3 className="text-sm font-bold text-white mt-0.5">
            {getPeriodLabel()}
            {periodFilter === "today" && (
              <span className="ml-2 text-[10px] text-[#C7D300] font-bold">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C7D300] animate-pulse mr-1 align-middle"></span>
                En direct
              </span>
            )}
          </h3>
        </div>
      </div>

      {/* Contrôles Calendrier */}
      <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
        <input
          type="date"
          value={selectedCalendarDate}
          onChange={(e) => selectSingleDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300] cursor-pointer"
        />

        {periodFilter === "custom" ? (
          <button
            type="button"
            onClick={resetToToday}
            className="text-xs bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold px-3 py-1.5 rounded-lg transition-all cursor-pointer"
          >
            Aujourd&apos;hui
          </button>
        ) : (
          <button
            type="button"
            onClick={resetToToday}
            className="text-xs border border-white/10 text-gray-400 font-semibold px-3 py-1.5 rounded-lg hover:text-white transition-all cursor-pointer"
          >
            Aujourd&apos;hui
          </button>
        )}

        <button
          type="button"
          onClick={() => setShowRangePicker(!showRangePicker)}
          className="text-xs text-gray-400 hover:text-white px-2 py-1.5 transition-colors cursor-pointer"
        >
          {showRangePicker ? "▾ Plage" : "▸ Plage"}
        </button>
      </div>

      {showRangePicker && (
        <div className="w-full pt-3 border-t border-white/8 flex flex-wrap items-center gap-3 text-xs">
          <span className="text-gray-400 font-semibold">Plage personnalisée :</span>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Du</span>
            <input
              type="date"
              value={calendarStartDate}
              onChange={(e) => selectRangeStart(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Au</span>
            <input
              type="date"
              value={calendarEndDate}
              onChange={(e) => selectRangeEnd(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
            />
          </div>
        </div>
      )}
    </div>
  );
}
