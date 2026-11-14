import { isSuperAdmin } from "./roles";

export type StaffPosition = 
  | "SUB_ADMIN"                // Direction générale adjointe
  | "GESTIONNAIRE_ADMIN"       // Gestion quotidienne des clients, boutiques, KYC
  | "RESPONSABLE_LOGISTIQUE"   // Gestion des commandes, livreurs, courses
  | "RESPONSABLE_FINANCIER"    // Caisse, dépôts, trésorerie, payouts partenaires
  | "RESPONSABLE_CATALOGUE"    // Modération des produits, propriétés, catalogue BDD
  | "SUPPORT_CLIENT";          // Gestion des tickets et assistance utilisateurs

export interface StaffPositionDefinition {
  id: StaffPosition;
  label: string;
  description: string;
  icon: string;
  defaultPermissions: StaffPermission[];
}

export type StaffPermission =
  // Clients
  | "clients.view"
  | "clients.manage"
  // Fournisseurs
  | "suppliers.view"
  | "suppliers.manage"
  | "suppliers.validate_kyc"
  | "suppliers.subscription"
  // Partenaires
  | "partners.view"
  | "partners.manage"
  | "partners.payout"
  // Commandes & Ventes
  | "orders.view"
  | "orders.manage"
  // Livreurs & Logistique
  | "drivers.view"
  | "drivers.manage"
  | "deliveries.dispatch"
  // Finances
  | "finance.view"
  | "finance.cash"
  | "subscriptions.manage"
  // Catalogue & Produits
  | "products.moderate"
  | "properties.moderate"
  // Support
  | "tickets.handle"
  // Système
  | "staff.manage"
  | "settings.system";

export const ALL_STAFF_POSITIONS: Record<StaffPosition, StaffPositionDefinition> = {
  SUB_ADMIN: {
    id: "SUB_ADMIN",
    label: "Sous-Administrateur Général",
    description: "Accès étendu à l'administration, supervision globale de la plateforme.",
    icon: "👑",
    defaultPermissions: [
      "clients.view", "clients.manage",
      "suppliers.view", "suppliers.manage", "suppliers.validate_kyc", "suppliers.subscription",
      "partners.view", "partners.manage", "partners.payout",
      "orders.view", "orders.manage",
      "drivers.view", "drivers.manage", "deliveries.dispatch",
      "finance.view", "finance.cash", "subscriptions.manage",
      "products.moderate", "properties.moderate",
      "tickets.handle"
    ]
  },
  GESTIONNAIRE_ADMIN: {
    id: "GESTIONNAIRE_ADMIN",
    label: "Gestionnaire Administratif",
    description: "Vérification des KYC, gestion des clients, modération des boutiques partenaires.",
    icon: "📋",
    defaultPermissions: [
      "clients.view", "clients.manage",
      "suppliers.view", "suppliers.manage", "suppliers.validate_kyc", "suppliers.subscription",
      "partners.view",
      "tickets.handle"
    ]
  },
  RESPONSABLE_LOGISTIQUE: {
    id: "RESPONSABLE_LOGISTIQUE",
    label: "Responsable Logistique & Livraisons",
    description: "Gestion des chauffeurs/livreurs, suivi des commandes et acheminement.",
    icon: "🚚",
    defaultPermissions: [
      "orders.view", "orders.manage",
      "drivers.view", "drivers.manage", "deliveries.dispatch"
    ]
  },
  RESPONSABLE_FINANCIER: {
    id: "RESPONSABLE_FINANCIER",
    label: "Responsable Financier & Caisse",
    description: "Gestion de la caisse centrale, validation des dépôts et paiement des commissions.",
    icon: "💼",
    defaultPermissions: [
      "finance.view", "finance.cash", "subscriptions.manage",
      "partners.view", "partners.payout",
      "orders.view"
    ]
  },
  RESPONSABLE_CATALOGUE: {
    id: "RESPONSABLE_CATALOGUE",
    label: "Responsable Catalogue & BDD",
    description: "Modération des fiches produits, propriétés immobilières et intégrité du catalogue.",
    icon: "🗄️",
    defaultPermissions: [
      "products.moderate", "properties.moderate",
      "suppliers.view",
      "orders.view"
    ]
  },
  SUPPORT_CLIENT: {
    id: "SUPPORT_CLIENT",
    label: "Support Client & Assistance",
    description: "Traitement des tickets, assistance aux acheteurs et suivi des réclamations.",
    icon: "🎧",
    defaultPermissions: [
      "tickets.handle",
      "clients.view",
      "orders.view"
    ]
  }
};

export const ALL_STAFF_PERMISSIONS: { id: StaffPermission; label: string; group: string }[] = [
  // Clients
  { id: "clients.view", label: "Consulter la liste des clients", group: "Clients" },
  { id: "clients.manage", label: "Gérer / convertir les clients", group: "Clients" },
  // Fournisseurs
  { id: "suppliers.view", label: "Consulter les fournisseurs", group: "Fournisseurs" },
  { id: "suppliers.manage", label: "Créer / modifier les fournisseurs", group: "Fournisseurs" },
  { id: "suppliers.validate_kyc", label: "Valider les profils et pièces KYC", group: "Fournisseurs" },
  { id: "suppliers.subscription", label: "Gérer les périodes d'essai & abonnements", group: "Fournisseurs" },
  // Partenaires
  { id: "partners.view", label: "Consulter les partenaires et boutiques affiliées", group: "Partenaires" },
  { id: "partners.manage", label: "Créer et gérer les partenaires apporteurs d'affaires", group: "Partenaires" },
  { id: "partners.payout", label: "Effectuer les paiements de commissions aux partenaires", group: "Partenaires" },
  // Commandes
  { id: "orders.view", label: "Consulter les commandes et factures", group: "Commandes" },
  { id: "orders.manage", label: "Gérer et modifier le statut des commandes", group: "Commandes" },
  // Logistique
  { id: "drivers.view", label: "Consulter la flotte de livreurs", group: "Logistique" },
  { id: "drivers.manage", label: "Créer et gérer les chauffeurs / livreurs", group: "Logistique" },
  { id: "deliveries.dispatch", label: "Assigner les livraisons aux chauffeurs", group: "Logistique" },
  // Finances
  { id: "finance.view", label: "Consulter le tableau de bord financier", group: "Finances" },
  { id: "finance.cash", label: "Encaisser les dépôts et gérer la caisse", group: "Finances" },
  { id: "subscriptions.manage", label: "Gérer la facturation des abonnements", group: "Finances" },
  // Catalogue
  { id: "products.moderate", label: "Modérer et approuver les produits", group: "Catalogue" },
  { id: "properties.moderate", label: "Modérer les biens immobiliers et hôtels", group: "Catalogue" },
  // Support
  { id: "tickets.handle", label: "Répondre et traiter les tickets d'assistance", group: "Support" },
  // Système
  { id: "staff.manage", label: "Nommer ou révoquer des collaborateurs", group: "Administration" },
  { id: "settings.system", label: "Modifier les paramètres de la plateforme", group: "Administration" }
];

/**
 * Calcule l'ensemble des permissions d'un collaborateur à partir de ses postes cumulés
 * et d'éventuelles permissions personnalisées supplémentaires.
 */
export function resolveStaffPermissions(
  positions: StaffPosition[] = [],
  customPermissions: string[] = []
): string[] {
  const permSet = new Set<string>();

  positions.forEach((pos) => {
    const def = ALL_STAFF_POSITIONS[pos];
    if (def) {
      def.defaultPermissions.forEach((p) => permSet.add(p));
    }
  });

  customPermissions.forEach((p) => permSet.add(p));

  return Array.from(permSet);
}

/**
 * Vérifie si un collaborateur possède une permission donnée.
 * Le Super Admin possède TOUJOURS toutes les permissions.
 */
export function hasStaffPermission(user: any, permission: StaffPermission): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;

  // Récupérer depuis staffProfile ou rétro-compatibilité
  const staffProfile = user.staffProfile;
  if (staffProfile) {
    if (Array.isArray(staffProfile.permissions) && staffProfile.permissions.includes(permission)) {
      return true;
    }
    // Si des postes sont définis mais permissions pas calculées
    if (Array.isArray(staffProfile.positions)) {
      const resolved = resolveStaffPermissions(staffProfile.positions, staffProfile.permissions);
      if (resolved.includes(permission)) return true;
    }
  }

  // Rétro-compatibilité avec les anciens rôles statutaires
  const role = String(user.role || "").toUpperCase();
  if (role === "SUB_ADMIN" || role === "ADMIN" || role === "SUBADMIN") {
    return permission !== "staff.manage" && permission !== "settings.system";
  }
  if (role.includes("FINANCE")) {
    return ["finance.view", "finance.cash", "subscriptions.manage", "partners.view", "partners.payout", "orders.view"].includes(permission);
  }
  if (role.includes("DB") || role.includes("TECH")) {
    return ["products.moderate", "properties.moderate", "suppliers.view", "orders.view"].includes(permission);
  }
  if (role.includes("OPS")) {
    return ["orders.view", "orders.manage", "drivers.view", "drivers.manage", "deliveries.dispatch"].includes(permission);
  }

  return false;
}

