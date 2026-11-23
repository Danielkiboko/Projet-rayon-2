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
    <div className="space-y-5">
      {/* Page Header Exécutif */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${selectedTicketId ? "hidden lg:flex" : "flex"}`}>
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">Support &amp; Tickets</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white/[0.06] text-gray-300 border border-white/10">
              {openCount} ouvert(s)
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Suivi en temps réel des demandes et réclamations des clients et fournisseurs.
          </p>
        </div>
      </div>

      {/* 4 Cartes KPI Exécutives */}
      <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 ${selectedTicketId ? "hidden lg:grid" : "grid"}`}>
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Total</span>
            <span className="p-1.5 bg-white/[0.05] rounded-lg text-gray-300"><Inbox size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums">{totalCount}</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Ouverts</span>
            <span className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg"><Clock size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-sky-400 tabular-nums">{openCount}</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">En cours</span>
            <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg"><AlertCircle size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-amber-400 tabular-nums">{inProgressCount}</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Résolus</span>
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg"><CheckCircle2 size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">{resolvedCount}</p>
        </div>
      </div>

      {/* Desk View: Filters + Two-Pane Container */}
      <div className={`bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col ${selectedTicketId ? "h-[calc(100dvh-130px)] lg:h-[750px]" : "h-[calc(100dvh-260px)] min-h-[480px] lg:h-[750px]"}`}>
        {/* Filters Bar */}
        <div className={`p-3 sm:p-4 border-b border-white/[0.08] bg-white/[0.01] flex flex-wrap items-center justify-between gap-3 ${selectedTicketId ? "hidden lg:flex" : "flex"}`}>
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher #ticket, sujet, nom..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-white/25"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 focus:outline-none focus:border-white/25"
            >
              <option value="all" className="bg-[#0F1D27]">Tous les statuts</option>
              <option value="open" className="bg-[#0F1D27]">Ouverts</option>
              <option value="in_progress" className="bg-[#0F1D27]">En cours</option>
              <option value="closed" className="bg-[#0F1D27]">Clôturés</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 focus:outline-none focus:border-white/25"
            >
              <option value="all" className="bg-[#0F1D27]">Tous les demandeurs</option>
              <option value="client" className="bg-[#0F1D27]">Clients</option>
              <option value="supplier" className="bg-[#0F1D27]">Fournisseurs</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white/[0.04] border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-gray-200 focus:outline-none focus:border-white/25"
            >
              <option value="all" className="bg-[#0F1D27]">Toutes catégories</option>
              <option value="order" className="bg-[#0F1D27]">Commandes</option>
              <option value="delivery" className="bg-[#0F1D27]">Livraison</option>
              <option value="payment" className="bg-[#0F1D27]">Paiement</option>
              <option value="product" className="bg-[#0F1D27]">Produits</option>
              <option value="property" className="bg-[#0F1D27]">Immobilier</option>
              <option value="technical" className="bg-[#0F1D27]">Technique</option>
              <option value="account" className="bg-[#0F1D27]">Compte</option>
            </select>
          </div>
        </div>

        {/* Master-Detail Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Tickets List */}
          <div
            className={`w-full lg:w-96 border-r border-white/10 overflow-y-auto flex flex-col bg-black/10 ${
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
                    className={`p-4 border-b border-white/5 cursor-pointer transition-colors relative ${
                      isSelected
                        ? "bg-[#C7D300]/10 border-l-4 border-l-[#C7D300]"
                        : "hover:bg-white/[0.03]"
                    }`}
                  >
                    {isUnread && (
                      <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-[#C7D300] animate-pulse" />
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-gray-400">
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/10">
                          Archivé
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-semibold text-white line-clamp-1 mb-1">{t.subject}</h4>

                    {/* Order or Supplier Badge if present */}
                    {(t.orderId || t.supplierName) && (
                      <div className="flex flex-wrap items-center gap-2 mb-1.5 text-[10px]">
                        {t.orderId && (
                          <span className="text-[#C7D300] font-mono bg-[#C7D300]/10 border border-[#C7D300]/20 px-1.5 py-0.5 rounded">
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
