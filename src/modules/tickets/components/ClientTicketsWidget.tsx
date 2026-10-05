"use client";

import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  LifeBuoy, 
  Plus, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  MessageSquare, 
  ChevronRight,
  ShieldCheck,
  HelpCircle,
  X
} from "lucide-react";
import { Ticket } from "@/types/tickets";
import { TicketConversation } from "./TicketConversation";
import { NewTicketModal } from "./NewTicketModal";
import { getCategoryBadge, getStatusBadge, getPriorityBadge } from "@/lib/ticketService";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function ClientTicketsWidget() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Requêtes limitées aux tickets du client (Firestore refuse une lecture de toute la collection)
    const byCreator = new Map<string, Ticket>();
    const byClient = new Map<string, Ticket>();

    const publish = () => {
      const merged = new Map<string, Ticket>([...byClient, ...byCreator]);
      const list = Array.from(merged.values()).sort((a: any, b: any) => {
        const tA = a.updatedAt?.toMillis?.() ?? 0;
        const tB = b.updatedAt?.toMillis?.() ?? 0;
        return tB - tA;
      });
      setTickets(list);
      setLoading(false);

      // Keep selected ticket in sync
      setSelectedTicket((current) => {
        if (!current) return current;
        return list.find((t) => t.id === current.id) || current;
      });
    };

    const onError = (err: any) => {
      console.warn("Client tickets listener error:", err.message);
      setLoading(false);
    };

    const unsubCreator = onSnapshot(
      query(collection(db, "tickets"), where("creatorId", "==", user.uid)),
      (snapshot) => {
        byCreator.clear();
        snapshot.docs.forEach((d) => byCreator.set(d.id, { id: d.id, ...d.data() } as Ticket));
        publish();
      },
      onError
    );

    const unsubClient = onSnapshot(
      query(collection(db, "tickets"), where("clientId", "==", user.uid)),
      (snapshot) => {
        byClient.clear();
        snapshot.docs.forEach((d) => byClient.set(d.id, { id: d.id, ...d.data() } as Ticket));
        publish();
      },
      onError
    );

    const unsubscribe = () => {
      unsubCreator();
      unsubClient();
    };

    return () => unsubscribe();
  }, [user]);

  const [statusTab, setStatusTab] = useState<"all" | "active" | "archived">("all");

  const openCount = tickets.filter((t) => t.status === "open" || t.status === "in_progress").length;
  const archivedCount = tickets.filter((t) => t.status === "closed" || t.status === "resolved" || t.isArchived).length;

  const displayTickets = tickets.filter((t) => {
    const isClosedOrArchived = t.status === "closed" || t.status === "resolved" || t.isArchived;
    if (statusTab === "active") return !isClosedOrArchived;
    if (statusTab === "archived") return isClosedOrArchived;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner / Helpdesk bar */}
      <div className="bg-gradient-to-r from-purple-900/40 via-indigo-900/30 to-slate-900/50 p-6 rounded-2xl border border-purple-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg">
              <LifeBuoy size={18} />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400">
              Assistance & Support Client
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Besoin d'aide ou problème avec une commande ?
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xl">
            Notre équipe d'administration et nos partenaires sont disponibles pour résoudre tout souci technique, de livraison ou de paiement.
          </p>
        </div>

        <button
          onClick={() => setIsNewTicketOpen(true)}
          className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm shadow-lg shadow-purple-600/25 transition-all self-start md:self-center shrink-0"
        >
          <Plus size={16} />
          <span>Ouvrir un ticket</span>
        </button>
      </div>

      {/* Quick stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div 
          onClick={() => setStatusTab("all")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusTab === "all"
              ? "bg-purple-500/10 border-purple-500/30 ring-1 ring-purple-500"
              : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
          }`}
        >
          <p className="text-xs text-gray-500 dark:text-slate-400">Total Demandes</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">{tickets.length}</p>
        </div>
        <div 
          onClick={() => setStatusTab("active")}
          className={`p-4 rounded-xl border cursor-pointer transition-all ${
            statusTab === "active"
              ? "bg-amber-500/10 border-amber-500/30 ring-1 ring-amber-500"
              : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
          }`}
        >
          <p className="text-xs text-amber-600 dark:text-amber-400">En cours de traitement</p>
          <p className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">{openCount}</p>
        </div>
        <div 
          onClick={() => setStatusTab("archived")}
          className={`p-4 rounded-xl border cursor-pointer transition-all col-span-2 sm:col-span-1 ${
            statusTab === "archived"
              ? "bg-emerald-500/10 border-emerald-500/30 ring-1 ring-emerald-500"
              : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800"
          }`}
        >
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Clôturés & Archivés</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{archivedCount}</p>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 border-b border-gray-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-gray-900 dark:text-white text-base">Vos tickets d'assistance</h3>
            <span className="text-xs text-gray-500">({displayTickets.length})</span>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center bg-gray-100 dark:bg-slate-800/80 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusTab("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusTab === "all"
                  ? "bg-white dark:bg-slate-700 text-purple-600 dark:text-white shadow-xs"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Tous ({tickets.length})
            </button>
            <button
              onClick={() => setStatusTab("active")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusTab === "active"
                  ? "bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              En cours ({openCount})
            </button>
            <button
              onClick={() => setStatusTab("archived")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                statusTab === "archived"
                  ? "bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Archivés ({archivedCount})
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Chargement de vos tickets...</div>
        ) : displayTickets.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <HelpCircle size={40} className="mx-auto text-gray-300 dark:text-slate-600 mb-3" />
            <p className="font-semibold text-gray-700 dark:text-gray-200">
              {statusTab === "archived" ? "Aucun ticket archivé" : "Aucun ticket ouvert"}
            </p>
            <p className="text-xs text-gray-400 mt-1 mb-4">
              {statusTab === "archived"
                ? "Dès qu'un problème est résolu, votre ticket est automatiquement clôturé et archivé ici."
                : "Si vous rencontrez le moindre problème avec vos achats ou livraisons, soumettez une requête ici."}
            </p>
            {statusTab !== "archived" && (
              <button
                onClick={() => setIsNewTicketOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-xs font-medium rounded-xl hover:bg-purple-700 transition-colors"
              >
                <Plus size={14} /> Poser une question
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-800">
            {displayTickets.map((t) => {
              const status = getStatusBadge(t.status);
              const category = getCategoryBadge(t.category);
              const isUnread = t.unreadByClient;
              const isArchived = t.status === "closed" || t.status === "resolved" || t.isArchived;

              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTicket(t)}
                  className="p-4 sm:p-5 hover:bg-gray-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors flex items-center justify-between gap-4 relative"
                >
                  {isUnread && (
                    <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                  )}

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-gray-500 dark:text-slate-400">
                        {t.ticketNumber}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${category.color}`}>
                        {category.label}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${status.color}`}>
                        {status.label}
                      </span>
                      {isArchived && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 border border-gray-200 dark:border-slate-700">
                          Archivé
                        </span>
                      )}
                      {t.orderId && (
                        <span className="text-[10px] text-gray-400 font-mono">
                          Cmd: #{t.orderId.slice(-6).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-gray-900 dark:text-white text-sm line-clamp-1">
                      {t.subject}
                    </h4>

                    <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-1">
                      {t.lastMessageSenderRole === "admin" ? (
                        <strong className="text-purple-600 dark:text-purple-400">Support Rayon : </strong>
                      ) : null}
                      {t.lastMessage || "Ticket créé."}
                    </p>

                    <p className="text-[11px] text-gray-400">
                      Mis à jour le{" "}
                      {t.updatedAt?.seconds
                        ? format(new Date(t.updatedAt.seconds * 1000), "d MMMM à HH:mm", { locale: fr })
                        : "À l'instant"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-gray-400 shrink-0">
                    <span className="text-xs font-medium text-purple-600 hidden sm:inline">
                      Voir la conversation
                    </span>
                    <ChevronRight size={18} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket Conversation Modal for Client */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-4xl h-[85vh] flex flex-col bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
            <TicketConversation
              ticket={selectedTicket}
              userRole="client"
              onBack={() => setSelectedTicket(null)}
            />
          </div>
        </div>
      )}

      {/* New Ticket Modal */}
      <NewTicketModal
        isOpen={isNewTicketOpen}
        onClose={() => setIsNewTicketOpen(false)}
        onCreated={(id) => {
          const t = tickets.find((x) => x.id === id);
          if (t) setSelectedTicket(t);
        }}
        role="client"
      />
    </div>
  );
}
