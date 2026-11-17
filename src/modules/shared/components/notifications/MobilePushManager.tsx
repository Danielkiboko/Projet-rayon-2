"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, limit } from "firebase/firestore";
import { Bell, X } from "lucide-react";
import toast from "react-hot-toast";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";

export interface BoundAccountInfo {
  uid: string;
  email: string;
  displayName: string;
  role: string;
  deviceId: string;
  deviceSecret: string;
  boundAt: number;
}

const BOUND_ACCOUNT_STORAGE_KEY = "rayons_bound_account_v1";
const DEVICE_ID_STORAGE_KEY = "rayons_device_id_v1";
const PUSHED_IDS_STORAGE_KEY = "rayons_pushed_notif_ids_v1";
const WATERMARK_STORAGE_KEY = "rayons_push_watermark_v1";

function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "server";
  try {
    const existing = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (existing && existing.length >= 8) return existing;
    const rand = Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
    const id = `dev_${rand}`;
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    return id;
  } catch {
    return `dev_${Date.now().toString(36)}`;
  }
}

export function getBoundPhoneAccount(): BoundAccountInfo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(BOUND_ACCOUNT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.uid && parsed.deviceId && parsed.deviceSecret) {
      return parsed as BoundAccountInfo;
    }
  } catch {}
  return null;
}

function getPushedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(PUSHED_IDS_STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {}
  return new Set();
}

function markIdAsPushed(id: string) {
  if (typeof window === "undefined") return;
  try {
    const current = getPushedIds();
    current.add(id);
    const trimmed = Array.from(current).slice(-250);
    localStorage.setItem(PUSHED_IDS_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {}
}

function getWatermark(): number {
  if (typeof window === "undefined") return Date.now();
  try {
    const raw = localStorage.getItem(WATERMARK_STORAGE_KEY);
    if (raw) {
      const val = Number(raw);
      if (!isNaN(val) && val > 0) return val;
    }
    const now = Date.now();
    localStorage.setItem(WATERMARK_STORAGE_KEY, String(now));
    return now;
  } catch {
    return Date.now();
  }
}

function updateWatermark(ts: number) {
  if (typeof window === "undefined") return;
  try {
    const current = getWatermark();
    if (ts > current) {
      localStorage.setItem(WATERMARK_STORAGE_KEY, String(ts));
    }
  } catch {}
}

/** Petit signal sonore discret (Web Audio API) lors d'une notification entrante */
function playNotificationChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.28);
  } catch {}
}

export default function MobilePushManager() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">("default");
  const [dismissedBanner, setDismissedBanner] = useState(false);
  const [boundAccount, setBoundAccount] = useState<BoundAccountInfo | null>(null);
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  // 1. Enregistrement du Service Worker (/sw.js) au démarrage
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("Notification" in window)) {
      setPermissionState("unsupported");
    } else {
      setPermissionState(Notification.permission);
    }

    const storedBound = getBoundPhoneAccount();
    if (storedBound) {
      setBoundAccount(storedBound);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          swRegRef.current = reg;
          if (storedBound && reg.active) {
            reg.active.postMessage({
              type: "SYNC_BOUND_ACCOUNT",
              account: storedBound,
            });
          }
        })
        .catch((err) => {
          console.warn("[MobilePush] Service Worker registration warning:", err);
        });
    }
  }, []);

  // 2. Fonction d'affichage d'une notification Push Système (Mobile & Desktop) + Toast in-app
  const triggerNativeAndInAppPush = useCallback(
    async (notif: { id: string; title: string; message: string; link?: string; type?: string; time?: number }) => {
      const pushed = getPushedIds();
      if (pushed.has(notif.id)) return;
      markIdAsPushed(notif.id);

      if (notif.time) {
        updateWatermark(notif.time);
      }

      const targetLink = notif.link && notif.link !== "#" ? notif.link : "/dashboard";

      // Son & vibration légère sur mobile
      playNotificationChime();
      if (typeof navigator !== "undefined" && "vibrate" in navigator) {
        try {
          navigator.vibrate([200, 100, 200]);
        } catch {}
      }

      // A. Notification Push Système via Service Worker (fonctionne en arrière-plan sur Android / iOS PWA)
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        try {
          const reg = swRegRef.current || (await navigator.serviceWorker?.ready);
          if (reg && typeof reg.showNotification === "function") {
            await reg.showNotification(notif.title, {
              body: notif.message,
              icon: "/icon-512.png",
              badge: "/icon.png",
              tag: `rayons-${notif.id}`,
              data: { url: targetLink },
            } as NotificationOptions);
          } else {
            const n = new Notification(notif.title, {
              body: notif.message,
              icon: "/icon-512.png",
              tag: `rayons-${notif.id}`,
            });
            n.onclick = () => {
              window.focus();
              router.push(targetLink);
            };
          }
        } catch (swErr) {
          console.warn("[MobilePush] showNotification warning:", swErr);
        }
      }

      // B. Bannière Toast interactive si l'application est ouverte au premier plan
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        toast.custom(
          (t) => (
            <div
              onClick={() => {
                toast.dismiss(t.id);
                router.push(targetLink);
              }}
              className="max-w-sm w-full bg-[#0F1D27] text-white border border-[#C7D300]/40 rounded-2xl shadow-2xl p-3.5 flex items-start gap-3 cursor-pointer hover:border-[#C7D300] transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-[#C7D300]/15 text-[#C7D300] flex items-center justify-center shrink-0 mt-0.5">
                <Bell size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-white truncate">{notif.title}</p>
                <p className="text-[11px] text-gray-300 line-clamp-2 mt-0.5">{notif.message}</p>
              </div>
            </div>
          ),
          { duration: 6000, position: "top-right" }
        );
      }
    },
    [router]
  );

  // 3. Obtention éventuelle du token FCM Web Push et liaison permanente de l'appareil au compte connecté
  const bindDeviceAndRegisterPush = useCallback(
    async (requestInteractivePermission = false) => {
      if (typeof window === "undefined") return;

      let currentPerm: NotificationPermission =
        "Notification" in window ? Notification.permission : "denied";

      if (requestInteractivePermission && "Notification" in window && currentPerm === "default") {
        try {
          currentPerm = await Notification.requestPermission();
          setPermissionState(currentPerm);
        } catch (e) {
          console.warn("[MobilePush] requestPermission error:", e);
        }
      }

      if (!user) return;

      let fcmToken: string | null = null;
      if (currentPerm === "granted") {
        try {
          const { getMessaging, getToken, isSupported } = await import("firebase/messaging");
          const { getApp } = await import("firebase/app");
          if (await isSupported()) {
            const messaging = getMessaging(getApp());
            const reg = swRegRef.current || (await navigator.serviceWorker?.ready);
            const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
            fcmToken = await getToken(messaging, {
              serviceWorkerRegistration: reg,
              ...(vapidKey ? { vapidKey } : {}),
            }).catch(() => null);
          }
        } catch {
          // Fallback silencieux sur le Service Worker direct si VAPID/FCM navigateur non configuré
        }
      }

      try {
        const idToken = await user.getIdToken();
        const deviceId = getOrCreateDeviceId();
        const res = await fetch("/api/push/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            deviceId,
            fcmToken,
            platform: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
            userAgent: navigator.userAgent,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          const boundInfo: BoundAccountInfo = {
            uid: data.boundUid,
            email: data.boundEmail || user.email || "",
            displayName:
              data.boundName ||
              userData?.company ||
              userData?.displayName ||
              user.displayName ||
              user.email ||
              "Mon Compte",
            role: data.boundRole || userData?.role || "CLIENT",
            deviceId: data.deviceId,
            deviceSecret: data.deviceSecret,
            boundAt: Date.now(),
          };
          localStorage.setItem(BOUND_ACCOUNT_STORAGE_KEY, JSON.stringify(boundInfo));
          setBoundAccount(boundInfo);

          if (navigator.serviceWorker?.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: "SYNC_BOUND_ACCOUNT",
              account: boundInfo,
            });
          }
        }
      } catch (err) {
        console.warn("[MobilePush] Device binding warning:", err);
      }
    },
    [user, userData]
  );

  // Dès qu'un utilisateur se connecte sur ce téléphone, lier l'appareil à son compte
  useEffect(() => {
    if (!user) return;
    bindDeviceAndRegisterPush(false);
  }, [user, bindDeviceAndRegisterPush]);

  // 4. Écoute en temps réel quand l'utilisateur est connecté (Notifications + Messages + Ventes)
  useEffect(() => {
    if (!user) return;

    const mountWatermark = getWatermark();

    // A. Écoute des notifications du compte (userId == user.uid)
    const qUserNotifs = query(
      collection(db, "inapp_notifications"),
      where("userId", "==", user.uid),
      limit(15)
    );

    const unsubUserNotifs = onSnapshot(
      qUserNotifs,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            const d = change.doc.data();
            const tMs =
              Number(d.time) ||
              (d.createdAt?.seconds ? d.createdAt.seconds * 1000 : 0);
            if (!d.read && tMs >= mountWatermark - 5000) {
              triggerNativeAndInAppPush({
                id: change.doc.id,
                title: d.title || "Notification Rayons.net",
                message: d.message || "",
                link: d.link || "/dashboard",
                type: d.type || "system",
                time: tMs,
              });
            }
          }
        });
      },
      () => {}
    );

    // B. Écoute des conversations (chats) où l'utilisateur est fournisseur (nouveaux messages clients)
    const qSupplierChats = query(
      collection(db, "chats"),
      where("supplierId", "==", user.uid),
      limit(20)
    );
    const unsubSupplierChats = onSnapshot(
      qSupplierChats,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "modified" || change.type === "added") {
            const c = change.doc.data();
            const updatedMs = c.updatedAt?.seconds ? c.updatedAt.seconds * 1000 : 0;
            if (c.unreadSupplier && updatedMs >= mountWatermark) {
              const notifKey = `chat_sup_${change.doc.id}_${updatedMs}`;
              triggerNativeAndInAppPush({
                id: notifKey,
                title: `💬 Message de ${c.clientName || "Client"}`,
                message: c.lastMessage || "Vous avez reçu un nouveau message.",
                link: `/supplier/messages?chatId=${change.doc.id}`,
                type: "chat",
                time: updatedMs,
              });
            }
          }
        });
      },
      () => {}
    );

    // C. Écoute des conversations (chats) où l'utilisateur est client (réponses fournisseurs / proformas)
    const qClientChats = query(
      collection(db, "chats"),
      where("clientId", "==", user.uid),
      limit(20)
    );
    const unsubClientChats = onSnapshot(
      qClientChats,
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "modified" || change.type === "added") {
            const c = change.doc.data();
            const updatedMs = c.updatedAt?.seconds ? c.updatedAt.seconds * 1000 : 0;
            if (c.unreadClient && updatedMs >= mountWatermark) {
              const notifKey = `chat_cli_${change.doc.id}_${updatedMs}`;
              triggerNativeAndInAppPush({
                id: notifKey,
                title: `💬 Message de ${c.supplierName || "Fournisseur"}`,
                message: c.lastMessage || "Nouvelle réponse dans votre discussion.",
                link: `/dashboard?tab=messages&chatId=${change.doc.id}`,
                type: "chat",
                time: updatedMs,
              });
            }
          }
        });
      },
      () => {}
    );

    return () => {
      unsubUserNotifs();
      unsubSupplierChats();
      unsubClientChats();
    };
  }, [user, triggerNativeAndInAppPush]);

  // 5. Écoute en arrière-plan MÊME SI DÉCONNECTÉ (via le compte lié à ce téléphone)
  useEffect(() => {
    if (user) return; // Déjà couvert par l'écoute temps réel ci-dessus
    const activeBound = boundAccount || getBoundPhoneAccount();
    if (!activeBound || !activeBound.uid || !activeBound.deviceId || !activeBound.deviceSecret) {
      return;
    }

    let isCancelled = false;

    const pollBoundAccountNotifications = async () => {
      if (isCancelled) return;
      try {
        const since = getWatermark();
        const url = `/api/push/register?uid=${encodeURIComponent(activeBound.uid)}&deviceId=${encodeURIComponent(
          activeBound.deviceId
        )}&deviceSecret=${encodeURIComponent(activeBound.deviceSecret)}&since=${since}`;

        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          for (const n of data.notifications) {
            const targetRedirect = n.link || "/dashboard";
            const loginRedirectLink = `/login?redirect=${encodeURIComponent(targetRedirect)}`;
            await triggerNativeAndInAppPush({
              id: n.id,
              title: n.title,
              message: n.message,
              link: loginRedirectLink,
              type: n.type,
              time: n.time,
            });
          }
        }
      } catch {
        // Ignorer les erreurs réseau hors-ligne
      }
    };

    // Vérifier immédiatement puis toutes les 18 secondes + au réveil de l'écran mobile
    pollBoundAccountNotifications();
    const interval = setInterval(pollBoundAccountNotifications, 18000);

    const handleWakeUp = () => {
      if (document.visibilityState === "visible") {
        pollBoundAccountNotifications();
      }
    };

    window.addEventListener("focus", handleWakeUp);
    window.addEventListener("online", pollBoundAccountNotifications);
    document.addEventListener("visibilitychange", handleWakeUp);

    return () => {
      isCancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", handleWakeUp);
      window.removeEventListener("online", pollBoundAccountNotifications);
      document.removeEventListener("visibilitychange", handleWakeUp);
    };
  }, [user, boundAccount, triggerNativeAndInAppPush]);

  // 6. Bannière d'activation Push en 1 clic si la permission n'est pas encore accordée
  const shouldShowEnableBanner =
    (Boolean(user) || Boolean(boundAccount)) &&
    permissionState === "default" &&
    !dismissedBanner;

  if (!shouldShowEnableBanner) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-5 left-3 right-3 sm:left-auto sm:right-5 sm:max-w-sm z-[90] bg-[#0F1D27]/95 backdrop-blur-xl border border-[#C7D300]/40 text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-[#C7D300]/15 text-[#C7D300] flex items-center justify-center shrink-0">
          <Bell size={18} className="animate-bounce" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-extrabold text-white truncate">
            Activer les alertes Push Mobile
          </p>
          <p className="text-[10px] text-gray-300 leading-tight">
            Soyez notifié dès qu&apos;on vous écrit ou lors d&apos;une vente, même déconnecté.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => bindDeviceAndRegisterPush(true)}
          className="px-3 py-1.5 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-heading font-extrabold text-[11px] transition-all cursor-pointer active:scale-95"
        >
          Activer
        </button>
        <button
          type="button"
          onClick={() => setDismissedBanner(true)}
          aria-label="Fermer"
          className="p-1 text-gray-400 hover:text-white rounded-lg cursor-pointer"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}
