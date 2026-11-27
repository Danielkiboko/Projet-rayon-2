"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, X, Search, Store, Shield, Home, ShoppingBag, Zap,
  CheckCircle2, Users, ArrowRight, Building, Filter, Sparkles
} from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc, setDoc, onSnapshot, orderBy, limit } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { hasAdminAccess, isTeamMember, SUPER_ADMIN_EMAILS } from "@/lib/permissions";
import AdminBroadcastModal from "@/modules/admin/components/AdminBroadcastModal";
import ValidationSuccessView from "@/modules/shared/components/ui/ValidationSuccessView";

interface Supplier {
  id: string;
  name: string;
  email: string;
  rayon: string;
  assignedRayons?: string[];
  status: string;
  profileUpdateStatus?: string;
  supplierApplicationStatus?: string;
  supplierApplication?: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
    commune?: string;
    address?: string;
    projectDescription?: string;
    paymentRef?: string;
    amountPaid?: number;
    paymentMethod?: string;
    submittedAt?: string;
  } | null;
  pendingProfile?: any;
  subscriptionStatus?: string;
  subscriptionEndDate?: any;
  role?: string;
  createdBy?: string;
  parentSupplierId?: string;
  businessType?: string;
  serviceAttached?: string;
  isOfficialAdminStore?: boolean;
  isAdminSupplier?: boolean;
  referralCode?: string;
  referralCodeUsed?: string;
  createdAt?: any;
  phone?: string;
  whatsappPhone?: string;
  payoutPhone?: string;
  payoutProvider?: string;
  address?: string;
  companyName?: string;
  rccm?: string;
  idNat?: string;
  nif?: string;
  idDocumentType?: string;
  idDocumentNumber?: string;
  idDocumentFrontUrl?: string;
  idDocumentBackUrl?: string;
  referredByPartnerId?: string;
  partnerReferral?: boolean;
  partnerName?: string;
  partnerCode?: string;
  nationality?: string;
  kycStatus?: string;
  logoUrl?: string;
}

export default function SuppliersPage() {
  const { user, userData } = useAuth();
  const callerEmailLower = (user?.email || "").toLowerCase().trim();
  const callerRoleUpper = String(userData?.role || "").toUpperCase();
  const callerPositionsUpper: string[] = Array.isArray(userData?.staffProfile?.positions)
    ? userData.staffProfile.positions.map((p: any) => String(p).toUpperCase())
    : [];
  const STRICT_DELETE_ADMIN_ROLES = ["SUB_ADMIN", "SUBADMIN", "SOUS_ADMIN", "SOUS_ADMIN_GENERAL", "ADMIN"];
  const canDeleteSupplier =
    SUPER_ADMIN_EMAILS.includes(callerEmailLower) ||
    callerRoleUpper === "SUPER_ADMIN" ||
    callerRoleUpper === "SUPERADMIN" ||
    userData?.isSuperAdmin === true ||
    userData?.isAdmin === true ||
    STRICT_DELETE_ADMIN_ROLES.includes(callerRoleUpper) ||
    callerPositionsUpper.some((p) => STRICT_DELETE_ADMIN_ROLES.includes(p));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isAccessModalOpen, setIsAccessModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [selectedSupplierSub, setSelectedSupplierSub] = useState<Supplier | null>(null);
  const [selectedSupplierToApprove, setSelectedSupplierToApprove] = useState<Supplier | null>(null);
  const [selectedSupplierForAccess, setSelectedSupplierForAccess] = useState<Supplier | null>(null);
  const [newSubDate, setNewSubDate] = useState("");
  const [daysToAdd, setDaysToAdd] = useState<number>(15);
  const [selectedSubStatus, setSelectedSubStatus] = useState<"TRIAL" | "ACTIVE" | "SUSPENDED_PAYMENT">("TRIAL");
  const [customExpiryDate, setCustomExpiryDate] = useState<string>("");

  // Filters state: dropdowns for Rayon, Source/Partner, and Subscription Status
  const [selectedRayonFilter, setSelectedRayonFilter] = useState<"all" | "immo" | "mode" | "connect" | "saveurs" | "pending">("all");
  const [selectedSourceFilter, setSelectedSourceFilter] = useState<string>("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "trial" | "active" | "expired" | "official">("all");
  const [partnersList, setPartnersList] = useState<{ id: string; name: string; code: string }[]>([]);

  // Rayon selection state for access modal & application evaluation modal
  const [selectedRayons, setSelectedRayons] = useState<string[]>([]);
  const [approvalRayons, setApprovalRayons] = useState<string[]>([]);
  const [approvalDays, setApprovalDays] = useState<number>(30);
  const [approvalNote, setApprovalNote] = useState<string>("");
  const [isApprovingApp, setIsApprovingApp] = useState<boolean>(false);

  const [search, setSearch] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState("");

  // Form states for creation (Strictly commercial vendors)
  const [supplierCategory, setSupplierCategory] = useState<"immo" | "mode" | "connect" | "saveurs">("immo");
  const [isOfficialAdminStore, setIsOfficialAdminStore] = useState(false);
  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [rayon, setRayon] = useState("immo");
  const [notificationMethod, setNotificationMethod] = useState<'email' | 'sms'>("email");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState("SUPPLIER_IMMO");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Fetch suppliers via fast server Admin API (with instant sessionStorage cache + client SDK fallback)
  const fetchSuppliers = async (silent = false) => {
    if (!user) return;
    if (!silent) {
      try {
        const cached = sessionStorage.getItem("rayons_admin_suppliers_cache_v1");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed.suppliers) && parsed.suppliers.length > 0) {
            setSuppliers(parsed.suppliers);
            if (Array.isArray(parsed.partnersList)) setPartnersList(parsed.partnersList);
            setIsLoading(false);
          } else {
            setIsLoading(true);
          }
        } else {
          setIsLoading(true);
        }
      } catch {
        setIsLoading(true);
      }
    }

    try {
      // 1. Fast server-side fetch via /api/admin/suppliers/list
      const token = await user.getIdToken();
      const apiRes = await fetch("/api/admin/suppliers/list", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.success && Array.isArray(apiData.suppliers)) {
          setSuppliers(apiData.suppliers);
          if (Array.isArray(apiData.partnersList)) {
            setPartnersList(apiData.partnersList);
          }
          try {
            sessionStorage.setItem(
              "rayons_admin_suppliers_cache_v1",
              JSON.stringify({
                suppliers: apiData.suppliers,
                partnersList: apiData.partnersList || [],
              })
            );
          } catch { }
          setIsLoading(false);
          return;
        }
      }

      // 2. Fallback: client SDK queries if API is unavailable
      const supplierRoles1 = [
        "SUPPLIER", "FOURNISSEUR", "SUB_SUPPLIER",
        "SUPPLIER_IMMO", "SUPPLIER_MODE", "SUPPLIER_CONNECT", "SUPPLIER_SAVEURS"
      ];
      const supplierRoles2 = [
        "supplier", "fournisseur", "sub_supplier",
        "supplier_immo", "supplier_mode", "supplier_connect", "supplier_saveurs"
      ];

      const q1 = query(collection(db, "users"), where("role", "in", supplierRoles1));
      const q2 = query(collection(db, "users"), where("role", "in", supplierRoles2));
      const q3 = query(collection(db, "users"), where("isSupplier", "==", true));
      const qPartners1 = query(collection(db, "users"), where("isPartner", "==", true));
      const qPartners2 = query(collection(db, "users"), where("role", "==", "PARTNER"));

      const [snap1, snap2, snap3, snapPartners1, snapPartners2] = await Promise.all([
        getDocs(q1),
        getDocs(q2),
        getDocs(q3),
        getDocs(qPartners1),
        getDocs(qPartners2)
      ]);

      const partnersMap: Record<string, { name: string; code: string }> = {};
      const processPartnerDoc = (pDoc: any) => {
        if (partnersMap[pDoc.id]) return;
        const pd = pDoc.data();
        partnersMap[pDoc.id] = {
          name: pd.displayName || pd.name || pd.company || pd.email || "Partenaire",
          code: pd.partnerCode || pd.referralCode || "---",
        };
      };
      snapPartners1.forEach(processPartnerDoc);
      snapPartners2.forEach(processPartnerDoc);

      setPartnersList(
        Object.entries(partnersMap)
          .map(([id, info]) => ({ id, name: info.name, code: info.code }))
          .sort((a, b) => a.name.localeCompare(b.name))
      );

      const fetchedSuppliers: Supplier[] = [];
      const seenIds = new Set<string>();

      const processSnap = (docSnap: any) => {
        if (seenIds.has(docSnap.id)) return;
        seenIds.add(docSnap.id);
        const data = docSnap.data();

        // Skip internal staff / fonctionnaires from commercial suppliers list
        if (data.isInternalStaff || isTeamMember(data)) {
          return;
        }

        const partnerId = data.referredByPartnerId || data.referredBy || (data.creatorRole === "PARTNER" ? data.createdBy : null);
        const partnerInfo = partnerId ? partnersMap[partnerId] : null;

        fetchedSuppliers.push({
          id: docSnap.id,
          name: data.companyName || data.company || data.displayName || data.name || "Sans nom",
          email: data.email || "",
          rayon: data.rayon || (Array.isArray(data.assignedRayons) && data.assignedRayons[0]) || "Non assigné",
          assignedRayons: data.assignedRayons || (data.rayon ? [data.rayon] : []),
          status: data.status === "active" || data.status === "Disponible" ? "Actif" : (data.status === "PENDING_APPROVAL" ? "En attente" : "Inactif"),
          profileUpdateStatus: data.profileUpdateStatus,
          pendingProfile: data.pendingProfile,
          subscriptionStatus: data.subscriptionStatus,
          subscriptionEndDate: data.subscriptionEndDate,
          role: data.role,
          createdBy: data.createdBy,
          parentSupplierId: data.parentSupplierId || data.createdBy,
          referredByPartnerId: partnerId || undefined,
          partnerReferral: Boolean(data.partnerReferral || partnerId),
          partnerName: partnerInfo?.name,
          partnerCode: partnerInfo?.code,
          businessType: data.businessType,
          serviceAttached: data.serviceAttached,
          isOfficialAdminStore: Boolean(data.isOfficialAdminStore || data.isAdminSupplier),
          isAdminSupplier: Boolean(data.isAdminSupplier),
          referralCode: data.referralCode,
          referralCodeUsed: data.referralCodeUsed,
          createdAt: data.createdAt, // Store createdAt to sort later
          phone: data.phone || data.phoneNumber || data.pendingProfile?.phone || "",
          whatsappPhone: data.whatsappPhone || data.pendingProfile?.whatsappPhone || "",
          payoutPhone: data.payoutPhone || data.pendingProfile?.payoutPhone || "",
          payoutProvider: data.payoutProvider || data.pendingProfile?.payoutProvider || "MPESA",
          address: data.address || data.pendingProfile?.address || "",
          companyName: data.companyName || data.company || data.pendingProfile?.companyName || "",
          rccm: data.rccm || data.pendingProfile?.rccm || "",
          idNat: data.idNat || data.pendingProfile?.idNat || "",
          nif: data.nif || data.pendingProfile?.nif || "",
          idDocumentType: data.idDocumentType || data.pendingProfile?.idDocumentType || "",
          idDocumentNumber: data.idDocumentNumber || data.pendingProfile?.idDocumentNumber || "",
          idDocumentFrontUrl: data.idDocumentFrontUrl || data.pendingProfile?.idDocumentFrontUrl || "",
          idDocumentBackUrl: data.idDocumentBackUrl || data.pendingProfile?.idDocumentBackUrl || "",
          nationality: data.nationality || data.pendingProfile?.nationality || "Congolaise (RDC)",
          kycStatus: data.kycStatus || "",
          logoUrl: data.logoUrl || data.logo || data.pendingProfile?.logoUrl || "",
        });
      };

      snap1.forEach(processSnap);
      snap2.forEach(processSnap);
      snap3.forEach(processSnap);

      // Sort locally by createdAt desc
      fetchedSuppliers.sort((a: any, b: any) => {
        const tA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const tB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return tB - tA;
      });

      setSuppliers(fetchedSuppliers);
    } catch (error: any) {
      console.error("Error fetching suppliers:", error);
      setError("Erreur d'accès aux fournisseurs : " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchSuppliers();
  }, [user?.uid]);

  const openReviewModal = (supplier: Supplier) => {
    setSelectedSupplierToApprove(supplier);
    const existingRayons = getSupplierRayons(supplier).filter((r) =>
      ["immo", "mode", "connect", "saveurs"].includes(r)
    );
    setApprovalRayons(existingRayons);
    setApprovalDays(30);
    setApprovalNote("");
    setIsReviewModalOpen(true);
  };

  const handleEvaluateApplication = async (action: "approve" | "reject") => {
    if (!selectedSupplierToApprove) return;
    if (action === "approve" && approvalRayons.length === 0) {
      setError("Veuillez sélectionner au moins un rayon à attribuer (Immo, Mode, Connect ou Saveurs).");
      return;
    }

    setIsApprovingApp(true);
    setError("");
    setSuccessMessage("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Session expirée. Veuillez vous reconnecter.");

      const res = await fetch("/api/admin/suppliers/approve-application", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supplierId: selectedSupplierToApprove.id,
          action,
          assignedRayons: approvalRayons,
          subscriptionDays: approvalDays,
          adminNote: approvalNote.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors du traitement de la demande.");
      }

      setSuccessMessage(data.message || "Décision enregistrée et candidat notifié !");
      setIsReviewModalOpen(false);
      setSelectedSupplierToApprove(null);
      fetchSuppliers();
    } catch (err: any) {
      console.error("Evaluate application error:", err);
      setError(err.message || "Erreur lors de l'évaluation du projet.");
    } finally {
      setIsApprovingApp(false);
    }
  };

  const openAccessModal = (supplier: Supplier) => {
    setSelectedSupplierForAccess(supplier);
    setSelectedRayons(getSupplierRayons(supplier));
    setIsAccessModalOpen(true);
  };

  const confirmApproveProfile = async () => {
    if (!selectedSupplierToApprove) return;
    setIsLoading(true);
    try {
      const ref = doc(db, "users", selectedSupplierToApprove.id);
      const pending = selectedSupplierToApprove.pendingProfile || {};
      await updateDoc(ref, {
        ...pending,
        pendingProfile: null,
        profileUpdateStatus: "APPROVED",
        kycStatus: "VERIFIED",
        status: "active",
        isBlocked: false,
        isSuspended: false,
        kycVerifiedAt: new Date().toISOString(),
      });

      // Synchroniser avec la collection suppliers
      try {
        const supRef = doc(db, "suppliers", selectedSupplierToApprove.id);
        await setDoc(supRef, {
          status: "active",
          isBlocked: false,
          kycStatus: "VERIFIED",
          updatedAt: new Date(),
        }, { merge: true });
      } catch (e) {
        console.warn("Sync suppliers non bloquant:", e);
      }

      setSuccessMessage("Profil et dossier d'identité approuvés en base de données. Fournisseur actif !");
      setIsReviewModalOpen(false);
      setSelectedSupplierToApprove(null);
      fetchSuppliers();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de l'approbation.");
      setIsLoading(false);
    }
  };

  const openSubModal = (supplier: Supplier) => {
    setSelectedSupplierId(supplier.id);
    setSelectedSupplierSub(supplier);
    const status = supplier.subscriptionStatus || "TRIAL";
    setSelectedSubStatus(status === "ACTIVE" ? "ACTIVE" : status === "SUSPENDED_PAYMENT" ? "SUSPENDED_PAYMENT" : "TRIAL");
    setDaysToAdd(15);
    setCustomExpiryDate("");
    setIsSubModalOpen(true);
  };

  const handleUpdateSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) return;
    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Vous devez être connecté.");
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/admin/suppliers/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supplierId: selectedSupplierId,
          subscriptionStatus: selectedSubStatus,
          daysToAdd: Number(daysToAdd),
          customExpiryDate: customExpiryDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de la mise à jour de l'abonnement.");
      }

      setSuccessMessage(data.message || `Statut et échéance mis à jour (${selectedSubStatus === "TRIAL" ? "Période d'essai" : selectedSubStatus === "ACTIVE" ? "Abonnement Actif" : "Suspendu"}).`);
      setIsSubModalOpen(false);
      setSelectedSupplierSub(null);
      fetchSuppliers();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de la mise à jour de l'abonnement.");
      setIsLoading(false);
    }
  };

  const handleQuickReactivate = async (supplier: Supplier) => {
    if (!confirm(`Réactiver immédiatement le compte fournisseur de "${supplier.name}" avec 15 jours d'essai ?`)) {
      return;
    }
    setIsLoading(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Vous devez être connecté.");
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/admin/suppliers/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          supplierId: supplier.id,
          action: "REACTIVATE",
          daysToAdd: 15,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de la réactivation.");
      }

      setSuccessMessage(data.message || `Compte fournisseur de "${supplier.name}" réactivé avec succès !`);
      fetchSuppliers();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erreur lors de la réactivation.");
      setIsLoading(false);
    }
  };

  const handleUpdateAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForAccess) return;
    setIsLoading(true);
    try {
      const ref = doc(db, "users", selectedSupplierForAccess.id);
      // We set assignedRayons. Also update 'rayon' to the first one for backward compatibility
      await updateDoc(ref, {
        assignedRayons: selectedRayons,
        rayon: selectedRayons.length > 0 ? selectedRayons[0] : "",
        serviceAttached: selectedRayons.length > 0 ? selectedRayons[0] : ""
      });
      setSuccessMessage("Accès mis à jour.");
      setIsAccessModalOpen(false);
      fetchSuppliers();
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la mise à jour des accès.");
      setIsLoading(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce fournisseur ? Cette action effacera toutes ses données (produits, propriétés, accès).")) {
      return;
    }

    setIsLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Vous devez être connecté.");

      const targetSup = suppliers.find(s => s.id === supplierId);
      const response = await fetch("/api/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: supplierId, email: targetSup?.email || undefined }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la suppression");
      }

      setSuppliers(prev => prev.filter(s => s.id !== supplierId));
      setSuccessMessage("Fournisseur et données associées supprimés avec succès.");
    } catch (err: any) {
      console.error("Delete supplier error:", err);
      setError(err.message || "Erreur lors de la suppression");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = (preselectedCategory?: "immo" | "mode" | "connect" | "saveurs") => {
    const cat = preselectedCategory || (selectedRayonFilter !== "all" && selectedRayonFilter !== "pending" ? selectedRayonFilter : "immo");
    setSupplierCategory(cat);
    if (cat === "immo") {
      setRole("SUPPLIER_IMMO");
      setRayon("immo");
    } else if (cat === "mode") {
      setRole("supplier");
      setRayon("mode");
    } else if (cat === "connect") {
      setRole("supplier");
      setRayon("connect");
    } else if (cat === "saveurs") {
      setRole("supplier");
      setRayon("saveurs");
    }
    setError("");
    setSuccessMessage("");
    setIsModalOpen(true);
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error("Vous devez être connecté pour effectuer cette action.");
      }

      // Generate a strong random password since the user will reset it anyway
      const randomPassword = Math.random().toString(36).slice(-10) + "A1@";
      const displayName = name || `${firstName} ${lastName}`.trim();

      const roleToCreate = supplierCategory === "immo" ? "SUPPLIER_IMMO" : (supplierCategory === "saveurs" ? "SUPPLIER_SAVEURS" : "supplier");
      const primaryRayon = supplierCategory;

      // 1. Create the user account via API
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email,
          password: randomPassword,
          displayName: displayName,
          roleToCreate: roleToCreate,
          extraData: {
            rayon: primaryRayon,
            firstName,
            lastName,
            assignedRayons: [primaryRayon],
            serviceAttached: primaryRayon,
            isOfficialAdminStore: Boolean(isOfficialAdminStore),
            isAdminSupplier: Boolean(isOfficialAdminStore),
            ...(supplierCategory === 'immo' ? { businessType: 'IMMOBILIER' } : (supplierCategory === 'saveurs' ? { businessType: 'RESTAURATION' } : {}))
          },
          notificationMethod,
          phoneNumber: notificationMethod === 'sms' ? phoneNumber : undefined
        }),
      });

      const rawText = await response.text();
      let data: any = {};
      try {
        data = rawText ? JSON.parse(rawText) : {};
      } catch {
        throw new Error(
          `Le serveur a mis trop de temps à répondre (HTTP ${response.status}). Rafraîchis la liste des fournisseurs pour vérifier si le compte a bien été créé.`
        );
      }

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la création du fournisseur.");
      }

      if (notificationMethod === 'email') {
        console.log("Email d'onboarding géré par le backend.");
      }

      // Reset form and close modal
      setName("");
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhoneNumber("");
      setRayon("immo");
      setRole("SUPPLIER_IMMO");
      setSupplierCategory("immo");
      setIsOfficialAdminStore(false);
      setIsModalOpen(false);

      const methodMsg = notificationMethod === 'email'
        ? `Un e-mail a été envoyé à ${email} pour qu'il configure son mot de passe.`
        : `Un SMS a été envoyé au ${phoneNumber} avec le mot de passe.`;
      setSuccessMessage(`Le compte fournisseur (${supplierCategory === 'immo' ? 'Immobilier & Hôtels' : supplierCategory === 'mode' ? 'Mode' : supplierCategory === 'connect' ? 'Connect' : supplierCategory === 'saveurs' ? 'Saveurs & Resto' : 'Sous-Admin'}) a été créé avec succès. ${methodMsg}`);
      fetchSuppliers(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getSupplierRayons = (s: Supplier): string[] => {
    const set = new Set<string>();
    if (Array.isArray(s.assignedRayons)) {
      s.assignedRayons.forEach((r) => {
        if (typeof r === "string" && r.trim()) set.add(r.toLowerCase().trim());
      });
    }
    if (s.rayon && typeof s.rayon === "string" && s.rayon !== "Non assigné") {
      set.add(s.rayon.toLowerCase().trim());
    }
    if (
      s.role === "SUPPLIER_IMMO" ||
      s.role === "supplier_immo" ||
      s.businessType === "IMMOBILIER" ||
      (typeof s.rayon === "string" && s.rayon.toLowerCase().includes("immo"))
    ) {
      set.add("immo");
    }
    if (
      s.role === "SUPPLIER_SAVEURS" ||
      s.role === "supplier_saveurs" ||
      s.businessType === "RESTAURATION" ||
      (typeof s.rayon === "string" && (s.rayon.toLowerCase().includes("saveur") || s.rayon.toLowerCase().includes("resto") || s.rayon.toLowerCase().includes("cuisine")))
    ) {
      set.add("saveurs");
    }
    if (s.serviceAttached && typeof s.serviceAttached === "string") {
      set.add(s.serviceAttached.toLowerCase().trim());
    }
    // Si c'est un sous-agent, hériter des rayons du fournisseur parent
    if (s.role === "SUB_SUPPLIER" || s.role === "sub_supplier") {
      const parent = suppliers.find(p => p.id === s.parentSupplierId || p.id === s.createdBy);
      if (parent) {
        if (parent.rayon && typeof parent.rayon === "string" && parent.rayon !== "Non assigné") {
          set.add(parent.rayon.toLowerCase().trim());
        }
        if (parent.role === "SUPPLIER_IMMO" || parent.businessType === "IMMOBILIER") {
          set.add("immo");
        }
        if (Array.isArray(parent.assignedRayons)) {
          parent.assignedRayons.forEach(r => set.add(r.toLowerCase().trim()));
        }
      }
    }
    return Array.from(set);
  };

  const immoSuppliersCount = suppliers.filter((s) => getSupplierRayons(s).includes("immo")).length;
  const modeSuppliersCount = suppliers.filter((s) => getSupplierRayons(s).includes("mode")).length;
  const connectSuppliersCount = suppliers.filter((s) => getSupplierRayons(s).includes("connect")).length;
  const saveursSuppliersCount = suppliers.filter((s) => getSupplierRayons(s).includes("saveurs")).length;

  const pendingProfilesCount = suppliers.filter(
    (s) =>
      s.supplierApplicationStatus === "PENDING_APPROVAL" ||
      s.profileUpdateStatus === "PENDING_APPROVAL" ||
      s.status === "PENDING_APPROVAL"
  ).length;

  const partnerSuppliersCount = suppliers.filter((s) => s.partnerReferral || !!s.referredByPartnerId).length;
  const directSuppliersCount = suppliers.length - partnerSuppliersCount;

  const filteredSuppliers = suppliers.filter((s) => {
    // 1. Rayon / Pending approval filter
    if (selectedRayonFilter === "pending") {
      if (
        s.supplierApplicationStatus !== "PENDING_APPROVAL" &&
        s.profileUpdateStatus !== "PENDING_APPROVAL" &&
        s.status !== "PENDING_APPROVAL"
      ) return false;
    } else if (selectedRayonFilter === "immo") {
      if (!getSupplierRayons(s).includes("immo")) return false;
    } else if (selectedRayonFilter === "mode") {
      if (!getSupplierRayons(s).includes("mode")) return false;
    } else if (selectedRayonFilter === "connect") {
      if (!getSupplierRayons(s).includes("connect")) return false;
    } else if (selectedRayonFilter === "saveurs") {
      if (!getSupplierRayons(s).includes("saveurs")) return false;
    }

    // 2. Source / Specific Partner filter
    if (selectedSourceFilter === "partner") {
      if (!s.partnerReferral && !s.referredByPartnerId) return false;
    } else if (selectedSourceFilter === "direct") {
      if (s.partnerReferral || !!s.referredByPartnerId) return false;
    } else if (selectedSourceFilter.startsWith("partner:")) {
      const targetPartnerId = selectedSourceFilter.slice("partner:".length);
      if (s.referredByPartnerId !== targetPartnerId) return false;
    }

    // 3. Subscription Status filter
    if (selectedStatusFilter !== "all") {
      const isOfficial = Boolean(s.isOfficialAdminStore || s.isAdminSupplier);
      const endDate = s.subscriptionEndDate
        ? new Date(s.subscriptionEndDate.toDate ? s.subscriptionEndDate.toDate() : s.subscriptionEndDate)
        : null;
      const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
      const isExpired = !isOfficial && daysLeft <= 0;
      const subStatus = s.subscriptionStatus || "TRIAL";

      if (selectedStatusFilter === "official" && !isOfficial) return false;
      if (selectedStatusFilter === "expired" && !isExpired) return false;
      if (selectedStatusFilter === "trial" && (isOfficial || isExpired || subStatus !== "TRIAL")) return false;
      if (selectedStatusFilter === "active" && (isOfficial || isExpired || subStatus !== "ACTIVE")) return false;
    }

    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      s.rayon.toLowerCase().includes(q) ||
      (s.partnerName && s.partnerName.toLowerCase().includes(q)) ||
      (s.partnerCode && s.partnerCode.toLowerCase().includes(q))
    );
  });

  const availableRayons = [
    { id: "immo", label: "Immobilier & Hôtellerie", icon: "🏠", desc: "Appartements, villas & hôtels" },
    { id: "mode", label: "Vêtements & Mode", icon: "👗", desc: "Vêtements, chaussures & accessoires" },
    { id: "connect", label: "Matériel & Réseau (Connect)", icon: "⚡", desc: "Électronique, télécoms & connectique" },
    { id: "saveurs", label: "Gastronomie & Cuisine (Saveurs)", icon: "🍽️", desc: "Restaurants, traiteurs & ustensiles" }
  ];

  // ─── État Broadcast ─────────────────────────────────────────────────────────
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);

  return (
    <div className="space-y-5 pb-16">
      {/* Top Header Exécutif */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">Fournisseurs &amp; Boutiques</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white/[0.06] text-gray-300 border border-white/10">
              {suppliers.length} total
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Gestion compartimentée des fournisseurs par rayon (Immobilier, Mode, Connect, Saveurs).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={() => setIsBroadcastOpen(true)}
            className="inline-flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-gray-200 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
          >
            <span>Écrire à tous</span>
          </button>
          <button
            onClick={() => handleOpenCreateModal()}
            className="inline-flex items-center gap-1.5 bg-[#C7D300] hover:bg-[#b8c400] text-[#0F1D27] px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>
              {selectedRayonFilter === "immo"
                ? "Nouveau Immo"
                : selectedRayonFilter === "mode"
                  ? "Nouveau Mode"
                  : selectedRayonFilter === "connect"
                    ? "Nouveau Connect"
                    : selectedRayonFilter === "saveurs"
                      ? "Nouveau Saveurs"
                      : "Nouveau Fournisseur"}
            </span>
          </button>
        </div>
      </div>

      {/* Alerte Profils Fournisseur en attente de validation */}
      {pendingProfilesCount > 0 && (
        <div className="p-4 bg-amber-500/15 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{pendingProfilesCount} profil{pendingProfilesCount > 1 ? "s" : ""} fournisseur en attente de validation</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold uppercase animate-pulse">Action requise</span>
              </h4>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Des commerçants ont mis à jour leurs identifiants légaux (RCCM, NIF, ID Nat) ou pièces d'identité. Cliquez pour vérifier et valider leur profil.
              </p>
            </div>
          </div>
          <button
            onClick={() => setSelectedRayonFilter("pending")}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer shrink-0"
          >
            Examiner les dossiers ({pendingProfilesCount})
          </button>
        </div>
      )}

      {successMessage ? (
        <ValidationSuccessView
          title="C'est fait !"
          message={successMessage}
          badgeLabel="Dossier Fournisseur Validé & Mis à Jour"
          onDone={() => setSuccessMessage("")}
        />
      ) : (
        /* Main Table Card with Clean Dropdown Filters */
        <div className="bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          {/* Unified Filter Bar (Search + Dropdowns) */}
          <div className="p-4 border-b border-white/10 bg-black/20 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              {/* 1. Search Input */}
              <div className="lg:col-span-4">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Recherche
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                  <input
                    type="text"
                    placeholder="Nom de boutique, email, téléphone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 bg-[#142430] border border-white/10 rounded-xl focus:outline-none focus:border-white/30 text-white text-xs transition-all"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Rayon Dropdown */}
              <div className="lg:col-span-3">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Rayon commercial
                </label>
                <select
                  value={selectedRayonFilter}
                  onChange={(e) => setSelectedRayonFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#142430] border border-white/10 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  <option value="all">Tous les rayons ({suppliers.length})</option>
                  <option value="immo">Immobilier &amp; Hôtels ({immoSuppliersCount})</option>
                  <option value="mode">Mode &amp; Vêtements ({modeSuppliersCount})</option>
                  <option value="connect">Matériel &amp; Connect ({connectSuppliersCount})</option>
                  <option value="saveurs">Saveurs &amp; Restauration ({saveursSuppliersCount})</option>
                  {pendingProfilesCount > 0 && (
                    <option value="pending">À valider KYC ({pendingProfilesCount})</option>
                  )}
                </select>
              </div>

              {/* 3. Origine / Partenaire Dropdown */}
              <div className="lg:col-span-3">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Origine / Partenaire
                </label>
                <select
                  value={selectedSourceFilter}
                  onChange={(e) => setSelectedSourceFilter(e.target.value)}
                  className="w-full px-3 py-2 bg-[#142430] border border-white/10 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  <option value="all">Toutes les origines ({suppliers.length})</option>
                  <option value="direct">Direction Centrale ({directSuppliersCount})</option>
                  <option value="partner">Tous les Partenaires ({partnerSuppliersCount})</option>
                  {partnersList.length > 0 && (
                    <optgroup label="Filtrer par Partenaire">
                      {partnersList.map((p) => {
                        const count = suppliers.filter((s) => s.referredByPartnerId === p.id).length;
                        return (
                          <option key={p.id} value={`partner:${p.id}`}>
                            {p.name} ({p.code}) — {count}
                          </option>
                        );
                      })}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* 4. Subscription Status Dropdown */}
              <div className="lg:col-span-2">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                  Abonnement
                </label>
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 bg-[#142430] border border-white/10 rounded-xl text-xs text-gray-200 focus:outline-none focus:border-white/30 cursor-pointer"
                >
                  <option value="all">Tous les statuts</option>
                  <option value="trial">En période d&apos;essai</option>
                  <option value="active">Abonnement actif</option>
                  <option value="expired">Expiré</option>
                  <option value="official">Boutiques Officielles</option>
                </select>
              </div>
            </div>

            {/* Summary & Reset Row */}
            <div className="flex items-center justify-between pt-1 text-xs text-gray-400">
              <span>
                <strong className="text-white">{filteredSuppliers.length}</strong> fournisseur{filteredSuppliers.length > 1 ? "s" : ""} affiché{filteredSuppliers.length > 1 ? "s" : ""}
              </span>
              {(selectedRayonFilter !== "all" || selectedSourceFilter !== "all" || selectedStatusFilter !== "all" || search.trim() !== "") && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRayonFilter("all");
                    setSelectedSourceFilter("all");
                    setSelectedStatusFilter("all");
                    setSearch("");
                  }}
                  className="text-xs text-gray-300 hover:text-white underline cursor-pointer"
                >
                  Réinitialiser les filtres
                </button>
              )}
            </div>
          </div>

          {/* Desktop Table (>= md) — Sober & Compartmentalized */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-xs text-gray-300">
              <thead className="text-[11px] uppercase bg-black/30 text-gray-400 tracking-wider border-b border-white/10">
                <tr>
                  <th className="px-5 py-3.5 font-semibold">Fournisseur / Boutique</th>
                  <th className="px-5 py-3.5 font-semibold">Origine / Partenaire</th>
                  <th className="px-5 py-3.5 font-semibold">Rayon</th>
                  <th className="px-5 py-3.5 font-semibold">Abonnement</th>
                  <th className="px-5 py-3.5 font-semibold">Dossier KYC</th>
                  <th className="px-5 py-3.5 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-white/40 border-t-transparent rounded-full animate-spin" />
                        <span>Chargement des fournisseurs...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredSuppliers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <div className="max-w-md mx-auto flex flex-col items-center">
                        <h3 className="text-sm font-semibold text-white mb-1">Aucun fournisseur trouvé</h3>
                        <p className="text-xs text-gray-400 mb-4">
                          Aucun compte ne correspond aux filtres sélectionnés.
                        </p>
                        <button
                          onClick={() => {
                            setSelectedRayonFilter("all");
                            setSelectedSourceFilter("all");
                            setSelectedStatusFilter("all");
                            setSearch("");
                          }}
                          className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors cursor-pointer"
                        >
                          Afficher toute la liste
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSuppliers.map((supplier) => {
                    const supplierRayons = getSupplierRayons(supplier);
                    const isImmo = supplierRayons.includes("immo");
                    const isMode = supplierRayons.includes("mode");
                    const isConnect = supplierRayons.includes("connect");
                    const isOfficial = Boolean(supplier.isOfficialAdminStore || supplier.isAdminSupplier);

                    const rayonLabel = isImmo
                      ? "Immobilier & Hôtels"
                      : isMode
                        ? "Mode & Vêtements"
                        : isConnect
                          ? "Matériel & Connect"
                          : "Saveurs & Resto";

                    const status = supplier.subscriptionStatus || "TRIAL";
                    const endDate = supplier.subscriptionEndDate
                      ? new Date(supplier.subscriptionEndDate.toDate ? supplier.subscriptionEndDate.toDate() : supplier.subscriptionEndDate)
                      : null;
                    const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                    const isExpired = !isOfficial && daysLeft <= 0;

                    const subCount = suppliers.filter(
                      (s) => s.parentSupplierId === supplier.id || (s.role === "SUB_SUPPLIER" && s.createdBy === supplier.id)
                    ).length;

                    return (
                      <tr key={supplier.id} className="hover:bg-white/[0.03] transition-colors">
                        {/* 1. Fournisseur / Boutique */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/10 text-gray-300 flex items-center justify-center shrink-0">
                              {isImmo ? (
                                <Home size={15} />
                              ) : isMode ? (
                                <ShoppingBag size={15} />
                              ) : isConnect ? (
                                <Zap size={15} />
                              ) : (
                                <Store size={15} />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white text-sm truncate">{supplier.name}</span>
                                {isOfficial && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-200 border border-white/15 font-medium shrink-0">
                                    Officiel
                                  </span>
                                )}
                                {supplier.role === "SUB_SUPPLIER" && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10 shrink-0">
                                    Sous-agent
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 truncate mt-0.5">
                                {supplier.email}
                                {supplier.phone ? ` · ${supplier.phone}` : ""}
                              </div>
                              {subCount > 0 && (
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  {subCount} sous-agent{subCount > 1 ? "s" : ""} rattaché{subCount > 1 ? "s" : ""}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Origine / Partenaire (Dedicated Column) */}
                        <td className="px-5 py-3.5">
                          {supplier.partnerName || supplier.partnerReferral ? (
                            <div className="flex flex-col">
                              <button
                                type="button"
                                onClick={() => {
                                  if (supplier.referredByPartnerId) {
                                    setSelectedSourceFilter(`partner:${supplier.referredByPartnerId}`);
                                  } else {
                                    setSelectedSourceFilter("partner");
                                  }
                                }}
                                className="text-left group cursor-pointer"
                                title="Filtrer les fournisseurs de ce partenaire"
                              >
                                <span className="font-semibold text-gray-200 group-hover:text-white group-hover:underline block">
                                  {supplier.partnerName || "Partenaire affilié"}
                                </span>
                                <span className="text-[11px] text-gray-500 font-mono">
                                  {supplier.partnerCode || supplier.referralCodeUsed || "Partenaire"}
                                </span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500">Direction Centrale</span>
                          )}
                        </td>

                        {/* 3. Rayon Commercial */}
                        <td className="px-5 py-3.5">
                          {supplier.role === "SUB_SUPPLIER" ? (
                            <span className="text-xs text-gray-500 italic">Hérité</span>
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              <span className="px-2.5 py-1 rounded-md bg-white/[0.05] border border-white/10 text-gray-200 text-xs font-medium">
                                {rayonLabel}
                              </span>
                              <button
                                type="button"
                                onClick={() => openAccessModal(supplier)}
                                className="text-[11px] text-gray-400 hover:text-white underline cursor-pointer"
                              >
                                Modifier le rayon
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 4. Abonnement */}
                        <td className="px-5 py-3.5">
                          {isOfficial ? (
                            <div>
                              <span className="text-xs text-gray-300 font-medium block">Exempté</span>
                              <span className="text-[11px] text-gray-500">Boutique plateforme</span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-start gap-0.5">
                              {isExpired ? (
                                <div className="flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    Expiré
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleQuickReactivate(supplier)}
                                    className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/15 text-white font-medium cursor-pointer"
                                  >
                                    Réactiver 15j
                                  </button>
                                </div>
                              ) : status === "TRIAL" ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                  Essai ({daysLeft}j restants)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  Actif ({daysLeft}j restants)
                                </span>
                              )}
                              {endDate && (
                                <span className="text-[11px] text-gray-500">
                                  Échéance : {endDate.toLocaleDateString("fr-FR")}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => openSubModal(supplier)}
                                className="text-[11px] text-gray-400 hover:text-white underline mt-0.5 cursor-pointer"
                              >
                                Gérer l&apos;échéance
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 5. Dossier KYC / Projet */}
                        <td className="px-5 py-3.5">
                          {supplier.supplierApplicationStatus === "PENDING_APPROVAL" ? (
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                Projet à évaluer
                              </span>
                              <button
                                type="button"
                                onClick={() => openReviewModal(supplier)}
                                className="text-[11px] px-2.5 py-1 rounded-lg bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold cursor-pointer"
                              >
                                Évaluer &amp; attribuer rayon
                              </button>
                            </div>
                          ) : supplier.profileUpdateStatus === "PENDING_APPROVAL" || supplier.status === "PENDING_APPROVAL" ? (
                            <div className="flex flex-col items-start gap-1">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                En attente
                              </span>
                              <button
                                type="button"
                                onClick={() => openReviewModal(supplier)}
                                className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold cursor-pointer"
                              >
                                Vérifier &amp; valider
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col items-start gap-1">
                              <span className="text-xs text-gray-400">
                                {supplier.idDocumentNumber || supplier.idDocumentFrontUrl ? "Vérifié / Renseigné" : "Non renseigné"}
                              </span>
                              <button
                                type="button"
                                onClick={() => openReviewModal(supplier)}
                                className="text-[11px] text-gray-400 hover:text-white underline cursor-pointer"
                              >
                                Consulter le dossier
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 6. Actions */}
                        <td className="px-5 py-3.5 text-right">
                          {canDeleteSupplier ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteSupplier(supplier.id)}
                              className="text-gray-400 hover:text-red-400 hover:bg-red-500/10 px-2.5 py-1 rounded-lg transition-colors text-xs font-medium cursor-pointer"
                            >
                              Supprimer
                            </button>
                          ) : (
                            <span className="text-[11px] text-gray-600" title="Réservé à l'Admin principal ou au statut Admin">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Supplier Cards (< md) — Sober & Clean */}
          <div className="md:hidden divide-y divide-white/[0.06]">
            {isLoading ? (
              <div className="p-8 text-center text-gray-400">
                <div className="w-6 h-6 border-2 border-white/40 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Chargement des fournisseurs...</p>
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <p className="text-sm font-semibold text-white">Aucun fournisseur trouvé</p>
              </div>
            ) : (
              filteredSuppliers.map((supplier) => {
                const supplierRayons = getSupplierRayons(supplier);
                const isImmo = supplierRayons.includes("immo");
                const isMode = supplierRayons.includes("mode");
                const isConnect = supplierRayons.includes("connect");
                const isOfficial = Boolean(supplier.isOfficialAdminStore || supplier.isAdminSupplier);

                const rayonLabel = isImmo
                  ? "Immobilier & Hôtels"
                  : isMode
                    ? "Mode & Vêtements"
                    : isConnect
                      ? "Matériel & Connect"
                      : "Saveurs & Resto";

                const status = supplier.subscriptionStatus || "TRIAL";
                const endDate = supplier.subscriptionEndDate
                  ? new Date(supplier.subscriptionEndDate.toDate ? supplier.subscriptionEndDate.toDate() : supplier.subscriptionEndDate)
                  : null;
                const daysLeft = endDate ? Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                const isExpired = !isOfficial && daysLeft <= 0;

                return (
                  <div key={supplier.id} className="p-4 flex flex-col gap-2.5 hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm text-white truncate">{supplier.name}</h4>
                        <p className="text-[11px] text-gray-400 truncate">{supplier.email}</p>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 text-gray-300 shrink-0">
                        {rayonLabel}
                      </span>
                    </div>

                    {/* Clean Info Grid: Origine + Abonnement */}
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-black/20 p-2.5 rounded-lg border border-white/5">
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block">Origine</span>
                        <span className="text-gray-200 font-medium truncate block">
                          {supplier.partnerName ? `Partenaire : ${supplier.partnerName}` : "Direction Centrale"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 uppercase block">Abonnement</span>
                        <span className="text-gray-200 font-medium block">
                          {isOfficial
                            ? "Officiel (Exempté)"
                            : isExpired
                              ? "Expiré"
                              : status === "TRIAL"
                                ? `Essai (${daysLeft}j)`
                                : `Actif (${daysLeft}j)`}
                        </span>
                      </div>
                    </div>

                    {(supplier.supplierApplicationStatus === "PENDING_APPROVAL" || supplier.profileUpdateStatus === "PENDING_APPROVAL" || supplier.status === "PENDING_APPROVAL") && (
                      <button
                        onClick={() => openReviewModal(supplier)}
                        className={`w-full text-xs font-bold py-2 px-3 rounded-lg cursor-pointer ${
                          supplier.supplierApplicationStatus === "PENDING_APPROVAL"
                            ? "bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27]"
                            : "bg-amber-500 hover:bg-amber-400 text-gray-950"
                        }`}
                      >
                        {supplier.supplierApplicationStatus === "PENDING_APPROVAL"
                          ? "Évaluer le projet & attribuer un rayon"
                          : "Vérifier & valider le dossier KYC"}
                      </button>
                    )}

                    <div className="pt-1 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openAccessModal(supplier)}
                          className="text-gray-400 hover:text-white underline cursor-pointer"
                        >
                          Rayon
                        </button>
                        <button
                          onClick={() => openReviewModal(supplier)}
                          className="text-gray-400 hover:text-white underline cursor-pointer"
                        >
                          Dossier KYC
                        </button>
                        {!isOfficial && (
                          <button
                            onClick={() => openSubModal(supplier)}
                            className="text-gray-400 hover:text-white underline cursor-pointer"
                          >
                            Échéance
                          </button>
                        )}
                      </div>

                      {canDeleteSupplier && (
                        <button
                          onClick={() => handleDeleteSupplier(supplier.id)}
                          className="text-gray-400 hover:text-red-400 text-xs cursor-pointer"
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Access Management Modal */}
      <AnimatePresence>
        {isAccessModalOpen && selectedSupplierForAccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h2 className="text-xl font-semibold text-white">Gérer les accès</h2>
                <button onClick={() => setIsAccessModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleUpdateAccess} className="p-6 space-y-4">
                <div className="mb-4">
                  <p className="text-sm text-gray-300 mb-2">
                    Sélectionnez les rayons auxquels <strong>{selectedSupplierForAccess.name}</strong> a le droit de vendre :
                  </p>
                </div>

                <div className="space-y-3">
                  {availableRayons.map((r) => (
                    <label key={r.id} className="flex items-center space-x-3 bg-white/5 border border-white/10 p-3 rounded-lg cursor-pointer hover:bg-white/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedRayons.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRayons([...selectedRayons, r.id]);
                          } else {
                            setSelectedRayons(selectedRayons.filter(id => id !== r.id));
                          }
                        }}
                        className="w-4 h-4 text-primary bg-black border-white/20 rounded focus:ring-primary focus:ring-2"
                      />
                      <span className="text-white text-sm font-medium">{r.label}</span>
                    </label>
                  ))}
                </div>

                <div className="pt-6 flex justify-end space-x-3">
                  <button type="button" onClick={() => setIsAccessModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white transition-colors">
                    Annuler
                  </button>
                  <button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary-light text-white px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50">
                    {isLoading ? "En cours..." : "Valider"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create Supplier Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg bg-[#0F1D27] border border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-[#0F1D27] z-10">
                <h2 className="text-xl font-semibold text-white">Créer un compte</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleCreateSupplier} className="p-6 space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300 text-sm mb-2">
                  Un e-mail de configuration de mot de passe sera automatiquement envoyé à l'adresse indiquée une fois le compte créé.
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Prénom</label>
                    <input
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Nom (Post-nom)</label>
                    <input
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Nom de l'entreprise (Optionnel)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-300">Email (identifiant de connexion)</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">Méthode de notification</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center space-x-2 text-white cursor-pointer">
                      <input
                        type="radio"
                        name="notificationMethod"
                        value="email"
                        checked={notificationMethod === 'email'}
                        onChange={() => setNotificationMethod('email')}
                        className="text-primary focus:ring-primary bg-black/20 border-white/10"
                      />
                      <span>Email</span>
                    </label>
                    <label className="flex items-center space-x-2 text-white cursor-pointer">
                      <input
                        type="radio"
                        name="notificationMethod"
                        value="sms"
                        checked={notificationMethod === 'sms'}
                        onChange={() => setNotificationMethod('sms')}
                        className="text-primary focus:ring-primary bg-black/20 border-white/10"
                      />
                      <span>SMS</span>
                    </label>
                  </div>
                </div>

                {notificationMethod === 'sms' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-300">Numéro de téléphone</label>
                    <input
                      type="tel"
                      required
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+243..."
                      className="w-full px-4 py-2 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white"
                    />
                  </div>
                )}

                {/* Visual Category / Rayon Selection */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-300">
                    Type de Prestataire & Rayon d'Affectation <span className="text-red-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Immo & Hotel */}
                    <div
                      onClick={() => {
                        setSupplierCategory("immo");
                        setRole("SUPPLIER_IMMO");
                        setRayon("immo");
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${supplierCategory === "immo"
                        ? "bg-emerald-500/15 border-emerald-500 text-white shadow-md shadow-emerald-500/10"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xl">🏠</span>
                        {supplierCategory === "immo" ? (
                          <CheckCircle2 size={18} className="text-emerald-400" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-white/20" />
                        )}
                      </div>
                      <div className="font-semibold text-sm text-white">Immobilier & Hôtels</div>
                      <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        Appartements, villas, résidences, hôtels & nuitées
                      </div>
                    </div>

                    {/* Mode */}
                    <div
                      onClick={() => {
                        setSupplierCategory("mode");
                        setRole("supplier");
                        setRayon("mode");
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${supplierCategory === "mode"
                        ? "bg-pink-500/15 border-pink-500 text-white shadow-md shadow-pink-500/10"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xl">👗</span>
                        {supplierCategory === "mode" ? (
                          <CheckCircle2 size={18} className="text-pink-400" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-white/20" />
                        )}
                      </div>
                      <div className="font-semibold text-sm text-white">Mode & Vêtements</div>
                      <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        Prêt-à-porter, chaussures, sacs & accessoires
                      </div>
                    </div>

                    {/* Connect */}
                    <div
                      onClick={() => {
                        setSupplierCategory("connect");
                        setRole("supplier");
                        setRayon("connect");
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${supplierCategory === "connect"
                        ? "bg-cyan-500/15 border-cyan-500 text-white shadow-md shadow-cyan-500/10"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xl">⚡</span>
                        {supplierCategory === "connect" ? (
                          <CheckCircle2 size={18} className="text-cyan-400" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-white/20" />
                        )}
                      </div>
                      <div className="font-semibold text-sm text-white">Matériel & Connect</div>
                      <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        Smartphones, matériel informatique & réseaux
                      </div>
                    </div>

                    {/* Saveurs */}
                    <div
                      onClick={() => {
                        setSupplierCategory("saveurs");
                        setRole("supplier");
                        setRayon("saveurs");
                      }}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${supplierCategory === "saveurs"
                        ? "bg-[#FF6B35]/15 border-[#FF6B35] text-white shadow-md shadow-[#FF6B35]/10"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-gray-200"
                        }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xl">🍽️</span>
                        {supplierCategory === "saveurs" ? (
                          <CheckCircle2 size={18} className="text-[#FF6B35]" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-white/20" />
                        )}
                      </div>
                      <div className="font-semibold text-sm text-white">Saveurs & Gastronomie</div>
                      <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                        Restaurants, plats cuisinés & ustensiles de cuisine
                      </div>
                    </div>

                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Un abonnement d'essai de 30 jours sera automatiquement attribué au fournisseur standard pour commencer à vendre.
                  </p>
                </div>

                {/* Option: Boutique Officielle Rayons (Magasin interne de la plateforme) */}
                <div
                  onClick={() => setIsOfficialAdminStore(!isOfficialAdminStore)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${isOfficialAdminStore
                    ? "bg-amber-500/15 border-amber-500 text-white shadow-lg shadow-amber-500/10"
                    : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white"
                    }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">🏷️</span>
                      <div>
                        <p className="font-bold text-sm text-white flex items-center gap-1.5">
                          <span>Boutique Officielle Rayons (Magasin Plateforme)</span>
                          <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold uppercase">
                            Exempté d'abonnement
                          </span>
                        </p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                          Ce compte est une vitrine marchande officielle appartenant à Rayons.net pour vendre des produits ou biens propres. <strong>Il est exempté d'abonnement mensuel</strong>. Il s'agit d'une boutique commerciale et non d'un administrateur système.
                        </p>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isOfficialAdminStore}
                      onChange={(e) => setIsOfficialAdminStore(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded text-amber-500 focus:ring-amber-400 bg-black/40 border-white/20 shrink-0"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-primary hover:bg-primary-light text-white font-semibold rounded-lg transition-colors flex items-center disabled:opacity-50"
                  >
                    {isSubmitting ? "Création en cours..." : "Créer le compte"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Subscription & Trial Management Modal */}
      <AnimatePresence>
        {isSubModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-[#0B0F17] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-5 border-b border-white/10">
                <div>
                  <h2 className="text-lg font-bold text-white">Gérer Période d'Essai & Abonnement</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Partenaire : <span className="text-white font-semibold">{selectedSupplierSub?.name}</span></p>
                </div>
                <button onClick={() => { setIsSubModalOpen(false); setSelectedSupplierSub(null); }} className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateSubscription} className="p-5 space-y-4">
                {/* État actuel du partenaire */}
                {selectedSupplierSub && (() => {
                  const currentEnd = selectedSupplierSub.subscriptionEndDate
                    ? (selectedSupplierSub.subscriptionEndDate.toDate
                      ? selectedSupplierSub.subscriptionEndDate.toDate()
                      : new Date(selectedSupplierSub.subscriptionEndDate))
                    : null;
                  const daysLeft = currentEnd
                    ? Math.ceil((currentEnd.getTime() - Date.now()) / 86400000)
                    : null;
                  const status = selectedSupplierSub.subscriptionStatus || "TRIAL";
                  return (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 uppercase font-semibold text-[10px]">Statut en base :</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold ${status === "TRIAL" ? "bg-blue-500/20 text-blue-300 border border-blue-500/30" :
                          status === "ACTIVE" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                            "bg-red-500/20 text-red-300 border border-red-500/30"
                          }`}>
                          {status === "TRIAL" ? "Période d'essai" : status === "ACTIVE" ? "Abonnement Actif" : "Suspendu"}
                        </span>
                      </div>
                      {currentEnd ? (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-gray-300">Échéance actuelle :</span>
                          <span className="font-semibold text-white">{currentEnd.toLocaleDateString("fr-FR")} ({daysLeft && daysLeft > 0 ? `${daysLeft}j restants` : `Expiré`})</span>
                        </div>
                      ) : (
                        <p className="text-gray-400 pt-1">Aucune date d'échéance renseignée.</p>
                      )}
                    </div>
                  );
                })()}

                {/* 1. Choix du statut d'utilisation */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-300">Statut du compte fournisseur</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSubStatus("TRIAL")}
                      className={`p-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${selectedSubStatus === "TRIAL"
                        ? "bg-blue-500/20 text-blue-300 border-blue-500/50 shadow-sm"
                        : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                        }`}
                    >
                      ⏱️ Essai (15j)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSubStatus("ACTIVE")}
                      className={`p-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${selectedSubStatus === "ACTIVE"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                        : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                        }`}
                    >
                      ✅ Actif (Payé)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedSubStatus("SUSPENDED_PAYMENT")}
                      className={`p-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${selectedSubStatus === "SUSPENDED_PAYMENT"
                        ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-sm"
                        : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                        }`}
                    >
                      ⛔ Suspendu
                    </button>
                  </div>
                </div>

                {/* 2. Nombre de jours à accorder ou date précise */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300">Durée ou prolongation</label>
                  <div className="flex items-center gap-2">
                    {[15, 30, 60, 90].map(d => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => {
                          setDaysToAdd(d);
                          setCustomExpiryDate("");
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${daysToAdd === d && !customExpiryDate
                          ? 'bg-primary text-gray-950 shadow-sm'
                          : 'bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10'
                          }`}
                      >
                        {d === 15 ? "15j (Essai)" : `+${d}j`}
                      </button>
                    ))}
                  </div>

                  <div className="pt-2">
                    <label className="text-[11px] text-gray-400 block mb-1">Ou fixer une date d'échéance précise au calendrier :</label>
                    <input
                      type="date"
                      value={customExpiryDate}
                      onChange={(e) => setCustomExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                    />
                  </div>
                </div>

                {/* Aperçu de la nouvelle échéance */}
                {selectedSupplierSub && (() => {
                  let preview: Date;
                  if (customExpiryDate) {
                    preview = new Date(customExpiryDate);
                  } else {
                    const currentEnd = selectedSupplierSub.subscriptionEndDate
                      ? (selectedSupplierSub.subscriptionEndDate.toDate
                        ? selectedSupplierSub.subscriptionEndDate.toDate()
                        : new Date(selectedSupplierSub.subscriptionEndDate))
                      : null;
                    const base = currentEnd && currentEnd > new Date() ? currentEnd : new Date();
                    preview = new Date(base);
                    preview.setDate(preview.getDate() + Number(daysToAdd));
                  }
                  return (
                    <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl text-xs text-gray-300 flex items-center justify-between">
                      <span>Nouvelle échéance calculée :</span>
                      <span className="text-primary-light font-bold">{preview.toLocaleDateString("fr-FR")}</span>
                    </div>
                  );
                })()}

                <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                  <span className="text-base shrink-0">⚡</span>
                  <div>
                    <strong className="block font-bold">Déblocage & Réactivation immédiate :</strong>
                    En validant un statut <em>Essai</em> ou <em>Actif</em>, le fournisseur est instantanément débloqué, réactivé en base et autorisé à publier immédiatement.
                  </div>
                </div>

                <div className="pt-2 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => { setIsSubModalOpen(false); setSelectedSupplierSub(null); }}
                    className="px-4 py-2 text-xs font-semibold text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary-light text-gray-950 font-bold px-5 py-2 rounded-xl text-xs transition-all shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {isLoading ? "Enregistrement..." : "Appliquer"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Review Profile & KYC Identity Modal */}
      <AnimatePresence>
        {isReviewModalOpen && selectedSupplierToApprove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-[#0F1D27] border border-white/15 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-5 sm:p-6 border-b border-white/10 shrink-0">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">
                    Dossier Identité, Pièces & Coordonnées (Base de données)
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Fournisseur : <strong className="text-white">{selectedSupplierToApprove.name}</strong> ({selectedSupplierToApprove.email})
                  </p>
                </div>
                <button onClick={() => setIsReviewModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                  <X size={24} />
                </button>
              </div>

              <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
                {/* 0. Projet & Activité déclarée après paiement (Évaluation & Attribution du Rayon) */}
                {(selectedSupplierToApprove.supplierApplication || selectedSupplierToApprove.supplierApplicationStatus === "PENDING_APPROVAL") && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                        <span>📋 Projet déclaré &amp; Attribution du Rayon (Décision Admin)</span>
                      </h3>
                      {selectedSupplierToApprove.supplierApplication?.paymentRef && (
                        <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          Payé ${selectedSupplierToApprove.supplierApplication.amountPaid ?? 50} • Réf: {selectedSupplierToApprove.supplierApplication.paymentRef}
                        </span>
                      )}
                    </div>

                    <div className="bg-black/35 rounded-xl p-3.5 border border-white/10">
                      <span className="block text-[10px] text-gray-400 uppercase font-bold mb-1">
                        Ce que le candidat vend / Description du projet :
                      </span>
                      <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">
                        {selectedSupplierToApprove.supplierApplication?.projectDescription || "Aucune description renseignée."}
                      </p>
                      <div className="mt-2.5 pt-2.5 border-t border-white/10 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-300">
                        {selectedSupplierToApprove.supplierApplication?.company && (
                          <span>Boutique : <strong className="text-white">{selectedSupplierToApprove.supplierApplication.company}</strong></span>
                        )}
                        {selectedSupplierToApprove.supplierApplication?.commune && (
                          <span>Commune : <strong className="text-white">{selectedSupplierToApprove.supplierApplication.commune}</strong></span>
                        )}
                        {selectedSupplierToApprove.supplierApplication?.paymentMethod && (
                          <span>Paiement : <strong className="text-emerald-300">{selectedSupplierToApprove.supplierApplication.paymentMethod}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Choix du/des rayon(s) exclusivement par l'admin */}
                    <div>
                      <label className="block text-xs font-bold text-white mb-2">
                        Attribuer le(s) rayon(s) officiel(s) en fonction de son activité *
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {availableRayons.map((r) => {
                          const isChecked = approvalRayons.includes(r.id);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() =>
                                setApprovalRayons((prev) =>
                                  prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                                )
                              }
                              className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                                isChecked
                                  ? "bg-[#C7D300]/15 border-[#C7D300] text-white"
                                  : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold flex items-center gap-1.5">
                                  <span>{r.icon}</span>
                                  <span>{r.label}</span>
                                </span>
                                {isChecked && <CheckCircle2 size={16} className="text-[#C7D300] shrink-0" />}
                              </div>
                              <p className="text-[10px] text-gray-400 mt-0.5">{r.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                          Durée (jours)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={365}
                          value={approvalDays}
                          onChange={(e) => setApprovalDays(Number(e.target.value) || 30)}
                          className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1">
                          Message / Motif envoyé dans la notification (optionnel)
                        </label>
                        <input
                          type="text"
                          value={approvalNote}
                          onChange={(e) => setApprovalNote(e.target.value)}
                          placeholder="Ex : Bienvenue dans Rayons Connect ! ou motif en cas de refus..."
                          className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-xs text-white placeholder:text-gray-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Coordonnées & Numéros */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C7D300] mb-3">
                    1. Numéros de Téléphone & Adresse
                  </h3>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">Téléphone Principal</span>
                      <span className="text-sm text-white font-mono font-bold">
                        {selectedSupplierToApprove.pendingProfile?.phone || selectedSupplierToApprove.phone || "Non renseigné"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">WhatsApp</span>
                      <span className="text-sm text-emerald-300 font-mono">
                        {selectedSupplierToApprove.pendingProfile?.whatsappPhone || selectedSupplierToApprove.whatsappPhone || "Non renseigné"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">Mobile Money ({selectedSupplierToApprove.payoutProvider || "MPESA"})</span>
                      <span className="text-sm text-[#C7D300] font-mono font-bold">
                        {selectedSupplierToApprove.pendingProfile?.payoutPhone || selectedSupplierToApprove.payoutPhone || "Non renseigné"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">Adresse physique</span>
                      <span className="text-sm text-gray-200">
                        {selectedSupplierToApprove.pendingProfile?.address || selectedSupplierToApprove.address || "Non renseignée"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pièce d'Identité & KYC */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C7D300] mb-3">
                    2. Pièce d&apos;Identité Officielle (KYC)
                  </h3>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Type de Pièce</span>
                        <span className="text-sm text-white font-semibold">
                          {selectedSupplierToApprove.pendingProfile?.idDocumentType || selectedSupplierToApprove.idDocumentType || "Non renseigné"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Numéro de la Pièce</span>
                        <span className="text-sm text-[#C7D300] font-mono font-bold">
                          {selectedSupplierToApprove.pendingProfile?.idDocumentNumber || selectedSupplierToApprove.idDocumentNumber || "Non renseigné"}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-gray-400 uppercase font-bold">Nationalité</span>
                        <span className="text-sm text-gray-200">
                          {selectedSupplierToApprove.pendingProfile?.nationality || selectedSupplierToApprove.nationality || "Congolaise (RDC)"}
                        </span>
                      </div>
                    </div>

                    {/* Photos Recto / Verso */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="bg-black/40 border border-white/10 rounded-xl p-3">
                        <span className="block text-[10px] text-gray-400 uppercase font-bold mb-2">
                          Pièce d&apos;identité — RECTO
                        </span>
                        {(selectedSupplierToApprove.pendingProfile?.idDocumentFrontUrl || selectedSupplierToApprove.idDocumentFrontUrl) ? (
                          <img
                            src={selectedSupplierToApprove.pendingProfile?.idDocumentFrontUrl || selectedSupplierToApprove.idDocumentFrontUrl}
                            alt="Pièce Recto"
                            className="w-full h-36 max-h-36 object-contain rounded-lg bg-black/50"
                          />
                        ) : (
                          <div className="h-28 flex items-center justify-center text-xs text-gray-500 border border-dashed border-white/10 rounded-lg">
                            Aucune photo Recto fournie
                          </div>
                        )}
                      </div>

                      <div className="bg-black/40 border border-white/10 rounded-xl p-3">
                        <span className="block text-[10px] text-gray-400 uppercase font-bold mb-2">
                          Pièce d&apos;identité — VERSO
                        </span>
                        {(selectedSupplierToApprove.pendingProfile?.idDocumentBackUrl || selectedSupplierToApprove.idDocumentBackUrl) ? (
                          <img
                            src={selectedSupplierToApprove.pendingProfile?.idDocumentBackUrl || selectedSupplierToApprove.idDocumentBackUrl}
                            alt="Pièce Verso"
                            className="w-full h-36 max-h-36 object-contain rounded-lg bg-black/50"
                          />
                        ) : (
                          <div className="h-28 flex items-center justify-center text-xs text-gray-500 border border-dashed border-white/10 rounded-lg">
                            Aucune photo Verso fournie
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Références Légales & Entreprise */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#C7D300] mb-3">
                    3. Mentions Légales & Entreprise
                  </h3>
                  <div className="bg-white/5 rounded-xl border border-white/10 p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">Entreprise</span>
                      <span className="text-sm text-white">
                        {selectedSupplierToApprove.pendingProfile?.companyName || selectedSupplierToApprove.companyName || "Non renseigné"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">RCCM</span>
                      <span className="text-sm text-gray-200 font-mono">
                        {selectedSupplierToApprove.pendingProfile?.rccm || selectedSupplierToApprove.rccm || "Non renseigné"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">ID. NAT</span>
                      <span className="text-sm text-gray-200 font-mono">
                        {selectedSupplierToApprove.pendingProfile?.idNat || selectedSupplierToApprove.idNat || "Non renseigné"}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-gray-400 uppercase font-bold">NIF</span>
                      <span className="text-sm text-gray-200 font-mono">
                        {selectedSupplierToApprove.pendingProfile?.nif || selectedSupplierToApprove.nif || "Non renseigné"}
                      </span>
                    </div>
                  </div>
                </div>

                {(selectedSupplierToApprove.pendingProfile?.logoUrl || selectedSupplierToApprove.logoUrl) && (
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#C7D300] mb-2">Logo de l&apos;enseigne</h3>
                    <div className="bg-white/5 rounded-xl border border-white/10 p-4 flex justify-center items-center h-28">
                      <img
                        src={selectedSupplierToApprove.pendingProfile?.logoUrl || selectedSupplierToApprove.logoUrl}
                        alt="Logo"
                        className="max-h-full max-w-full object-contain"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-5 sm:p-6 border-t border-white/10 shrink-0 flex flex-wrap items-center justify-end gap-3">
                <button
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  Fermer
                </button>
                {selectedSupplierToApprove.supplierApplicationStatus === "PENDING_APPROVAL" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleEvaluateApplication("reject")}
                      disabled={isApprovingApp}
                      className="bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      Refuser la demande
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEvaluateApplication("approve")}
                      disabled={isApprovingApp || approvalRayons.length === 0}
                      className="bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] px-5 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-colors disabled:opacity-50 cursor-pointer shadow-lg"
                    >
                      {isApprovingApp ? "Attribution..." : "✅ Approuver & Attribuer ce Rayon (+ Notifier)"}
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={confirmApproveProfile}
                    disabled={isLoading}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-lg"
                  >
                    {isLoading ? "Validation..." : "✅ Valider & Certifier l'Identité en BDD"}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Modal Broadcast Message Groupé ─────────────────────────────────── */}
      <AdminBroadcastModal
        isOpen={isBroadcastOpen}
        onClose={() => setIsBroadcastOpen(false)}
        onSuccess={(msg) => setSuccessMessage(msg)}
      />
    </div>
  );
}
