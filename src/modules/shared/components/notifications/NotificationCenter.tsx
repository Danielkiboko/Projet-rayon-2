"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell, Megaphone, ShieldAlert, Archive, ArchiveRestore, Trash2, CheckCheck, Inbox,
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";

export type CenterNotification = {
  id: string;
  title: string;
  message: string;
  time?: number;
  type?: string;
  link?: string;
  read?: boolean;
  seen?: boolean;
  archived?: boolean;
  sentByAdmin?: boolean;
  sentBy?: string;
  /** true = document Firestore (inapp_notifications) → peut être archivé / supprimé */
  persisted?: boolean;
};

interface Props {
  notifications: CenterNotification[];
  accentText?: string;
  onOpenAnnouncement: (n: CenterNotification) => void;
}

const LOCAL_SEEN_KEY = "rayons_seen_virtual_notifs";

export const isAnnouncementNotif = (n: CenterNotification) =>
  n.type === "broadcast" || !!n.sentByAdmin;

export default function NotificationCenter({ notifications, accentText = "text-[#C7D300]", onOpenAnnouncement }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"inbox" | "archived">("inbox");
  // Notifications "virtuelles" (alertes admin calculées, non stockées) : vu = localStorage
  const [localSeen, setLocalSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_SEEN_KEY);
      if (raw) setLocalSeen(new Set(JSON.parse(raw)));
    } catch {}
  }, []);

  const isSeen = (n: CenterNotification) =>
    n.read || (n.persisted ? !!n.seen : localSeen.has(n.id));

  const inbox = useMemo(() => notifications.filter(n => !n.archived), [notifications]);
  const archived = useMemo(() => notifications.filter(n => n.archived), [notifications]);
  const unreadCount = inbox.filter(n => !n.read).length;
  const unseenCount = inbox.filter(n => !isSeen(n)).length;

  // ── Actions Firestore ──────────────────────────────────────────────────────
  const markAllSeen = async () => {
    const unseen = inbox.filter(n => !isSeen(n));
    if (unseen.length === 0) return;

    const virtualIds = unseen.filter(n => !n.persisted).map(n => n.id);
    if (virtualIds.length) {
      const next = new Set(localSeen);
      virtualIds.forEach(id => next.add(id));
      setLocalSeen(next);
      try { localStorage.setItem(LOCAL_SEEN_KEY, JSON.stringify([...next].slice(-300))); } catch {}
    }

    const persisted = unseen.filter(n => n.persisted);
    if (persisted.length) {
      try {
        const batch = writeBatch(db);
        persisted.forEach(n => batch.update(doc(db, "inapp_notifications", n.id), { seen: true }));
        await batch.commit();
      } catch (err) {
        console.warn("markAllSeen failed:", err);
      }
    }
  };

  const markRead = async (n: CenterNotification) => {
    if (n.read || !n.persisted) return;
    try {
      await updateDoc(doc(db, "inapp_notifications", n.id), { read: true, seen: true });
    } catch (err) {
      console.warn("markRead failed:", err);
    }
  };

  const markAllRead = async () => {
    const targets = inbox.filter(n => n.persisted && !n.read);
    if (!targets.length) return;
    try {
      const batch = writeBatch(db);
      targets.forEach(n => batch.update(doc(db, "inapp_notifications", n.id), { read: true, seen: true }));
      await batch.commit();
    } catch (err) {
      console.warn("markAllRead failed:", err);
    }
  };

  const toggleArchive = async (n: CenterNotification) => {
    if (!n.persisted) return;
    try {
      await updateDoc(doc(db, "inapp_notifications", n.id), {
        archived: !n.archived,
        read: true,
        seen: true,
      });
    } catch (err) {
      console.warn("toggleArchive failed:", err);
    }
  };

  const remove = async (n: CenterNotification) => {
    if (!n.persisted) return;
    if (!confirm("Supprimer définitivement cette notification ?")) return;
    try {
      await deleteDoc(doc(db, "inapp_notifications", n.id));
    } catch (err) {
      console.warn("delete failed:", err);
      alert("Impossible de supprimer cette notification.");
    }
  };

  const emptyArchives = async () => {
    const targets = archived.filter(n => n.persisted);
    if (!targets.length) return;
    if (!confirm(`Supprimer définitivement ${targets.length} notification(s) archivée(s) ?`)) return;
    try {
      const batch = writeBatch(db);
      targets.forEach(n => batch.delete(doc(db, "inapp_notifications", n.id)));
      await batch.commit();
    } catch (err) {
      console.warn("emptyArchives failed:", err);
    }
  };

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      setTab("inbox");
      // Dès que la liste est ouverte, tout est considéré "vu" → la cloche cesse de clignoter
      markAllSeen();
    }
  };

  const list = tab === "inbox" ? inbox : archived;

  const formatDate = (t?: number) =>
    new Date(t || Date.now()).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="relative">
      <button
        id="notification-bell"
        onClick={toggleOpen}
        aria-label={`Notifications (${unreadCount} non lues)`}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/5"
      >
        <Bell size={20} className={unseenCount > 0 ? "text-white" : ""} />
        {unseenCount > 0 ? (
          // Nouvelles notifications jamais vues → animation
          <span className="absolute top-1 right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
        ) : unreadCount > 0 ? (
          // Déjà vues mais non lues → simple compteur fixe, sans clignotement
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-white/15 text-[9px] font-bold text-gray-200 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] bg-[#141C23] border border-white/10 rounded-2xl shadow-2xl shadow-black/60 z-50 overflow-hidden">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-white/10 bg-[#18232C]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Notifications</h3>
                {tab === "inbox" && unreadCount > 0 && (
                  <button
                    id="notif-mark-all-read"
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-[11px] text-[#C7D300] hover:underline cursor-pointer"
                  >
                    <CheckCheck size={13} /> Tout marquer comme lu
                  </button>
                )}
                {tab === "archived" && archived.some(n => n.persisted) && (
                  <button
                    id="notif-empty-archives"
                    onClick={emptyArchives}
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:underline cursor-pointer"
                  >
                    <Trash2 size={12} /> Vider les archives
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1 mt-3 bg-black/30 p-1 rounded-xl">
                <button
                  id="notif-tab-inbox"
                  onClick={() => setTab("inbox")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    tab === "inbox" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Inbox size={13} /> Boîte ({inbox.length})
                </button>
                <button
                  id="notif-tab-archived"
                  onClick={() => setTab("archived")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                    tab === "archived" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Archive size={13} /> Archives ({archived.length})
                </button>
              </div>
            </div>

            {/* Liste */}
            <div className="max-h-96 overflow-y-auto">
              {list.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">
                  {tab === "inbox" ? <Bell size={26} className="mx-auto mb-2 opacity-30" /> : <Archive size={26} className="mx-auto mb-2 opacity-30" />}
                  {tab === "inbox" ? "Aucune notification." : "Aucune notification archivée."}
                </div>
              ) : (
                list.map(n => {
                  const announcement = isAnnouncementNotif(n);
                  const content = (
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          announcement ? "bg-[#C7D300]/15 text-[#C7D300]" : `bg-blue-500/15 ${accentText}`
                        }`}
                      >
                        {announcement ? <Megaphone size={16} /> : <ShieldAlert size={16} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className={`text-xs truncate ${n.read ? "font-medium text-gray-300" : "font-bold text-white"}`}>
                            {n.title}
                          </h4>
                          {/* Point statique (aucune animation) pour les non lues */}
                          {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-[#C7D300] shrink-0" />}
                        </div>
                        <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{n.message}</p>
                        <span className="text-[10px] text-gray-500 mt-1 block">{formatDate(n.time)}</span>
                      </div>
                    </div>
                  );

                  return (
                    <div
                      key={n.id}
                      className={`group relative flex items-start gap-2 p-3.5 border-b border-white/5 transition-colors ${
                        n.read ? "hover:bg-white/5" : "bg-[#C7D300]/[0.06] hover:bg-[#C7D300]/10"
                      }`}
                    >
                      {announcement ? (
                        <button
                          type="button"
                          onClick={() => {
                            setIsOpen(false);
                            onOpenAnnouncement(n);
                          }}
                          className="flex-1 min-w-0 text-left cursor-pointer"
                        >
                          {content}
                        </button>
                      ) : (
                        <Link
                          href={n.link || "#"}
                          onClick={() => {
                            markRead(n);
                            setIsOpen(false);
                          }}
                          className="flex-1 min-w-0"
                        >
                          {content}
                        </Link>
                      )}

                      {n.persisted && (
                        <div className="flex flex-col gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            title={n.archived ? "Désarchiver" : "Archiver"}
                            onClick={() => toggleArchive(n)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
                          >
                            {n.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                          </button>
                          <button
                            type="button"
                            title="Supprimer"
                            onClick={() => remove(n)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
