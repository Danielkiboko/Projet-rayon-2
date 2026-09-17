"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, LayoutDashboard, Package, ShoppingCart, Truck, Wallet, CreditCard, Users, Layers, Lock, ArrowRight, Clock } from "lucide-react";
import { themeConfig } from "@/lib/themeConfig";
import ProfileUpdateModal from "@/modules/supplier/components/ProfileUpdateModal";
import DashboardLayout from "@/modules/shared/components/layouts/DashboardLayout";
import { isSupplier, getSupplierType } from "@/lib/permissions";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";
import { recordSubscriptionDeposit } from "@/lib/accountingLedger";

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeRayon, setActiveRayon] = useState<string>("");
  
  const activeSupplierId = userData?.parentSupplierId || user?.uid;

  useEffect(() => {
    if (userData) {
      const saved = localStorage.getItem("activeSupplierRayon");
      const available = userData.assignedRayons || [];
      if (saved && available.includes(saved)) {
        setActiveRayon(saved);
      } else if (available.length > 0) {
        setActiveRayon(available[0]);
        localStorage.setItem("activeSupplierRayon", available[0]);
      } else {
        const defaultType = getSupplierType(userData);
        setActiveRayon(defaultType);
      }
    }
  }, [userData]);

  // Redirect to billing if trial expired, or redirect sub-suppliers lacking permissions
  useEffect(() => {
    if (!loading && user && userData && isSupplier(userData)) {
      // Permission check for SUB_SUPPLIER
      if (userData.role === 'SUB_SUPPLIER') {
        const allowed = pathname === '/supplier' || 
                        pathname === '/supplier/settings' || 
                        (Array.isArray(userData.permissions) && userData.permissions.some((p: string) => pathname.startsWith(p)));
        if (!allowed) {
          router.push('/supplier');
          return;
        }
      }

      // Check subscription/trial expiry
      const subscriptionInfo = evaluateSupplierSubscription(userData);
      if (subscriptionInfo.isBlocked) {
        // Allow dashboard and finance pages — block everything else
        const allowedWhenExpired = ['/supplier', '/supplier/finance', '/supplier/settings'];
        const isAllowed = allowedWhenExpired.some(p => pathname === p || pathname.startsWith(p + '/'));
        if (!isAllowed) {
          router.push('/supplier');
        }
      }
    }
  }, [user, userData, loading, pathname, router]);

  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // Listen to in-app notifications
  useEffect(() => {
    if (!user) return;
    
    let unsubNotifs: any;
    let unsubChats: any;
    
    const setupNotifications = async () => {
      try {
        const { collection, query, where, onSnapshot, orderBy, limit } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");

        const qNotifs = query(
          collection(db, "inapp_notifications"),
          where("supplierId", "==", activeSupplierId),
          where("read", "==", false),
          orderBy("createdAt", "desc"),
          limit(20)
        );

        unsubNotifs = onSnapshot(qNotifs, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach(doc => {
            const d = doc.data();
            items.push({
              id: doc.id,
              type: d.type || "system",
              title: d.title || "Notification",
              message: d.message || "",
              time: d.time || Date.now(),
              link: d.link || "#"
            });
          });
          items.sort((a, b) => b.time - a.time);
          setNotifications(items);
          setUnreadCount(items.length);
        }, (err) => {
          console.warn("Supplier notifications warning:", err.message);
        });

        // Setup chat listener
        const qChats = query(
          collection(db, "chats"),
          where("supplierId", "==", activeSupplierId),
          where("unreadSupplier", "==", true),
          limit(20)
        );

        unsubChats = onSnapshot(qChats, (snapshot) => {
          setUnreadChatCount(snapshot.docs.length);
        }, (err) => {
          console.warn("Supplier chats unread warning:", err.message);
        });

      } catch (err) {
        console.error("Error setting up supplier notifications:", err);
      }
    };

    setupNotifications();

    return () => {
      if (unsubNotifs) unsubNotifs();
      if (unsubChats) unsubChats();
    };
  }, [user, activeSupplierId]);

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#0b061c] text-white">Chargement...</div>;
  }

  if (!user || !isSupplier(userData)) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0b061c] text-white flex-col">
        <ShieldAlert size={48} className="mb-4 text-red-500" />
        <p>Accès refusé. Réservé aux fournisseurs.</p>
      </div>
    );
  }

  const subscriptionInfo = evaluateSupplierSubscription(userData);
  const isSubscriptionExpired = subscriptionInfo.isBlocked;

  const service = activeRayon || getSupplierType(userData) || "default";
  const theme = themeConfig[service as keyof typeof themeConfig] || themeConfig["default"];
  
  // Clone menu items to safely modify them
  let navItems = theme.menu.map(item => ({...item}));

  // Add badge to Messages menu if unread count > 0
  const messagesIndex = navItems.findIndex(item => item.href === '/supplier/messages');
  if (messagesIndex !== -1 && unreadChatCount > 0) {
    navItems[messagesIndex].badge = unreadChatCount;
  }

  // Le fournisseur principal peut voir le menu Équipe
  if (userData?.role !== 'SUB_SUPPLIER') {
    navItems.push({ title: "Équipe", href: "/supplier/team", icon: Users as any });
  }

  // Le sous-fournisseur ne voit que ce qui est dans ses permissions (et le dashboard)
  if (userData?.role === 'SUB_SUPPLIER' && Array.isArray(userData?.permissions)) {
    navItems = navItems.filter(item => 
      item.href === '/supplier' || userData.permissions.includes(item.href)
    );
  }

  // Verrouillage strict des fonctionnalités si abonnement expiré
  if (subscriptionInfo.isBlocked) {
    navItems = navItems.map(item => {
      const isAllowed = item.href === '/supplier' || item.href === '/supplier/finance' || item.href === '/supplier/settings';
      return {
        ...item,
        locked: !isAllowed
      };
    });
  }

  const availableRayons = userData?.assignedRayons || [];

  const handlePayDeposit = async () => {
    const depositAmount = userData?.depositAmount || 50;
    if (!confirm(`Confirmez-vous le règlement de votre dépôt mensuel de $${depositAmount} ?\n\nCette action prolongera votre abonnement pour 30 jours supplémentaires.`)) {
      return;
    }
    try {
      await recordSubscriptionDeposit({
        supplierId: activeSupplierId,
        supplierName: userData?.displayName || userData?.company || "Partenaire",
        amount: depositAmount,
        paymentMethod: "Paiement direct en ligne",
        currentBalance: 0
      });
      alert("Félicitations ! Votre dépôt mensuel a été validé avec succès.");
      window.location.reload();
    } catch (err: any) {
      console.error("Error paying deposit:", err);
      alert(err.message || "Erreur lors du paiement du dépôt.");
    }
  };

  const getRayonLabel = (r: string) => {
    switch (r) {
      case 'immo': return '🏢 Immobilier';
      case 'mode': return '👗 Rayon Mode';
      case 'connect': return '📡 Rayon Connect';
      case 'saveurs': return '🍽️ Rayon Saveurs';
      default: return r;
    }
  };

  const handleSwitchRayon = (r: string) => {
    localStorage.setItem("activeSupplierRayon", r);
    window.location.reload();
  };

  return (
    <DashboardLayout
      menuItems={navItems}
      themeColors={theme.colors}
      roleBadgeTitle="Service rattaché"
      roleBadgeValue={theme.name}
      topbarTitle="Tableau de bord"
      userName={userData?.displayName || userData?.name || "Fournisseur"}
      userRole="Partenaire"
      notifications={notifications}
      unreadCount={unreadCount}
      customProfileModal={
        <ProfileUpdateModal 
          user={user} 
          userData={userData} 
          onSuccess={() => window.location.reload()} 
        />
      }
    >
      {/* ── Rayon Switcher ── */}
      {availableRayons.length > 1 && (
        <div className="flex items-center space-x-2 bg-white/5 border border-white/10 p-2 rounded-xl overflow-x-auto mb-6 w-max shadow-lg backdrop-blur-md">
          <div className="flex items-center space-x-2 px-3 text-gray-400 shrink-0">
            <Layers size={18} className="text-primary" />
            <span className="text-sm font-semibold text-gray-200">Rayon actif :</span>
          </div>
          {availableRayons.map((r: string) => (
            <button
              key={r}
              onClick={() => handleSwitchRayon(r)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all shrink-0 flex items-center gap-2 ${
                activeRayon === r
                  ? "bg-white text-gray-950 shadow-md shadow-black/30 font-bold"
                  : "text-gray-400 hover:text-white hover:bg-white/10"
              }`}
            >
              {activeRayon === r && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
              {getRayonLabel(r)}
            </button>
          ))}
        </div>
      )}

      {/* ── Subscription / Deposit State Banners (Couleurs officielles Rayons.net) ── */}
      {subscriptionInfo.isBlocked ? (
        <div className="bg-[#0F1D27] border border-red-500/40 p-4 md:p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6 shadow-xl shadow-black/40 backdrop-blur-md">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0 mt-0.5">
              <ShieldAlert size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-red-400 font-bold text-sm">Compte Suspendu : Dépôt Mensuel Attendu ($50)</p>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                  Mode Consultation Seul
                </span>
              </div>
              <p className="text-red-200/80 text-xs mt-1 leading-relaxed max-w-2xl">
                {subscriptionInfo.reason || "Votre délai d'essai de 15 jours est dépassé. Régularisez votre dépôt pour débloquer la publication de vos articles et la messagerie client."}
              </p>
            </div>
          </div>
          <button
            onClick={handlePayDeposit}
            className="shrink-0 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-red-950/40 whitespace-nowrap flex items-center gap-2 cursor-pointer animate-pulse"
          >
            <span>Régulariser Maintenant ($50)</span>
            <ArrowRight size={14} />
          </button>
        </div>
      ) : subscriptionInfo.isTrial && (
        <div className="bg-[#0F1D27] border border-[#C7D300]/35 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 shadow-xl shadow-black/40">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-[#C7D300]/15 text-[#C7D300] border border-[#C7D300]/30 shrink-0">
              <Clock size={20} />
            </div>
            <div>
              <p className="text-white font-bold text-sm flex items-center gap-2 flex-wrap">
                <span>Période d'essai active :</span>
                <span className="text-[#C7D300] font-extrabold">{subscriptionInfo.daysLeft} jour{subscriptionInfo.daysLeft > 1 ? "s" : ""} restant{subscriptionInfo.daysLeft > 1 ? "s" : ""}</span>
              </p>
              <p className="text-gray-300 text-xs mt-0.5">
                Échéance du premier dépôt le <strong className="text-white font-semibold">{subscriptionInfo.formattedDueDate}</strong>. Période d'essai de 15 jours gérée par l'administration.
              </p>
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {pathname === '/supplier/finance' ? (
              <button
                onClick={handlePayDeposit}
                className="px-4 py-2 bg-[#C7D300] hover:bg-[#b0ba00] text-[#0F1D27] text-xs font-extrabold rounded-xl shadow-md transition-all cursor-pointer"
              >
                Régler d'avance ($50)
              </button>
            ) : (
              <button
                onClick={() => router.push('/supplier/finance')}
                className="px-4 py-2 bg-[#C7D300]/15 hover:bg-[#C7D300]/25 text-[#C7D300] border border-[#C7D300]/30 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Voir échéancier
              </button>
            )}
          </div>
        </div>
      )}
      
      {service === "immo" && 
        (!userData?.rccm || !userData?.nif || !userData?.logoUrl || !userData?.idNat) && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl flex items-start space-x-3 mb-6">
          <ShieldAlert className="text-red-400 mt-0.5 shrink-0" size={20} />
          <div>
            <h3 className="text-red-400 font-semibold text-sm">Profil Légal Incomplet</h3>
            <p className="text-red-400/80 text-sm mt-1">Vous devez renseigner votre RCCM, ID Nat, NIF et Logo dans les Paramètres pour pouvoir générer des factures.</p>
            <Link href="/supplier/settings" className="inline-block mt-2 text-xs font-semibold text-white bg-red-500/20 hover:bg-red-500/30 px-3 py-1.5 rounded-lg transition-colors">
              Aller aux paramètres
            </Link>
          </div>
        </div>
      )}
      
      {children}
    </DashboardLayout>
  );
}
