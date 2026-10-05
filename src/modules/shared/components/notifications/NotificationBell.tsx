"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Bell, Check, Trash2, Package, Hotel, Truck, 
  Star, MessageSquare, ExternalLink, X, CheckCheck
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  collection, query, where, onSnapshot, 
  doc, updateDoc, writeBatch, limit 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export interface NotificationItem {
  id: string;
  type: "order" | "booking" | "delivery" | "review" | "chat" | "system";
  title: string;
  message: string;
  link?: string;
  read: boolean;
  time?: number;
  createdAt?: any;
}

interface NotificationBellProps {
  variant?: "light" | "dark";
}

export default function NotificationBell({ variant = "light" }: NotificationBellProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Real-time listener for user notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const byUserMap = new Map<string, NotificationItem>();
    const byClientMap = new Map<string, NotificationItem>();

    const updateCombined = () => {
      const combined = new Map([...byClientMap, ...byUserMap]);
      const items = Array.from(combined.values()).sort((a, b) => (b.time || 0) - (a.time || 0));
      setNotifications(items);
    };

    // Query 1: by userId
    const q1 = query(
      collection(db, "inapp_notifications"),
      where("userId", "==", user.uid),
      limit(30)
    );
    const unsub1 = onSnapshot(
      q1,
      (snapshot) => {
        byUserMap.clear();
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          byUserMap.set(docSnap.id, {
            id: docSnap.id,
            type: d.type || "system",
            title: d.title || "Notification",
            message: d.message || "",
            link: d.link || "#",
            read: !!d.read,
            time: d.time || (d.createdAt?.seconds ? d.createdAt.seconds * 1000 : Date.now()),
          });
        });
        updateCombined();
      },
      (error) => {
        console.warn("Notifications listener error (userId):", error);
      }
    );

    // Query 2: by clientId
    const q2 = query(
      collection(db, "inapp_notifications"),
      where("clientId", "==", user.uid),
      limit(30)
    );
    const unsub2 = onSnapshot(
      q2,
      (snapshot) => {
        byClientMap.clear();
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          byClientMap.set(docSnap.id, {
            id: docSnap.id,
            type: d.type || "system",
            title: d.title || "Notification",
            message: d.message || "",
            link: d.link || "#",
            read: !!d.read,
            time: d.time || (d.createdAt?.seconds ? d.createdAt.seconds * 1000 : Date.now()),
          });
        });
        updateCombined();
      },
      (error) => {
        console.warn("Notifications listener error (clientId):", error);
      }
    );

    return () => {
      unsub1();
      unsub2();
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (notif: NotificationItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!notif.read) {
      try {
        await updateDoc(doc(db, "inapp_notifications", notif.id), {
          read: true,
        });
      } catch (err) {
        console.error("Error marking notification as read:", err);
      }
    }
    if (notif.link && notif.link !== "#") {
      setIsOpen(false);
      router.push(notif.link);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    try {
      const batch = writeBatch(db);
      unread.forEach((n) => {
        batch.update(doc(db, "inapp_notifications", n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const formatRelativeTime = (timestamp?: number) => {
    if (!timestamp) return "Récemment";
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "À l'instant";
    if (mins < 60) return `Il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days === 1) return "Hier";
    if (days < 7) return `Il y a ${days} jours`;
    return new Date(timestamp).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  };

  const getIcon = (type: NotificationItem["type"]) => {
    switch (type) {
      case "order":
        return <Package size={16} className="text-blue-500" />;
      case "booking":
        return <Hotel size={16} className="text-amber-500" />;
      case "delivery":
        return <Truck size={16} className="text-emerald-500" />;
      case "review":
        return <Star size={16} className="text-yellow-500 fill-yellow-500" />;
      case "chat":
        return <MessageSquare size={16} className="text-purple-500" />;
      default:
        return <Bell size={16} className="text-indigo-500" />;
    }
  };

  if (!user) return null;

  const filteredNotifications =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  const isDark = variant === "dark";

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-full transition-all cursor-pointer group ${
          isDark
            ? "text-gray-300 hover:text-white hover:bg-white/10"
            : "text-[#0F1D27] hover:bg-gray-100"
        }`}
        title="Centre de notifications"
        aria-label="Notifications"
      >
        <Bell size={21} className="group-hover:scale-110 transition-transform" />

        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[19px] h-[19px] px-1 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200/90 overflow-hidden z-[100] text-gray-900"
          >
            {/* Popover Header */}
            <div className="p-4 border-b border-gray-100 bg-gray-50/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="font-extrabold text-sm text-gray-900 flex items-center gap-1.5">
                  <Bell size={16} className="text-primary" />
                  <span>Notifications</span>
                </h4>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                    {unreadCount} nouvelle{unreadCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    title="Tout marquer comme lu"
                    className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors text-xs font-medium flex items-center gap-1"
                  >
                    <CheckCheck size={16} />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Filter Sub-bar */}
            <div className="px-4 py-2 bg-white border-b border-gray-100 flex items-center gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                  filter === "all"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Toutes ({notifications.length})
              </button>
              <button
                onClick={() => setFilter("unread")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                  filter === "unread"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                Non lues ({unreadCount})
              </button>
            </div>

            {/* Notifications List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-gray-50">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3 text-gray-300">
                    <Bell size={24} />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Aucune notification</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-[220px] mx-auto">
                    {filter === "unread"
                      ? "Toutes vos notifications sont à jour !"
                      : "Vous recevrez ici les confirmations de commandes, réservations et livraisons."}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif)}
                    className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      !notif.read
                        ? "bg-amber-50/40 hover:bg-amber-50/80"
                        : "bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-gray-100 shrink-0 mt-0.5 shadow-xs">
                      {getIcon(notif.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p
                          className={`text-xs truncate ${
                            !notif.read ? "font-bold text-gray-900" : "font-medium text-gray-700"
                          }`}
                        >
                          {notif.title}
                        </p>
                        <span className="text-[10px] text-gray-400 shrink-0">
                          {formatRelativeTime(notif.time)}
                        </span>
                      </div>

                      <p className="text-xs text-gray-500 leading-snug line-clamp-2">
                        {notif.message}
                      </p>

                      {notif.link && notif.link !== "#" && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:underline">
                          <span>Voir les détails</span>
                          <ExternalLink size={10} />
                        </div>
                      )}
                    </div>

                    {!notif.read && (
                      <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-2" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Popover Footer */}
            {notifications.length > 0 && (
              <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                <span>Centre Rayons en direct</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="font-bold text-indigo-600 hover:underline"
                  >
                    Tout marquer comme lu
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
