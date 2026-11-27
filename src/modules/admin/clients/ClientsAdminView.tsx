"use client";

import { useState, useEffect } from "react";
import { 
  Search, 
  Users as UsersIcon, 
  UserCheck, 
  UserX, 
  Clock, 
  Download, 
  Plus, 
  Phone, 
  Mail, 
  Copy, 
  Check, 
  Calendar, 
  MessageCircle, 
  X,
  Sparkles,
  Trash2,
  ShieldAlert,
  ArrowRightCircle,
  AlertTriangle,
  UserPlus,
  Eye,
  ShoppingBag,
  Star,
} from "lucide-react";
import { db, auth } from "@/lib/firebase";
import { collection, query, limit, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { SUPER_ADMIN_EMAILS } from "@/lib/permissions";
import { getAccountType } from "@/domain/roles";
import ResponsiveModal from "@/modules/shared/components/ui/ResponsiveModal";
import ValidationSuccessView from "@/modules/shared/components/ui/ValidationSuccessView";
import ClientCrmDrawer from "@/modules/admin/clients/ClientCrmDrawer";
import toast from "react-hot-toast";

interface ClientData {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  phone: string;
  isOnline: boolean;
  lastConnection: Date | null;
  role?: string;
  createdAt: Date | null;
  crmTags: string[];
  crmNote: string;
  isSuspended: boolean;
}

/**
 * Détermine si un compte doit être EXCLU de la liste des clients particuliers.
 * Les Fournisseurs, Fonctionnaires, Équipe admin et Livreurs ont leurs sections dédiées.
 */
function isExcludedFromClients(data: any): boolean {
  if (!data) return false;

  // 1. Détection canonique basée sur accountType
  const type = getAccountType(data);
  if (type !== "CLIENT") {
    return true;
  }

  const role = (data.role || "").toUpperCase();
  const email = (data.email || "").toLowerCase().trim();

  // 2. Super Admin & Partenaires
  if (SUPER_ADMIN_EMAILS.includes(email) || role === "SUPER_ADMIN" || role === "SUPERADMIN") {
    return true;
  }
  if (role === "PARTNER" || data.isPartner === true) {
    return true;
  }

  // 3. Locataires (gérés dans la gestion immobilière)
  if (role.includes("TENANT") || role.includes("LOCATAIRE")) {
    return true;
  }

  return false;
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "NEW" | "ONLINE" | "WITH_PHONE" | "BUYERS" | "VIP" | "SUSPENDED">("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "ONLINE" | "NAME" | "SPENT">("NEWEST");
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orderStatsByClient, setOrderStatsByClient] = useState<Record<string, { ordersCount: number; totalSpentUSD: number; lastOrderAt: string | null }>>({});
  const [selectedCrmClient, setSelectedCrmClient] = useState<ClientData | null>(null);

  // Copied feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [validationSuccessMsg, setValidationSuccessMsg] = useState("");

  // Suppression & Promotion
  const [clientToDelete, setClientToDelete] = useState<ClientData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [clientToPromote, setClientToPromote] = useState<ClientData | null>(null);
  const [targetRole, setTargetRole] = useState<string>("SUB_ADMIN");
  const [promoteRayon, setPromoteRayon] = useState<string>("connect");
  const [promoteStoreName, setPromoteStoreName] = useState<string>("");
  const [isPromoting, setIsPromoting] = useState(false);

  // Modal création manuelle
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    address: "",
  });

  useEffect(() => {
    setIsLoading(true);

    const q = query(collection(db, "users"), limit(500));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const clientsData: ClientData[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();

          if (isExcludedFromClients(data)) {
            return;
          }

          let lastConn: Date | null = null;
          if (data.lastConnection) {
            lastConn = data.lastConnection.toDate ? data.lastConnection.toDate() : new Date(data.lastConnection);
          }

          let created: Date | null = null;
          if (data.createdAt) {
            created = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          }

          const fName = data.firstName || "";
          const lName = data.lastName || "";
          const rawName = data.displayName || `${fName} ${lName}`.trim() || data.name;

          clientsData.push({
            id: doc.id,
            name: rawName || "Client Anonyme",
            firstName: fName,
            lastName: lName,
            email: data.email || "",
            phone: data.phoneNumber || data.phone || "",
            isOnline: !!data.isOnline,
            lastConnection: lastConn,
            role: data.role || "CLIENT",
            createdAt: created,
            crmTags: Array.isArray(data.crmTags) ? data.crmTags : [],
            crmNote: typeof data.crmNote === "string" ? data.crmNote : "",
            isSuspended: Boolean(data.isSuspended || String(data.status || "").toUpperCase() === "SUSPENDED"),
          });
        });

        setClients(clientsData);
        setIsLoading(false);
      },
      (error) => {
        console.error("Erreur écoute clients:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Charger les statistiques d'achats (commandes & total dépensé par client)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const res = await fetch("/api/admin/clients/crm", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const json = await res.json();
        if (active && json.success && json.statsByClient) {
          setOrderStatsByClient(json.statsByClient);
        }
      } catch (err) {
        console.warn("Clients CRM stats warning:", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [clients.length]);

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Action : Supprimer définitivement un client (Auth + DB)
  const handleDeleteClient = async () => {
    if (!clientToDelete) return;
    setIsDeleting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Vous devez être connecté.");
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/users/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: clientToDelete.id, email: clientToDelete.email || undefined }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la suppression");

      const deletedLabel = clientToDelete.email || clientToDelete.name;
      setClientToDelete(null);
      setValidationSuccessMsg(`Le compte client (${deletedLabel}) a été supprimé avec succès.`);
    } catch (err: any) {
      console.error("Erreur suppression:", err);
      toast.error(err.message || "Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Action : Promouvoir/Convertir directement un client en Admin ou Fournisseur
  const handlePromoteClient = async () => {
    if (!clientToPromote) return;
    setIsPromoting(true);
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error("Vous devez être connecté.");
      const token = await currentUser.getIdToken();

      const res = await fetch("/api/admin/clients/promote", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: clientToPromote.id,
          newRole: targetRole,
          extraData: targetRole === "SUPPLIER" ? {
            rayon: promoteRayon,
            company: promoteStoreName || clientToPromote.name,
            companyName: promoteStoreName || clientToPromote.name,
          } : {},
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la conversion");

      const promoteText = data.message || `Client converti avec succès en ${targetRole} !`;
      setClientToPromote(null);
      setValidationSuccessMsg(promoteText);
    } catch (err: any) {
      console.error("Erreur conversion:", err);
      toast.error(err.message || "Erreur lors de la conversion.");
    } finally {
      setIsPromoting(false);
    }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName && !formData.lastName && !formData.email && !formData.phone) {
      alert("Veuillez renseigner au moins un nom, email ou numéro de téléphone.");
      return;
    }

    setIsSubmitting(true);
    try {
      const displayName = `${formData.firstName} ${formData.lastName}`.trim();
      await addDoc(collection(db, "users"), {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        displayName: displayName || "Nouveau Client",
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        phoneNumber: formData.phone.trim(),
        address: formData.address.trim(),
        role: "CLIENT",
        status: "ACTIVE",
        createdAt: serverTimestamp(),
        createdAtClient: new Date().toISOString(),
        isOnline: false,
      });

      setIsModalOpen(false);
      setFormData({ firstName: "", lastName: "", email: "", phone: "", address: "" });
      setValidationSuccessMsg(`Le nouveau client "${displayName || formData.email || "Client"}" a été enregistré avec succès dans la base de données !`);
    } catch (err: any) {
      console.error(err);
      alert(`Erreur lors de la création : ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Export CSV
  const exportClientsCSV = () => {
    if (clients.length === 0) {
      alert("Aucun client à exporter.");
      return;
    }

    const headers = ["ID", "Nom Complet", "Prénom", "Nom", "Email", "Téléphone", "Date d'inscription", "En Ligne"];
    const rows = filteredAndSortedClients.map((c) => [
      c.id,
      `"${(c.name || "").replace(/"/g, '""')}"`,
      `"${(c.firstName || "").replace(/"/g, '""')}"`,
      `"${(c.lastName || "").replace(/"/g, '""')}"`,
      `"${(c.email || "").replace(/"/g, '""')}"`,
      `"${(c.phone || "").replace(/"/g, '""')}"`,
      c.createdAt ? c.createdAt.toISOString() : "",
      c.isOnline ? "OUI" : "NON",
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute("download", `coordonnees_clients_rayons_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isRecentClient = (date: Date | null) => {
    if (!date) return false;
    const diffDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 7;
  };

  // Filtrage et tri
  const filteredAndSortedClients = clients
    .filter((c) => {
      const term = search.toLowerCase();
      const matchesSearch =
        c.name.toLowerCase().includes(term) ||
        c.email.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      if (filterType === "NEW") return isRecentClient(c.createdAt);
      if (filterType === "ONLINE") return c.isOnline;
      if (filterType === "WITH_PHONE") return !!c.phone && c.phone.trim().length > 3;
      if (filterType === "BUYERS") return (orderStatsByClient[c.id]?.ordersCount || 0) > 0;
      if (filterType === "VIP") return c.crmTags.includes("VIP") || (orderStatsByClient[c.id]?.totalSpentUSD || 0) >= 100;
      if (filterType === "SUSPENDED") return c.isSuspended;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "SPENT") {
        const spentA = orderStatsByClient[a.id]?.totalSpentUSD || 0;
        const spentB = orderStatsByClient[b.id]?.totalSpentUSD || 0;
        if (spentA !== spentB) return spentB - spentA;
        return (orderStatsByClient[b.id]?.ordersCount || 0) - (orderStatsByClient[a.id]?.ordersCount || 0);
      }
      if (sortBy === "NEWEST") {
        const timeA = a.createdAt ? a.createdAt.getTime() : 0;
        const timeB = b.createdAt ? b.createdAt.getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === "ONLINE") {
        if (a.isOnline === b.isOnline) {
          const timeA = a.lastConnection ? a.lastConnection.getTime() : 0;
          const timeB = b.lastConnection ? b.lastConnection.getTime() : 0;
          return timeB - timeA;
        }
        return a.isOnline ? -1 : 1;
      }
      if (sortBy === "NAME") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

  const formatDate = (date: Date | null) => {
    if (!date) return "Non précisé";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const recentCount = clients.filter((c) => isRecentClient(c.createdAt)).length;
  const activeClientsCount = clients.filter((c) => c.isOnline).length;
  const buyersCount = clients.filter((c) => (orderStatsByClient[c.id]?.ordersCount || 0) > 0).length;
  const vipCount = clients.filter((c) => c.crmTags.includes("VIP") || (orderStatsByClient[c.id]?.totalSpentUSD || 0) >= 100).length;
  const suspendedCount = clients.filter((c) => c.isSuspended).length;

  return (
    <div className="space-y-5 pb-16">
      {/* En-tête Exécutif */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">Clients &amp; CRM</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white/[0.06] text-gray-300 border border-white/10 whitespace-nowrap">
              Fiche 360°
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            Suivi des clients Rayons.net : historique d&apos;achats, segmentation VIP, notes internes et export CRM.
          </p>
        </div>

        {/* Boutons d'actions Admin */}
        <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          <button
            onClick={exportClientsCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 rounded-lg text-xs font-semibold transition-colors border border-white/10 whitespace-nowrap cursor-pointer"
            title="Télécharger la liste sous format Excel/CSV"
          >
            <Download size={13} />
            <span>Exporter CSV</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#C7D300] hover:bg-[#b8c400] text-[#0F1D27] rounded-lg text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus size={14} />
            <span>Nouveau Client</span>
          </button>
        </div>
      </div>

      {/* 4 Cartes KPI Exécutives */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          onClick={() => { setFilterType("ALL"); setSortBy("NEWEST"); }}
          className={`bg-white/[0.03] border p-4 rounded-xl flex flex-col justify-between gap-2.5 transition-colors text-left cursor-pointer ${
            filterType === "ALL" ? "border-white/25 bg-white/[0.05]" : "border-white/[0.08] hover:border-white/15"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Total Clients</span>
            <span className="p-1.5 rounded-lg bg-white/[0.05] text-gray-300">
              <UsersIcon size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{clients.length}</p>
          <div className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06] w-full">
            {recentCount} nouveau(x) sur 7 jours
          </div>
        </button>

        <button
          onClick={() => { setFilterType("BUYERS"); setSortBy("SPENT"); }}
          className={`bg-white/[0.03] border p-4 rounded-xl flex flex-col justify-between gap-2.5 transition-colors text-left cursor-pointer ${
            filterType === "BUYERS" ? "border-white/25 bg-white/[0.05]" : "border-white/[0.08] hover:border-white/15"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Acheteurs Actifs</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ShoppingBag size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{buyersCount}</p>
          <div className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06] w-full">
            Clients ayant déjà commandé
          </div>
        </button>

        <button
          onClick={() => { setFilterType("VIP"); setSortBy("SPENT"); }}
          className={`bg-white/[0.03] border p-4 rounded-xl flex flex-col justify-between gap-2.5 transition-colors text-left cursor-pointer ${
            filterType === "VIP" ? "border-white/25 bg-white/[0.05]" : "border-white/[0.08] hover:border-white/15"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Clients VIP</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Star size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{vipCount}</p>
          <div className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06] w-full">
            Tag VIP ou achats ≥ $100
          </div>
        </button>

        <button
          onClick={() => setFilterType("ONLINE")}
          className={`bg-white/[0.03] border p-4 rounded-xl flex flex-col justify-between gap-2.5 transition-colors text-left cursor-pointer ${
            filterType === "ONLINE" ? "border-white/25 bg-white/[0.05]" : "border-white/[0.08] hover:border-white/15"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">En Ligne</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <UserCheck size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums tracking-tight">{activeClientsCount}</p>
          <div className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06] w-full">
            {suspendedCount} compte(s) suspendu(s)
          </div>
        </button>
      </div>

      {validationSuccessMsg ? (
        <ValidationSuccessView
          title="C'est fait !"
          message={validationSuccessMsg}
          badgeLabel="Base Clients Mise à Jour"
          onDone={() => setValidationSuccessMsg("")}
        />
      ) : (
      /* Barre de recherche, filtres et tri */
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-white/[0.08] flex flex-col lg:flex-row gap-3 justify-between lg:items-center">
          <div className="relative w-full lg:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
            <input
              type="text"
              placeholder="Rechercher nom, email, tél..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg focus:outline-none focus:border-white/25 text-white text-[11px] placeholder:text-gray-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end">
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-white/[0.04] border border-white/10 text-gray-200 text-[11px] rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-white/25"
            >
              <option value="NEWEST" className="bg-[#0F1D27]">Plus récents</option>
              <option value="SPENT" className="bg-[#0F1D27]">Meilleurs acheteurs ($)</option>
              <option value="ONLINE" className="bg-[#0F1D27]">En ligne</option>
              <option value="NAME" className="bg-[#0F1D27]">Nom (A-Z)</option>
            </select>

            <div className="flex items-center gap-1 p-1 bg-black/30 border border-white/[0.06] rounded-lg text-[11px] overflow-x-auto">
              {[
                { id: "ALL", label: `Tous (${clients.length})` },
                { id: "BUYERS", label: `Acheteurs (${buyersCount})` },
                { id: "VIP", label: `VIP (${vipCount})` },
                { id: "NEW", label: `Nouveaux (${recentCount})` },
                { id: "SUSPENDED", label: `Suspendus (${suspendedCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id as any)}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    filterType === tab.id ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Desktop Table (hidden on mobile) ── */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs text-gray-300">
            <thead className="text-[10px] uppercase bg-white/[0.01] text-gray-500 font-semibold border-b border-white/[0.08] tracking-wider">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Client &amp; Tags CRM</th>
                <th className="px-4 py-3 whitespace-nowrap">Téléphone</th>
                <th className="px-4 py-3 whitespace-nowrap">Email</th>
                <th className="px-4 py-3 whitespace-nowrap">Achats</th>
                <th className="px-4 py-3 whitespace-nowrap">Statut</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs">Chargement de la base clients...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredAndSortedClients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <p className="text-sm font-semibold text-gray-400">Aucun client trouvé.</p>
                      <p className="text-xs text-gray-600">
                        {search ? "Essayez une autre recherche." : "Enregistrez un premier client avec le bouton ci-dessus."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedClients.map((client) => {
                  const initial = (client.name || "C").charAt(0).toUpperCase();
                  const isNew = isRecentClient(client.createdAt);
                  const cStats = orderStatsByClient[client.id] || { ordersCount: 0, totalSpentUSD: 0 };

                  return (
                    <tr key={client.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center text-blue-200 font-bold text-xs shrink-0 shadow-sm">
                            {initial}
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedCrmClient(client)}
                              className="font-semibold text-white hover:text-[#C7D300] tracking-tight text-sm flex items-center gap-1.5 flex-wrap text-left cursor-pointer transition-colors"
                            >
                              <span>{client.name}</span>
                              {isNew && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-[#C7D300]/20 text-[#C7D300] border border-[#C7D300]/30">NOUVEAU</span>
                              )}
                              {client.isSuspended && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-red-500/15 text-red-400 border border-red-500/30">SUSPENDU</span>
                              )}
                              {client.crmTags.map((tag) => (
                                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                                  {tag}
                                </span>
                              ))}
                            </button>
                            <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-2">
                              <span className="font-mono">ID: {client.id.substring(0, 8)}</span>
                              {client.crmNote && <span className="text-gray-400 truncate max-w-[180px]">· {client.crmNote}</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {client.phone ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs text-gray-200 font-semibold">{client.phone}</span>
                            <button onClick={() => copyToClipboard(client.phone, `phone-${client.id}`)} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Copier">
                              {copiedId === `phone-${client.id}` ? <Check size={12} className="text-[#C7D300]" /> : <Copy size={12} />}
                            </button>
                            <a href={`tel:${client.phone}`} className="p-1 rounded-md text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors" title="Appeler"><Phone size={12} /></a>
                            <a href={`https://wa.me/${client.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-colors" title="WhatsApp"><MessageCircle size={12} /></a>
                          </div>
                        ) : <span className="text-xs text-gray-600 italic">Non renseigné</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        {client.email ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-300 truncate max-w-[180px]">{client.email}</span>
                            <button onClick={() => copyToClipboard(client.email, `email-${client.id}`)} className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors" title="Copier">{copiedId === `email-${client.id}` ? <Check size={12} className="text-[#C7D300]" /> : <Copy size={12} />}</button>
                          </div>
                        ) : <span className="text-xs text-gray-600 italic">Non renseigné</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="text-xs">
                          <div className="font-bold text-[#C7D300] tabular-nums">
                            ${Math.round(cStats.totalSpentUSD).toLocaleString("fr-FR")}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            {cStats.ordersCount} commande{cStats.ordersCount > 1 ? "s" : ""}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        {client.isOnline ? (
                          <span className="inline-flex items-center space-x-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                            <span>En Ligne</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-gray-400 bg-white/5 border border-white/5 px-2 py-0.5 rounded-full text-[11px] font-medium">
                            <Clock size={10} className="text-gray-500" />
                            <span>{client.createdAt ? client.createdAt.toLocaleDateString("fr-FR") : "—"}</span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedCrmClient(client)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#C7D300]/15 hover:bg-[#C7D300]/25 text-[#C7D300] rounded-lg text-xs font-bold transition-colors border border-[#C7D300]/30 cursor-pointer"
                            title="Ouvrir la Fiche Client 360° (Achats, Tags, Notes, Push)"
                          >
                            <Eye size={13} />
                            <span>Fiche 360°</span>
                          </button>
                          <button
                            onClick={() => { setClientToPromote(client); setPromoteStoreName(client.name || ""); }}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 rounded-lg text-xs font-semibold transition-colors border border-blue-500/20 cursor-pointer"
                            title="Convertir ce compte en Admin ou Fournisseur"
                          >
                            <ArrowRightCircle size={13} />
                          </button>
                          <button
                            onClick={() => setClientToDelete(client)}
                            className="inline-flex items-center gap-1 px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg text-xs font-semibold transition-colors border border-red-500/20 cursor-pointer"
                            title="Supprimer définitivement ce compte client pour libérer son email"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Mobile Cards (visible on mobile < md) ── */}
        <div className="md:hidden p-3 space-y-3">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Chargement...</p>
            </div>
          ) : filteredAndSortedClients.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              <UsersIcon size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs font-semibold text-white">Aucun client trouvé</p>
            </div>
          ) : (
            filteredAndSortedClients.map((client) => {
              const initial = (client.name || "C").charAt(0).toUpperCase();
              const isNew = isRecentClient(client.createdAt);
              return (
                <div key={client.id} className="bg-black/30 border border-white/[0.08] rounded-2xl p-4 space-y-3">
                  {/* Top row: avatar + name + status */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center text-blue-200 font-bold text-sm shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm truncate">{client.name}</span>
                        {isNew && <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-[#C7D300]/20 text-[#C7D300] border border-[#C7D300]/30 shrink-0">NOUVEAU</span>}
                      </div>
                      <div className="text-[11px] text-gray-500 font-mono">ID: {client.id.substring(0, 8)}...</div>
                    </div>
                    {client.isOnline ? (
                      <span className="inline-flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded-full text-[10px] font-semibold shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        En ligne
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-gray-500 bg-white/5 border border-white/5 px-2 py-1 rounded-full text-[10px] font-medium shrink-0">
                        <Clock size={10} />Hors ligne
                      </span>
                    )}
                  </div>

                  {/* Contact info */}
                  <div className="space-y-2 text-xs">
                    {client.phone && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-gray-300">
                          <Phone size={12} className="text-gray-500 shrink-0" />
                          <span className="font-mono font-semibold">{client.phone}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => copyToClipboard(client.phone, `phone-${client.id}`)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white border border-white/10" title="Copier">
                            {copiedId === `phone-${client.id}` ? <Check size={11} className="text-[#C7D300]" /> : <Copy size={11} />}
                          </button>
                          <a href={`tel:${client.phone}`} className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Appeler"><Phone size={11} /></a>
                          <a href={`https://wa.me/${client.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-green-500/10 text-green-400 border border-green-500/20" title="WhatsApp"><MessageCircle size={11} /></a>
                        </div>
                      </div>
                    )}
                    {client.email && (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-gray-400 min-w-0">
                          <Mail size={12} className="text-gray-500 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                          <button onClick={() => copyToClipboard(client.email, `email-${client.id}`)} className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white border border-white/10" title="Copier">
                            {copiedId === `email-${client.id}` ? <Check size={11} className="text-[#C7D300]" /> : <Copy size={11} />}
                          </button>
                          <a href={`mailto:${client.email}`} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20" title="Email"><Mail size={11} /></a>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer: date + actions */}
                  <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={11} />
                        <span>{formatDate(client.createdAt)}</span>
                      </div>
                      <button
                        onClick={() => { const d = `Client : ${client.name}\nTél : ${client.phone || "—"}\nEmail : ${client.email || "—"}\nInscrit le : ${formatDate(client.createdAt)}`; navigator.clipboard.writeText(d); toast.success("📋 Fiche copiée !"); }}
                        className="text-gray-400 hover:text-white underline text-[11px] cursor-pointer"
                      >
                        Copier fiche
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <button
                        onClick={() => setSelectedCrmClient(client)}
                        className="flex items-center justify-center gap-1 py-2 px-2 bg-[#C7D300]/15 hover:bg-[#C7D300]/25 text-[#C7D300] rounded-xl text-xs font-bold border border-[#C7D300]/30 cursor-pointer"
                      >
                        <Eye size={13} />
                        <span>Fiche 360°</span>
                      </button>
                      <button
                        onClick={() => { setClientToPromote(client); setPromoteStoreName(client.name || ""); }}
                        className="flex items-center justify-center gap-1 py-2 px-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-xl text-xs font-semibold border border-blue-500/20 cursor-pointer"
                      >
                        <ArrowRightCircle size={13} />
                        <span>Convertir</span>
                      </button>
                      <button
                        onClick={() => setClientToDelete(client)}
                        className="flex items-center justify-center gap-1 py-2 px-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold border border-red-500/20 cursor-pointer"
                      >
                        <Trash2 size={13} />
                        <span>Suppr.</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}

      {/* MODAL : Enregistrer un Client Manuellement */}
      <ResponsiveModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Enregistrer un Nouveau Client"
        subtitle="Ajout manuel de coordonnées dans la base de données Rayon"
        icon={<UsersIcon size={20} />}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateClient} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Prénom</label>
              <input
                type="text"
                required
                placeholder="Ex: Jean"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">Nom</label>
              <input
                type="text"
                required
                placeholder="Ex: Mukendi"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Numéro de Téléphone (Mobile Money / Contact)
            </label>
            <input
              type="tel"
              placeholder="+243 82 000 00 00"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Adresse Email</label>
            <input
              type="email"
              placeholder="client@gmail.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">Adresse / Ville (Facultatif)</label>
            <input
              type="text"
              placeholder="Gombe, Kinshasa"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
            />
          </div>

          <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Enregistrement...</span>
              ) : (
                <>
                  <UserCheck size={15} />
                  <span>Ajouter à la base de données</span>
                </>
              )}
            </button>
          </div>
        </form>
      </ResponsiveModal>

      {/* MODAL : Confirmation de Suppression Définitive d'un Client */}
      <ResponsiveModal
        isOpen={!!clientToDelete}
        onClose={() => !isDeleting && setClientToDelete(null)}
        title="Supprimer Définitivement ce Client ?"
        subtitle="Libération d'adresse email et suppression des accès"
        icon={<AlertTriangle size={20} className="text-red-400" />}
        maxWidth="md"
      >
        {clientToDelete && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs leading-relaxed space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-red-400">
                <ShieldAlert size={16} />
                Action irréversible sur le compte
              </p>
              <p>
                Vous êtes sur le point de supprimer le compte de{" "}
                <span className="font-bold text-white">{clientToDelete.name}</span>{" "}
                ({clientToDelete.email || clientToDelete.phone || "Sans email"}).
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-300 pt-1">
                <li>Le compte sera supprimé de <strong>Firebase Authentication</strong>.</li>
                <li>Son profil sera retiré de la collection Firestore <code>users</code>.</li>
                <li><strong>L'adresse email sera immédiatement libérée</strong> pour créer un compte administrateur ou boutique sans erreur de doublon.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setClientToDelete(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteClient}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-500 hover:bg-red-600 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isDeleting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Suppression en cours...</span>
                  </div>
                ) : (
                  <>
                    <Trash2 size={15} />
                    <span>Supprimer et Libérer l'Email</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* MODAL : Conversion / Promotion de Rôle d'un Client */}
      <ResponsiveModal
        isOpen={!!clientToPromote}
        onClose={() => !isPromoting && setClientToPromote(null)}
        title="Convertir le Rôle du Client"
        subtitle="Transformer ce compte sans le supprimer ni réinitialiser ses données"
        icon={<UserPlus size={20} className="text-blue-400" />}
        maxWidth="md"
      >
        {clientToPromote && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
              <p className="font-semibold text-white mb-1">
                Compte sélectionné : {clientToPromote.name} ({clientToPromote.email || "Sans email"})
              </p>
              <p className="text-gray-300 text-[11px]">
                Plutôt que de supprimer le client pour recréer son compte, vous pouvez directement lui attribuer les droits d'administration, de boutique ou de partenaire d'affaires.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-300">
                Sélectionnez le nouveau statut / rôle à lui attribuer :
              </label>
              <select
                value={targetRole}
                onChange={(e) => setTargetRole(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-400 cursor-pointer"
              >
                <optgroup label="Équipe Administrative Centrale">
                  <option value="SUB_ADMIN">Sous-Administrateur (Gestion générale)</option>
                  <option value="ADMIN_FINANCE">Admin Finances & Trésorerie (Comptabilité, Payouts)</option>
                  <option value="ADMIN_DB">Admin Base de Données (Clients & Fournisseurs)</option>
                  <option value="ADMIN_OPS">Admin Opérations & Logistique (Commandes, Livraisons)</option>
                </optgroup>
                <optgroup label="Partenariat & Vente">
                  <option value="SUPPLIER">Fournisseur / Boutique marchande</option>
                  <option value="PARTNER">Partenaire Apporteur d'Affaires (Recruteur Fournisseurs)</option>
                </optgroup>
              </select>
            </div>

            {targetRole === "SUPPLIER" && (
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/10 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Nom commercial de la Boutique
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Kin Boutique Store"
                    value={promoteStoreName}
                    onChange={(e) => setPromoteStoreName(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1">
                    Rayon d'Activité
                  </label>
                  <select
                    value={promoteRayon}
                    onChange={(e) => setPromoteRayon(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-blue-400 cursor-pointer"
                  >
                    <option value="connect">Rayon Connect (High-Tech, Matériel, Télécoms)</option>
                    <option value="immo">Rayon Immo (Immobilier, Bailleurs, Agences)</option>
                    <option value="mode">Rayon Mode (Vêtements, Chaussures, Accessoires)</option>
                    <option value="saveurs">Rayon Saveurs (Restaurants, Traiteurs, Épicerie)</option>
                  </select>
                </div>
              </div>
            )}

            {targetRole === "PARTNER" && (
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/25 space-y-1 text-xs">
                <span className="font-bold text-purple-300 flex items-center gap-1.5">
                  <span>🤝</span>
                  <span>Partenaire Apporteur d&apos;Affaires</span>
                </span>
                <p className="text-gray-300 text-[11px] leading-relaxed">
                  Ce compte n&apos;a aucun rayon ni boutique propre. Il disposera d&apos;un code partenaire officiel pour inscrire des fournisseurs et percevra ses commissions récurrentes gérées par l&apos;administration centrale.
                </p>
              </div>
            )}

            <div className="text-[11px] text-gray-400 bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
              <p className="font-semibold text-white">Conséquences de la conversion :</p>
              <p>• Les claims de sécurité Firebase Auth sont synchronisés instantanément.</p>
              <p>• À sa prochaine connexion (ou rafraîchissement), l&apos;utilisateur sera automatiquement redirigé vers son espace dédié.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                type="button"
                disabled={isPromoting}
                onClick={() => setClientToPromote(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPromoting}
                onClick={handlePromoteClient}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isPromoting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Conversion en cours...</span>
                  </div>
                ) : (
                  <>
                    <ArrowRightCircle size={15} />
                    <span>Appliquer la conversion</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* DRAWER : Fiche Client 360° (CRM) */}
      <ClientCrmDrawer
        client={selectedCrmClient}
        onClose={() => setSelectedCrmClient(null)}
      />
    </div>
  );
}
