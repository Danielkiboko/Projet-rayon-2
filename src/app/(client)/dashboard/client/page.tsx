"use client";

import { useEffect, useState, Suspense } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
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
  ExternalLink 
} from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { generateOrderInvoicePDF, generateHotelBookingReceiptPDF } from "@/lib/invoiceGenerator";
import { ClientChatsWidget } from "@/modules/supplier/components/ClientChatsWidget";
import NotificationBell from "@/modules/shared/components/notifications/NotificationBell";
import ProfileUpdateModal from "@/modules/supplier/components/ProfileUpdateModal";
import { useCurrency } from "@/context/CurrencyContext";

export default function ClientDashboard() {
  const { user, userData, signOut } = useAuth();
  const router = useRouter();
  const { formatPrice, currency } = useCurrency();
  
  const [activeTab, setActiveTab] = useState<"orders" | "visits" | "hotels" | "messages">("orders");
  const [orders, setOrders] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [hotelBookings, setHotelBookings] = useState<any[]>([]);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState<number>(0);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }

    // 1. Fetch Orders
    const qOrders = query(
      collection(db, "orders"),
      where("clientId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsubOrders = onSnapshot(qOrders, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(fetchedOrders);
    }, (err) => {
      console.warn("Client orders listener warning:", err);
    });

    // 2. Fetch Visits
    const qVisits = query(
      collection(db, "visits"),
      where("clientId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsubVisits = onSnapshot(qVisits, (snapshot) => {
      const fetchedVisits = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

    return () => {
      unsubOrders();
      unsubVisits();
      unsubHotels();
      unsubChats();
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

  if (!user || !userData) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500 font-medium">Chargement de votre espace...</div>;
  }

  const clientDisplayName = userData.displayName || userData.name || user.displayName || "Client";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 bg-primary/10 text-primary rounded-full">
                Espace Client
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mt-1">Bonjour, {clientDisplayName}</h1>
            <p className="text-sm text-gray-500">Suivez vos commandes, réservations d'hôtels, visites immobilières et discutez en direct.</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-red-600 hover:bg-red-50 transition-colors font-medium shadow-2xs text-sm"
            >
              <LogOut size={16} />
              Se déconnecter
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-2 border-b border-gray-200 mb-8 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium whitespace-nowrap transition-colors text-sm ${
              activeTab === "orders" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Package size={17} /> Mes Achats
            {orders.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 font-semibold">
                {orders.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("hotels")}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium whitespace-nowrap transition-colors text-sm ${
              activeTab === "hotels" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Hotel size={17} /> Hôtels & Séjours
            {hotelBookings.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700 font-semibold">
                {hotelBookings.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("visits")}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium whitespace-nowrap transition-colors text-sm ${
              activeTab === "visits" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <Calendar size={17} /> Mes Visites
            {visits.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700 font-semibold">
                {visits.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("messages")}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium whitespace-nowrap transition-colors text-sm ${
              activeTab === "messages" ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <MessageSquare size={17} /> Messages
            {unreadMessagesCount > 0 ? (
              <span className="px-2 py-0.5 text-xs rounded-full bg-red-500 text-white font-bold animate-pulse">
                {unreadMessagesCount}
              </span>
            ) : null}
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {/* 1. ORDERS */}
          {activeTab === "orders" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
                {orders.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Package className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="font-semibold text-gray-700">Vous n'avez pas encore passé de commande</p>
                    <p className="text-xs text-gray-400 mt-1 mb-4">Découvrez nos rayons Mode, Connect et Saveurs pour commander en ligne.</p>
                    <Link href="/" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-medium rounded-xl hover:bg-primary-dark transition-colors">
                      Explorer les rayons <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {orders.map(order => (
                      <li key={order.id} className="p-6 hover:bg-gray-50/70 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
                          <div>
                            <span className="font-bold text-gray-900">Commande #{order.id.slice(-6)}</span>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {order.createdAt?.toDate ? order.createdAt.toDate().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "Date récente"}
                            </div>
                          </div>
                           <span className="text-xs font-semibold px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full w-fit">
                            {order.status === "CONFIRMED_AWAITING_DRIVER" ? "En attente de livreur" :
                             order.status === "ACCEPTED" ? "Livreur assigné" :
                             order.status === "ARRIVED_AWAITING_PAYMENT" ? "Livreur sur place" :
                             order.status === "COMPLETED" ? "Livré ✓" :
                             order.status === "CANCELLED" ? "Annulé" :
                             order.status || "En cours"}
                           </span>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                          <div className="text-sm text-gray-500">
                            Total TTC : <span className="font-bold text-gray-900">{formatPrice(order.totalAmount)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => generateOrderInvoicePDF(order, null, currency)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                              title="Télécharger la facture officielle PDF"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Facture PDF
                            </button>
                            <Link
                              href={`/order/${order.id}/tracking`}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                            >
                              Suivi de livraison
                            </Link>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          )}

          {/* 2. HOTELS & STAYS */}
          {activeTab === "hotels" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
                {hotelBookings.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Hotel className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="font-semibold text-gray-700">Aucune réservation d'hôtel pour le moment</p>
                    <p className="text-xs text-gray-400 mt-1 mb-4">
                      Réservez des chambres, suites et appart-hôtels d'exception à Kinshasa et en RDC.
                    </p>
                    <Link 
                      href="/rayon/immo" 
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-medium rounded-xl hover:bg-primary-dark transition-colors"
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
                        <div key={booking.id} className="p-6 hover:bg-gray-50/70 transition-colors">
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
                            <span className={`text-xs font-semibold px-3 py-1 rounded-full border w-fit ${statusBadge.cls}`}>
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

          {/* 3. PROPERTY VISITS */}
          {activeTab === "visits" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
                {visits.length === 0 ? (
                  <div className="p-12 text-center text-gray-500">
                    <Calendar className="mx-auto text-gray-300 mb-3" size={48} />
                    <p className="font-semibold text-gray-700">Vous n'avez aucune demande de visite</p>
                    <p className="text-xs text-gray-400 mt-1 mb-4">Consultez nos biens immobiliers à louer ou à acheter à Kinshasa.</p>
                    <Link href="/rayon/immo" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-medium rounded-xl hover:bg-primary-dark transition-colors">
                      Voir les biens <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {visits.map(visit => (
                      <li key={visit.id} className="p-6 hover:bg-gray-50/70 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-bold text-gray-900">{visit.propertyTitle || "Bien immobilier"}</span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
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
                            className="inline-flex items-center gap-1 text-primary hover:text-primary-dark font-semibold text-xs"
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

          {/* 4. EMBEDDED MESSAGES */}
          {activeTab === "messages" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Suspense fallback={<div className="min-h-[500px] bg-white rounded-2xl border border-gray-200 flex items-center justify-center text-gray-400">Chargement de la messagerie...</div>}>
                <ClientChatsWidget embedded={true} />
              </Suspense>
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
    </div>
  );
}
