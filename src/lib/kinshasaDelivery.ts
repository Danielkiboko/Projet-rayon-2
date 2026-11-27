/**
 * Kinshasa Delivery Zones & Delivery Fees
 * Shared single source of truth between DirectBuyModal, CartDrawer, and /api/orders/create.
 */

export interface KinshasaCommune {
  name: string;
  label?: string;
  fee: number;
  zone?: "central" | "inter" | "peri" | "far" | "other";
  negotiated?: boolean;
}

export const OTHER_DESTINATION_VALUE = "Autre";

export const KINSHASA_COMMUNES: KinshasaCommune[] = [
  { name: "Gombe", zone: "central", fee: 3 },
  { name: "Kintambo", zone: "central", fee: 3 },
  { name: "Lingwala", zone: "central", fee: 3 },
  { name: "Barumbu", zone: "central", fee: 3 },
  { name: "Kinshasa (Commune)", zone: "central", fee: 3 },
  { name: "Bandalungwa", zone: "central", fee: 3 },
  { name: "Kasa-Vubu", zone: "central", fee: 3 },
  { name: "Kalamu", zone: "central", fee: 3 },
  { name: "Ngaliema", zone: "inter", fee: 5 },
  { name: "Limete", zone: "inter", fee: 5 },
  { name: "Lemba", zone: "inter", fee: 5 },
  { name: "Matete", zone: "inter", fee: 5 },
  { name: "Ngaba", zone: "inter", fee: 5 },
  { name: "Ngiri-Ngiri", zone: "inter", fee: 5 },
  { name: "Bumbu", zone: "inter", fee: 5 },
  { name: "Makala", zone: "inter", fee: 5 },
  { name: "Selembao", zone: "inter", fee: 5 },
  { name: "Mont-Ngafula", zone: "peri", fee: 8 },
  { name: "Masina", zone: "peri", fee: 8 },
  { name: "Ndjili", zone: "peri", fee: 8 },
  { name: "Kimbanseke", zone: "peri", fee: 8 },
  { name: "Kisenso", zone: "peri", fee: 8 },
  { name: "Nsele", zone: "far", fee: 15 },
  { name: "Maluku", zone: "far", fee: 20 },
  {
    name: OTHER_DESTINATION_VALUE,
    label: "Autre destination (hors liste / Province) — À convenir avec le vendeur",
    zone: "other",
    fee: 0,
    negotiated: true,
  },
];

export function isNegotiatedDeliveryCommune(communeName?: string): boolean {
  if (!communeName) return false;
  const normalized = communeName.trim().toLowerCase();
  return normalized === "autre" || normalized === "other" || normalized.startsWith("autre");
}

export function getDeliveryFeeForCommune(communeName: string): number {
  if (isNegotiatedDeliveryCommune(communeName)) return 0;
  const found = KINSHASA_COMMUNES.find(
    (c) => c.name.toLowerCase() === communeName.toLowerCase()
  );
  return found ? found.fee : 5; // Default fallback to $5
}
