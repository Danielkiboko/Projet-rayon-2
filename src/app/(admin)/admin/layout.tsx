"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { ShieldAlert, LayoutDashboard, Package, Users, Settings, UserCheck, Store, Truck, ShoppingCart, Building, Wallet } from "lucide-react";
import DashboardLayout from "@/modules/shared/components/layouts/DashboardLayout";
import { hasAdminAccess, isSuperAdmin } from "@/lib/permissions";

const ADMIN_MENU = [
  { title: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Commandes", href: "/admin/orders", icon: ShoppingCart, colorClass: { bg: "bg-purple-600/10", text: "text-purple-500" } },
  { title: "Produits", href: "/admin/products", icon: Package, colorClass: { bg: "bg-purple-600/10", text: "text-purple-500" } },
  { title: "Immobilier", href: "/admin/properties", icon: Building, colorClass: { bg: "bg-green-600/10", text: "text-green-500" } },
  { title: "Clients", href: "/admin/clients", icon: UserCheck, colorClass: { bg: "bg-blue-600/10", text: "text-blue-500" } },
  { title: "Fournisseurs", href: "/admin/suppliers", icon: Store, colorClass: { bg: "bg-blue-600/10", text: "text-blue-500" } },
  { title: "Livreurs", href: "/admin/drivers", icon: Truck, colorClass: { bg: "bg-blue-600/10", text: "text-blue-500" } },
  { title: "Finances", href: "/admin/finance", icon: Wallet },
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

      } catch (err) {
        console.error("Error setting up notifications:", err);
      }
    };

    setupListeners();

    return () => {
      if (unsubUsers) unsubUsers();
      if (unsubProps) unsubProps();
      if (unsubProds) unsubProds();
    };
  }, [hasAccess]);

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-[#0b061c] text-white">Chargement...</div>;
  }

  if (!hasAccess) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0b061c] text-white flex-col">
        <ShieldAlert size={48} className="mb-4 text-red-500" />
        <h1 className="text-2xl font-bold mb-2">Accès Refusé</h1>
        <p className="text-gray-400">Cette zone est strictement réservée à la direction.</p>
        <Link href="/" className="mt-6 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  const userRole = (userData?.role || "").toUpperCase();

  // Role-based menu customization
  const filteredMenuItems = ADMIN_MENU.filter((item) => {
    if (isSuper) return true;

    // Sub-Admin sees all modules exactly like the Super Admin
    if (userRole === "SUB_ADMIN" || userRole === "SUBADMIN" || userRole === "ADMIN") {
      return true;
    }

    if (userRole === "ADMIN_FINANCE") {
      return ["/admin/dashboard", "/admin/finance", "/admin/orders", "/admin/settings"].includes(item.href);
    }
    if (userRole === "ADMIN_DB" || userRole === "ADMIN_TECH") {
      return ["/admin/dashboard", "/admin/products", "/admin/properties", "/admin/orders", "/admin/settings"].includes(item.href);
    }
    if (userRole === "ADMIN_OPS") {
      return ["/admin/dashboard", "/admin/orders", "/admin/drivers", "/admin/clients", "/admin/settings"].includes(item.href);
    }
    
    return !["/admin/health"].includes(item.href);
  });

  const roleBadgeValue = isSuper 
    ? "SUPER ADMIN" 
    : userRole === "SUB_ADMIN" || userRole === "SUBADMIN" || userRole === "ADMIN"
    ? "SOUS-ADMINISTRATEUR"
    : userRole === "ADMIN_FINANCE" 
    ? "GESTIONNAIRE FINANCE"
    : userRole === "ADMIN_DB" || userRole === "ADMIN_TECH"
    ? "GESTIONNAIRE BDD & PRODUITS"
    : userRole === "ADMIN_OPS"
    ? "GESTIONNAIRE OPÉRATIONS"
    : "ADMIN DÉLÉGUÉ";

  const userRoleTitle = isSuper 
    ? "Directeur Général (Super Admin)" 
    : userRole === "SUB_ADMIN" || userRole === "SUBADMIN" || userRole === "ADMIN"
    ? "Sous-Administrateur Général (Adjoint)"
    : userRole === "ADMIN_FINANCE" 
    ? "Responsable Finances & Caisse"
    : userRole === "ADMIN_DB" || userRole === "ADMIN_TECH"
    ? "Gestionnaire Catalogue & BDD"
    : userRole === "ADMIN_OPS"
    ? "Responsable Opérations & Logistique"
    : "Collaborateur Administratif";

  return (
    <DashboardLayout
      menuItems={filteredMenuItems}
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
