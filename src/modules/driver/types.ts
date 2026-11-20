/**
 * Contrats de données du compartiment Livreur (Web + App Mobile `livreur_app`).
 */
export type DriverMissionStatus =
  | "CONFIRMED_AWAITING_DRIVER"
  | "pending_driver"
  | "ACCEPTED"
  | "ARRIVED_AWAITING_PAYMENT"
  | "LIVRE"
  | "COMPLETED"
  | "CANCELLED";

export interface DriverCoordinates {
  lat: number;
  lng: number;
}
