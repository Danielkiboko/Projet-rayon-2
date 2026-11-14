/**
 * Définition canonique des types de comptes et rôles sur Rayons.net
 * Source de vérité unique pour le frontend, backend et les règles métier.
 */

export type AccountType = 
  | "CLIENT"        // Acheteur particulier / client final
  | "SUPPLIER"      // Fournisseur commercial / boutique marchande avec rayon assigné
  | "SUB_SUPPLIER"  // Sous-agent ou délégué rattaché à un fournisseur principal
  | "PARTNER"       // Partenaire apporteur d'affaires (SANS RAYON, développe son réseau)
  | "STAFF"         // Équipe interne / fonctionnaire (SANS RAYON, assigné à des tâches/postes)
  | "DRIVER";       // Chauffeur / livreur

export const SUPER_ADMIN_EMAILS = [
  "danielkiboko218@gmail.com",
  "admin@rayons.net"
];

export const SUPPLIER_ROLES = [
  "SUPPLIER", "supplier", "FOURNISSEUR", "fournisseur",
  "SUPPLIER_IMMO", "supplier_immo",
  "SUPPLIER_MODE", "supplier_mode",
  "SUPPLIER_CONNECT", "supplier_connect",
  "SUPPLIER_SAVEURS", "supplier_saveurs"
];

export const STAFF_ROLES = [
  "SUPER_ADMIN", "superAdmin", "SUPERADMIN",
  "ADMIN", "admin",
  "SUB_ADMIN", "sub_admin", "SUBADMIN", "subadmin",
  "SOUS_ADMIN", "sous_admin", "SOUS_ADMIN_GENERAL",
  "ADMIN_FINANCE", "admin_finance",
  "ADMIN_DB", "admin_db", "ADMIN_TECH", "admin_tech",
  "ADMIN_OPS", "admin_ops",
  "FONCTIONNAIRE", "fonctionnaire",
  "STAFF", "staff"
];

export const DRIVER_ROLES = [
  "DRIVER", "driver", "LIVREUR", "livreur",
  "CHAUFFEUR", "chauffeur", "DELIVERY", "delivery", "COURSIER", "coursier"
];

/**
 * Normalise et détermine le type de compte réel d'un utilisateur.
 * Privilégie le champ explicite `accountType` s'il existe, sinon rétro-déduit proprement.
 */
export function getAccountType(user: any): AccountType {
  if (!user) return "CLIENT";

  // 1. Champ canonique s'il est déjà migré
  if (user.accountType) {
    const raw = String(user.accountType).toUpperCase().trim();
    if (["CLIENT", "SUPPLIER", "SUB_SUPPLIER", "PARTNER", "STAFF", "DRIVER"].includes(raw)) {
      return raw as AccountType;
    }
  }

  const role = String(user.role || "").toUpperCase().trim();
  const email = String(user.email || "").toLowerCase().trim();

  // 2. Super Admin ou Staff interne
  if (
    SUPER_ADMIN_EMAILS.includes(email) ||
    user.isInternalStaff === true ||
    user.isSuperAdmin === true ||
    STAFF_ROLES.map(r => r.toUpperCase()).includes(role) ||
    role.includes("ADMIN") ||
    role.includes("FONCTIONNAIRE") ||
    role.includes("STAFF")
  ) {
    return "STAFF";
  }

  // 3. Partenaire apporteur d'affaires (AUCUN RAYON)
  if (role === "PARTNER" || user.isPartner === true) {
    return "PARTNER";
  }

  // 4. Livreur
  if (user.isDriver === true || DRIVER_ROLES.map(r => r.toUpperCase()).includes(role)) {
    return "DRIVER";
  }

  // 5. Sous-fournisseur
  if (role === "SUB_SUPPLIER" || role === "sub_supplier" || user.parentSupplierId) {
    return "SUB_SUPPLIER";
  }

  // 6. Fournisseur marchand
  if (
    user.isSupplier === true ||
    SUPPLIER_ROLES.map(r => r.toUpperCase()).includes(role) ||
    Boolean(user.companyName || user.company || user.rccm || user.nif || user.idNat)
  ) {
    return "SUPPLIER";
  }

  // 7. Par défaut : Client
  return "CLIENT";
}

export function isStaff(user: any): boolean {
  return getAccountType(user) === "STAFF";
}

export function isSuperAdmin(user: any): boolean {
  const email = String(user?.email || "").toLowerCase().trim();
  const role = String(user?.role || "").toUpperCase().trim();
  return SUPER_ADMIN_EMAILS.includes(email) || role === "SUPER_ADMIN" || role === "SUPERADMIN";
}

export function isPartner(user: any): boolean {
  return getAccountType(user) === "PARTNER";
}

export function isSupplier(user: any): boolean {
  const t = getAccountType(user);
  return t === "SUPPLIER" || t === "SUB_SUPPLIER";
}

export function isDriver(user: any): boolean {
  return getAccountType(user) === "DRIVER";
}

export function isClient(user: any): boolean {
  return getAccountType(user) === "CLIENT";
}

