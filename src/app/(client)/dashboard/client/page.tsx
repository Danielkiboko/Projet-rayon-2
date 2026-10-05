"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { 
  Package, 
  Calendar, 
  MessageSquare, 
  LogOut, 
  FileText, 
  Hotel, 
  Users, 
  Bed, 
  MapPin, 
  Clock, 
  ArrowRight,
  ExternalLink,
  LifeBuoy,
  Search,
  CheckCircle2,
  Truck,
  ShieldCheck,
  UserCheck,
  Phone,
  Mail,
  SlidersHorizontal,
  Sparkles,
  ShoppingBag
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { generateOrderInvoicePDF, generateHotelBookingReceiptPDF } from "@/lib/invoiceGenerator";
import { ClientChatsWidget } from "@/modules/supplier/components/ClientChatsWidget";
import { ClientTicketsWidget } from "@/modules/tickets/components/ClientTicketsWidget";
import NotificationBell from "@/modules/shared/components/notifications/NotificationBell";
import ProfileUpdateModal from "@/modules/supplier/components/ProfileUpdateModal";
import { useCurrency } from "@/context/CurrencyContext";

// Alibaba Components
import ClientQuickStats from "@/modules/client/components/ClientQuickStats";
import ClientBuyerProtectionBanner from "@/modules/client/components/ClientBuyerProtectionBanner";
import ClientOrderCardAlibaba from "@/modules/client/components/ClientOrderCardAlibaba";
import ClientProformaSection from "@/modules/client/components/ClientProformaSection";
import AlibabaClientBottomNav from "@/modules/client/components/AlibabaClientBottomNav";

type ClientDashboardTab = "orders" | "proformas" | "hotels" | "visits" | "messages" | "tickets";
type OrderStatusFilter = "all" | "pending" | "preparing" | "in_transit" | "delivered" | "cancelled";

export default function ClientDashboard() {
  const { user, userData, signOut } = useAuth();
  const router = useRouter();
  const { formatPrice, currency } = useCurrency();
  
  const [activeTab, setActiveTab] = useState<ClientDashboardTab>("orders");
  const [orderFilter, setOrderFilter] = useState<OrderStatusFilter>("all");
  const [orderSearchQuery, setOrderSearchQuery] = useState("");

  const [orders, setOrders] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [hotelBookings, setHotelBookings] = useState<any[]>([]);
  const [pendingProformasCount, setPendingProformasCount] = useState<number>(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState<number>(0);

  // Sync tab with URL search params
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as ClientDashboardTab;
      if (["orders", "proformas", "hotels", "visits", "messages", "tickets"].includes(tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }

    // Tri côté client (évite de dépendre d'un index composite Firestore clientId + createdAt)
    const sortByCreatedDesc = (a: any, b: any) => {
      const tA = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
      const tB = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
      return tB - tA;
    };

    // 1. Fetch Orders
    const qOrders = query(
      collection(db, "orders"),
      where("clientId", "==", user.uid),
      limit(100)
    );
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedOrders.sort(sortByCreatedDesc);
      setOrders(fetchedOrders);
    }, (err) => {
      console.warn("Client orders listener warning:", err);
    });

    // 2. Fetch Visits
    const qVisits = query(
      collection(db, "visits"),
      where("clientId", "==", user.uid),
      limit(50)
    );
    const unsubVisits = onSnapshot(qVisits, (snapshot) => {
      const fetchedVisits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      fetchedVisits.sort(sortByCreatedDesc);
      setVisits(fetchedVisits);
    }, (err) => {
      console.warn("Client visits listener warning:", err);
    });

    // 3. Fetch Hotel Bookings
    const qHotels = query(
      collection(db, "hotel_bookings"),
      where("clientId", "==", user.uid),
      limit(30)
    );
    const unsubHotels = onSnapshot(qHotels, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      list.sort((a: any, b: any) => {
        const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.checkInDate || 0).getTime();
        const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.checkInDate || 0).getTime();
        return timeB - timeA;
      });
      setHotelBookings(list);
    }, (err) => {
      console.warn("Client hotels listener warning:", err);
    });

    // 4. Listen to unread chats for notification badge
    const qChats = query(
      collection(db, "chats"),
      where("clientId", "==", user.uid),
      limit(30)
    );
    const unsubChats = onSnapshot(qChats, (snapshot) => {
      let unread = 0;
      snapshot.docs.forEach(d => {
        if (d.data().unreadClient) unread++;
      });
      setUnreadMessagesCount(unread);
    }, (err) => {
      console.warn("Client chats unread listener warning:", err);
    });

    // 5. Listen to tickets for unread badge
    const qTickets = query(
      collection(db, "tickets"),
      where("creatorId", "==", user.uid)
    );
    const unsubTickets = onSnapshot(qTickets, (snapshot) => {
      let unread = 0;
      snapshot.docs.forEach(d => {
        if (d.data().unreadByClient) unread++;
      });
      setUnreadTicketsCount(unread);
    }, (err) => {
      console.warn("Client tickets unread listener warning:", err);
    });

    return () => {
      unsubOrders();
      unsubVisits();
      unsubHotels();
      unsubChats();
      unsubTickets();
    };
  }, [user, router]);

  const handleLogout = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
    }
  };

  // Filtered Orders logic (Alibaba style status segmentation)
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const s = (o.status || "").toLowerCase();
      let matchesFilter = true;

      if (orderFilter === "pending") {
        matchesFilter = ["pending_driver", "confirmed_awaiting_driver", "pending"].includes(s);
      } else if (orderFilter === "preparing") {
        matchesFilter = ["driver_assigned", "accepted", "preparing", "in_preparation"].includes(s);
      } else if (orderFilter === "in_transit") {
        matchesFilter = ["in_transit", "arrived_awaiting_payment", "ready", "picked_up"].includes(s);
      } else if (orderFilter === "delivered") {
        matchesFilter = ["delivered", "completed", "livre"].includes(s);
      } else if (orderFilter === "cancelled") {
        matchesFilter = s === "cancelled";
      }

      if (!matchesFilter) return false;

      if (orderSearchQuery.trim()) {
        const q = orderSearchQuery.toLowerCase();
        const idMatch = o.id.toLowerCase().includes(q);
        const storeMatch = (o.storeName || o.supplierName || "").toLowerCase().includes(q);
        const itemMatch = o.items?.some((it: any) => 
          (it.productName || it.title || it.name || "").toLowerCase().includes(q)
        );
        return idMatch || storeMatch || itemMatch;
      }

      return true;
    });
  }, [orders, orderFilter, orderSearchQuery]);

  // Order counts per status
  const orderCounts = useMemo(() => {
    const counts = {
      all: orders.length,
      pending: 0,
      preparing: 0,
      in_transit: 0,
      delivered: 0,
      cancelled: 0,
      active: 0
    };

    orders.forEach(o => {
      const s = (o.status || "").toLowerCase();
      if (["pending_driver", "confirmed_awaiting_driver", "pending"].includes(s)) counts.pending++;
      else if (["driver_assigned", "accepted", "preparing", "in_preparation"].includes(s)) counts.preparing++;
      else if (["in_transit", "arrived_awaiting_payment", "ready", "picked_up"].includes(s)) counts.in_transit++;
      else if (["delivered", "completed", "livre"].includes(s)) counts.delivered++;
      else if (s === "cancelled") counts.cancelled++;

      if (!["delivered", "completed", "livre", "cancelled"].includes(s)) {
        counts.active++;
      }
    });

    return counts;
  }, [orders]);

  if (!user || !userData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 font-medium">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Chargement de votre Espace Acheteur...</span>
        </div>
      </div>
    );
  }

  const clientDisplayName = userData.displayName || userData.name || user.displayName || "Client VIP";
  const clientPhone = userData.phone || userData.phoneNumber || user.phoneNumber || "";
  const clientEmail = userData.email || user.email || "";

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 sm:pb-8">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        
        {/* Top Breadcrumb / Marketplace Link */}
        <div className="flex items-center justify-between mb-3 text-xs">
          <Link 
            href="/" 
            className="inline-flex items-center gap-1.5 text-gray-600 hover:text-[#FF6600] font-bold transition-colors group"
          >
            <ArrowRight size={14} className="rotate-180 text-gray-400 group-hover:text-[#FF6600] transition-colors" />
            <span>Retourner aux Rayons / Explorer les Produits</span>
          </Link>
          <span className="text-[11px] font-semibold text-gray-400 hidden sm:inline">
            Espace Acheteur Certifié
          </span>
        </div>

        {/* 1. Header VIP Style Alibaba (Buyer Center Profile) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-gray-200/80 shadow-xs relative">
          <div className="flex items-center gap-4">
            {/* VIP Avatar */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-dark text-white font-extrabold text-xl sm:text-2xl flex items-center justify-center shadow-md shadow-primary/20 shrink-0 relative">
              {clientDisplayName.charAt(0).toUpperCase()}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] text-white" title="Compte Actif">
                ✓
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {clientDisplayName}
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 bg-[#C7D300]/20 text-[#0F1D27] rounded-full border border-[#C7D300]/40">
                  <Sparkles size={11} className="text-amber-600" /> Acheteur VIP Rayons
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                {clientEmail && (
                  <span className="flex items-center gap-1">
                    <Mail size={12} className="text-gray-400" /> {clientEmail}
                  </span>
                )}
                {clientPhone && (
                  <span className="flex items-center gap-1 font-medium text-gray-700">
                    <Phone size={12} className="text-primary" /> {clientPhone}
                  </span>
                )}
                <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                  <ShieldCheck size={12} /> Identité Vérifiée
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:self-center">
            {/* Bouton pour aller sur les rayons et consulter les produits */}
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 bg-[#FF6600] hover:bg-[#e65c00] text-white font-extrabold rounded-xl shadow-xs hover:shadow-md transition-all text-xs sm:text-sm cursor-pointer group shrink-0"
              title="Consulter les rayons et les produits"
            >
              <ShoppingBag size={16} className="group-hover:scale-110 transition-transform" />
              <span>Consulter les Rayons</span>
            </Link>

            <NotificationBell />

            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-red-600 hover:bg-red-50 transition-colors font-medium shadow-2xs text-xs sm:text-sm cursor-pointer shrink-0"
              title="Se déconnecter"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* 2. Quick Metrics (Alibaba Stat Cards) */}
        <ClientQuickStats 
          ordersCount={orders.length}
          activeOrdersCount={orderCounts.active}
          proformasCount={pendingProformasCount}
          hotelsCount={hotelBookings.length}
          visitsCount={visits.length}
          onSelectTab={(tab) => setActiveTab(tab)}
        />

        {/* 3. Trade Assurance Protection Banner */}
        <ClientBuyerProtectionBanner />

        {/* 4. Main Navigation Tabs (Alibaba My Alibaba Bar) */}
        <div className="flex space-x-1 sm:space-x-2 border-b border-gray-200 mb-6 overflow-x-auto pb-0.5 scrollbar-none">
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-3 border-b-2 whitespace-nowrap transition-all text-xs sm:text-sm cursor-pointer ${
              activeTab === "orders" 
                ? "border-[#FF6600] text-gray-900 font-extrabold" 
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 font-medium"
            }`}
          >
            <Package size={17} className={activeTab === "orders" ? "text-[#FF6600]" : "text-gray-400"} /> 
            <span>Mes Achats</span>
            {orders.length > 0 && (
              <span className={`px-2 py-0.5 text-xs rounded-full font-bold ${
                activeTab === "orders" ? "bg-[#FF6600]/10 text-[#FF6600]" : "bg-gray-100 text-gray-600"
              }`}>
                {orders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("proformas")}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-3 border-b-2 whitespace-nowrap transition-all text-xs sm:text-sm cursor-pointer ${
              activeTab === "proformas" 
                ? "border-amber-500 text-gray-900 font-extrabold" 
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 font-medium"
            }`}
          >
            <FileText size={17} className={activeTab === "proformas" ? "text-amber-500" : "text-gray-400"} /> 
            <span>Devis & Proformas (RFQ)</span>
            {pendingProformasCount > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white font-bold animate-pulse">
                {pendingProformasCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("hotels")}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-3 border-b-2 whitespace-nowrap transition-all text-xs sm:text-sm cursor-pointer ${
              activeTab === "hotels" 
                ? "border-blue-600 text-gray-900 font-extrabold" 
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 font-medium"
            }`}
          >
            <Hotel size={17} className={activeTab === "hotels" ? "text-blue-600" : "text-gray-400"} /> 
            <span>Hôtels & Séjours</span>
            {hotelBookings.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-semibold">
                {hotelBookings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("visits")}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-3 border-b-2 whitespace-nowrap transition-all text-xs sm:text-sm cursor-pointer ${
              activeTab === "visits" 
                ? "border-emerald-600 text-gray-900 font-extrabold" 
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 font-medium"
            }`}
          >
            <Calendar size={17} className={activeTab === "visits" ? "text-emerald-600" : "text-gray-400"} /> 
            <span>Visites Immo</span>
            {visits.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                {visits.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("messages")}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-3 border-b-2 whitespace-nowrap transition-all text-xs sm:text-sm cursor-pointer ${
              activeTab === "messages" 
                ? "border-[#FF6600] text-gray-900 font-extrabold" 
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 font-medium"
            }`}
          >
            <MessageSquare size={17} className={activeTab === "messages" ? "text-[#FF6600]" : "text-gray-400"} /> 
            <span>Messagerie Vendeurs</span>
            {unreadMessagesCount > 0 ? (
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-500 text-white font-bold animate-pulse">
                {unreadMessagesCount}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setActiveTab("tickets")}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-3 border-b-2 whitespace-nowrap transition-all text-xs sm:text-sm cursor-pointer ${
              activeTab === "tickets" 
                ? "border-purple-600 text-gray-900 font-extrabold" 
                : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300 font-medium"
            }`}
          >
            <LifeBuoy size={17} className={activeTab === "tickets" ? "text-purple-600" : "text-gray-400"} /> 
            <span>Assistance & Réclamations</span>
            {unreadTicketsCount > 0 ? (
              <span className="px-2 py-0.5 text-xs rounded-full bg-purple-600 text-white font-bold animate-pulse">
                {unreadTicketsCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* 5. Tab Content Sections */}
        <div>
          {/* TAB 1: ORDERS (ALIBABA PIPELINE) */}
          {activeTab === "orders" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              
              {/* Alibaba Pipeline Filters + Search Bar */}
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  {/* Status Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                    {[
                      { key: "all", label: "Toutes", count: orderCounts.all },
                      { key: "pending", label: "En attente", count: orderCounts.pending },
                      { key: "preparing", label: "En préparation", count: orderCounts.preparing },
                      { key: "in_transit", label: "En livraison", count: orderCounts.in_transit },
                      { key: "delivered", label: "Livrées", count: orderCounts.delivered },
                      { key: "cancelled", label: "Annulées", count: orderCounts.cancelled },
                    ].map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setOrderFilter(f.key as OrderStatusFilter)}
                        className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                          orderFilter === f.key
                            ? "bg-gray-900 text-white shadow-xs"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <span>{f.label}</span>
                        {f.count > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            orderFilter === f.key ? "bg-white/20 text-white" : "bg-gray-200 text-gray-700"
                          }`}>
                            {f.count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Search Input */}
                  <div className="relative shrink-0 w-full md:w-64">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Rechercher article, N°..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-gray-50 border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-gray-900"
                    />
                  </div>
                </div>
              </div>

              {/* Order Cards List */}
              {filteredOrders.length === 0 ? (
                <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-12 text-center text-gray-500">
                  <Package className="mx-auto text-gray-300 mb-3" size={48} />
                  <p className="font-bold text-gray-800 text-base">Aucune commande trouvée</p>
                  <p className="text-xs text-gray-400 mt-1 mb-5">
                    {orderSearchQuery
                      ? "Aucun résultat ne correspond à votre recherche."
                      : "Vous n'avez pas de commande dans cette catégorie pour le moment."}
                  </p>
                  <Link 
                    href="/" 
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition-colors"
                  >
                    Explorer les rayons <ArrowRight size={14} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <ClientOrderCardAlibaba key={order.id} order={order} />
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* TAB 2: PROFORMAS & RFQ */}
          {activeTab === "proformas" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <ClientProformaSection 
                onProformaCountChange={(c) => setPendingProformasCount(c)} 
              />
            </motion.div>
          )}

          {/* TAB 3: HOTELS & STAYS */}
          {activeTab === "hotels" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
                {hotelBookings.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Hotel className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="font-bold text-gray-800 text-base">Aucune réservation d'hôtel pour le moment</p>
                    <p className="text-xs text-gray-400 mt-1 mb-4">
                      Réservez des chambres, suites et appart-hôtels d'exception à Kinshasa et en RDC.
                    </p>
                    <Link 
                      href="/rayon/immo" 
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition-colors"
                    >
                      Découvrir les hôtels <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {hotelBookings.map((booking) => {
                      const statusBadge = 
                        booking.status === "CONFIRMED" ? { label: "Confirmée", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" } :
                        booking.status === "CHECKED_IN" ? { label: "En séjour", cls: "bg-blue-100 text-blue-800 border-blue-200" } :
                        booking.status === "CHECKED_OUT" ? { label: "Séjour terminé", cls: "bg-gray-100 text-gray-800 border-gray-200" } :
                        booking.status === "CANCELLED" ? { label: "Annulée", cls: "bg-red-100 text-red-800 border-red-200" } :
                        { label: "En attente de confirmation", cls: "bg-amber-100 text-amber-800 border-amber-200" };

                      return (
                        <div key={booking.id} className="p-5 sm:p-6 hover:bg-gray-50/70 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-900 text-base">
                                  {booking.propertyTitle || "Réservation d'hôtel"}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                Réservé le {booking.createdAt?.toDate ? booking.createdAt.toDate().toLocaleDateString("fr-FR") : "Récemment"}
                              </div>
                            </div>
                            <span className={`text-xs font-bold px-3 py-1 rounded-full border w-fit ${statusBadge.cls}`}>
                              {statusBadge.label}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl mb-4 text-xs">
                            <div>
                              <span className="text-gray-400 block font-medium">Dates du séjour</span>
                              <div className="font-semibold text-gray-800 flex items-center gap-1 mt-1">
                                <Clock size={13} className="text-primary" />
                                {booking.checkInDate || "—"} au {booking.checkOutDate || "—"}
                              </div>
                            </div>

                            <div>
                              <span className="text-gray-400 block font-medium">Type d'hébergement</span>
                              <div className="font-semibold text-gray-800 flex items-center gap-1 mt-1">
                                <Bed size={13} className="text-primary" />
                                {booking.roomType || "Chambre Standard"}
                              </div>
                            </div>

                            <div>
                              <span className="text-gray-400 block font-medium">Voyageurs</span>
                              <div className="font-semibold text-gray-800 flex items-center gap-1 mt-1">
                                <Users size={13} className="text-primary" />
                                {booking.guestsCount || 1} personne(s)
                              </div>
                            </div>

                            <div>
                              <span className="text-gray-400 block font-medium">Total estimé</span>
                              <div className="font-bold text-primary text-sm mt-1">
                                {booking.totalPrice ? formatPrice(booking.totalPrice) : "Sur devis / À l'arrivée"}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <div className="text-xs text-gray-500">
                              Bénéficiaire : <span className="font-medium text-gray-800">{booking.guestName || clientDisplayName}</span> ({booking.guestPhone || "Téléphone non spécifié"})
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => generateHotelBookingReceiptPDF(booking)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg transition-colors cursor-pointer"
                                title="Télécharger le bon de réservation / reçu officiel PDF"
                              >
                                <FileText size={13} />
                                Bon de séjour PDF
                              </button>

                              {booking.supplierId && (
                                <Link
                                  href={`/dashboard/client/chats?supplierId=${booking.supplierId}`}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                                >
                                  <MessageSquare size={13} />
                                  Contacter l'hôtel
                                </Link>
                              )}
                              <Link
                                href="/rayon/immo"
                                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                              >
                                Rayon Immo
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 4: PROPERTY VISITS */}
          {activeTab === "visits" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
                {visits.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Calendar className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="font-bold text-gray-800 text-base">Vous n'avez aucune demande de visite</p>
                    <p className="text-xs text-gray-400 mt-1 mb-4">Consultez nos biens immobiliers à louer ou à acheter à Kinshasa.</p>
                    <Link href="/rayon/immo" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-dark transition-colors">
                      Voir les biens <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {visits.map(visit => (
                      <li key={visit.id} className="p-5 sm:p-6 hover:bg-gray-50/70 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-gray-900">{visit.propertyTitle || "Bien immobilier"}</span>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            visit.status === "APPROVED" ? "bg-emerald-100 text-emerald-800" :
                            visit.status === "PENDING" ? "bg-amber-100 text-amber-800" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {visit.status === "APPROVED" ? "Visite validée" : visit.status === "PENDING" ? "En attente" : visit.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap justify-between items-center gap-3 mt-4 pt-2 border-t border-gray-100">
                          <span className="flex items-center gap-1">
                            <Clock size={13} className="text-primary" /> Date souhaitée : <strong className="text-gray-800">{visit.requestedDate || "Non spécifiée"}</strong>
                          </span>
                          <Link 
                            href={`/dashboard/client/chats?supplierId=${visit.supplierId}`} 
                            className="inline-flex items-center gap-1 text-primary hover:text-primary-dark font-bold text-xs"
                          >
                            <MessageSquare size={13} /> Contacter l'agent
                          </Link>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}

          {/* TAB 5: EMBEDDED MESSAGES (EXACT ALIBABA MESSAGERIE) */}
          {activeTab === "messages" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Suspense fallback={<div className="min-h-[500px] bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-gray-400">Chargement de la messagerie...</div>}>
                <ClientChatsWidget 
                  embedded={true} 
                  ordersCount={orders.length}
                  notificationsCount={unreadTicketsCount}
                  proformasCount={pendingProformasCount}
                  onSelectTab={(tab) => setActiveTab(tab)}
                />
              </Suspense>
            </motion.div>
          )}

          {/* TAB 6: TICKETS & SUPPORT */}
          {activeTab === "tickets" && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <ClientTicketsWidget />
            </motion.div>
          )}

        </div>
      </div>

      {/* Non-blocking profile completion modal for phone / notifications */}
      <ProfileUpdateModal 
        user={user} 
        userData={userData} 
        onSuccess={() => {}} 
      />

      {/* Alibaba 5-Tab Mobile Navigation Bar */}
      <AlibabaClientBottomNav 
        activeTab={activeTab}
        onSelectTab={(tab) => setActiveTab(tab)}
        unreadMessagesCount={unreadMessagesCount}
      />
    </div>
  );
}
