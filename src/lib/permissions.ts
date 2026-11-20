import { hasStaffPermission } from "@/domain/permissions";

const superAdminEmailsEnv = (
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAILS || process.env.SUPER_ADMIN_EMAILS || "danielkiboko218@gmail.com,admin@rayons.net"
    : "danielkiboko218@gmail.com,admin@rayons.net"
)
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const SUPER_ADMIN_EMAILS: string[] = superAdminEmailsEnv;

/**
 * Checks if the user is the Super Admin.
 * Super Admin has full control over the platform.
 */
export const isSuperAdmin = (user: any, userData: any): boolean => {
  const email = (user?.email || userData?.email || "").toLowerCase().trim();
  const role = (userData?.role || "").toUpperCase();
  return SUPER_ADMIN_EMAILS.includes(email) || role === "SUPER_ADMIN" || role === "SUPERADMIN";
};

/**
 * Checks if user is an internal team collaborator / fonctionnaire.
 */
export const isTeamMember = (userData: any): boolean => {
  const role = (userData?.role || "").toUpperCase();
  return (
    [
      "SUB_ADMIN", "ADMIN_FINANCE", "ADMIN_DB", "ADMIN_TECH", "ADMIN_OPS",
      "SUPER_ADMIN", "ADMIN", "STAFF", "GESTIONNAIRE_ADMIN",
      "RESPONSABLE_LOGISTIQUE", "RESPONSABLE_FINANCIER",
      "RESPONSABLE_CATALOGUE", "SUPPORT_CLIENT"
    ].includes(role) ||
    userData?.accountType === "STAFF" ||
    userData?.isInternalStaff === true
  );
};

export const isSubAdmin = (userData: any): boolean => {
  const role = (userData?.role || "").toUpperCase();
  return (
    [
      "SUB_ADMIN", "ADMIN_FINANCE", "ADMIN_DB", "ADMIN_TECH", "ADMIN_OPS",
      "ADMIN", "STAFF", "GESTIONNAIRE_ADMIN",
      "RESPONSABLE_LOGISTIQUE", "RESPONSABLE_FINANCIER",
      "RESPONSABLE_CATALOGUE", "SUPPORT_CLIENT"
    ].includes(role) ||
    userData?.accountType === "STAFF" ||
    userData?.isInternalStaff === true
  );
};

export const isGeneralSubAdmin = (userData: any): boolean => {
  const role = (userData?.role || "").toUpperCase();
  return role === "SUB_ADMIN" || role === "SUBADMIN" || role === "ADMIN";
};

/**
 * Checks if the user has any admin access (Super Admin or Internal Staff Member).
 */
export const hasAdminAccess = (user: any, userData: any): boolean => {
  return isSuperAdmin(user, userData) || isSubAdmin(userData);
};

/**
 * Role-specific permissions for internal staff.
 * Délègue à la source de vérité unique `src/domain/permissions.ts` (`hasStaffPermission`)
 * afin de couvrir à la fois les anciens rôles (ADMIN_FINANCE, ADMIN_OPS, ADMIN_DB)
 * ET les postes fonctionnaires modernes (`staffProfile.positions`).
 */
function buildPermissionSubject(user: any, userData: any) {
  return {
    ...(userData || {}),
    email: user?.email || userData?.email || "",
  };
}

export const canAccessFinance = (user: any, userData: any): boolean => {
  if (isSuperAdmin(user, userData)) return true;
  const subject = buildPermissionSubject(user, userData);
  return (
    hasStaffPermission(subject, "finance.view") ||
    hasStaffPermission(subject, "finance.cash") ||
    hasStaffPermission(subject, "subscriptions.manage")
  );
};

export const canAccessDatabase = (user: any, userData: any): boolean => {
  if (isSuperAdmin(user, userData)) return true;
  const subject = buildPermissionSubject(user, userData);
  return (
    hasStaffPermission(subject, "products.moderate") ||
    hasStaffPermission(subject, "properties.moderate")
  );
};

export const canAccessOperations = (user: any, userData: any): boolean => {
  if (isSuperAdmin(user, userData)) return true;
  const subject = buildPermissionSubject(user, userData);
  return (
    hasStaffPermission(subject, "drivers.manage") ||
    hasStaffPermission(subject, "deliveries.dispatch") ||
    hasStaffPermission(subject, "orders.manage")
  );
};

export const getRoleTitle = (role?: string): string => {
  const r = (role || "").toUpperCase();
  if (r.includes("SUPER")) return "Directeur Général (Super Admin)";
  if (r === "SUB_ADMIN" || r === "SUBADMIN" || r === "ADMIN") return "Sous-Administrateur Général";
  if (r.includes("FINANCE") || r === "RESPONSABLE_FINANCIER") return "Responsable Financier & Caisse";
  if (r.includes("DB") || r.includes("TECH") || r === "RESPONSABLE_CATALOGUE") return "Responsable Catalogue & BDD";
  if (r.includes("OPS") || r === "RESPONSABLE_LOGISTIQUE") return "Responsable Logistique & Livraisons";
  if (r === "SUPPORT_CLIENT" || r.includes("SUPPORT")) return "Support Client & Assistance";
  if (r === "GESTIONNAIRE_ADMIN") return "Gestionnaire Administratif";
  return "Collaborateur";
};

/**
 * Checks if the user is a partner (Apporteur d'affaires / affilié).
 * A partner can recruit suppliers, earning monthly recurring commissions.
 */
export const isPartner = (userData: any): boolean => {
  const role = (userData?.role || "").toUpperCase();
  return role === "PARTNER" || userData?.isPartner === true;
};

/**
 * Checks if the user is a supplier (Fournisseur) of any type.
 */
export const isSupplier = (userData: any): boolean => {
  const role = userData?.role?.toUpperCase();
  return [
    "SUPPLIER", 
    "SUPPLIER_IMMO", 
    "SUB_SUPPLIER", 
    "FOURNISSEUR",
    "SUPPLIER_SAVEURS", 
    "SUPPLIER_MODE", 
    "SUPPLIER_CONNECT"
  ].includes(role);
};

/**
 * Returns all rayons available to a supplier (from assignedRayons array, role, businessType, rayon field, serviceAttached).
 * Ensures consistency across the entire app.
 */
export const getSupplierAvailableRayons = (userData: any): string[] => {
  if (!userData) return [];
  const set = new Set<string>();

  // 1. Explicit assignedRayons
  if (Array.isArray(userData.assignedRayons)) {
    userData.assignedRayons.forEach((r: any) => {
      if (typeof r === "string" && r.trim()) set.add(r.toLowerCase().trim());
    });
  }

  // 2. Primary rayon field
  if (userData.rayon && typeof userData.rayon === "string" && userData.rayon !== "Non assigné") {
    set.add(userData.rayon.toLowerCase().trim());
  }

  // 3. Service attached
  if (userData.serviceAttached && typeof userData.serviceAttached === "string") {
    set.add(userData.serviceAttached.toLowerCase().trim());
  }

  // 4. Role or businessType indicators for Immo
  if (
    userData.role === "SUPPLIER_IMMO" ||
    userData.role === "supplier_immo" ||
    userData.businessType === "IMMOBILIER" ||
    (typeof userData.rayon === "string" && userData.rayon.toLowerCase().includes("immo"))
  ) {
    set.add("immo");
  }

  // 5. Role or businessType indicators for Saveurs
  if (
    userData.role === "SUPPLIER_SAVEURS" ||
    userData.role === "supplier_saveurs" ||
    userData.businessType === "RESTAURATION" ||
    (typeof userData.rayon === "string" && (
      userData.rayon.toLowerCase().includes("saveur") ||
      userData.rayon.toLowerCase().includes("resto") ||
      userData.rayon.toLowerCase().includes("cuisine")
    ))
  ) {
    set.add("saveurs");
  }

  // 6. Role indicators for Mode / Connect
  if (userData.role === "SUPPLIER_MODE" || userData.role === "supplier_mode") {
    set.add("mode");
  }
  if (userData.role === "SUPPLIER_CONNECT" || userData.role === "supplier_connect") {
    set.add("connect");
  }

  return Array.from(set);
};

/**
 * Determines the specific supplier service type (immo, mode, connect, or default).
 * Centralizes the logic to avoid duplicated checks across the app.
 */
export const getSupplierType = (userData: any): "immo" | "mode" | "connect" | "saveurs" | "default" => {
  const available = getSupplierAvailableRayons(userData);

  // If running in browser and user has a saved active rayon from assigned rayons, respect it
  if (typeof window !== "undefined") {
    const active = localStorage.getItem("activeSupplierRayon");
    if (active && (active === "immo" || active === "mode" || active === "connect" || active === "saveurs")) {
      if (available.length === 0 || available.includes(active)) {
        return active;
      }
    }
  }

  // If user has specific available rayons, use the first one
  if (available.length > 0) {
    const first = available[0];
    if (first === "immo" || first === "mode" || first === "connect" || first === "saveurs") {
      return first;
    }
  }

  // Check if role or business type is explicitly Real Estate
  const isImmo = 
    userData?.role === "SUPPLIER_IMMO" || 
    userData?.businessType === "IMMOBILIER" || 
    userData?.rayon?.type === "REAL_ESTATE" || 
    userData?.rayon === "immo";

  if (isImmo) return "immo";

  const service = userData?.serviceAttached || userData?.rayon;
  if (service === "mode" || service === "connect" || service === "saveurs") {
    return service as "mode" | "connect" | "saveurs";
  }

  // Otherwise, fallback to default
  return "default";
};
