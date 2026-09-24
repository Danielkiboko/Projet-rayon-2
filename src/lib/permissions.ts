/**
 * Checks if the user is the Super Admin.
 * Super Admin has full control over the platform.
 */
export const isSuperAdmin = (user: any, userData: any): boolean => {
  const email = (user?.email || "").toLowerCase().trim();
  const role = (userData?.role || "").toUpperCase();
  return email === "danielkiboko218@gmail.com" || role === "SUPER_ADMIN" || role === "SUPERADMIN";
};

/**
 * Checks if user is an internal team collaborator / fonctionnaire.
 */
export const isTeamMember = (userData: any): boolean => {
  const role = (userData?.role || "").toUpperCase();
  return ["SUB_ADMIN", "ADMIN_FINANCE", "ADMIN_DB", "ADMIN_TECH", "ADMIN_OPS", "SUPER_ADMIN", "ADMIN"].includes(role);
};

export const isSubAdmin = (userData: any): boolean => {
  const role = (userData?.role || "").toUpperCase();
  return ["SUB_ADMIN", "ADMIN_FINANCE", "ADMIN_DB", "ADMIN_TECH", "ADMIN_OPS", "ADMIN"].includes(role);
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
 * Role-specific permissions for internal staff
 */
export const canAccessFinance = (user: any, userData: any): boolean => {
  const role = (userData?.role || "").toUpperCase();
  return isSuperAdmin(user, userData) || role === "ADMIN_FINANCE" || role === "SUB_ADMIN" || role === "ADMIN";
};

export const canAccessDatabase = (user: any, userData: any): boolean => {
  const role = (userData?.role || "").toUpperCase();
  return isSuperAdmin(user, userData) || role === "ADMIN_DB" || role === "ADMIN_TECH" || role === "SUB_ADMIN" || role === "ADMIN";
};

export const canAccessOperations = (user: any, userData: any): boolean => {
  const role = (userData?.role || "").toUpperCase();
  return isSuperAdmin(user, userData) || role === "ADMIN_OPS" || role === "SUB_ADMIN" || role === "ADMIN";
};

export const getRoleTitle = (role?: string): string => {
  const r = (role || "").toUpperCase();
  if (r.includes("SUPER")) return "Directeur Général (Super Admin)";
  if (r === "SUB_ADMIN" || r === "SUBADMIN" || r === "ADMIN") return "Sous-Administrateur Général";
  if (r.includes("FINANCE")) return "Gestionnaire Financier & Comptabilité";
  if (r.includes("DB") || r.includes("TECH")) return "Gestionnaire Base de Données & Catalogue";
  if (r.includes("OPS")) return "Gestionnaire des Opérations & Logistique";
  return "Collaborateur";
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
