"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";
import { LogOut, Sparkles, ShieldCheck, Users, Briefcase } from "lucide-react";
import Link from "next/link";
import { isPartner, hasAdminAccess } from "@/lib/permissions";

export default function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, userData, loading } = useAuth();
  const router = useRouter();

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace("/login");
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

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

  const displayName = userData?.displayName || userData?.name || user?.displayName || user?.email?.split("@")[0] || "Partenaire";

  return (
    <div className="min-h-screen bg-[#0B151D] text-gray-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0F1D27]/95 backdrop-blur-md border-b border-white/[0.08] px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RayonsLogo size="md" variant="dark" href="/partner" />
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#C7D300]/10 border border-[#C7D300]/25 text-[#C7D300] text-xs font-bold uppercase tracking-wider">
            <Briefcase size={12} />
            <span>Portail Partenaire</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex flex-col text-right">
            <span className="text-xs font-bold text-white">{displayName}</span>
            <span className="text-[10px] text-gray-400">Apporteur d'Affaires Agréé</span>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
            title="Se déconnecter"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Déconnexion</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] bg-[#0A1218] py-4 px-6 text-center text-xs text-gray-500">
        <p>Rayons.net • Plateforme de Commerce Centralisée • Gestion Administrative et Modération par l'Administration Centrale</p>
      </footer>
    </div>
  );
}
