"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, LayoutDashboard, Package, Users, Settings, UserCheck, Store, Truck, ShoppingCart, Building, Wallet, LifeBuoy, Gift, Briefcase, Bell } from "lucide-react";
import DashboardLayout from "@/modules/shared/components/layouts/DashboardLayout";
import { hasAdminAccess, isSuperAdmin } from "@/lib/permissions";

const ADMIN_MENU = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Push & App Mobile", href: "/admin/push", icon: Bell, colorClass: { bg: "bg-[#C7D300]/10", text: "text-[#C7D300]" } },
  { title: "Clients", href: "/admin/clients", icon: UserCheck, colorClass: { bg: "bg-blue-600/10", text: "text-blue-500" } },
  { title: "Partenaires", href: "/admin/partners", icon: Briefcase, colorClass: { bg: "bg-[#C7D300]/10", text: "text-[#C7D300]" } },
  { title: "Fournisseurs", href: "/admin/suppliers", icon: Store, colorClass: { bg: "bg-blue-600/10", text: "text-blue-500" } },
  { title: "Mes Ventes", href: "/admin/orders", icon: ShoppingCart, colorClass: { bg: "bg-purple-600/10", text: "text-purple-500" } },
  { title: "Produits", href: "/admin/products", icon: Package, colorClass: { bg: "bg-purple-600/10", text: "text-purple-500" } },
  { title: "Immobilier", href: "/admin/properties", icon: Building, colorClass: { bg: "bg-green-600/10", text: "text-green-500" } },
  { title: "Livreurs", href: "/admin/drivers", icon: Truck, colorClass: { bg: "bg-blue-600/10", text: "text-blue-500" } },
  { title: "Finances", href: "/admin/finance", icon: Wallet },
  { title: "Parrainages", href: "/admin/referrals", icon: Gift, colorClass: { bg: "bg-amber-600/10", text: "text-amber-500" } },
  { title: "Tickets & Support", href: "/admin/tickets", icon: LifeBuoy, colorClass: { bg: "bg-amber-600/10", text: "text-amber-500" } },
  { title: "Santé & Bugs", href: "/admin/health", icon: ShieldAlert },
  { title: "Équipe & Fonctionnaires", href: "/admin/team", icon: Users, colorClass: { bg: "bg-indigo-600/10", text: "text-indigo-400" } },
  { title: "Paramètres", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userData, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const hasAccess = hasAdminAccess(user, userData);
  const isSuper = isSuperAdmin(user, userData);

  // Notifications logic
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!hasAccess) return;

    let unsubUsers: any;
    let unsubProps: any;
    let unsubProds: any;
    let unsubBroadcasts: any;

    const setupListeners = async () => {
      try {
        const { collection, query, where, onSnapshot, limit } = await import("firebase/firestore");
        const { db } = await import("@/lib/firebase");

        const updateNotifications = (type: string, newItems: any[]) => {
          setNotifications(prev => {
            const filtered = prev.filter(n => n.type !== type);
            const combined = [...filtered, ...newItems].sort((a, b) => b.time - a.time);
            setUnreadCount(combined.length);
            return combined;
          });
        };

        const qUsers = query(
          collection(db, "users"), 
          where("role", "in", ["SUPPLIER", "supplier", "SUPPLIER_IMMO", "supplier_immo"]),
          limit(15)
        );
        unsubUsers = onSnapshot(qUsers, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach(doc => {
            const d = doc.data();
            if (d.profileUpdateStatus === "PENDING_APPROVAL" || d.status === "PENDING_APPROVAL") {
              items.push({
                id: `supplier-${doc.id}`,
                type: "supplier",
                title: "Profil Fournisseur modifié",
                message: `${d.displayName || d.email} a mis à jour ses informations.`,
                time: Date.now(),
                link: "/admin/suppliers"
              });
            }
          });
          updateNotifications("supplier", items);
        }, (err) => {
          console.warn("Notifications users listener warning (handled):", err.message);
        });

        const qProps = query(
          collection(db, "properties"), 
          where("status", "==", "PENDING_APPROVAL"),
          limit(15)
        );
        unsubProps = onSnapshot(qProps, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach(doc => {
            const d = doc.data();
            items.push({
              id: `property-${doc.id}`,
              type: "property",
              title: "Nouveau Bien Immobilier",
              message: `${d.title || 'Bien'} est en attente de validation.`,
              time: Date.now(),
              link: "/admin/properties"
            });
          });
          updateNotifications("property", items);
        }, (err) => {
          console.warn("Notifications properties listener warning (handled):", err.message);
        });

        const qProds = query(
          collection(db, "products"), 
          where("status", "in", ["PENDING_APPROVAL", "pending_approval"]),
          limit(15)
        );
        unsubProds = onSnapshot(qProds, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach(doc => {
            const d = doc.data();
            items.push({
              id: `product-${doc.id}`,
              type: "product",
              title: "Nouveau Produit",
              message: `${d.name || 'Produit'} est en attente de validation.`,
              time: Date.now(),
              link: "/admin/products"
            });
          });
          updateNotifications("product", items);
        }, (err) => {
          console.warn("Notifications products listener warning (handled):", err.message);
        });

        const qBroadcasts = query(
          collection(db, "inapp_notifications"),
          where("userId", "==", user?.uid || ""),
          limit(30)
        );
        unsubBroadcasts = onSnapshot(qBroadcasts, (snapshot) => {
          const items: any[] = [];
          snapshot.forEach(doc => {
            const d = doc.data();
            items.push({
              id: doc.id,
              type: d.type || "system",
              title: d.title || "Notification",
              message: d.message || "",
              time: d.time || (d.createdAt?.toMillis ? d.createdAt.toMillis() : Date.now()),
              link: d.link || "#",
              read: !!d.read,
              seen: !!d.seen,
              archived: !!d.archived,
              persisted: true,
              sentByAdmin: !!d.sentByAdmin,
              sentBy: d.sentBy || "Direction Rayons.net"
            });
          });
          updateNotifications("broadcast", items);
        }, (err) => {
          console.warn("Notifications broadcasts listener warning:", err.message);
        });

      } catch (err) {
        console.error("Error setting up notifications:", err);
      }
    };

    setupListeners();

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubProps) unsubProps();
      if (unsubProds) unsubProds();
      if (unsubBroadcasts) unsubBroadcasts();
    };
  }, [hasAccess, user?.uid]);

  const userRole = (userData?.role || "").toUpperCase();
  const positions: string[] = Array.isArray(userData?.staffProfile?.positions) && userData.staffProfile.positions.length > 0
    ? userData.staffProfile.positions
    : [userRole];

  const isFullAdmin =
    isSuper ||
    positions.includes("SUB_ADMIN") ||
    positions.includes("SUBADMIN") ||
    positions.includes("ADMIN") ||
    userRole === "SUB_ADMIN" ||
    userRole === "ADMIN";

  const isLogisticsOnly =
    !isFullAdmin &&
    (positions.includes("RESPONSABLE_LOGISTIQUE") || positions.includes("ADMIN_OPS") || userRole === "ADMIN_OPS" || userRole === "RESPONSABLE_LOGISTIQUE");

  const isSupportOnly =
    !isFullAdmin &&
    (positions.includes("SUPPORT_CLIENT") || userRole === "SUPPORT_CLIENT");

  const isFinanceOnly =
    !isFullAdmin &&
    (positions.includes("RESPONSABLE_FINANCIER") || positions.includes("ADMIN_FINANCE") || userRole === "ADMIN_FINANCE" || userRole === "RESPONSABLE_FINANCIER");

  // Construire les routes strictement autorisées par poste fonctionnaire
  const allowedHrefs = new Set<string>();
  if (isFullAdmin) {
    ADMIN_MENU.forEach((m) => allowedHrefs.add(m.href));
  } else {
    if (positions.includes("RESPONSABLE_FINANCIER") || positions.includes("ADMIN_FINANCE") || userRole.includes("FINANCE")) {
      // Finance : uniquement ce que l'application génère (Abonnements, Caisse, Commissions Partenaires & Parrainages)
      allowedHrefs.add("/admin/finance");
      allowedHrefs.add("/admin/partners");
      allowedHrefs.add("/admin/referrals");
    }
    if (positions.includes("SUPPORT_CLIENT") || userRole.includes("SUPPORT")) {
      // Service Client : uniquement les requêtes/correspondances clients et l'annuaire clients
      allowedHrefs.add("/admin/tickets");
      allowedHrefs.add("/admin/clients");
    }
    if (positions.includes("RESPONSABLE_LOGISTIQUE") || positions.includes("ADMIN_OPS") || userRole.includes("OPS") || userRole.includes("LOGISTIQUE")) {
      // Logistique : uniquement la flotte de livreurs et les courses/livraisons
      allowedHrefs.add("/admin/drivers");
      allowedHrefs.add("/admin/orders");
    }
    if (positions.includes("RESPONSABLE_CATALOGUE") || positions.includes("ADMIN_DB") || positions.includes("ADMIN_TECH") || userRole.includes("DB") || userRole.includes("CATALOGUE")) {
      // Catalogue : uniquement modération produits, immobilier et consultation fournisseurs
      allowedHrefs.add("/admin/products");
      allowedHrefs.add("/admin/properties");
      allowedHrefs.add("/admin/suppliers");
    }
    if (positions.includes("GESTIONNAIRE_ADMIN") || userRole === "GESTIONNAIRE_ADMIN") {
      // Gestionnaire Admin : KYC fournisseurs, partenaires, clients, tickets et push
      allowedHrefs.add("/admin/suppliers");
      allowedHrefs.add("/admin/partners");
      allowedHrefs.add("/admin/clients");
      allowedHrefs.add("/admin/tickets");
      allowedHrefs.add("/admin/push");
    }
  }

  // Adapter les intitulés du menu selon le métier du fonctionnaire
  const filteredMenuItems = ADMIN_MENU.filter((item) => isFullAdmin || allowedHrefs.has(item.href)).map((item) => {
    if (item.href === "/admin/orders" && isLogisticsOnly) {
      return { ...item, title: "Courses & Livraisons" };
    }
    if (item.href === "/admin/drivers" && isLogisticsOnly) {
      return { ...item, title: "Flotte & Livreurs" };
    }
    if (item.href === "/admin/tickets" && isSupportOnly) {
      return { ...item, title: "Requêtes & Correspondances" };
    }
    if (item.href === "/admin/finance" && isFinanceOnly) {
      return { ...item, title: "Finances & Abonnements" };
    }
    return item;
  });

  // Redirection automatique si un fonctionnaire tente d'ouvrir une page hors de son périmètre
  const allowedHrefsList = Array.from(allowedHrefs);
  const primaryRoute = isFullAdmin
    ? "/admin/dashboard"
    : allowedHrefsList[0] || "/admin/tickets";

  useEffect(() => {
    if (loading || !hasAccess || isFullAdmin) return;
    const isCurrentAllowed = allowedHrefsList.some(
      (href) => pathname === href || pathname.startsWith(`${href}/`)
    );
    if (!isCurrentAllowed && primaryRoute) {
      router.replace(primaryRoute);
    }
  }, [pathname, loading, hasAccess, isFullAdmin, primaryRoute, router, allowedHrefsList.join(",")]);

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#0F1D27] text-white">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-14 h-14 rounded-full border-3 border-white/10 border-t-[#C7D300] animate-spin" />
          <div className="absolute w-2.5 h-2.5 rounded-full bg-[#C7D300]" />
        </div>
        <p className="text-xs text-gray-400 font-medium tracking-wide">
          Vérification des accès administrateur...
        </p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0F1D27] text-white flex-col p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center mb-4">
          <ShieldAlert size={32} />
        </div>
        <h1 className="text-2xl font-bold mb-2 font-heading">Accès Restreint</h1>
        <p className="text-gray-400 text-sm max-w-sm mb-6">
          Cette zone est strictement réservée à l&apos;équipe administrative de Rayons.net.
        </p>
        <Link 
          href="/" 
          className="px-5 py-2.5 bg-[#C7D300] hover:bg-[#b5bf00] text-[#0F1D27] rounded-xl font-bold text-xs transition-colors shadow-lg shadow-[#C7D300]/15"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  const roleBadgeValue = isSuper 
    ? "SUPER ADMIN" 
    : userRole === "SUB_ADMIN" || userRole === "SUBADMIN" || userRole === "ADMIN"
    ? "SOUS-ADMINISTRATEUR"
    : userData?.staffProfile?.positions?.length
    ? "FONCTIONNAIRE DÉLÉGUÉ"
    : "ADMIN DÉLÉGUÉ";

  const userRoleTitle = isSuper 
    ? "Directeur Général (Super Admin)" 
    : userData?.roleTitle ||
      (userRole === "SUB_ADMIN" || userRole === "SUBADMIN" || userRole === "ADMIN"
        ? "Sous-Administrateur Général (Adjoint)"
        : userRole === "ADMIN_FINANCE"
        ? "Responsable Finances & Caisse"
        : userRole === "ADMIN_DB" || userRole === "ADMIN_TECH"
        ? "Gestionnaire Catalogue & BDD"
        : userRole === "ADMIN_OPS"
        ? "Responsable Opérations & Logistique"
        : "Collaborateur Administratif");

  const roleBadgeTitle = isSuper
    ? "Direction Générale"
    : userRole === "SUB_ADMIN" || userRole === "SUBADMIN" || userRole === "ADMIN"
    ? "Direction Adjointe"
    : "Fonctionnaire Rayons";

  return (
    <DashboardLayout
      menuItems={filteredMenuItems}
      roleBadgeTitle={roleBadgeTitle}
      roleBadgeValue={roleBadgeValue}
      topbarTitle="Administration Centrale"
      userName={userData?.displayName || userData?.name || "Collaborateur"}
      userRole={userRoleTitle}
      notifications={notifications}
      unreadCount={unreadCount}
    >
      {children}
    </DashboardLayout>
  );
}
