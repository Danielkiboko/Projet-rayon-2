"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isPartner, hasAdminAccess } from "@/lib/permissions";
import DashboardLayout from "@/modules/shared/components/layouts/DashboardLayout";
import {
  BarChart3,
  ShoppingBag,
  Building2,
  Coins,
  TrendingUp,
} from "lucide-react";

function PartnerLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "stats";

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace("/login?redirect=/partner");
        return;
      }
      const partnerOk = isPartner(userData) || hasAdminAccess(user, userData);
      if (!partnerOk) {
        router.replace("/dashboard");
      }
    }
  }, [user, userData, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F1D27] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#C7D300] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-gray-300">Chargement de votre Espace Partenaire...</p>
        </div>
      </div>
    );
  }

  const partnerOk = isPartner(userData) || hasAdminAccess(user, userData);
  if (!user || !partnerOk) {
    return null;
  }

  const navItems = [
    {
      title: "Tableau de Bord & Stats",
      href: "/partner?tab=stats",
      icon: BarChart3,
      active: pathname === "/partner" && (currentTab === "stats" || !currentTab),
    },
    {
      title: "Publications Fournisseurs",
      href: "/partner?tab=publications",
      icon: ShoppingBag,
      active: pathname === "/partner" && currentTab === "publications",
    },
    {
      title: "Mes Fournisseurs",
      href: "/partner?tab=suppliers",
      icon: Building2,
      active: pathname === "/partner" && currentTab === "suppliers",
    },
    {
      title: "Commissions Récurrentes",
      href: "/partner?tab=commissions",
      icon: Coins,
      active: pathname === "/partner" && currentTab === "commissions",
    },
    {
      title: "Virement Mobile Money",
      href: "/partner?tab=payout",
      icon: TrendingUp,
      active: pathname === "/partner" && currentTab === "payout",
    },
  ];

  const displayName =
    userData?.displayName ||
    userData?.name ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Partenaire";

  return (
    <DashboardLayout
      menuItems={navItems}
      themeColors={{
        sidebarBg: "bg-[#0F1D27]",
        sidebarText: "text-white",
        primaryBtn: "bg-[#C7D300] text-[#0F1D27] font-bold",
        accentText: "text-[#C7D300]",
        activeMenuBg: "bg-[#C7D300]/15",
        activeMenuText: "text-[#C7D300]",
      }}
      roleBadgeTitle="Espace Agréé"
      roleBadgeValue="Partenaire"
      topbarTitle="Portail Partenaire"
      userName={displayName}
      userRole="Apporteur d'Affaires"
    >
      {children}
    </DashboardLayout>
  );
}

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0F1D27] flex items-center justify-center text-white">
          <div className="w-10 h-10 border-3 border-[#C7D300] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <PartnerLayoutContent>{children}</PartnerLayoutContent>
    </Suspense>
  );
}
