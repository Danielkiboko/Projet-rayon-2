import { AccountType } from "./roles";
import { StaffPosition, StaffPermission } from "./permissions";

export interface BaseUser {
  id: string;
  email: string;
  displayName: string;
  accountType: AccountType;
  role: string;
  phoneNumber?: string;
  photoURL?: string;
  status: "active" | "suspended" | "pending" | "inactive";
  createdAt?: any;
  updatedAt?: any;
}

/**
 * Profil spécifique pour les Partenaires Apporteurs d'Affaires.
 * STRICTEMENT SÉPARÉ : AUCUN RAYON, AUCUNE BOUTIQUE.
 */
export interface PartnerProfile {
  partnerCode: string;
  referralCode: string;
  balance: number;
  totalEarned: number;
  recruitedSuppliersCount: number;
  payoutMethod?: string;
  payoutPhone?: string;
  payoutProvider?: string;
}

export interface PartnerUser extends BaseUser {
  accountType: "PARTNER";
  partnerProfile: PartnerProfile;
  // Note: un partenaire n'a JAMAIS de rayon ni de assignedRayons.
}

/**
 * Profil spécifique pour les Collaborateurs / Fonctionnaires internes.
 * STRICTEMENT SÉPARÉ : AUCUN RAYON, ORGANISÉ PAR POSTES ET TÂCHES.
 */
export interface StaffProfile {
  positions: StaffPosition[];
  permissions: StaffPermission[];
  department?: string;
  assignedBy?: string;
  assignedAt?: any;
}

export interface StaffUser extends BaseUser {
  accountType: "STAFF";
  staffProfile: StaffProfile;
  // Note: un collaborateur n'a JAMAIS de rayon ni de assignedRayons.
}

/**
 * Fournisseur marchand / boutique.
 * SEUL TYPE AYANT DROIT À UN OU PLUSIEURS RAYONS.
 */
export interface SupplierUser extends BaseUser {
  accountType: "SUPPLIER" | "SUB_SUPPLIER";
  companyName: string;
  rayon: "connect" | "immo" | "mode" | "saveurs" | string;
  assignedRayons: string[];
  serviceAttached?: string;
  businessType?: string;
  subscriptionStatus: "TRIAL" | "ACTIVE" | "SUSPENDED_PAYMENT" | "EXPIRED";
  subscriptionEndDate?: any;
  isBlocked: boolean;
  referredByPartnerId?: string;
  partnerReferral?: boolean;
  parentSupplierId?: string;
  // Identifiants légaux & KYC
  rccm?: string;
  idNat?: string;
  nif?: string;
  kycStatus?: "VERIFIED" | "PENDING_APPROVAL" | "REJECTED" | "UNVERIFIED";
}

/**
 * Client particulier / acheteur final.
 */
export interface ClientUser extends BaseUser {
  accountType: "CLIENT";
}

/**
 * Livreur / Chauffeur.
 */
export interface DriverUser extends BaseUser {
  accountType: "DRIVER";
  supplierId?: string;
  vehicleType?: string;
  licenseNumber?: string;
}

