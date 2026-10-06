"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, ShoppingCart, User } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";

interface AlibabaClientBottomNavProps {
  activeTab?: string;
  onSelectTab?: (tab: any) => void;
  unreadMessagesCount?: number;
  pendingPaymentsCount?: number;
}

export default function AlibabaClientBottomNav({
  activeTab,
  onSelectTab,
  unreadMessagesCount = 0,
  pendingPaymentsCount: propPendingCount,
}: AlibabaClientBottomNavProps) {
  const pathname = usePathname();
  const { totalItems, openCart } = useCart();
  const { user } = useAuth();
  
  const [livePendingCount, setLivePendingCount] = useState<number>(0);

  // Listen to pending proformas if not supplied via props
  useEffect(() => {
    if (!user) {
      setLivePendingCount(0);
      return;
    }

    if (typeof propPendingCount === "number") {
      setLivePendingCount(propPendingCount);
      return;
    }

    // Fetch user chats for pending proformas
    const qChats = query(
      collection(db, "chats"),
      where("clientId", "==", user.uid),
      limit(25)
    );

    const messageUnsubs: (() => void)[] = [];

    const unsubChats = onSnapshot(qChats, (snapshot) => {
      messageUnsubs.forEach(u => u());
      messageUnsubs.length = 0;

      if (snapshot.empty) {
        setLivePendingCount(0);
        return;
      }

      const pendingMap = new Map<string, boolean>();

      snapshot.docs.forEach((chatDoc) => {
        const qMsg = query(
          collection(db, "chats", chatDoc.id, "messages"),
          where("type", "==", "proforma")
        );

        const unsubMsg = onSnapshot(qMsg, (msgSnap) => {
          msgSnap.docs.forEach((msgDoc) => {
            const m = msgDoc.data();
            const key = `${chatDoc.id}_${msgDoc.id}`;
            if (m.proforma && m.proforma.status === "pending") {
              pendingMap.set(key, true);
            } else {
              pendingMap.delete(key);
            }
          });
          setLivePendingCount(pendingMap.size);
        });

        messageUnsubs.push(unsubMsg);
      });
    });

    return () => {
      unsubChats();
      messageUnsubs.forEach(u => u());
    };
  }, [user, propPendingCount]);

  const effectivePendingCount = typeof propPendingCount === "number" ? propPendingCount : livePendingCount;
  const cartBadgeCount = effectivePendingCount > 0 ? effectivePendingCount : totalItems;

  const isMessagesActive = pathname === "/dashboard/client/chats" || (pathname === "/dashboard/client" && activeTab === "messages");
  const isProfileActive = pathname === "/dashboard/client" && activeTab === "profile";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#0F1D27]/95 backdrop-blur-md border-t border-gray-200 dark:border-white/10 px-3 py-1.5 flex items-center justify-around sm:hidden shadow-lg safe-area-bottom">
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

      {/* 2. Messagerie */}
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

      {/* 3. Panier (Produits & Proformas en attente de paiement) */}
      <button
        type="button"
        onClick={openCart}
        className="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-gray-900 transition-colors relative cursor-pointer"
      >
        <div className="relative">
          <ShoppingCart size={20} strokeWidth={1.8} className={effectivePendingCount > 0 ? "text-[#FF6600]" : "text-gray-500"} />
          {cartBadgeCount > 0 && (
            <span className={`absolute -top-1.5 -right-2.5 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[16px] text-center shadow-xs ${
              effectivePendingCount > 0 ? "bg-[#FF6600] animate-pulse" : "bg-gray-700"
            }`}>
              {cartBadgeCount}
            </span>
          )}
        </div>
        <span className={`text-[10px] mt-0.5 font-medium ${effectivePendingCount > 0 ? "text-[#FF6600] font-bold" : "text-gray-600"}`}>
          Panier
        </span>
      </button>

      {/* 4. Mon Rayons (Profil et Coordonnées) */}
      <button
        type="button"
        onClick={() => {
          if (onSelectTab) {
            onSelectTab("profile");
          } else {
            window.location.href = "/dashboard/client?tab=profile";
          }
        }}
        className="flex flex-col items-center justify-center flex-1 py-1 transition-colors cursor-pointer"
      >
        <User size={20} strokeWidth={isProfileActive ? 2.5 : 1.8} className={isProfileActive ? "text-[#FF6600]" : "text-gray-500"} />
        <span className={`text-[10px] mt-0.5 font-medium ${isProfileActive ? "text-[#FF6600] font-bold" : "text-gray-600"}`}>
          Mon Rayons
        </span>
      </button>
    </nav>
  );
}
