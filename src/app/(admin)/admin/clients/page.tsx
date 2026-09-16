"use client";

import { useState, useEffect } from "react";
import { Search, Users as UsersIcon, UserCheck, UserX, Clock, ShieldAlert, Sparkles, RefreshCw } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, limit, onSnapshot } from "firebase/firestore";
import { isSupplier, isTeamMember, hasAdminAccess } from "@/lib/permissions";

interface ClientData {
  id: string;
  name: string;
  email: string;
  phone: string;
  isOnline: boolean;
  lastConnection: Date | null;
  role?: string;
  createdAt?: Date | null;
}

/**
 * Détermine si un compte doit être EXCLU de la liste des clients.
 * Les Fournisseurs (Immo, Mode, etc.), les Fonctionnaires/Staff et les Livreurs ont leurs propres sections dédiées.
 */
function isExcludedFromClients(data: any): boolean {
  if (!data) return false;
  const role = (data.role || "").toUpperCase();
  const email = (data.email || "").toLowerCase().trim();

  // 1. Super Admin
  if (email === "danielkiboko218@gmail.com" || role === "SUPER_ADMIN" || role === "SUPERADMIN") {
    return true;
  }

  // 2. Fonctionnaires & Équipe interne (Admin team / staff)
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

  // 3. Fournisseurs (Tous rayons : Immo, Mode, Tech, Saveurs, Sous-agents)
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
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ONLINE" | "OFFLINE">("ALL");
  const [clients, setClients] = useState<ClientData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);

    // Écoute en temps réel les utilisateurs pour suivre leur présence
    const q = query(collection(db, "users"), limit(250));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const clientsData: ClientData[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();

          // Exclure strictement les Fournisseurs, Fonctionnaires, Livreurs et Staff
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

          const rawName = data.displayName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || data.name;

          clientsData.push({
            id: doc.id,
            name: rawName || "Client Anonyme",
            email: data.email || "Non renseigné",
            phone: data.phoneNumber || data.phone || "Non renseigné",
            isOnline: !!data.isOnline,
            lastConnection: lastConn,
            role: data.role || "CLIENT",
            createdAt: created,
          });
        });

        // Tri : D'abord les personnes en ligne, puis par dernière connexion récente
        clientsData.sort((a, b) => {
          if (a.isOnline === b.isOnline) {
            if (!a.lastConnection && !b.lastConnection) return 0;
            if (!a.lastConnection) return 1;
            if (!b.lastConnection) return -1;
            return b.lastConnection.getTime() - a.lastConnection.getTime();
          }
          return a.isOnline ? -1 : 1;
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

  const filteredClients = clients.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === "ONLINE") return c.isOnline;
    if (statusFilter === "OFFLINE") return !c.isOnline;
    return true;
  });

  const formatDate = (date: Date | null) => {
    if (!date) return "Aucune connexion";
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const activeClientsCount = clients.filter((c) => c.isOnline).length;
  const offlineClientsCount = clients.length - activeClientsCount;

  return (
    <div className="space-y-6">
      {/* En-tête et statistiques rapides */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Clients Particuliers</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 text-blue-300 border border-blue-500/25">
              Consommateurs Réels
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Liste filtrée des clients acheteurs et locataires. Les fournisseurs et fonctionnaires sont automatiquement exclus.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`bg-[#0F1A23] border p-3.5 rounded-2xl flex items-center justify-between transition-all ${
              statusFilter === "ALL" ? "border-blue-500/50 shadow-md shadow-blue-950/20" : "border-white/[0.08] hover:border-white/20"
            }`}
          >
            <div className="text-left">
              <p className="text-[11px] text-gray-400 uppercase font-semibold">Total Clients</p>
              <p className="text-2xl font-bold text-white mt-0.5">{clients.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0 ml-3">
              <UsersIcon size={18} />
            </div>
          </button>

          <button
            onClick={() => setStatusFilter("ONLINE")}
            className={`bg-[#0F1A23] border p-3.5 rounded-2xl flex items-center justify-between transition-all ${
              statusFilter === "ONLINE" ? "border-emerald-500/50 shadow-md shadow-emerald-950/20" : "border-white/[0.08] hover:border-white/20"
            }`}
          >
            <div className="text-left">
              <p className="text-[11px] text-gray-400 uppercase font-semibold">En Ligne</p>
              <p className="text-2xl font-bold text-emerald-400 mt-0.5">{activeClientsCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 ml-3">
              <UserCheck size={18} />
            </div>
          </button>

          <button
            onClick={() => setStatusFilter("OFFLINE")}
            className={`bg-[#0F1A23] border p-3.5 rounded-2xl flex items-center justify-between transition-all col-span-2 sm:col-span-1 ${
              statusFilter === "OFFLINE" ? "border-gray-500/50 shadow-md" : "border-white/[0.08] hover:border-white/20"
            }`}
          >
            <div className="text-left">
              <p className="text-[11px] text-gray-400 uppercase font-semibold">Hors Ligne</p>
              <p className="text-2xl font-bold text-gray-300 mt-0.5">{offlineClientsCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/5 text-gray-400 border border-white/10 flex items-center justify-center shrink-0 ml-3">
              <UserX size={18} />
            </div>
          </button>
        </div>
      </div>

      {/* Barre de recherche et onglets */}
      <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-white/[0.06] flex flex-col sm:flex-row gap-3 justify-between items-center bg-white/[0.01]">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher par nom, email, téléphone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/[0.08] rounded-xl focus:outline-none focus:border-blue-500 text-white text-xs placeholder:text-gray-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-black/30 border border-white/[0.06] rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "ALL" ? "bg-white text-gray-900 font-bold shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              Tous ({clients.length})
            </button>
            <button
              onClick={() => setStatusFilter("ONLINE")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                statusFilter === "ONLINE" ? "bg-emerald-600 text-white font-bold shadow-sm" : "text-gray-400 hover:text-white"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>En ligne ({activeClientsCount})</span>
            </button>
            <button
              onClick={() => setStatusFilter("OFFLINE")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusFilter === "OFFLINE" ? "bg-white/10 text-white font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              Hors ligne ({offlineClientsCount})
            </button>
          </div>
        </div>

        {/* Tableau des clients */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-[11px] uppercase bg-black/20 text-gray-400 font-semibold border-b border-white/[0.06]">
              <tr>
                <th className="px-6 py-4">Client Particulier</th>
                <th className="px-6 py-4">Coordonnées</th>
                <th className="px-6 py-4">État de Présence</th>
                <th className="px-6 py-4">Dernière Activité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs">Chargement en direct des clients...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <p className="text-sm font-semibold text-gray-400">Aucun client particulier trouvé.</p>
                      <p className="text-xs text-gray-600">
                        {search ? "Essayez une autre recherche." : "Les comptes fournisseurs et fonctionnaires sont bien séparés."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredClients.map((client) => {
                  const initial = (client.name || "C").charAt(0).toUpperCase();

                  return (
                    <tr key={client.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-3.5">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center text-blue-200 font-bold text-sm shrink-0 shadow-sm">
                            {initial}
                          </div>
                          <div>
                            <div className="font-semibold text-white tracking-tight text-sm flex items-center gap-2">
                              <span>{client.name}</span>
                            </div>
                            <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                              ID: {client.id.substring(0, 10)}...
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-xs text-gray-200 font-medium">{client.email}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 font-mono">{client.phone}</div>
                      </td>

                      <td className="px-6 py-4">
                        {client.isOnline ? (
                          <span className="inline-flex items-center space-x-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full w-fit text-xs font-semibold">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span>En Ligne</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1.5 text-gray-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-full w-fit text-xs font-medium">
                            <UserX size={12} />
                            <span>Hors ligne</span>
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-2 text-xs text-gray-300">
                          <Clock size={13} className="text-gray-500 shrink-0" />
                          <span>{formatDate(client.lastConnection)}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
