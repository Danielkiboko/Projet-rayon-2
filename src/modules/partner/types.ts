/**
 * Contrats de données du compartiment Partenaire (Apporteur d'affaires — sans accès Rayon).
 */
export type PartnerTab = "stats" | "publications" | "suppliers" | "commissions" | "payout";

export interface PartnerFilleul {
  id: string;
  filleulId: string;
  filleulName: string;
  filleulEmail: string | null;
  phone?: string | null;
  rayon?: string | null;
  subscriptionStatus?: string | null;
  code: string;
  totalCommissions: number;
  paymentsCount: number;
  createdAt: string | null;
  lastPaymentAt: string | null;
}

export interface PartnerCommission {
  id: string;
  filleulName: string;
  amount: number;
  currency: string;
  kind: string;
  status: "PENDING" | "PAID";
  paymentRef: string;
  createdAt: string | null;
  paidAt: string | null;
}
