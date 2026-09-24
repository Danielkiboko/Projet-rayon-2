"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search, Package, Clock, CheckCircle, Truck, XCircle, ShoppingBag,
  Download, LayoutGrid, List, Bell, UtensilsCrossed, ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from "firebase/firestore";
import { generateOrderInvoicePDF } from "@/lib/invoiceGenerator";
import { getSupplierType } from "@/lib/permissions";

interface Order {
  id: string;
  clientId: string;
  clientPhone?: string;
  clientAddress?: string;
  items: any[];
  totalAmount: number;
  deliveryFee: number;
  paymentStatus: string;
  status: string;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  createdAt: any;
  deliveredAt?: any;
  cancelledAt?: any;
}

// ── Statut Badge ──
const getStatusBadge = (status: string) => {
  const s = (status || "").toLowerCase();
  if (["delivered", "completed", "livre"].includes(s))
    return <span className="flex w-max items-center gap-1 text-green-400 bg-green-400/10 px-2 py-1 rounded-md text-xs font-medium"><CheckCircle size={12} />Livrée</span>;
  if (["pending_driver", "confirmed_awaiting_driver", "pending"].includes(s))
    return <span className="flex w-max items-center gap-1 text-orange-400 bg-orange-400/10 px-2 py-1 rounded-md text-xs font-medium"><Clock size={12} />Nouveau</span>;
  if (["driver_assigned", "accepted", "preparing"].includes(s))
    return <span className="flex w-max items-center gap-1 text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md text-xs font-medium"><Truck size={12} />En préparation</span>;
  if (["in_transit", "arrived_awaiting_payment", "ready"].includes(s))
    return <span className="flex w-max items-center gap-1 text-[#FF6B35] bg-[#FF6B35]/10 px-2 py-1 rounded-md text-xs font-medium"><Truck size={12} />En livraison</span>;
  if (s === "cancelled")
    return <span className="flex w-max items-center gap-1 text-red-400 bg-red-400/10 px-2 py-1 rounded-md text-xs font-medium"><XCircle size={12} />Annulée</span>;
  return <span className="w-max text-gray-400 bg-white/10 px-2 py-1 rounded-md text-xs font-medium">{status || "Inconnu"}</span>;
};

// ── Kanban Column ──
const KANBAN_COLS = [
  { key: "new",       label: "🆕 Nouvelles",      color: "border-orange-500/40 bg-orange-500/5",  statuses: ["pending_driver","confirmed_awaiting_driver","pending"] },
  { key: "prep",      label: "👨‍🍳 En préparation", color: "border-blue-500/40 bg-blue-500/5",    statuses: ["driver_assigned","accepted","preparing"] },
  { key: "ready",     label: "✅ Prêt à livrer",   color: "border-[#FF6B35]/40 bg-[#FF6B35]/5",  statuses: ["in_transit","arrived_awaiting_payment","ready"] },
  { key: "done",      label: "🎉 Livrées",          color: "border-green-500/40 bg-green-500/5",  statuses: ["delivered","completed","livre"] },
];

const getCol = (status: string) => {
  const s = (status || "").toLowerCase();
  return KANBAN_COLS.find(c => c.statuses.includes(s))?.key || "new";
};

const NEXT_STATUS: Record<string, string | null> = {
  pending_driver: "preparing",
  confirmed_awaiting_driver: "preparing",
  pending: "preparing",
  preparing: "ready",
  driver_assigned: "ready",
  accepted: "ready",
  ready: "delivered",
  in_transit: "delivered",
  arrived_awaiting_payment: "delivered",
};

export default function SupplierOrdersPage() {
  const { user, userData } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;
  const rayon = getSupplierType(userData);
  const isSaveurs = rayon === "saveurs";

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"table" | "kanban">(isSaveurs ? "kanban" : "table");
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const prevOrderIds = useRef<Set<string>>(new Set());
  const audioCtx = useRef<AudioContext | null>(null);

  // ── Son d'alerte ──
  const playAlert = useCallback(() => {
    try {
      if (!audioCtx.current) audioCtx.current = new AudioContext();
      const ctx = audioCtx.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {}
  }, []);

  useEffect(() => {
    if (!user || !activeSupplierId) return;
    const q = query(
      collection(db, "orders"),
      where("supplierId", "==", activeSupplierId),
      orderBy("createdAt", "desc"),
      limit(80)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const fetched: Order[] = [];
      const newIds = new Set<string>();
      let hasNew = false;

      snapshot.forEach(d => {
        fetched.push({ id: d.id, ...d.data() } as Order);
        newIds.add(d.id);
        if (!prevOrderIds.current.has(d.id) && prevOrderIds.current.size > 0) {
          hasNew = true;
        }
      });

      if (hasNew && isSaveurs) {
        playAlert();
        setNewOrderAlert(true);
        setTimeout(() => setNewOrderAlert(false), 4000);
      }

      prevOrderIds.current = newIds;
      setOrders(fetched);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsub();
  }, [user, activeSupplierId, isSaveurs, playAlert]);

  const filteredOrders = orders.filter(o => {
    const searchMatch = o.id.toLowerCase().includes(search.toLowerCase()) ||
      (o.clientPhone && o.clientPhone.includes(search));
    const s = (o.status || "").toLowerCase();
    let statusMatch = true;
    if (filter === "pending") statusMatch = ["pending_driver","confirmed_awaiting_driver","pending","driver_assigned","accepted"].includes(s);
    else if (filter === "in_transit") statusMatch = ["in_transit","arrived_awaiting_payment","preparing","ready"].includes(s);
    else if (filter === "delivered") statusMatch = ["delivered","completed","livre"].includes(s);
    else if (filter === "cancelled") statusMatch = s === "cancelled";
    return searchMatch && statusMatch;
  });

  // ── Kanban advance ──
  const advanceOrder = async (order: Order) => {
    const next = NEXT_STATUS[(order.status || "").toLowerCase()];
    if (!next) return;
    try {
      await updateDoc(doc(db, "orders", order.id), { status: next });
    } catch (e) {
      console.error("Error advancing order:", e);
    }
  };

  const accentColor = isSaveurs ? "#FF6B35" : rayon === "mode" ? "#D4B08C" : rayon === "connect" ? "#00B5A5" : "#C7D300";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            {isSaveurs ? <UtensilsCrossed size={24} style={{ color: accentColor }} /> : <ShoppingBag size={24} style={{ color: accentColor }} />}
            Gestion des Commandes
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {isSaveurs ? "Suivez les commandes en cuisine et à la livraison." : "Suivez l'état de vos livraisons en temps réel."}
          </p>
        </div>
        {/* Vue switch */}
        <div className="flex items-center gap-2">
          <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${viewMode === "table" ? "bg-white text-gray-950" : "text-gray-400 hover:text-white"}`}
            >
              <List size={14} />Liste
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${viewMode === "kanban" ? "bg-white text-gray-950" : "text-gray-400 hover:text-white"}`}
            >
              <LayoutGrid size={14} />Kanban
            </button>
          </div>
        </div>
      </div>

      {/* Alerte nouvelle commande Saveurs */}
      <AnimatePresence>
        {newOrderAlert && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-[#FF6B35]/40 bg-[#FF6B35]/10 shadow-lg"
          >
            <Bell size={20} className="text-[#FF6B35] animate-bounce" />
            <div>
              <p className="font-bold text-sm text-white">🍽️ Nouvelle commande reçue !</p>
              <p className="text-xs text-gray-400">Une commande vient d'être passée — consultez la vue Kanban.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtres / Recherche */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Rechercher par ID ou téléphone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 transition-all"
            style={{ "--tw-ring-color": accentColor } as any}
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none [&>option]:bg-[#0F1D27]"
        >
          <option value="all">Tous les statuts</option>
          <option value="pending">Nouvelles / En attente</option>
          <option value="in_transit">En préparation / En route</option>
          <option value="delivered">Livrées</option>
          <option value="cancelled">Annulées</option>
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: accentColor, borderTopColor: "transparent" }} />
          <p className="text-sm">Chargement des commandes...</p>
        </div>
      ) : viewMode === "table" ? (
        /* ────────────────── VUE TABLE ────────────────── */
        <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-300">
              <thead className="text-xs uppercase bg-black/40 text-gray-400 border-b border-white/5">
                <tr>
                  <th className="px-6 py-4">ID Commande</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Client</th>
                  <th className="px-6 py-4">Articles</th>
                  <th className="px-6 py-4">Montant</th>
                  <th className="px-6 py-4">Statut</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center text-gray-500">
                      <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
                      <p>Aucune commande ne correspond à ces filtres.</p>
                    </td>
                  </tr>
                ) : filteredOrders.map((order, i) => {
                  const itemsCount = order.items?.reduce((a, it) => a + (it.quantity || 1), 0) || 0;
                  const d = order.deliveredAt?.toDate?.() || order.createdAt?.toDate?.() || null;
                  return (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-white">#{order.id.substring(0, 8).toUpperCase()}</td>
                      <td className="px-6 py-4 text-gray-400 text-xs">{d ? d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="px-6 py-4">{order.clientPhone || "—"}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-gray-200">{itemsCount} article{itemsCount > 1 ? "s" : ""}</span>
                          {order.items?.slice(0, 2).map((it, idx) => (
                            <span key={idx} className="text-[11px] text-gray-500 truncate max-w-[180px]">{it.quantity}x {it.productName}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-bold text-white">{(order.totalAmount || 0).toLocaleString("fr-FR")} $</td>
                      <td className="px-6 py-4">{getStatusBadge(order.status)}</td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => generateOrderInvoicePDF(order, userData, "$")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold transition-all active:scale-95"
                        >
                          <Download size={12} />Facture
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ────────────────── VUE KANBAN ────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {KANBAN_COLS.map(col => {
            const colOrders = filteredOrders.filter(o => getCol(o.status) === col.key);
            return (
              <div key={col.key} className={`rounded-2xl border p-4 flex flex-col gap-3 min-h-[200px] ${col.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">{col.label}</h3>
                  <span className="text-xs font-bold px-2 py-0.5 bg-white/10 rounded-full text-gray-300">{colOrders.length}</span>
                </div>
                <div className="flex flex-col gap-3 flex-1 overflow-y-auto max-h-[60vh]">
                  {colOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 py-8 text-gray-600">
                      <p className="text-xs">Aucune commande</p>
                    </div>
                  ) : colOrders.map((order, i) => {
                    const d = order.createdAt?.toDate?.() || null;
                    const canAdvance = !!NEXT_STATUS[(order.status || "").toLowerCase()];
                    return (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col gap-2 hover:border-white/20 transition-all"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">#{order.id.substring(0, 8).toUpperCase()}</span>
                          <span className="text-[10px] text-gray-500">{d ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : ""}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {order.items?.map((it, idx) => (
                            <div key={idx} className="truncate">{it.quantity}x {it.productName}</div>
                          ))}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-sm font-bold text-white">{(order.totalAmount || 0).toLocaleString("fr-FR")} $</span>
                          {canAdvance && (
                            <button
                              onClick={() => advanceOrder(order)}
                              className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all active:scale-95"
                            >
                              Avancer <ChevronRight size={10} />
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => generateOrderInvoicePDF(order, userData, "$")}
                          className="mt-1 flex items-center justify-center gap-1 w-full py-1 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-lg text-[10px] font-medium transition-all"
                        >
                          <Download size={10} /> Facture
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
