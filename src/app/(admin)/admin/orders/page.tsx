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

  // Statistiques financières propres à l'admin
  const totalRevenue = orders
    .filter((o) => ["LIVRÉE", "DELIVERED", "COMPLETED"].includes((o.status || "").toUpperCase()))
    .reduce((sum, o) => sum + (o.total || o.totalAmount || o.itemsTotal || 0), 0);

  const pendingCount = orders.filter((o) => 
    ["EN_ATTENTE", "PENDING", "PENDING_DRIVER", "CONFIRMED_AWAITING_DRIVER", "PREPARING", "EN_PREPARATION"].includes((o.status || "").toUpperCase())
  ).length;

  const deliveredCount = orders.filter((o) => 
    ["LIVRÉE", "DELIVERED", "COMPLETED"].includes((o.status || "").toUpperCase())
  ).length;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">Mes Ventes & Commandes</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Ma Boutique Personnelle
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1 max-w-2xl">
            Commandes passées par les clients sur vos propres articles mis en vente. Vous ne voyez ici que <strong>vos propres ventes</strong> (les autres fournisseurs conservent la stricte confidentialité de leurs commandes).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all border border-white/10"
          >
            <Package size={15} />
            <span>Gérer mes Articles</span>
          </Link>
          <Link
            href="/admin/clients"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] rounded-xl text-xs font-bold transition-all shadow-md"
          >
            <UserCheck size={15} />
            <span>Répertoire Clients</span>
          </Link>
        </div>
      </div>

      {/* Cartes KPI Mes Ventes */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#0F1A23] border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Chiffre d'affaires encaissé</p>
            <p className="text-2xl font-bold text-white mt-0.5">{totalRevenue.toLocaleString()} $</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <DollarSign size={18} />
          </div>
        </div>

        <div className="bg-[#0F1A23] border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">À Traiter / En Cours</p>
            <p className="text-2xl font-bold text-orange-400 mt-0.5">{pendingCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20 flex items-center justify-center shrink-0">
            <Clock size={18} />
          </div>
        </div>

        <div className="bg-[#0F1A23] border border-white/[0.08] p-4 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-gray-400 uppercase font-semibold">Commandes Livrées</p>
            <p className="text-2xl font-bold text-[#C7D300] mt-0.5">{deliveredCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#C7D300]/10 text-[#C7D300] border border-[#C7D300]/20 flex items-center justify-center shrink-0">
            <CheckCircle size={18} />
          </div>
        </div>
      </div>

      {/* Table des commandes */}
      <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl overflow-hidden shadow-lg">
        {/* Recherche et filtres */}
        <div className="p-4 border-b border-white/[0.06] flex flex-col sm:flex-row justify-between gap-3 bg-white/[0.01]">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Rechercher par ID ou nom du client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/30 border border-white/[0.08] rounded-xl focus:outline-none focus:border-purple-500 text-white text-xs placeholder:text-gray-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-black/30 border border-white/[0.06] rounded-xl text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === "all" ? "bg-white text-gray-900 font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              Toutes ({orders.length})
            </button>
            <button
              onClick={() => setFilter("pending")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === "pending" ? "bg-orange-500 text-white font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              À Traiter
            </button>
            <button
              onClick={() => setFilter("delivered")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === "delivered" ? "bg-emerald-600 text-white font-bold" : "text-gray-400 hover:text-white"
              }`}
            >
              Livrées ({deliveredCount})
            </button>
          </div>
        </div>

        {/* Tableau */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-[11px] uppercase bg-black/20 text-gray-400 font-semibold border-b border-white/[0.06]">
              <tr>
                <th className="px-6 py-4">Commande</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Articles Vendus</th>
                <th className="px-6 py-4">Total</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Action</th>
                <th className="px-6 py-4 text-right">Facture</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs">Chargement de vos ventes...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-14 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto text-center">
                      <div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                        <ShoppingBag size={26} />
                      </div>
                      <p className="text-sm font-bold text-white">Aucune vente enregistrée sur vos articles</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                        Lorsque des clients achètent des articles que vous avez publiés dans votre catalogue, leurs commandes s'afficheront directement ici.
                      </p>
                      <Link
                        href="/admin/products"
                        className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
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
                          <Package size={13} className="text-purple-400 shrink-0" />
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
                          className="bg-black/40 border border-white/10 text-white text-[11px] rounded-lg px-2 py-1 focus:outline-none focus:border-purple-500"
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
      </div>
    </div>
  );
}
