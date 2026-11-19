"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { 
  LogOut, 
  Menu, 
  X, 
  Bell, 
  UserCircle, 
  Search, 
  ShieldAlert, 
  Lock, 
  ArrowRight, 
  Megaphone,
  LayoutDashboard,
  ShoppingBag,
  Package,
  MessageSquare,
  LifeBuoy,
  BarChart3,
  Building2,
  Coins
} from "lucide-react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";
import { RayonsMark } from "@/modules/shared/components/brand/RayonsMark";
import AnnouncementReaderModal from "@/modules/shared/components/notifications/AnnouncementReaderModal";
import NotificationCenter, { isAnnouncementNotif } from "@/modules/shared/components/notifications/NotificationCenter";
import ProfileManagerModal from "@/modules/shared/components/profile/ProfileManagerModal";
import { LanguageSelector } from "@/modules/shared/components/LanguageSelector";
import { useLanguage } from "@/context/LanguageContext";

type MenuItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  requiresPremium?: boolean;
  locked?: boolean;
  active?: boolean;
  onClick?: () => void;
  colorClass?: {
    bg: string;
    text: string;
  };
};

type ThemeColors = {
  sidebarBg?: string;
  sidebarText?: string;
  primaryBtn?: string;
  primaryBtnHover?: string;
  accentText?: string;
  activeMenuBg?: string;
  activeMenuText?: string;
};

type Notification = {
  id: string;
  title: string;
  message: string;
  time: number;
  read?: boolean;
  type?: string;
  link?: string;
};

interface DashboardLayoutProps {
  children: React.ReactNode;
  menuItems: MenuItem[];
  themeColors?: ThemeColors;
  topbarTitle?: string;
  roleBadgeTitle?: string;
  roleBadgeValue?: string;
  userName?: string;
  userRole?: string;
  unreadCount?: number;
  notifications?: Notification[];
  serviceType?: string;
  customProfileModal?: React.ReactNode;
}

export function DashboardLayout({
  children,
  menuItems,
  themeColors = {
    sidebarBg: "bg-[#0F1D27]",
    sidebarText: "text-white",
    primaryBtn: "bg-[#C7D300] text-[#0F1D27] font-bold",
    accentText: "text-[#C7D300]",
    activeMenuBg: "bg-[#C7D300]/15",
    activeMenuText: "text-[#C7D300]"
  },
  topbarTitle = "Tableau de bord",
  roleBadgeTitle = "Fournisseur",
  roleBadgeValue,
  userName: passedUserName,
  userRole: passedUserRole,
  unreadCount: passedUnreadCount,
  notifications: passedNotifications,
  serviceType = "default",
  customProfileModal
}: DashboardLayoutProps) {
  const pathname = usePathname();
  const { user, userData, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { t, translateLabel } = useLanguage();
  const router = useRouter();
  const [navQuery, setNavQuery] = useState("");
  const [isNavSearchOpen, setIsNavSearchOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<any | null>(null);
  const [lockedModalItem, setLockedModalItem] = useState<MenuItem | null>(null);

  // Utiliser directement les notifications transmises par le parent (pour rester réactif en temps réel)
  const notifications = passedNotifications || [];
  const unreadCount = passedUnreadCount !== undefined ? passedUnreadCount : notifications.filter(n => !n.read).length;
  const unreadAnnouncement = notifications.find(
    (n: any) => isAnnouncementNotif(n) && !n.read && !n.archived
  );

  const userName = passedUserName || user?.displayName || user?.email || "Fournisseur";
  const userRole = passedUserRole || roleBadgeTitle;

  const catalogItem = menuItems.find(m => m.href.includes("products") || m.href.includes("properties") || m.href.includes("catalog"));
  const orderItem = menuItems.find(m => m.href.includes("orders"));
  const messageItem = menuItems.find(m => m.href.includes("messages"));
  const orderBadgeCount = orderItem?.badge || 0;
  const messageBadgeCount = messageItem?.badge || 0;

  const isSupplierMenuSubRoute = pathname.startsWith("/supplier") &&
    pathname !== "/supplier" &&
    !pathname.includes("products") &&
    !pathname.includes("properties") &&
    !pathname.includes("orders") &&
    !pathname.includes("messages");

  const isAdminMenuSubRoute = pathname.startsWith("/admin") &&
    pathname !== "/admin" &&
    pathname !== "/admin/dashboard" &&
    !pathname.startsWith("/admin/orders") &&
    !pathname.startsWith("/admin/products") &&
    !pathname.startsWith("/admin/tickets");

  return (
    <div className="flex h-dvh bg-[#0B151C] overflow-hidden font-sans">
      {customProfileModal}
      <ProfileManagerModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        userRoleLabel={userRole}
      />

      {/* Subscription Locked Feature Modal */}
      <AnimatePresence>
        {lockedModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 10 }}
              className="bg-[#0F1B24] border border-red-500/30 rounded-2xl p-6 max-w-md w-full shadow-2xl shadow-black/80 relative"
            >
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 mb-4">
                <Lock size={24} />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">
                Accès restreint : {lockedModalItem.title}
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed mb-4">
                Votre période d'essai de 15 jours est terminée. La navigation et la gestion active de cette section sont bloquées jusqu'au règlement de votre dépôt mensuel ($50).
              </p>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 mb-6 text-xs text-gray-300 leading-relaxed">
                💡 <strong className="text-white">Mode consultation :</strong> Vous pouvez toujours visualiser vos indicateurs globaux sur votre tableau de bord.
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setLockedModalItem(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-gray-300 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors"
                >
                  Rester ici
                </button>
                <Link
                  href="/supplier/finance"
                  onClick={() => setLockedModalItem(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-lg shadow-red-950/40 text-center"
                >
                  <span>Payer ($50)</span>
                  <ArrowRight size={15} />
                </Link>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        className={`fixed inset-y-0 left-0 z-50 w-64 h-dvh shrink-0 ${themeColors.sidebarBg} border-r border-white/10 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-white/10 shrink-0">
          <RayonsLogo 
            variant="dark" 
            size="sm" 
            rayon={serviceType !== "default" ? (serviceType as any) : undefined} 
            href="/" 
          />
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-3 space-y-0.5 overscroll-contain">
          {menuItems.map((item, index) => {
            const isActive = item.active !== undefined 
              ? item.active 
              : (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
            const Icon = item.icon;
            
            const activeBg = item.colorClass ? item.colorClass.bg : themeColors.activeMenuBg;
            const activeText = item.colorClass ? item.colorClass.text : themeColors.activeMenuText;

            if (item.locked) {
              return (
                <div 
                  key={`${item.href || 'locked'}-${item.title}-${index}`} 
                  onClick={() => {
                    setIsSidebarOpen(false);
                    setLockedModalItem(item);
                  }}
                  className="flex items-center justify-between px-3 py-2 rounded-xl transition-all text-gray-500 hover:bg-red-500/10 hover:text-red-300 cursor-pointer opacity-70 group border border-transparent hover:border-red-500/20"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon size={17} strokeWidth={1.8} className="text-gray-500 group-hover:text-red-400 shrink-0" />
                    <span className="text-[13px] font-medium truncate">{translateLabel(item.title)}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20 shrink-0">
                    <Lock size={10} />
                    <span>Bloqué</span>
                  </div>
                </div>
              );
            }
            
            return (
              <Link 
                key={`${item.href || 'menu'}-${item.title}-${index}`} 
                href={item.href} 
                onClick={() => {
                  setIsSidebarOpen(false);
                  if (item.onClick) {
                    item.onClick();
                  }
                }}
              >
                <div className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all ${
                  isActive 
                    ? `${activeBg} ${activeText} shadow-sm font-bold` 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}>
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Icon size={17} strokeWidth={isActive ? 2.4 : 1.9} className="shrink-0" />
                    <span className={`text-[13px] truncate ${isActive ? "font-semibold" : "font-medium"}`}>{translateLabel(item.title)}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shrink-0">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-1.5 shrink-0 bg-[#0B151C]/60">
          <div className={`px-3 py-2 rounded-xl border text-center ${themeColors.activeMenuBg} border-white/5`}>
            <p className="text-[9px] text-gray-400 uppercase font-bold tracking-wider">{translateLabel(roleBadgeTitle)}</p>
            <p className={`text-xs font-bold truncate ${themeColors.accentText}`}>
              {roleBadgeValue}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                setIsProfileModalOpen(true);
              }}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-gray-200 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors cursor-pointer text-[11px] font-bold"
              title={t("dash.profileIdentity")}
            >
              <UserCircle size={15} className="text-[#C7D300] shrink-0" />
              <span className="truncate">{t("nav.profile")}</span>
            </button>
            <button 
              type="button"
              onClick={() => {
                setIsSidebarOpen(false);
                signOut();
              }}
              className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl text-red-400 bg-red-500/5 hover:bg-red-500/15 border border-red-500/15 transition-colors cursor-pointer text-[11px] font-bold"
              title={t("dash.logout")}
            >
              <LogOut size={15} className="shrink-0" />
              <span className="truncate">{t("dash.logout")}</span>
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Main content wrapper */}
      <main className="flex-1 flex flex-col h-dvh overflow-hidden relative">
        {/* Topbar */}
        <header className="h-13 sm:h-16 flex items-center justify-between px-3 sm:px-6 border-b border-white/10 bg-[#0F1D27]/90 backdrop-blur-md z-30 relative gap-2 shrink-0">
          <div className="flex items-center min-w-0 flex-1 mr-2">
            <button onClick={() => setIsSidebarOpen(true)} className="mr-2 sm:mr-3 text-gray-400 hover:text-white lg:hidden shrink-0 p-1.5 rounded-lg hover:bg-white/5 active:scale-95 transition-all">
              <Menu size={20} />
            </button>
            <Link href="/" className="lg:hidden mr-2 shrink-0 flex items-center">
              <RayonsMark size={22} color="#C7D300" />
            </Link>
            <h1 className="text-xs sm:text-base md:text-lg font-bold text-white truncate">{translateLabel(topbarTitle)}</h1>
          </div>
          
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            {/* Quick Jump Navigation Search */}
            <div className="relative hidden md:block">
              <div className="flex items-center bg-white/5 rounded-full px-3.5 py-1.5 border border-white/10 focus-within:border-[#C7D300]/50 transition-colors">
                <Search size={15} className="text-gray-400 mr-2 shrink-0" />
                <input 
                  type="text" 
                  value={navQuery}
                  onFocus={() => setIsNavSearchOpen(true)}
                  onBlur={() => setTimeout(() => setIsNavSearchOpen(false), 180)}
                  onChange={(e) => {
                    setNavQuery(e.target.value);
                    setIsNavSearchOpen(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && navQuery.trim()) {
                      const q = navQuery.toLowerCase();
                      const match = menuItems.find(
                        (m) =>
                          !m.locked &&
                          (m.title.toLowerCase().includes(q) ||
                            translateLabel(m.title).toLowerCase().includes(q) ||
                            m.href.toLowerCase().includes(q))
                      );
                      if (match) {
                        router.push(match.href);
                        setNavQuery("");
                        setIsNavSearchOpen(false);
                      }
                    }
                  }}
                  placeholder={t("dash.search")} 
                  className="bg-transparent text-xs sm:text-sm text-white placeholder-gray-500 focus:outline-none w-40 lg:w-48"
                />
                {navQuery && (
                  <button type="button" onClick={() => setNavQuery("")} className="text-gray-400 hover:text-white ml-1 cursor-pointer">
                    <X size={13} />
                  </button>
                )}
              </div>

              {isNavSearchOpen && (
                <div className="absolute right-0 mt-1.5 w-64 max-h-72 overflow-y-auto rounded-xl bg-[#12222E] border border-white/15 shadow-2xl py-1.5 z-50">
                  {menuItems
                    .filter((m) => {
                      if (m.locked) return false;
                      if (!navQuery.trim()) return true;
                      const q = navQuery.toLowerCase();
                      return (
                        m.title.toLowerCase().includes(q) ||
                        translateLabel(m.title).toLowerCase().includes(q) ||
                        m.href.toLowerCase().includes(q)
                      );
                    })
                    .map((m, idx) => {
                      const ItemIcon = m.icon;
                      return (
                        <button
                          key={`${m.href}-${idx}`}
                          type="button"
                          onMouseDown={() => {
                            router.push(m.href);
                            setNavQuery("");
                            setIsNavSearchOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-xs text-gray-200 hover:bg-white/10 hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors"
                        >
                          <ItemIcon size={14} className="text-[#C7D300] shrink-0" />
                          <span className="truncate font-medium">{translateLabel(m.title)}</span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>

            <LanguageSelector variant="dark" />
            
            {/* Notification Center */}
            <NotificationCenter
              notifications={notifications as any}
              accentText={themeColors.accentText}
              onOpenAnnouncement={(n) => setSelectedAnnouncement(n)}
            />

            <button
              type="button"
              onClick={() => setIsProfileModalOpen(true)}
              title="Gérer mon profil, mes numéros et ma pièce d'identité"
              className="flex items-center space-x-2.5 pl-2 sm:pl-4 border-l border-white/10 group cursor-pointer text-left rounded-xl py-1 pr-1.5 hover:bg-white/5 transition-all"
            >
              <div className="hidden md:block text-right">
                <span className="text-sm font-medium text-gray-200 group-hover:text-white block leading-tight transition-colors">
                  {(() => {
                    const currentHour = new Date().getHours();
                    const greeting = currentHour >= 5 && currentHour < 18 ? t("dash.hello") : t("dash.goodEvening");
                    return (userName && userName !== "Fournisseur" && userName !== "Utilisateur")
                      ? `${greeting} ${userName}`
                      : userName;
                  })()}
                </span>
                <span className="text-[10px] text-[#C7D300] font-semibold block leading-tight">
                  {userRole} • {t("dash.manageProfile")}
                </span>
              </div>
              <div className="relative w-9 h-9 rounded-full bg-white/10 text-gray-300 group-hover:text-white group-hover:border-[#C7D300]/50 border border-white/15 flex items-center justify-center overflow-hidden transition-all shrink-0 shadow-sm">
                {userData?.logoUrl || userData?.logo || userData?.photoURL ? (
                  <img
                    src={userData.logoUrl || userData.logo || userData.photoURL}
                    alt={userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCircle size={24} />
                )}
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#C7D300] ring-2 ring-[#0F1D27]" />
              </div>
            </button>
          </div>
        </header>
        
        {/* Scrollable Content with Mobile-friendly spacing */}
        <div className="flex-1 overflow-y-auto p-2.5 sm:p-5 md:p-8 pb-20 lg:pb-8">
          <div className="max-w-7xl mx-auto space-y-3.5 sm:space-y-6">
            {/* Bannière de communiqué officiel si non lu */}
            {unreadAnnouncement && (
              <div className="bg-gradient-to-r from-[#0F1D27] via-[#162a38] to-[#0F1D27] border border-[#C7D300]/40 rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-xl shadow-black/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-[#C7D300]/15 border border-[#C7D300]/30 flex items-center justify-center text-[#C7D300] shrink-0">
                    <Megaphone size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#C7D300]/20 text-[#C7D300] border border-[#C7D300]/30">
                        Communiqué Officiel
                      </span>
                      <span className="text-[10px] sm:text-xs text-gray-400">Direction Rayons.net</span>
                    </div>
                    <h4 className="text-xs sm:text-sm font-bold text-white mt-0.5">{unreadAnnouncement.title}</h4>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedAnnouncement(unreadAnnouncement)}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-gradient-to-r from-[#C7D300] to-[#b5c000] text-[#0F1D27] text-[11px] sm:text-xs font-bold transition-all shadow-md shadow-[#C7D300]/20 hover:brightness-110 active:scale-95 shrink-0 cursor-pointer w-full sm:w-auto text-center"
                >
                  Lire le communiqué
                </button>
              </div>
            )}

            {children}
          </div>
        </div>

        {/* Tactile Mobile Bottom Navigation Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-[#0F1D27]/95 backdrop-blur-md border-t border-white/10 px-1.5 pt-1.5 pb-[calc(0.4rem+env(safe-area-inset-bottom,0px))] flex items-center justify-around shadow-2xl">
          {pathname.startsWith("/admin") ? (
            /* ── ADMIN MOBILE QUICK BAR (Dynamique selon les droits du compte) ── */
            <>
              {menuItems.slice(0, 4).map((item, idx) => {
                const QuickIcon = item.icon;
                const isItemActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={`${item.href}-${idx}`}
                    href={item.href}
                    className={`flex flex-col items-center justify-center flex-1 py-1 min-w-0 transition-colors ${
                      isItemActive
                        ? themeColors.accentText || "text-[#C7D300]"
                        : "text-gray-400 hover:text-white"
                    }`}
                  >
                    <QuickIcon size={19} strokeWidth={isItemActive ? 2.5 : 2} />
                    <span className="text-[10px] font-semibold mt-1 truncate max-w-[68px]">
                      {translateLabel(item.title)}
                    </span>
                  </Link>
                );
              })}

              {/* 5. Menu Drawer complet */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className="flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer relative text-gray-300 hover:text-white"
              >
                <Menu size={19} strokeWidth={2.2} />
                <span className="text-[10px] font-semibold mt-1">Menu</span>
              </button>
            </>
          ) : pathname.startsWith("/partner") ? (
            /* ── PARTENAIRE MOBILE QUICK BAR ── */
            <>
              <Link
                href="/partner?tab=stats"
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  menuItems[0]?.active ? themeColors.accentText || "text-[#C7D300]" : "text-gray-400 hover:text-white"
                }`}
              >
                <BarChart3 size={19} strokeWidth={menuItems[0]?.active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold mt-1">Stats</span>
              </Link>

              <Link
                href="/partner?tab=publications"
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  menuItems[1]?.active ? themeColors.accentText || "text-[#C7D300]" : "text-gray-400 hover:text-white"
                }`}
              >
                <ShoppingBag size={19} strokeWidth={menuItems[1]?.active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold mt-1">Publications</span>
              </Link>

              <Link
                href="/partner?tab=suppliers"
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  menuItems[2]?.active ? themeColors.accentText || "text-[#C7D300]" : "text-gray-400 hover:text-white"
                }`}
              >
                <Building2 size={19} strokeWidth={menuItems[2]?.active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold mt-1">Boutiques</span>
              </Link>

              <Link
                href="/partner?tab=commissions"
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  menuItems[3]?.active ? themeColors.accentText || "text-[#C7D300]" : "text-gray-400 hover:text-white"
                }`}
              >
                <Coins size={19} strokeWidth={menuItems[3]?.active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold mt-1">Gains</span>
              </Link>

              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer relative ${
                  menuItems[4]?.active ? themeColors.accentText || "text-[#C7D300]" : "text-gray-400 hover:text-white"
                }`}
              >
                <Menu size={19} strokeWidth={menuItems[4]?.active ? 2.5 : 2} />
                <span className="text-[10px] font-semibold mt-1">Menu</span>
              </button>
            </>
          ) : (
            /* ── FOURNISSEUR MOBILE QUICK BAR ── */
            <>
              {/* 1. Accueil Fournisseur */}
              <Link
                href="/supplier"
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  pathname === "/supplier" ? themeColors.accentText || "text-[#C7D300]" : "text-gray-400 hover:text-white"
                }`}
              >
                <LayoutDashboard size={19} strokeWidth={pathname === "/supplier" ? 2.5 : 2} />
                <span className="text-[10px] font-semibold mt-1">Accueil</span>
              </Link>

              {/* 2. Catalogue Fournisseur */}
              <Link
                href={catalogItem?.href || "/supplier/products"}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                  pathname.includes("products") || pathname.includes("properties")
                    ? themeColors.accentText || "text-[#C7D300]"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Package size={19} strokeWidth={pathname.includes("products") || pathname.includes("properties") ? 2.5 : 2} />
                <span className="text-[10px] font-semibold mt-1">
                  {pathname.includes("properties") ? "Biens" : "Catalogue"}
                </span>
              </Link>

              {/* 3. Ventes Fournisseur */}
              <Link
                href="/supplier/orders"
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
                  pathname.includes("orders") ? themeColors.accentText || "text-[#C7D300]" : "text-gray-400 hover:text-white"
                }`}
              >
                <div className="relative">
                  <ShoppingBag size={19} strokeWidth={pathname.includes("orders") ? 2.5 : 2} />
                  {orderBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-[#C7D300] text-[#0F1D27] text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[15px] text-center">
                      {orderBadgeCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold mt-1">Ventes</span>
              </Link>

              {/* 4. Messages Fournisseur */}
              <Link
                href="/supplier/messages"
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors relative ${
                  pathname.includes("messages") ? themeColors.accentText || "text-[#C7D300]" : "text-gray-400 hover:text-white"
                }`}
              >
                <div className="relative">
                  <MessageSquare size={19} strokeWidth={pathname.includes("messages") ? 2.5 : 2} />
                  {messageBadgeCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[15px] text-center animate-pulse">
                      {messageBadgeCount}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold mt-1">Messages</span>
              </Link>

              {/* 5. Menu Drawer */}
              <button
                type="button"
                onClick={() => setIsSidebarOpen(true)}
                className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer relative ${
                  isSupplierMenuSubRoute ? themeColors.accentText || "text-[#C7D300]" : "text-gray-400 hover:text-white"
                }`}
              >
                <div className="relative">
                  <Menu size={19} strokeWidth={isSupplierMenuSubRoute ? 2.5 : 2} />
                  {isSupplierMenuSubRoute && (
                    <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-[#C7D300] animate-pulse" />
                  )}
                </div>
                <span className="text-[10px] font-semibold mt-1">Menu</span>
              </button>
            </>
          )}
        </nav>

        {/* Modal de lecture du communiqué officiel */}
        <AnnouncementReaderModal
          isOpen={!!selectedAnnouncement}
          announcement={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      </main>
    </div>
  );
}

export default DashboardLayout;
