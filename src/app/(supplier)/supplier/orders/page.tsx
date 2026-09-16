"use client";

import { useState, useEffect } from "react";
import { Search, Package, Clock, CheckCircle, Truck, XCircle, ShoppingBag, Download, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { generateOrderInvoicePDF } from "@/lib/invoiceGenerator";

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
  createdAt: any;
  deliveredAt?: any;
  cancelledAt?: any;
}

const getStatusBadge = (status: string) => {
  const normalized = (status || "").toLowerCase();
  switch (normalized) {
    case "delivered":
    case "completed":
    case "livre":
      return <span className="flex w-max items-center space-x-1 text-green-400 bg-green-400/10 px-2 py-1 rounded-md text-xs font-medium"><CheckCircle size={12} /><span>Livrée</span></span>;
    case "pending_driver":
    case "confirmed_awaiting_driver":
      return <span className="flex w-max items-center space-x-1 text-orange-400 bg-orange-400/10 px-2 py-1 rounded-md text-xs font-medium"><Clock size={12} /><span>En attente de livreur</span></span>;
    case "driver_assigned":
    case "accepted":
      return <span className="flex w-max items-center space-x-1 text-blue-400 bg-blue-400/10 px-2 py-1 rounded-md text-xs font-medium"><Truck size={12} /><span>Livreur assigné</span></span>;
    case "in_transit":
    case "arrived_awaiting_payment":
      return <span className="flex w-max items-center space-x-1 text-primary bg-primary/10 px-2 py-1 rounded-md text-xs font-medium"><Truck size={12} /><span>En cours de livraison</span></span>;
    case "cancelled":
      return <span className="flex w-max items-center space-x-1 text-red-400 bg-red-400/10 px-2 py-1 rounded-md text-xs font-medium"><XCircle size={12} /><span>Annulée</span></span>;
    default:
      return <span className="w-max text-gray-400 bg-white/10 px-2 py-1 rounded-md text-xs font-medium">{status || "Inconnu"}</span>;
  }
};

export default function SupplierOrdersPage() {
  const { user, userData } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;
  
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !activeSupplierId) return;
    
    // Requête ajustée : on utilise 'supplierId' au lieu de 'supplierIds' array-contains.
    const q = query(
      collection(db, "orders"),
      where("supplierId", "==", activeSupplierId),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched: Order[] = [];
      snapshot.forEach(doc => {
        fetched.push({ id: doc.id, ...doc.data() } as Order);
      });
      setOrders(fetched);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, activeSupplierId]);

  const filteredOrders = orders.filter(o => {
    const searchMatch = o.id.toLowerCase().includes(search.toLowerCase()) || 
                       (o.clientPhone && o.clientPhone.includes(search));
    
    const normalizedStatus = (o.status || "").toLowerCase();
    let statusMatch = true;
    
    if (filter === "pending") {
      statusMatch = normalizedStatus === "pending_driver" || normalizedStatus === "confirmed_awaiting_driver" || normalizedStatus === "driver_assigned" || normalizedStatus === "accepted";
    } else if (filter === "in_transit") {
      statusMatch = normalizedStatus === "in_transit" || normalizedStatus === "arrived_awaiting_payment";
    } else if (filter === "delivered") {
      statusMatch = normalizedStatus === "delivered" || normalizedStatus === "completed" || normalizedStatus === "livre";
    } else if (filter === "cancelled") {
      statusMatch = normalizedStatus === "cancelled";
    }

    return searchMatch && statusMatch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tableau de Bord des Commandes</h1>
          <p className="text-sm text-gray-400">Suivez l'état de vos livraisons en temps réel.</p>
        </div>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Rechercher par ID ou N° Tél..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary text-white text-sm transition-all"
            />
          </div>
          <div className="flex space-x-2">
            <select 
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary [&>option]:bg-[#0b061c]"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente (Livreur)</option>
              <option value="in_transit">En route</option>
              <option value="delivered">Livrées</option>
              <option value="cancelled">Annulées</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="text-xs uppercase bg-black/40 text-gray-400 border-b border-white/5">
              <tr>
                <th className="px-6 py-4">ID Commande</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Articles (Produits)</th>
                <th className="px-6 py-4">Prix à payer (Solde)</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Facturation</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
                    Chargement des commandes...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 flex flex-col items-center">
                    <ShoppingBag size={48} className="mb-4 text-gray-600 opacity-50" />
                    Aucune commande ne correspond à ces filtres.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, index) => {
                  const itemsCount = order.items?.reduce((acc, item) => acc + (item.quantity || 1), 0) || 0;
                  const total = order.totalAmount || 0;
                  const dateToDisplay = order.deliveredAt?.toDate 
                    ? order.deliveredAt.toDate() 
                    : order.createdAt?.toDate 
                      ? order.createdAt.toDate() 
                      : null;

                  return (
                    <motion.tr 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      key={order.id} 
                      className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-6 py-4 font-bold text-white truncate max-w-[120px]">
                        #{order.id.substring(0, 8).toUpperCase()}
                      </td>
                      <td className="px-6 py-4">
                        {dateToDisplay ? dateToDisplay.toLocaleDateString("fr-FR", { hour: '2-digit', minute: '2-digit'}) : "Date inconnue"}
                      </td>
                      <td className="px-6 py-4 truncate max-w-[150px]">
                        {order.clientPhone || "Inconnu"}
                      </td>
                      <td className="px-6 py-4 flex flex-col space-y-1">
                        <div className="flex items-center space-x-2 font-medium text-gray-200">
                          <Package size={14} className="text-primary" />
                          <span>{itemsCount} produit(s)</span>
                        </div>
                        {order.items?.map((item, idx) => (
                          <span key={idx} className="text-xs text-gray-500 truncate max-w-[200px]">
                            {item.quantity}x {item.productName}
                          </span>
                        ))}
                      </td>
                      <td className="px-6 py-4 font-bold text-white text-lg">
                        {total.toLocaleString()} $
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(order.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => generateOrderInvoicePDF(order, userData, "$")}
                          title="Télécharger la Facture Officielle de la Commande"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-[#C7D300] hover:text-[#0F1D27] text-white rounded-lg text-xs font-bold transition-all shadow-xs active:scale-95"
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
