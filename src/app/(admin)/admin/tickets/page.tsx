"use client";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  LifeBuoy, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  MessageSquare, 
  User, 
  Store, 
  RefreshCw,
  Inbox
} from "lucide-react";
import { Ticket, TicketStatus, TicketCategory } from "@/types/tickets";
import { TicketConversation } from "@/modules/tickets/components/TicketConversation";
import { getCategoryBadge, getStatusBadge, getPriorityBadge } from "@/lib/ticketService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminTicketsPage() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  useEffect(() => {
    const q = query(collection(db, "tickets"), orderBy("updatedAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Ticket[] = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        })) as Ticket[];
        setTickets(fetched);
        setLoading(false);

        // Auto select first ticket if none selected on desktop
        if (fetched.length > 0 && !selectedTicketId && window.innerWidth >= 1024) {
          setSelectedTicketId(fetched[0].id);
        }
      },
      (err) => {
        console.warn("Tickets listener error:", err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredTickets = tickets.filter((t) => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = t.ticketNumber?.toLowerCase().includes(q);
      const matchSubj = t.subject?.toLowerCase().includes(q);
      const matchName = t.creatorName?.toLowerCase().includes(q);
      const matchEmail = t.creatorEmail?.toLowerCase().includes(q);
      const matchOrder = t.orderId?.toLowerCase().includes(q);
      if (!matchNum && !matchSubj && !matchName && !matchEmail && !matchOrder) {
        return false;
      }
    }
    // Status
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    // Role
    if (roleFilter !== "all" && t.creatorRole !== roleFilter) return false;
    // Category
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;

    return true;
  });

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  // Stats
  const totalCount = tickets.length;
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "resolved" || t.status === "closed").length;
  const unreadCount = tickets.filter((t) => t.unreadByAdmin).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <LifeBuoy size={20} />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">Support & Assistance Tickets</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Gérez toutes les demandes et réclamations des clients et des fournisseurs en temps réel.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Tickets</p>
            <p className="text-2xl font-bold text-white mt-0.5">{totalCount}</p>
          </div>
          <div className="p-3 bg-slate-800/80 rounded-xl text-slate-400">
            <Inbox size={20} />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-400 font-medium">Ouverts (Nouveaux)</p>
            <p className="text-2xl font-bold text-blue-400 mt-0.5">{openCount}</p>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-400 font-medium">En cours de traitement</p>
            <p className="text-2xl font-bold text-amber-400 mt-0.5">{inProgressCount}</p>
          </div>
          <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
            <AlertCircle size={20} />
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-emerald-400 font-medium">Résolus / Clôturés</p>
            <p className="text-2xl font-bold text-emerald-400 mt-0.5">{resolvedCount}</p>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Desk View: Filters + Two-Pane Container */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[750px]">
        {/* Filters Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search size={16} className="absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Rechercher par #ticket, sujet, nom, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="open">Ouverts uniquement</option>
              <option value="in_progress">En cours</option>
              <option value="closed">Clôturés / Archivés</option>
            </select>

            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="all">Tous les demandeurs</option>
              <option value="client">Clients</option>
              <option value="supplier">Fournisseurs</option>
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="all">Toutes catégories</option>
              <option value="order">Commandes</option>
              <option value="delivery">Livraison</option>
              <option value="payment">Paiement</option>
              <option value="product">Produits</option>
              <option value="property">Immobilier</option>
              <option value="technical">Technique</option>
              <option value="account">Compte</option>
            </select>
          </div>
        </div>

        {/* Master-Detail Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Tickets List */}
          <div
            className={`w-full lg:w-96 border-r border-slate-800 overflow-y-auto flex flex-col bg-slate-900/40 ${
              selectedTicketId ? "hidden lg:flex" : "flex"
            }`}
          >
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Chargement des tickets...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm flex flex-col items-center gap-2">
                <LifeBuoy size={32} className="opacity-40" />
                <p>Aucun ticket correspondant.</p>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = t.id === selectedTicketId;
                const status = getStatusBadge(t.status);
                const category = getCategoryBadge(t.category);
                const priority = getPriorityBadge(t.priority);
                const isUnread = t.unreadByAdmin;
                const isArchived = t.status === "closed" || t.status === "resolved" || t.isArchived;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-4 border-b border-slate-800/80 cursor-pointer transition-colors relative ${
                      isSelected
                        ? "bg-purple-600/10 border-l-4 border-l-purple-500"
                        : "hover:bg-slate-800/50"
                    }`}
                  >
                    {isUnread && (
                      <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-purple-500 animate-pulse" />
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-slate-400">
                        {t.ticketNumber}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border ${category.color}`}>
                        {category.label}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold ${
                          t.creatorRole === "supplier"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-blue-500/10 text-blue-400"
                        }`}
                      >
                        {t.creatorRole === "supplier" ? <Store size={10} /> : <User size={10} />}
                        {t.creatorRole === "supplier" ? "Fournisseur" : "Client"}
                      </span>
                      {isArchived && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
                          Archivé
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-semibold text-white line-clamp-1 mb-1">{t.subject}</h4>

                    {/* Order or Supplier Badge if present */}
                    {(t.orderId || t.supplierName) && (
                      <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[10px]">
                        {t.orderId && (
                          <span className="text-purple-400 font-mono bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                            Cmd: #{t.orderId.slice(-6).toUpperCase()}
                          </span>
                        )}
                        {t.supplierName && (
                          <span className="text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Store size={9} />
                            {t.supplierName}
                          </span>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                      {t.lastMessage || "Nouveau ticket..."}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>{t.creatorName}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${status.color}`}>
                          {status.label}
                        </span>
                        <span>
                          {t.updatedAt?.seconds
                            ? format(new Date(t.updatedAt.seconds * 1000), "d MMM HH:mm", { locale: fr })
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Right Column: Ticket Conversation & Actions */}
          <div className={`flex-1 flex flex-col ${!selectedTicketId ? "hidden lg:flex" : "flex"}`}>
            {selectedTicket ? (
              <TicketConversation
                ticket={selectedTicket}
                userRole="admin"
                onBack={() => setSelectedTicketId(null)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-400 mb-4">
                  <LifeBuoy size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-300">Aucun ticket sélectionné</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Sélectionnez un ticket dans la colonne de gauche pour afficher la conversation en direct, intervenir et assister le demandeur.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
