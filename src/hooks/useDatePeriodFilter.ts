"use client";

import { useState, useCallback } from "react";

export type PeriodFilterType =
  | "today"
  | "yesterday"
  | "last7days"
  | "this_month"
  | "all"
  | "custom";

export function useDatePeriodFilter(initialPeriod: PeriodFilterType = "today") {
  const [periodFilter, setPeriodFilter] = useState<PeriodFilterType>(initialPeriod);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>("");
  const [calendarStartDate, setCalendarStartDate] = useState<string>("");
  const [calendarEndDate, setCalendarEndDate] = useState<string>("");
  const [showRangePicker, setShowRangePicker] = useState<boolean>(false);

  const resetToToday = useCallback(() => {
    setPeriodFilter("today");
    setSelectedCalendarDate("");
    setCalendarStartDate("");
    setCalendarEndDate("");
    setShowRangePicker(false);
  }, []);

  const selectSingleDate = useCallback((dateStr: string) => {
    setSelectedCalendarDate(dateStr);
    setCalendarStartDate("");
    setCalendarEndDate("");
    setPeriodFilter("custom");
  }, []);

  const selectRangeStart = useCallback((dateStr: string) => {
    setCalendarStartDate(dateStr);
    setSelectedCalendarDate("");
    setPeriodFilter("custom");
  }, []);

  const selectRangeEnd = useCallback((dateStr: string) => {
    setCalendarEndDate(dateStr);
    setSelectedCalendarDate("");
    setPeriodFilter("custom");
  }, []);

  const isTxInPeriod = useCallback(
    (
      item: { createdAt?: any; date?: any; [key: string]: any },
      overridePeriod?: PeriodFilterType
    ): boolean => {
      if (!item) return false;
      const rawDate = item.createdAt || item.date;
      if (!rawDate) return false;

      let time: number;
      if (typeof rawDate === "number") {
        time = rawDate;
      } else if (rawDate.toMillis && typeof rawDate.toMillis === "function") {
        time = rawDate.toMillis();
      } else if (rawDate.seconds && typeof rawDate.seconds === "number") {
        time = rawDate.seconds * 1000;
      } else if (rawDate instanceof Date) {
        time = rawDate.getTime();
      } else {
        time = new Date(rawDate).getTime();
      }

      if (isNaN(time)) return false;

      const activePeriod = overridePeriod || periodFilter;
      if (activePeriod === "all") return true;

      const now = new Date();

      if (activePeriod === "today") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
        return time >= start && time <= end;
      }

      if (activePeriod === "yesterday") {
        const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const start = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0).getTime();
        const end = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999).getTime();
        return time >= start && time <= end;
      }

      if (activePeriod === "last7days") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0).getTime();
        return time >= start;
      }

      if (activePeriod === "this_month") {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        return time >= start;
      }

      if (activePeriod === "custom") {
        if (selectedCalendarDate && !calendarStartDate && !calendarEndDate) {
          const [y, m, d] = selectedCalendarDate.split("-").map(Number);
          const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
          const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
          return time >= start && time <= end;
        }

        let match = true;
        if (calendarStartDate) {
          const [y, m, d] = calendarStartDate.split("-").map(Number);
          const start = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
          if (time < start) match = false;
        }
        if (calendarEndDate) {
          const [y, m, d] = calendarEndDate.split("-").map(Number);
          const end = new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
          if (time > end) match = false;
        }
        return match;
      }

      return true;
    },
    [periodFilter, selectedCalendarDate, calendarStartDate, calendarEndDate]
  );

  const getPeriodLabel = useCallback((): string => {
    switch (periodFilter) {
      case "today":
        return "Aujourd'hui (24h)";
      case "yesterday":
        return "Hier";
      case "last7days":
        return "7 derniers jours";
      case "this_month":
        return "Ce mois";
      case "all":
        return "Tout l'historique";
      case "custom": {
        if (selectedCalendarDate && !calendarStartDate && !calendarEndDate) {
          const [y, m, d] = selectedCalendarDate.split("-");
          return `Journée du ${d}/${m}/${y}`;
        }
        if (calendarStartDate && calendarEndDate) {
          const [y1, m1, d1] = calendarStartDate.split("-");
          const [y2, m2, d2] = calendarEndDate.split("-");
          return `Du ${d1}/${m1}/${y1} au ${d2}/${m2}/${y2}`;
        }
        if (calendarStartDate) {
          const [y, m, d] = calendarStartDate.split("-");
          return `Depuis le ${d}/${m}/${y}`;
        }
        if (calendarEndDate) {
          const [y, m, d] = calendarEndDate.split("-");
          return `Jusqu'au ${d}/${m}/${y}`;
        }
        return "Date du calendrier";
      }
    }
  }, [periodFilter, selectedCalendarDate, calendarStartDate, calendarEndDate]);

  return {
    periodFilter,
    setPeriodFilter,
    selectedCalendarDate,
    setSelectedCalendarDate,
    calendarStartDate,
    setCalendarStartDate,
    calendarEndDate,
    setCalendarEndDate,
    showRangePicker,
    setShowRangePicker,
    resetToToday,
    selectSingleDate,
    selectRangeStart,
    selectRangeEnd,
    isTxInPeriod,
    isItemInPeriod: isTxInPeriod,
    getPeriodLabel,
  };
}
