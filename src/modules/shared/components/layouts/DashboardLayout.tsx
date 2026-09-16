"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Menu, X, Bell, UserCircle, Search, ShieldAlert, Lock, ArrowRight } from "lucide-react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";

type MenuItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: number;
  requiresPremium?: boolean;
  locked?: boolean;
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
  const { user, signOut } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(passedNotifications || []);

  const [lockedModalItem, setLockedModalItem] = useState<MenuItem | null>(null);

  const unreadCount = passedUnreadCount !== undefined ? passedUnreadCount : notifications.filter(n => !n.read).length;

  const userName = passedUserName || user?.displayName || user?.email || "Fournisseur";
  const userRole = passedUserRole || roleBadgeTitle;

  return (
    <div className="flex h-screen bg-[#0B151C] overflow-hidden font-sans">
      {customProfileModal}

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
        className={`fixed inset-y-0 left-0 z-50 w-64 ${themeColors.sidebarBg} border-r border-white/10 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-white/10">
          <RayonsLogo 
            variant="dark" 
            size="sm" 
            rayon={serviceType !== "default" ? (serviceType as any) : undefined} 
            href="/" 
          />
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            
            const activeBg = item.colorClass ? item.colorClass.bg : themeColors.activeMenuBg;
            const activeText = item.colorClass ? item.colorClass.text : themeColors.activeMenuText;

            if (item.locked) {
              return (
                <div 
                  key={item.title} 
                  onClick={() => setLockedModalItem(item)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl transition-all text-gray-500 hover:bg-red-500/10 hover:text-red-300 cursor-pointer opacity-70 group border border-transparent hover:border-red-500/20"
                >
                  <div className="flex items-center space-x-3">
                    <Icon size={20} strokeWidth={1.8} className="text-gray-500 group-hover:text-red-400" />
                    <span className="text-sm font-medium">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-400 text-[10px] font-bold border border-red-500/20">
                    <Lock size={10} />
                    <span>Bloqué</span>
                  </div>
                </div>
              );
            }
            
            return (
              <Link key={item.title} href={item.href}>
                <div className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? `${activeBg} ${activeText} shadow-sm` 
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}>
                  <div className="flex items-center space-x-3">
                    <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                    <span className={`text-sm ${isActive ? "font-semibold" : "font-medium"}`}>{item.title}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                      {item.badge}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/5">
          <div className={`px-4 py-3 mb-4 rounded-xl border text-center ${themeColors.activeMenuBg} border-white/5`}>
            {roleBadgeTitle === "Privilèges" && <ShieldAlert size={20} className={`mx-auto mb-1 ${themeColors.accentText}`} />}
            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">{roleBadgeTitle}</p>
            <p className={`text-sm font-semibold truncate ${themeColors.accentText}`}>
              {roleBadgeValue}
            </p>
          </div>
          <button 
            onClick={() => signOut()}
            className="flex items-center justify-center space-x-2 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-400/10 transition-colors"
          >
            <LogOut size={18} />
            <span className="text-sm font-medium">Déconnexion</span>
          </button>
        </div>
      </motion.aside>

      {/* Main content wrapper */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Topbar */}
        <header className="h-16 flex items-center justify-between px-6 border-b border-white/10 bg-[#0F1D27]/90 backdrop-blur-md z-30 relative">
          <div className="flex items-center">
            <button onClick={() => setIsSidebarOpen(true)} className="mr-4 text-gray-400 hover:text-white lg:hidden">
              <Menu size={24} />
            </button>
            <h1 className="text-lg font-semibold text-white hidden sm:block">{topbarTitle}</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center bg-white/5 rounded-full px-4 py-2 border border-white/5">
              <Search size={16} className="text-gray-400 mr-2" />
              <input 
                type="text" 
                placeholder="Rechercher..." 
                className="bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none w-48"
              />
            </div>
            
            {/* Notification Dropdown */}
            <div className="relative">
              <button 
                onClick={() => setIsNotifOpen(!isNotifOpen)}
                className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                )}
              </button>
              
              {isNotifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-4 border-b border-white/10 bg-[#222]">
                      <h3 className="text-sm font-semibold text-white">Notifications ({unreadCount})</h3>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-400 text-sm">
                          Aucune notification.
                        </div>
                      ) : (
                        notifications.map((notif) => (
                          <Link 
                            key={notif.id} 
                            href={notif.link || "#"}
                            onClick={() => setIsNotifOpen(false)}
                            className="block p-4 border-b border-white/5 hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-start">
                              <div className={`w-8 h-8 rounded bg-blue-500/20 ${themeColors.accentText} flex items-center justify-center mr-3 shrink-0`}>
                                <ShieldAlert size={16} />
                              </div>
                              <div>
                                <h4 className="text-sm font-medium text-white">{notif.title}</h4>
                                <p className="text-xs text-gray-400 mt-1">{notif.message}</p>
                              </div>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center space-x-2 pl-4 border-l border-white/10">
              <div className="hidden md:block text-right">
                <span className="text-sm font-medium text-gray-300 block leading-tight">
                  {(() => {
                    const currentHour = new Date().getHours();
                    const greeting = currentHour >= 5 && currentHour < 18 ? "Bonjour" : "Bonsoir";
                    return (userName && userName !== "Fournisseur" && userName !== "Utilisateur")
                      ? `${greeting} ${userName}`
                      : userName;
                  })()}
                </span>
                <span className="text-[10px] text-gray-500 block leading-tight">{userRole}</span>
              </div>
              <button className="p-1 rounded-full bg-white/5 text-gray-400 hover:text-white border border-white/5">
                <UserCircle size={28} />
              </button>
            </div>
          </div>
        </header>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardLayout;
