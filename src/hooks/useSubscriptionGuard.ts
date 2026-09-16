"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSupplier } from "@/lib/permissions";

export type SubscriptionStatus = "ACTIVE" | "TRIAL" | "EXPIRED" | "BLOCKED" | "OK";

/**
 * Hook that checks the supplier's subscription status.
 * Returns:
 *  - status: "OK" (has access), "TRIAL" (in trial), "EXPIRED" (trial/sub expired)
 *  - daysLeft: number of days remaining in trial/subscription
 *  - isBlocked: true if access to navigation should be blocked
 */
export function useSubscriptionGuard() {
  const { userData, loading } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>("OK");
  const [daysLeft, setDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    if (loading || !userData) return;

    // Only apply to suppliers
    if (!isSupplier(userData)) {
      setStatus("OK");
      return;
    }

    const subStatus = (userData.subscriptionStatus || "").toUpperCase();

    // If explicitly blocked by admin
    if (subStatus === "BLOCKED" || subStatus === "SUSPENDED") {
      setStatus("BLOCKED");
      setDaysLeft(0);
      return;
    }

    // If active paid subscription
    if (subStatus === "ACTIVE") {
      setStatus("ACTIVE");
      return;
    }

    // Check trial/expiry date
    const endDateRaw = userData.subscriptionEndDate;
    if (!endDateRaw) {
      // No date set — treat as expired to be safe
      setStatus("EXPIRED");
      setDaysLeft(0);
      return;
    }

    let endDate: Date;
    // Handle Firestore Timestamp or plain date string
    if (typeof endDateRaw.toDate === "function") {
      endDate = endDateRaw.toDate();
    } else {
      endDate = new Date(endDateRaw);
    }

    const now = new Date();
    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      setStatus("EXPIRED");
      setDaysLeft(0);
    } else if (subStatus === "TRIAL") {
      setStatus("TRIAL");
      setDaysLeft(diffDays);
    } else {
      setStatus("ACTIVE");
      setDaysLeft(diffDays);
    }
  }, [userData, loading]);

  const isBlocked = status === "EXPIRED" || status === "BLOCKED";

  return { status, daysLeft, isBlocked };
}
