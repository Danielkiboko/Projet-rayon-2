"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, 
  Package, 
  Clock, 
  CheckCircle, 
  Truck, 
  XCircle, 
  ShoppingBag, 
  Download, 
  UserCheck, 
  Phone, 
  MessageCircle, 
  DollarSign, 
  ArrowUpRight 
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit, doc, updateDoc } from "firebase/firestore";
import { generateOrderInvoicePDF } from "@/lib/invoiceGenerator";
import ValidationSuccessView from "@/modules/shared/components/ui/ValidationSuccessView";

interface Order {
  id: string;
  clientId: string;
  clientName?: string;
  clientPhone?: string;
  clientAddress?: string;
  supplierId?: string;
  items: any[];
  itemsTotal?: number;
  total?: number;
  totalAmount?: number;
  deliveryFee?: number;
  status: string;
  createdAt: any;
}

const getStatusBadge = (status: string) => {
  const normalized = (status || "").toUpperCase();
  switch (normalized) {
    case "LIVRÉE":
    case "DELIVERED":
    case "COMPLETED":
      return (
        <span className="inline-flex items-center gap-1 text-green-400 bg-green-400/10 border border-green-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
          <CheckCircle size={12} />
          <span>Livrée</span>
        </span>
      );
    case "EN_ATTENTE":
    case "PENDING":
    case "PENDING_DRIVER":
    case "CONFIRMED_AWAITING_DRIVER":
      return (
        <span className="inline-flex items-center gap-1 text-orange-400 bg-orange-400/10 border border-orange-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
          <Clock size={12} />
          <span>Nouvelle commande</span>
        </span>
      );
    case "EXPÉDIÉE":
    case "SHIPPED":
    case "IN_TRANSIT":
      return (
        <span className="inline-flex items-center gap-1 text-blue-400 bg-blue-400/10 border border-blue-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
          <Truck size={12} />
          <span>En livraison</span>
        </span>
      );
    case "PREPARING":
    case "EN_PREPARATION":
      return (
        <span className="inline-flex items-center gap-1 text-purple-400 bg-purple-400/10 border border-purple-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
          <Package size={12} />
          <span>En préparation</span>
        </span>
      );
    case "ANNULÉE":
    case "CANCELLED":
      return (
        <span className="inline-flex items-center gap-1 text-red-400 bg-red-400/10 border border-red-500/20 px-2.5 py-1 rounded-full text-xs font-semibold">
          <XCircle size={12} />
          <span>Annulée</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-gray-400 bg-white/5 border border-white/10 px-2.5 py-1 rounded-full text-xs font-medium">
          {status || "Inconnu"}
        </span>
      );
  }
};

export default function AdminMyOrdersPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [validationSuccessMsg, setValidationSuccessMsg] = useState("");

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // Filtrer STRICTEMENT sur les commandes dont le vendeur est l'admin (user.uid)
    // Seules ses propres ventes sont récupérées, respectant la stricte confidentialité des fournisseurs tiers.
    const q = query(
      collection(db, "orders"),
      where("supplierId", "==", user.uid),
      limit(100)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched: Order[] = [];
        snapshot.forEach((d) => {
          fetched.push({ id: d.id, ...d.data() } as Order);
        });

        // Tri chronologique côté client (évite tout besoin d'index composite complexe)
        fetched.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
          return timeB - timeA;
        });

        setOrders(fetched);
        setLoading(false);
      },
      (error) => {
        console.error("Erreur récupération mes ventes:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: newStatus,
        updatedAt: new Date(),
      });
      setValidationSuccessMsg(`Le statut de la commande #${orderId.slice(0, 8)} a été mis à jour (${newStatus}).`);
    } catch (e: any) {
      console.error(e);
      alert(`Erreur lors de la mise à jour : ${e.message}`);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const term = search.toLowerCase();
    const searchMatch =
      o.id.toLowerCase().includes(term) ||
      (o.clientPhone && o.clientPhone.includes(term)) ||
      (o.clientName && o.clientName.toLowerCase().includes(term));

    const normalizedStatus = (o.status || "").toUpperCase();
    let statusMatch = true;
    if (filter === "pending") {
      statusMatch = ["EN_ATTENTE", "PENDING", "PENDING_DRIVER", "CONFIRMED_AWAITING_DRIVER"].includes(normalizedStatus);
    } else if (filter === "preparing") {
      statusMatch = ["PREPARING", "EN_PREPARATION"].includes(normalizedStatus);
    } else if (filter === "shipped") {
      statusMatch = ["EXPÉDIÉE", "SHIPPED", "IN_TRANSIT"].includes(normalizedStatus);
    } else if (filter === "delivered") {
      statusMatch = ["LIVRÉE", "DELIVERED", "COMPLETED"].includes(normalizedStatus);
    }

    return searchMatch && statusMatch;
  });

  // Statistiques analytiques propres aux rayons de l'admin (Investi / Prix de Vente / Gain Net)
  const deliveredOrders = orders.filter((o) =>
    ["LIVRÉE", "DELIVERED", "COMPLETED"].includes((o.status || "").toUpperCase())
  );

  const totalInvested = deliveredOrders.reduce((sum, o) => {
    const orderInvested = (o.items || []).reduce((acc: number, it: any) => {
      const qty = Number(it.quantity || 1);
      const cogs =
        it.costOfGoodsSold !== undefined
          ? Number(it.costOfGoodsSold || 0)
          : Number(it.purchasePrice || 0) * qty;
      return acc + Math.max(0, cogs);
    }, 0);
    return sum + orderInvested;
  }, 0);

  const totalRevenue = deliveredOrders.reduce(
    (sum, o) => sum + (o.itemsTotal || o.total || o.totalAmount || 0),
    0
  );

  const totalNetProfit = totalRevenue - totalInvested;

  const pendingCount = orders.filter((o) => 
    ["EN_ATTENTE", "PENDING", "PENDING_DRIVER", "CONFIRMED_AWAITING_DRIVER", "PREPARING", "EN_PREPARATION"].includes((o.status || "").toUpperCase())
  ).length;

  const deliveredCount = deliveredOrders.length;

  return (
    <div className="space-y-5 pb-16">
      {/* En-tête Exécutif */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">Mes Ventes &amp; Commandes</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white/[0.06] text-gray-300 border border-white/10 whitespace-nowrap">
              Boutique Officielle
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-2xl">
            Commandes passées sur vos propres articles. Les ventes des fournisseurs tiers restent strictement privées dans leur espace.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 overflow-x-auto">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 rounded-lg text-xs font-semibold transition-colors border border-white/10 whitespace-nowrap"
          >
            <Package size={13} />
            <span>Mes Articles</span>
          </Link>
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#C7D300] hover:bg-[#b8c400] text-[#0F1D27] rounded-lg text-xs font-bold transition-colors whitespace-nowrap"
          >
            <UserCheck size={13} />
            <span>Clients</span>
          </Link>
        </div>
      </div>

      {/* 4 Cartes KPI Exécutives : Somme Investie / Prix de Vente / Gain Net / Commandes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Somme Investie</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Package size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-300 tabular-nums tracking-tight">${totalInvested.toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">Coût d&apos;achat de vos rayons</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Prix de Vente</span>
            <span className="p-1.5 rounded-lg bg-white/[0.06] text-white">
              <DollarSign size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">${totalRevenue.toLocaleString()}</p>
          <p className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">Encaissé par votre boutique</p>
        </div>

        <div className="bg-white/[0.03] border border-emerald-500/20 p-4 rounded-xl flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-emerald-300 uppercase font-semibold tracking-wider">Gain Net Reçu</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <ArrowUpRight size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums tracking-tight">${totalNetProfit.toLocaleString()}</p>
          <p className="text-[11px] text-emerald-300/80 pt-1 border-t border-white/[0.06]">Marge nette sur vos rayons</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl flex flex-col justify-between gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-400 uppercase font-semibold tracking-wider">Suivi Commandes</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock size={14} />
            </span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">
            {deliveredCount} <span className="text-xs font-medium text-gray-400">livrées</span>
          </p>
          <p className="text-[11px] text-amber-300 pt-1 border-t border-white/[0.06]">
            {pendingCount} à traiter · {orders.length} au total
          </p>
        </div>
      </div>

      {validationSuccessMsg ? (
        <ValidationSuccessView
          title="C'est fait !"
          message={validationSuccessMsg}
          badgeLabel="Commande & Livraison Mise à Jour"
          onDone={() => setValidationSuccessMsg("")}
        />
      ) : (
      /* Table des commandes */
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        {/* Recherche et filtres */}
        <div className="p-3.5 sm:p-4 border-b border-white/[0.08] flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={13} />
            <input
              type="text"
              placeholder="Rechercher ID ou client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg focus:outline-none focus:border-white/25 text-white text-[11px] placeholder:text-gray-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-black/30 border border-white/[0.06] rounded-lg text-[11px] overflow-x-auto whitespace-nowrap">
            {[
              { id: "all", label: `Toutes (${orders.length})` },
              { id: "pending", label: `À traiter (${pendingCount})` },
              { id: "delivered", label: `Livrées (${deliveredCount})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as any)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                  filter === tab.id ? "bg-white/15 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Tableau */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs text-gray-300">
            <thead className="text-[10px] uppercase bg-white/[0.01] text-gray-500 font-semibold border-b border-white/[0.08] tracking-wider">
              <tr>
                <th className="px-4 py-3 whitespace-nowrap">Commande</th>
                <th className="px-4 py-3 whitespace-nowrap">Client</th>
                <th className="px-4 py-3 whitespace-nowrap">Articles</th>
                <th className="px-4 py-3 whitespace-nowrap">Total</th>
                <th className="px-4 py-3 whitespace-nowrap">Statut</th>
                <th className="px-4 py-3 whitespace-nowrap">Action</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#C7D300] border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs">Chargement de vos ventes...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center">
                      <div className="w-14 h-14 rounded-2xl bg-[#C7D300]/10 border border-[#C7D300]/20 text-[#C7D300] flex items-center justify-center mb-3">
                        <ShoppingBag size={26} />
                      </div>
                      <p className="text-sm font-bold text-white">Aucune vente enregistrée sur vos articles</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Lorsque des clients achètent des articles que vous avez publiés dans votre catalogue, leurs commandes s'afficheront directement ici.
                      </p>
                      <Link
                        href="/admin/products"
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-xl text-xs font-bold transition-all shadow-sm"
                      >
                        <span>Publier ou vérifier mes articles</span>
                        <ArrowUpRight size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, index) => {
                  const itemsCount = order.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;
                  const total = order.total || order.totalAmount || order.itemsTotal || 0;
                  const dateStr = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString("fr-FR") : "Date récente";

                  return (
                    <motion.tr
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.04 }}
                      key={order.id}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      {/* ID et date */}
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-white font-bold">#{order.id.slice(0, 8)}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">{dateStr}</div>
                      </td>

                      {/* Client */}
                      <td className="px-6 py-4">
                        <div className="text-xs text-white font-semibold">{order.clientName || "Client"}</div>
                        {order.clientPhone && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] text-gray-400 font-mono">{order.clientPhone}</span>
                            <a
                              href={`tel:${order.clientPhone}`}
                              className="text-gray-500 hover:text-emerald-400 transition-colors"
                              title="Appeler le client"
                            >
                              <Phone size={11} />
                            </a>
                            <a
                              href={`https://wa.me/${order.clientPhone.replace(/[^0-9]/g, "")}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-500 hover:text-green-400 transition-colors"
                              title="WhatsApp"
                            >
                              <MessageCircle size={11} />
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Articles */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-gray-300 font-medium">
                          <Package size={13} className="text-[#C7D300] shrink-0" />
                          <span>{itemsCount} article(s)</span>
                        </div>
                        <div className="mt-1 space-y-0.5 max-w-[200px]">
                          {order.items?.slice(0, 2).map((item, idx) => (
                            <p key={idx} className="text-[11px] text-gray-500 truncate">
                              {item.quantity}x {item.name || item.productName || "Article"}
                            </p>
                          ))}
                          {order.items && order.items.length > 2 && (
                            <p className="text-[10px] text-gray-600">+{order.items.length - 2} autre(s)...</p>
                          )}
                        </div>
                      </td>

                      {/* Total */}
                      <td className="px-6 py-4">
                        <span className="font-bold text-white text-sm">{total.toLocaleString()} $</span>
                      </td>

                      {/* Statut */}
                      <td className="px-6 py-4">{getStatusBadge(order.status)}</td>

                      {/* Action rapide pour changer le statut */}
                      <td className="px-6 py-4">
                        <select
                          value={(order.status || "PENDING").toUpperCase()}
                          onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className="bg-black/40 border border-white/10 text-white text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-[#C7D300]"
                        >
                          <option value="CONFIRMED_AWAITING_DRIVER">Nouvelle</option>
                          <option value="PREPARING">En préparation</option>
                          <option value="IN_TRANSIT">En livraison</option>
                          <option value="DELIVERED">Livrée</option>
                          <option value="CANCELLED">Annulée</option>
                        </select>
                      </td>

                      {/* Facture */}
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => generateOrderInvoicePDF(order, null, "$")}
                          title="Télécharger la Facture Client Officielle"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-[#C7D300] hover:text-[#0F1D27] text-white rounded-lg text-xs font-bold transition-all border border-white/5 shadow-xs"
                        >
                          <Download size={13} />
                          <span>Facture</span>
                        </button>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards (Visible only on mobile < md) */}
        <div className="md:hidden p-3 space-y-3">
          {loading ? (
            <div className="p-8 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-[#C7D300] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Chargement de vos ventes...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              <ShoppingBag size={32} className="mx-auto mb-2 opacity-30 text-[#C7D300]" />
              <p className="text-xs font-semibold text-white">Aucune commande trouvée</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const itemsCount = order.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;
              const total = order.total || order.totalAmount || order.itemsTotal || 0;
              const dateStr = order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString("fr-FR") : "Récent";

              return (
                <div
                  key={order.id}
                  className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-white">#{order.id.slice(0, 8)}</span>
                      <p className="text-[11px] text-gray-400 mt-0.5">{dateStr}</p>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  {/* Client Info */}
                  <div className="flex items-center justify-between text-xs py-2 border-y border-white/5">
                    <div>
                      <p className="font-semibold text-white">{order.clientName || "Client"}</p>
                      {order.clientPhone && (
                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">{order.clientPhone}</p>
                      )}
                    </div>
                    {order.clientPhone && (
                      <div className="flex items-center gap-2">
                        <a
                          href={`tel:${order.clientPhone}`}
                          className="p-2 rounded-xl bg-white/5 text-gray-300 hover:text-white border border-white/10"
                          title="Appeler"
                        >
                          <Phone size={14} />
                        </a>
                        <a
                          href={`https://wa.me/${order.clientPhone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          title="WhatsApp"
                        >
                          <MessageCircle size={14} />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Articles & Total */}
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-gray-400">{itemsCount} article{itemsCount > 1 ? "s" : ""}</span>
                      <div className="text-[11px] text-gray-500 truncate max-w-[180px]">
                        {order.items?.slice(0, 1).map((item, idx) => (
                          <span key={idx}>{item.quantity}x {item.name || item.productName || "Article"}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block uppercase">Total</span>
                      <span className="font-bold text-base text-white">{total.toLocaleString()} $</span>
                    </div>
                  </div>

                  {/* Actions & Status Dropdown */}
                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <select
                      value={(order.status || "PENDING").toUpperCase()}
                      onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                      className="flex-1 bg-black/60 border border-white/15 text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:border-[#C7D300] font-medium"
                    >
                      <option value="CONFIRMED_AWAITING_DRIVER">Nouvelle</option>
                      <option value="PREPARING">En préparation</option>
                      <option value="IN_TRANSIT">En livraison</option>
                      <option value="DELIVERED">Livrée</option>
                      <option value="CANCELLED">Annulée</option>
                    </select>

                    <button
                      onClick={() => generateOrderInvoicePDF(order, null, "$")}
                      className="px-3.5 py-2 bg-white/10 hover:bg-[#C7D300] hover:text-[#0F1D27] text-white rounded-xl text-xs font-bold transition-all border border-white/10 flex items-center gap-1.5"
                    >
                      <Download size={13} />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}
    </div>
  );
}
