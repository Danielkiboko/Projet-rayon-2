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
  Sparkles
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, limit, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { isSupplier, isTeamMember, hasAdminAccess } from "@/lib/permissions";

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
}

/**
 * Détermine si un compte doit être EXCLU de la liste des clients particuliers.
 * Les Fournisseurs, Fonctionnaires, Équipe admin et Livreurs ont leurs sections dédiées.
 */
function isExcludedFromClients(data: any): boolean {
  if (!data) return false;
  const role = (data.role || "").toUpperCase();
  const email = (data.email || "").toLowerCase().trim();

  // 1. Super Admin
  if (email === "danielkiboko218@gmail.com" || role === "SUPER_ADMIN" || role === "SUPERADMIN") {
    return true;
  }

  // 2. Fonctionnaires & Équipe interne
  if (
    isTeamMember(data) ||
    hasAdminAccess(null, data) ||
    role.includes("ADMIN") ||
    role.includes("FONCTIONNAIRE") ||
    role.includes("STAFF") ||
    role.includes("COLLABORAT")
  ) {
    return true;
  }

  // 3. Fournisseurs
  if (
    isSupplier(data) ||
    role.includes("SUPPLIER") ||
    role.includes("FOURNISSEUR") ||
    !!data.parentSupplierId ||
    !!data.companyName ||
    !!data.rccm ||
    !!data.nif ||
    !!data.idNat ||
    !!data.businessType ||
    !!data.serviceAttached ||
    (Array.isArray(data.assignedRayons) && data.assignedRayons.length > 0)
  ) {
    return true;
  }

  // 4. Livreurs & Chauffeurs
  if (
    role.includes("DRIVER") ||
    role.includes("LIVREUR") ||
    role.includes("CHAUFFEUR") ||
    role.includes("DELIVERY") ||
    role.includes("COURSIER")
  ) {
    return true;
  }

  // 5. Locataires (gérés dans la gestion immobilière)
  if (role.includes("TENANT") || role.includes("LOCATAIRE")) {
    return true;
  }

  return false;
}

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "NEW" | "ONLINE" | "WITH_PHONE">("ALL");
  const [sortBy, setSortBy] = useState<"NEWEST" | "ONLINE" | "NAME">("NEWEST");
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Copied feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  const copyToClipboard = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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
      alert("✅ Nouveau client enregistré avec succès dans la base de données !");
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

      return true;
    })
    .sort((a, b) => {
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
  const withPhoneCount = clients.filter((c) => !!c.phone && c.phone.trim().length > 3).length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Répertoire & Nouveaux Clients</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C7D300]/20 text-[#C7D300] border border-[#C7D300]/30">
              Coordonnées Acheteurs
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Suivi des clients enregistrés sur Rayon.net. Récupérez leurs coordonnées (nom, email, téléphone) pour votre CRM, vos actions marketing et votre base de données.
          </p>
        </div>

        {/* Boutons d'actions Admin */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={exportClientsCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all border border-white/10 shadow-sm"
            title="Télécharger la liste sous format Excel/CSV"
          >
            <Download size={15} />
            <span>Exporter Coordonnées (CSV)</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <Plus size={16} />
            <span>Enregistrer un Client</span>
          </button>
        </div>
      </div>

      {/* Cartes statistiques */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => { setFilterType("ALL"); setSortBy("NEWEST"); }}
          className={`bg-[#0F1A23] border p-3.5 rounded-2xl flex items-center justify-between transition-all text-left ${
            filterType === "ALL" ? "border-blue-500/50 shadow-md shadow-blue-950/20" : "border-white/[0.08] hover:border-white/20"
          }`}
        >
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Total Base</p>
            <p className="text-2xl font-bold text-white mt-0.5">{clients.length}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
            <UsersIcon size={18} />
          </div>
        </button>

        <button
          onClick={() => { setFilterType("NEW"); setSortBy("NEWEST"); }}
          className={`bg-[#0F1A23] border p-3.5 rounded-2xl flex items-center justify-between transition-all text-left ${
            filterType === "NEW" ? "border-[#C7D300]/50 shadow-md shadow-[#C7D300]/10" : "border-white/[0.08] hover:border-white/20"
          }`}
        >
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Nouveaux (7j)</p>
            <p className="text-2xl font-bold text-[#C7D300] mt-0.5">{recentCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#C7D300]/10 text-[#C7D300] border border-[#C7D300]/20 flex items-center justify-center shrink-0">
            <Sparkles size={18} />
          </div>
        </button>

        <button
          onClick={() => setFilterType("WITH_PHONE")}
          className={`bg-[#0F1A23] border p-3.5 rounded-2xl flex items-center justify-between transition-all text-left ${
            filterType === "WITH_PHONE" ? "border-purple-500/50 shadow-md" : "border-white/[0.08] hover:border-white/20"
          }`}
        >
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Avec Téléphone</p>
            <p className="text-2xl font-bold text-purple-400 mt-0.5">{withPhoneCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
            <Phone size={18} />
          </div>
        </button>

        <button
          onClick={() => setFilterType("ONLINE")}
          className={`bg-[#0F1A23] border p-3.5 rounded-2xl flex items-center justify-between transition-all text-left ${
            filterType === "ONLINE" ? "border-emerald-500/50 shadow-md" : "border-white/[0.08] hover:border-white/20"
          }`}
        >
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">En Ligne</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{activeClientsCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <UserCheck size={18} />
          </div>
        </button>
      </div>

      {/* Barre de recherche, filtres et tri */}
      <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-white/[0.06] flex flex-col md:flex-row gap-3 justify-between items-center bg-white/[0.01]">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/[0.08] rounded-xl focus:outline-none focus:border-blue-500 text-white text-xs placeholder:text-gray-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
            {/* Tri */}
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="hidden sm:inline">Trier par :</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-black/30 border border-white/[0.08] text-white text-xs rounded-xl px-2.5 py-1.5 focus:outline-none"
              >
                <option value="NEWEST">Plus récents d'abord</option>
                <option value="ONLINE">Présence (En ligne)</option>
                <option value="NAME">Nom (A-Z)</option>
              </select>
            </div>

            {/* Filtres tabs */}
            <div className="flex items-center gap-1 p-1 bg-black/30 border border-white/[0.06] rounded-xl text-xs">
              <button
                onClick={() => setFilterType("ALL")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  filterType === "ALL" ? "bg-white text-gray-900 font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                Tous ({clients.length})
              </button>
              <button
                onClick={() => setFilterType("NEW")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                  filterType === "NEW" ? "bg-[#C7D300] text-[#0F1D27] font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                Nouveaux ({recentCount})
              </button>
              <button
                onClick={() => setFilterType("ONLINE")}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1 ${
                  filterType === "ONLINE" ? "bg-emerald-600 text-white font-bold" : "text-gray-400 hover:text-white"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>En ligne ({activeClientsCount})</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tableau des clients */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-[11px] uppercase bg-black/20 text-gray-400 font-semibold border-b border-white/[0.06]">
              <tr>
                <th className="px-6 py-4">Client Enregistré</th>
                <th className="px-6 py-4">Téléphone</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Inscription</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions rapides</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
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

                  return (
                    <tr key={client.id} className="hover:bg-white/[0.02] transition-colors">
                      {/* Nom & Initiales */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center text-blue-200 font-bold text-sm shrink-0 shadow-sm">
                            {initial}
                          </div>
                          <div>
                            <div className="font-semibold text-white tracking-tight text-sm flex items-center gap-2">
                              <span>{client.name}</span>
                              {isNew && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#C7D300]/20 text-[#C7D300] border border-[#C7D300]/30 animate-pulse">
                                  NOUVEAU
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                              ID: {client.id.substring(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Téléphone */}
                      <td className="px-6 py-4">
                        {client.phone ? (
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-gray-200 font-semibold">{client.phone}</span>
                            <button
                              onClick={() => copyToClipboard(client.phone, `phone-${client.id}`)}
                              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Copier le numéro"
                            >
                              {copiedId === `phone-${client.id}` ? <Check size={12} className="text-[#C7D300]" /> : <Copy size={12} />}
                            </button>
                            <a
                              href={`tel:${client.phone}`}
                              className="p-1 rounded-md text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                              title="Appeler"
                            >
                              <Phone size={12} />
                            </a>
                            <a
                              href={`https://wa.me/${client.phone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1 rounded-md text-gray-400 hover:text-green-400 hover:bg-green-500/10 transition-colors"
                              title="Contacter sur WhatsApp"
                            >
                              <MessageCircle size={12} />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600 italic">Non renseigné</span>
                        )}
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4">
                        {client.email ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-300">{client.email}</span>
                            <button
                              onClick={() => copyToClipboard(client.email, `email-${client.id}`)}
                              className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                              title="Copier l'email"
                            >
                              {copiedId === `email-${client.id}` ? <Check size={12} className="text-[#C7D300]" /> : <Copy size={12} />}
                            </button>
                            <a
                              href={`mailto:${client.email}`}
                              className="p-1 rounded-md text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                              title="Envoyer un email"
                            >
                              <Mail size={12} />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-600 italic">Non renseigné</span>
                        )}
                      </td>

                      {/* Date d'inscription */}
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1.5 text-xs text-gray-300">
                          <Calendar size={13} className="text-gray-500 shrink-0" />
                          <span>{formatDate(client.createdAt)}</span>
                        </div>
                      </td>

                      {/* Statut de présence */}
                      <td className="px-6 py-4">
                        {client.isOnline ? (
                          <span className="inline-flex items-center space-x-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>En Ligne</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-gray-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full text-xs font-medium">
                            <Clock size={11} className="text-gray-500" />
                            <span>{client.lastConnection ? formatDate(client.lastConnection) : "Déconnecté"}</span>
                          </span>
                        )}
                      </td>

                      {/* Actions rapides */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            const details = `Client : ${client.name}\nTéléphone : ${client.phone || "Non renseigné"}\nEmail : ${client.email || "Non renseigné"}\nDate inscription : ${formatDate(client.createdAt)}`;
                            navigator.clipboard.writeText(details);
                            alert("📋 Fiche contact copiée dans le presse-papier !");
                          }}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition-colors border border-white/5"
                        >
                          Copier fiche
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL : Enregistrer un Client Manuellement */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0F1D27] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Enregistrer un Nouveau Client</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Ajout manuel de coordonnées dans la base de données Rayon
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateClient} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] transition-all shadow-md flex items-center gap-2"
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
          </div>
        </div>
      )}
    </div>
  );
}
