/**
 * Machine à états canonique des commandes & livraisons Rayons.net.
 * Contrat unique partagé entre le Web (Client, Fournisseur, Livreur, Admin)
 * et les applications mobiles (`rayons_app` & `livreur_app`).
 */

export type CanonicalOrderStatus =
  | "PENDING"
  | "PREPARING"
  | "CONFIRMED_AWAITING_DRIVER"
  | "ACCEPTED"
  | "IN_TRANSIT"
  | "ARRIVED_AWAITING_PAYMENT"
  | "COMPLETED"
  | "CANCELLED";

export interface OrderStatusMeta {
  canonical: CanonicalOrderStatus;
  labelFr: string;
  labelEn: string;
  labelZh: string;
  tone: "amber" | "purple" | "blue" | "emerald" | "red" | "gray";
}

export const ORDER_STATUS_META: Record<CanonicalOrderStatus, OrderStatusMeta> = {
  PENDING: {
    canonical: "PENDING",
    labelFr: "En attente",
    labelEn: "Pending",
    labelZh: "待处理",
    tone: "amber",
  },
  PREPARING: {
    canonical: "PREPARING",
    labelFr: "En préparation",
    labelEn: "Preparing",
    labelZh: "备货中",
    tone: "purple",
  },
  CONFIRMED_AWAITING_DRIVER: {
    canonical: "CONFIRMED_AWAITING_DRIVER",
    labelFr: "En attente d'un livreur",
    labelEn: "Awaiting Driver",
    labelZh: "等待骑手接单",
    tone: "amber",
  },
  ACCEPTED: {
    canonical: "ACCEPTED",
    labelFr: "Livreur assigné",
    labelEn: "Driver Assigned",
    labelZh: "骑手已接单",
    tone: "blue",
  },
  IN_TRANSIT: {
    canonical: "IN_TRANSIT",
    labelFr: "En livraison",
    labelEn: "In Transit",
    labelZh: "配送中",
    tone: "blue",
  },
  ARRIVED_AWAITING_PAYMENT: {
    canonical: "ARRIVED_AWAITING_PAYMENT",
    labelFr: "Arrivé · Paiement à la livraison",
    labelEn: "Arrived · Awaiting Payment",
    labelZh: "已到达 · 等待付款",
    tone: "amber",
  },
  COMPLETED: {
    canonical: "COMPLETED",
    labelFr: "Livrée",
    labelEn: "Delivered",
    labelZh: "已送达",
    tone: "emerald",
  },
  CANCELLED: {
    canonical: "CANCELLED",
    labelFr: "Annulée",
    labelEn: "Cancelled",
    labelZh: "已取消",
    tone: "red",
  },
};

/**
 * Normalise tous les statuts historiques (FR/EN/Mobile/Legacy) vers un statut canonique unique.
 */
export function normalizeOrderStatus(raw?: string | null): CanonicalOrderStatus {
  const s = String(raw || "").toUpperCase().trim();
  if (["COMPLETED", "DELIVERED", "LIVRÉE", "LIVREE", "LIVRE", "TERMINEE", "TERMINÉE"].includes(s)) {
    return "COMPLETED";
  }
  if (["CANCELLED", "CANCELED", "ANNULÉE", "ANNULEE", "REJECTED"].includes(s)) {
    return "CANCELLED";
  }
  if (s === "ARRIVED_AWAITING_PAYMENT") return "ARRIVED_AWAITING_PAYMENT";
  if (["IN_TRANSIT", "SHIPPED", "EXPÉDIÉE", "EXPEDIEE", "EN_LIVRAISON"].includes(s)) {
    return "IN_TRANSIT";
  }
  if (["ACCEPTED", "DRIVER_ASSIGNED"].includes(s)) return "ACCEPTED";
  if (["CONFIRMED_AWAITING_DRIVER", "PENDING_DRIVER"].includes(s)) {
    return "CONFIRMED_AWAITING_DRIVER";
  }
  if (["PREPARING", "EN_PREPARATION"].includes(s)) return "PREPARING";
  return "PENDING";
}

export function isAwaitingDriverStatus(raw?: string | null): boolean {
  return normalizeOrderStatus(raw) === "CONFIRMED_AWAITING_DRIVER";
}

export function isCompletedOrderStatus(raw?: string | null): boolean {
  return normalizeOrderStatus(raw) === "COMPLETED";
}
