"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut, getIdTokenResult } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, ShieldAlert, Clock } from "lucide-react";

interface AuthContextType {
  user: User | null;
  userData: any | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userData: null,
  loading: true,
  signOut: async () => {},
});

// ── Délais d'inactivité par rôle (en ms) ──────────────────────────────────────
// Admin / Sub-admin   : 15 min
// Fournisseur         : 30 min
// Livreur             : 2 heures
// Client              : illimité (e-commerce standard)
// ─────────────────────────────────────────────────────────────────────────────
const WARN_BEFORE_MS = 60 * 1000; // avertissement 1 min avant

function getTimeoutMs(role: string | undefined): number | null {
  if (!role) return null;
  const r = role.toLowerCase();
  if (r === "super_admin" || r === "admin" || r === "sub_admin") return 15 * 60 * 1000;
  if (r === "supplier" || r === "sub_supplier") return 30 * 60 * 1000;
  if (r === "driver") return 2 * 60 * 60 * 1000;
  return null; // client → pas de timeout
}

// ── Composant Modal d'avertissement ──────────────────────────────────────────
function SessionWarningModal({
  countdown,
  onStay,
  onLeave,
}: {
  countdown: number;
  onStay: () => void;
  onLeave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-sm bg-[#140b2e] border border-orange-500/40 rounded-2xl shadow-2xl p-6 text-center"
      >
        {/* Icône */}
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
          <ShieldAlert size={32} className="text-orange-400" />
        </div>

        {/* Texte */}
        <h2 className="text-xl font-bold text-white mb-2">Session sur le point d'expirer</h2>
        <p className="text-sm text-gray-400 mb-5">
          Vous allez être déconnecté automatiquement pour inactivité dans :
        </p>

        {/* Compte à rebours */}
        <div className="mb-6">
          <div className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-orange-500/10 border border-orange-500/30">
            <Clock size={20} className="text-orange-400" />
            <span className="text-4xl font-black text-orange-400 tabular-nums">
              {String(countdown).padStart(2, "0")}s
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onLeave}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-sm font-medium transition-all border border-white/10"
          >
            <LogOut size={15} />
            Déconnexion
          </button>
          <button
            onClick={onStay}
            className="flex-1 py-2.5 bg-primary hover:bg-primary-light text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-primary/20"
          >
            Rester connecté
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const router = useRouter();

  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);
  const warningTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  // ── Déconnexion effective ──
  const performSignOut = useCallback(async (reason: "inactivity" | "manual" = "manual") => {
    setShowWarning(false);
    if (user) {
      import("firebase/firestore").then(({ setDoc, doc, serverTimestamp }) => {
        setDoc(doc(db, "users", user.uid), {
          isOnline: false,
          lastConnection: serverTimestamp(),
        }, { merge: true }).catch(console.error);
      });
    }
    await firebaseSignOut(auth);
    router.push(reason === "inactivity" ? "/login?reason=inactivity" : "/login");
  }, [user, router]);

  // ── Effacer tous les timers ──
  const clearAllTimers = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    inactivityTimer.current = null;
    warningTimer.current = null;
    countdownInterval.current = null;
  }, []);

  // ── Démarrer le compte à rebours (modal) ──
  const startCountdown = useCallback(() => {
    setCountdown(60);
    setShowWarning(true);
    let secs = 60;
    countdownInterval.current = setInterval(() => {
      secs -= 1;
      setCountdown(secs);
      if (secs <= 0) {
        clearInterval(countdownInterval.current!);
        countdownInterval.current = null;
        performSignOut("inactivity");
      }
    }, 1000);
  }, [performSignOut]);

  // ── Rester connecté (reset tout) ──
  const handleStay = useCallback(() => {
    clearAllTimers();
    setShowWarning(false);
    setCountdown(60);
    // resetTimer sera rappelé via les event listeners
    window.dispatchEvent(new Event("mousemove"));
  }, [clearAllTimers]);

  // ── Setup du timer d'inactivité ──
  useEffect(() => {
    const timeoutMs = getTimeoutMs(userData?.role);
    if (!user || !timeoutMs) {
      clearAllTimers();
      return;
    }

    const warnAt = timeoutMs - WARN_BEFORE_MS;

    const resetTimer = () => {
      if (showWarning) return; // ne pas reset si le modal est visible
      clearAllTimers();

      // Timer 1 : afficher l'avertissement
      warningTimer.current = setTimeout(() => {
        startCountdown();
      }, Math.max(warnAt, 10000)); // minimum 10s pour éviter les bugs

      // Timer 2 : déconnexion forcée (backup si modal ignoré)
      inactivityTimer.current = setTimeout(() => {
        performSignOut("inactivity");
      }, timeoutMs + 5000);
    };

    const events = ["mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer(); // initialiser au montage

    return () => {
      clearAllTimers();
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, userData?.role, showWarning, clearAllTimers, startCountdown, performSignOut]);

  // ── Auth state listener ──
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        import("firebase/firestore").then(async ({ doc, getDoc }) => {
          try {
            const docSnap = await getDoc(doc(db, "users", currentUser.uid));
            if (docSnap.exists()) {
              const data = docSnap.data();
              let role = data.role;
              if (currentUser.email === "danielkiboko218@gmail.com") {
                role = role || "SUPER_ADMIN";
                currentUser.getIdToken(true).catch(() => {});
              }
              if (!role) {
                const tokenResult = await getIdTokenResult(currentUser, true);
                role = tokenResult.claims.role as string | undefined;
              }
              setUserData({ ...data, role });
            } else {
              let role: string | undefined = undefined;
              if (currentUser.email === "danielkiboko218@gmail.com") {
                role = "SUPER_ADMIN";
                currentUser.getIdToken(true).catch(() => {});
              } else {
                const tokenResult = await getIdTokenResult(currentUser, true);
                role = tokenResult.claims.role as string | undefined;
              }
              setUserData(role ? { role } : null);
            }
          } catch (error) {
            console.error("Error fetching user data:", error);
            try {
              const tokenResult = await getIdTokenResult(currentUser);
              let role = tokenResult.claims.role as string | undefined;
              if (!role && currentUser.email === "danielkiboko218@gmail.com") role = "SUPER_ADMIN";
              setUserData({
                role: role || (currentUser.email === "danielkiboko218@gmail.com" ? "SUPER_ADMIN" : "CLIENT"),
                email: currentUser.email,
                displayName: currentUser.displayName || "Utilisateur",
              });
            } catch {
              if (currentUser.email === "danielkiboko218@gmail.com") {
                setUserData({ role: "SUPER_ADMIN", email: currentUser.email, displayName: "Daniel Kiboko" });
              } else {
                setUserData({ role: "CLIENT", email: currentUser.email, displayName: currentUser.displayName || "Client" });
              }
            }
          } finally {
            setLoading(false);
          }
        });
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const signOut = useCallback(() => performSignOut("manual"), [performSignOut]);

  return (
    <AuthContext.Provider value={{ user, userData, loading, signOut }}>
      {children}

      {/* Modal d'avertissement de session */}
      <AnimatePresence>
        {showWarning && (
          <SessionWarningModal
            countdown={countdown}
            onStay={handleStay}
            onLeave={() => performSignOut("inactivity")}
          />
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
