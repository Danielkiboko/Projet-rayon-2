/**
 * Module de gestion des abonnements, dépôts attendus et blocages des fournisseurs
 * Règle métier : Période d'essai de 15 jours à la création, puis dépôt attendu mensuel.
 * Si l'échéance est dépassée sans règlement, blocage automatique des publications et messageries.
 */

export const TRIAL_DURATION_DAYS = 15;
export const DEFAULT_MONTHLY_DEPOSIT = 50; // $50 par mois par défaut

export interface SupplierSubscriptionInfo {
  isBlocked: boolean;
  isTrial: boolean;
  status: "TRIAL" | "ACTIVE" | "EXPIRED" | "SUSPENDED_PAYMENT";
  daysLeft: number;
  formattedDueDate: string;
  depositAmount: number;
  reason?: string;
}

export function evaluateSupplierSubscription(userData: any): SupplierSubscriptionInfo {
  if (!userData) {
    return {
      isBlocked: false,
      isTrial: false,
      status: "ACTIVE",
      daysLeft: 0,
      formattedDueDate: "Non renseigné",
      depositAmount: DEFAULT_MONTHLY_DEPOSIT
    };
  }

  // Si c'est l'administrateur principal, un sous-admin, ou une boutique officielle de l'admin
  if (
    userData.role === "ADMIN" || 
    userData.role === "admin" || 
    userData.role === "SUB_ADMIN" ||
    userData.email === "danielkiboko218@gmail.com" ||
    userData.isOfficialAdminStore === true ||
    userData.isAdminSupplier === true
  ) {
    return {
      isBlocked: false,
      isTrial: false,
      status: "ACTIVE",
      daysLeft: 9999,
      formattedDueDate: (userData.isOfficialAdminStore || userData.isAdminSupplier) 
        ? "Boutique Officielle Admin (Exempté de frais)" 
        : "Illimité",
      depositAmount: 0
    };
  }

  // Si le compte a été expressément bloqué manuellement ou suspendu pour paiement
  if (userData.isBlocked === true || userData.subscriptionStatus === "SUSPENDED_PAYMENT") {
    return {
      isBlocked: true,
      isTrial: false,
      status: "SUSPENDED_PAYMENT",
      daysLeft: 0,
      formattedDueDate: "Échue - Paiement requis",
      depositAmount: userData.depositAmount || DEFAULT_MONTHLY_DEPOSIT,
      reason: "Dépôt attendu mensuel impayé. Les publications et la messagerie sont suspendues."
    };
  }

  if (!userData.subscriptionEndDate) {
    // Si aucune date n'est définie mais que c'est un fournisseur, on considère une période d'essai de 15j à partir de createdAt
    const created = userData.createdAt?.toDate ? userData.createdAt.toDate() : new Date();
    const dueDate = new Date(created);
    dueDate.setDate(dueDate.getDate() + TRIAL_DURATION_DAYS);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return {
        isBlocked: true,
        isTrial: false,
        status: "EXPIRED",
        daysLeft: 0,
        formattedDueDate: dueDate.toLocaleDateString("fr-FR"),
        depositAmount: userData.depositAmount || DEFAULT_MONTHLY_DEPOSIT,
        reason: "Période d'essai de 15 jours expirée. Veuillez régler votre dépôt mensuel pour débloquer votre compte."
      };
    }

    return {
      isBlocked: false,
      isTrial: true,
      status: "TRIAL",
      daysLeft: diffDays,
      formattedDueDate: dueDate.toLocaleDateString("fr-FR"),
      depositAmount: userData.depositAmount || DEFAULT_MONTHLY_DEPOSIT
    };
  }

  const isTrial = userData.subscriptionStatus === "TRIAL";
  const created = userData.createdAt?.toDate 
    ? userData.createdAt.toDate() 
    : (userData.createdAt ? new Date(userData.createdAt) : null);

  let endDate = userData.subscriptionEndDate.toDate 
    ? userData.subscriptionEndDate.toDate() 
    : new Date(userData.subscriptionEndDate);

  // Règle d'entreprise stricte : Le trial est de 15 jours maximum à la création, non 30 jours.
  // Si le compte a été initialisé avec 30 jours par erreur et sans personnalisation admin explicite,
  // on recadre l'échéance à 15 jours à compter de la création.
  if (isTrial && !userData.adminCustomTrial && created) {
    const maxOfficialTrialEnd = new Date(created);
    maxOfficialTrialEnd.setDate(maxOfficialTrialEnd.getDate() + TRIAL_DURATION_DAYS);
    if (endDate.getTime() > maxOfficialTrialEnd.getTime()) {
      endDate = maxOfficialTrialEnd;
    }
  }

  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return {
      isBlocked: true,
      isTrial: false,
      status: "EXPIRED",
      daysLeft: 0,
      formattedDueDate: endDate.toLocaleDateString("fr-FR"),
      depositAmount: userData.depositAmount || DEFAULT_MONTHLY_DEPOSIT,
      reason: isTrial
        ? "Période d'essai de 15 jours arrivée à terme. Dépôt mensuel requis pour continuer à publier et échanger avec les clients."
        : "Échéance d'abonnement mensuel dépassée. Dépôt attendu pour réactiver les publications et la messagerie."
    };
  }

  return {
    isBlocked: false,
    isTrial: isTrial,
    status: isTrial ? "TRIAL" : "ACTIVE",
    daysLeft: diffDays,
    formattedDueDate: endDate.toLocaleDateString("fr-FR"),
    depositAmount: userData.depositAmount || DEFAULT_MONTHLY_DEPOSIT
  };
}
