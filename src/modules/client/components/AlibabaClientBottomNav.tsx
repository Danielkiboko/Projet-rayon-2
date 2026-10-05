"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, MessageSquare, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/context/CartContext";

interface AlibabaClientBottomNavProps {
  activeTab?: string;
  onSelectTab?: (tab: any) => void;
  unreadMessagesCount?: number;
}

export default function AlibabaClientBottomNav({
  activeTab,
  onSelectTab,
  unreadMessagesCount = 0,
}: AlibabaClientBottomNavProps) {
  const pathname = usePathname();
  const { totalItems, openCart } = useCart();

  const isMessagesActive = pathname === "/dashboard/client/chats" || (pathname === "/dashboard/client" && activeTab === "messages");
  const isMyAlibabaActive = pathname === "/dashboard/client" && activeTab !== "messages";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#0F1D27]/95 backdrop-blur-md border-t border-gray-200 dark:border-white/10 px-2 py-1.5 flex items-center justify-around sm:hidden shadow-lg safe-area-bottom">
      {/* 1. Accueil */}
      <Link
        href="/"
        className="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-gray-900 transition-colors"
      >
        <Home size={20} strokeWidth={pathname === "/" ? 2.5 : 1.8} className={pathname === "/" ? "text-[#FF6600]" : "text-gray-500"} />
        <span className={`text-[10px] mt-0.5 font-medium ${pathname === "/" ? "text-[#FF6600] font-bold" : "text-gray-600"}`}>
          Accueil
        </span>
      </Link>

      {/* 2. Catégories */}
      <Link
        href="/rayon/connect"
        className="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-gray-900 transition-colors"
      >
        <LayoutGrid size={20} strokeWidth={pathname.startsWith("/rayon") ? 2.5 : 1.8} className={pathname.startsWith("/rayon") ? "text-[#FF6600]" : "text-gray-500"} />
        <span className={`text-[10px] mt-0.5 font-medium ${pathname.startsWith("/rayon") ? "text-[#FF6600] font-bold" : "text-gray-600"}`}>
          Catégories
        </span>
      </Link>

      {/* 3. Messagerie (Active in orange when on messages) */}
      <button
        type="button"
        onClick={() => {
          if (onSelectTab) {
            onSelectTab("messages");
          } else {
            window.location.href = "/dashboard/client?tab=messages";
          }
        }}
        className="flex flex-col items-center justify-center flex-1 py-1 transition-colors relative cursor-pointer"
      >
        <div className="relative">
          <MessageSquare 
            size={20} 
            strokeWidth={isMessagesActive ? 2.5 : 1.8} 
            className={isMessagesActive ? "text-[#FF6600]" : "text-gray-500"} 
          />
          {unreadMessagesCount > 0 && (
            <span className="absolute -top-1.5 -right-3 bg-[#FF3B30] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[17px] text-center shadow-xs">
              {unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}
            </span>
          )}
        </div>
        <span className={`text-[10px] mt-0.5 font-medium ${isMessagesActive ? "text-[#FF6600] font-bold" : "text-gray-600"}`}>
          Messagerie
        </span>
      </button>

      {/* 4. Panier */}
      <button
        type="button"
        onClick={openCart}
        className="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-gray-900 transition-colors relative cursor-pointer"
      >
        <div className="relative">
          <ShoppingCart size={20} strokeWidth={1.8} className="text-gray-500" />
          {totalItems > 0 && (
            <span className="absolute -top-1.5 -right-2.5 bg-[#FF6600] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-xs">
              {totalItems}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5 font-medium text-gray-600">
          Panier
        </span>
      </button>

      {/* 5. Mon Rayons (Mon Espace Client) */}
      <button
        type="button"
        onClick={() => {
          if (onSelectTab) {
            onSelectTab("orders");
          } else {
            window.location.href = "/dashboard/client";
          }
        }}
        className="flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer"
      >
        <User size={20} strokeWidth={isMyAlibabaActive ? 2.5 : 1.8} className={isMyAlibabaActive ? "text-[#FF6600]" : "text-gray-500"} />
        <span className={`text-[10px] mt-0.5 font-medium ${isMyAlibabaActive ? "text-[#FF6600] font-bold" : "text-gray-600"}`}>
          Mon Rayons
        </span>
      </button>
    </nav>
  );
}
