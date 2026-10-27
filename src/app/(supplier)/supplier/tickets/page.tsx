"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  LifeBuoy, 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Inbox, 
  ShieldCheck, 
  User 
} from "lucide-react";
import { Ticket } from "@/types/tickets";
import { TicketConversation } from "@/modules/tickets/components/TicketConversation";
import { NewTicketModal } from "@/modules/tickets/components/NewTicketModal";
import { getCategoryBadge, getStatusBadge, getPriorityBadge } from "@/lib/ticketService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function SupplierTicketsPage() {
  const { user, userData } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const activeSupplierId = userData?.parentSupplierId || user?.uid;

  useEffect(() => {
    if (!user || !activeSupplierId) return;

    // Listen to tickets created by this supplier OR where supplierId == activeSupplierId
    const q = query(
      collection(db, "tickets"),
      orderBy("updatedAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Ticket[] = [];
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          if (
            data.creatorId === user.uid ||
            data.supplierId === activeSupplierId ||
            data.supplierId === user.uid
          ) {
            list.push({ id: docSnap.id, ...data } as Ticket);
          }
        });

        setTickets(list);
        setLoading(false);

        if (list.length > 0 && !selectedTicketId && window.innerWidth >= 1024) {
          setSelectedTicketId(list[0].id);
        }
      },
      (err) => {
        console.warn("Supplier tickets listener error:", err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, activeSupplierId]);

  const filteredTickets = tickets.filter((t) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNum = t.ticketNumber?.toLowerCase().includes(q);
      const matchSubj = t.subject?.toLowerCase().includes(q);
      const matchOrder = t.orderId?.toLowerCase().includes(q);
      if (!matchNum && !matchSubj && !matchOrder) return false;
    }
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  const selectedTicket = tickets.find((t) => t.id === selectedTicketId) || null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#C7D300]/15 text-[#C7D300] rounded-xl border border-[#C7D300]/30">
              <LifeBuoy size={20} />
            </span>
            <h1 className="text-2xl font-bold text-white tracking-tight">Support & Tickets</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Posez vos questions à l'équipe Rayons.net ou répondez aux requêtes d'assistance de vos clients.
          </p>
        </div>

        <button
          onClick={() => setIsNewTicketOpen(true)}
          className="flex items-center gap-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-[#C7D300]/20 transition-all w-max active:scale-95"
        >
          <Plus size={16} />
          <span>Ouvrir un ticket</span>
        </button>
      </div>

      {/* Two-Pane Container */}
      <div className="bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[720px]">
        {/* Search & Status Filters */}
        <div className="p-4 border-b border-white/10 bg-black/40 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={16} className="absolute left-3.5 top-3 text-gray-500" />
            <input
              type="text"
              placeholder="Rechercher par #ticket, sujet..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#C7D300]"
          >
            <option value="all">Tous les statuts</option>
            <option value="open">Ouverts</option>
            <option value="in_progress">En cours</option>
            <option value="resolved">Résolus</option>
            <option value="closed">Fermés</option>
          </select>
        </div>

        {/* Master-Detail */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: List */}
          <div
            className={`w-full lg:w-96 border-r border-white/10 overflow-y-auto flex flex-col bg-[#0F1D27]/80 ${
              selectedTicketId ? "hidden lg:flex" : "flex"
            }`}
          >
            {loading ? (
              <div className="p-8 text-center text-gray-500 text-sm">Chargement...</div>
            ) : filteredTickets.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                <LifeBuoy size={32} className="opacity-40" />
                <p>Aucun ticket d'assistance pour le moment.</p>
                <button
                  onClick={() => setIsNewTicketOpen(true)}
                  className="mt-2 text-xs text-[#C7D300] hover:underline font-bold"
                >
                  Créer votre premier ticket
                </button>
              </div>
            ) : (
              filteredTickets.map((t) => {
                const isSelected = t.id === selectedTicketId;
                const status = getStatusBadge(t.status);
                const category = getCategoryBadge(t.category);
                const isUnread = t.unreadBySupplier;

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTicketId(t.id)}
                    className={`p-4 border-b border-white/5 cursor-pointer transition-colors relative ${
                      isSelected
                        ? "bg-[#C7D300]/10 border-l-4 border-l-[#C7D300]"
                        : "hover:bg-white/5"
                    }`}
                  >
                    {isUnread && (
                      <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-[#C7D300] animate-pulse" />
                    )}

                    <div className="flex items-center gap-2 mb-1.5">
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
                        {t.creatorRole === "supplier" ? "Envoyé par vous" : "Client"}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-white line-clamp-1 mb-1">{t.subject}</h4>

                    <p className="text-xs text-slate-400 line-clamp-2 mb-2">
                      {t.lastMessage || "Nouveau ticket..."}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
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
                );
              })
            )}
          </div>

          {/* Right Column: Active Conversation */}
          <div className={`flex-1 flex flex-col ${!selectedTicketId ? "hidden lg:flex" : "flex"}`}>
            {selectedTicket ? (
              <TicketConversation
                ticket={selectedTicket}
                userRole="supplier"
                onBack={() => setSelectedTicketId(null)}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <LifeBuoy size={32} className="opacity-40 mb-3" />
                <h3 className="text-base font-bold text-slate-300">Aucun ticket sélectionné</h3>
                <p className="text-xs text-slate-500 max-w-xs mt-1">
                  Choisissez une demande dans la liste ou ouvrez un nouveau ticket pour contacter le support.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Ticket Modal */}
      <NewTicketModal
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onCreated={(id) => setSelectedTicketId(id)}
        role="supplier"
        defaultSupplierId={activeSupplierId}
      />
    </div>
  );
}
