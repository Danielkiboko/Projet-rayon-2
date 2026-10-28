"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, Suspense } from "react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";

function GoogleIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const reason = searchParams.get("reason");
  const { user, userData, loading } = useAuth();

  useEffect(() => {
    if (reason === "inactivity") {
      setError("Vous avez été déconnecté automatiquement pour inactivité. Veuillez vous reconnecter pour continuer.");
    }
  }, [reason]);

  useEffect(() => {
    if (!loading && user) {
      if (!userData) return;
      
      const explicitRedirect = searchParams.get("redirect");
      if (explicitRedirect) {
        router.replace(explicitRedirect);
        return;
      }
      
      const role = (userData.role || "").toUpperCase();
      if (role === "SUPER_ADMIN" || role === "ADMIN" || role === "SUB_ADMIN" || role.startsWith("ADMIN_")) {
        router.replace("/admin/dashboard");
      } else if (role === "SUPPLIER" || role === "FOURNISSEUR" || role.startsWith("SUPPLIER_") || role === "SUB_SUPPLIER") {
        router.replace("/supplier");
      } else if (role === "DRIVER" || role === "LIVREUR") {
        router.replace("/driver");
      } else {
        router.replace("/dashboard");
      }
    }
  }, [user, userData, loading, router, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace(redirectUrl);
    } catch (err: any) {
      console.log("Erreur de connexion :", err.message);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Adresse email ou mot de passe incorrect.");
      } else {
        setError(err.message || "Erreur lors de la connexion.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

      // Vérification et création du profil client dans Firestore si premier accès
      const userDocRef = doc(db, "users", googleUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      if (!userDocSnap.exists()) {
        await setDoc(userDocRef, {
          id: googleUser.uid,
          email: googleUser.email,
          displayName: googleUser.displayName || googleUser.email?.split("@")[0] || "Client",
          photoURL: googleUser.photoURL || null,
          role: "client",
          authProvider: "google",
          createdAt: serverTimestamp(),
          lastConnection: serverTimestamp(),
          isOnline: true,
        });
      } else {
        await updateDoc(userDocRef, {
          lastConnection: serverTimestamp(),
          isOnline: true,
        }).catch(() => {});
      }

      router.replace(redirectUrl);
    } catch (err: any) {
      console.log("Erreur Google Auth :", err.code, err.message);
      if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") {
        // Fenêtre fermée par l'utilisateur, pas d'erreur affichée
        return;
      } else if (err.code === "auth/popup-blocked") {
        setError("La fenêtre de connexion a été bloquée par votre navigateur. Veuillez autoriser les fenêtres pop-up.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("Le domaine rayons.net doit être ajouté dans Firebase Console (Authentication > Paramètres > Domaines autorisés).");
      } else if (err.code === "auth/account-exists-with-different-credential") {
        setError("Un compte existe déjà avec cette adresse email via une autre méthode de connexion.");
      } else {
        setError(err.message || "Erreur lors de la connexion avec Google.");
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0F1D27]">
      
      {/* Left Column: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24 py-12">
        <Link href="/" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-[#0F1D27] mb-8 transition-colors">
          <ArrowLeft size={16} className="mr-2" /> Retour à l'accueil
        </Link>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full"
        >
          <div className="mb-6">
            <RayonsLogo size="lg" href="/" />
          </div>

          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-heading font-extrabold tracking-tight text-[#0F1D27]">Bon retour</h1>
            <p className="text-gray-500 text-sm">Connectez-vous pour accéder à votre console Rayons.net.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}

          {/* Bouton Connexion Google / Gmail */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading || isGoogleLoading}
            className="w-full py-3.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-heading font-bold text-sm border border-gray-200 rounded-xl transition-all shadow-xs flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {isGoogleLoading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
            ) : (
              <>
                <GoogleIcon />
                <span>Continuer avec Google (Gmail)</span>
              </>
            )}
          </button>

          {/* Séparateur */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#F8FAFC] px-3 text-gray-400 font-semibold tracking-wider">
                ou avec votre email
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-gray-700">Adresse Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] focus:border-transparent text-[#0F1D27] transition-all shadow-xs"
                placeholder="votre@email.com"
              />
            </div>
            
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-heading font-bold uppercase tracking-wider text-gray-700">Mot de passe</label>
                <Link href="/forgot-password" className="text-xs font-semibold text-gray-500 hover:text-[#0F1D27] transition-colors">
                  Mot de passe oublié ?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] focus:border-transparent text-[#0F1D27] transition-all shadow-xs"
                placeholder="••••••••"
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              type="submit"
              disabled={isLoading || isGoogleLoading}
              className="w-full py-3.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-heading font-bold rounded-xl transition-all shadow-md shadow-[#C7D300]/20 flex justify-center items-center mt-3 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-[#0F1D27]/30 border-t-[#0F1D27] rounded-full animate-spin" />
              ) : (
                "Se connecter"
              )}
            </motion.button>
          </form>

          <div className="text-center text-sm text-gray-500 mt-8">
            Pas encore de compte ?{" "}
            <Link href={redirectUrl !== "/dashboard" ? `/register?redirect=${redirectUrl}` : "/register"} className="font-heading font-bold text-[#0F1D27] hover:underline transition-colors">
              Créer un compte
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Right Column: Hero Image with Brand Colors */}
      <div className="hidden lg:block lg:w-1/2 relative bg-[#0F1D27] overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?auto=format&fit=crop&q=80&w=2000" 
          alt="Rayons Login Hero" 
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1D27] via-[#0F1D27]/60 to-transparent pointer-events-none" />
        <div className="absolute bottom-16 left-12 right-12 text-white">
          <div className="inline-block text-xs font-heading font-bold text-[#C7D300] bg-[#C7D300]/15 border border-[#C7D300]/30 px-3 py-1 rounded-full uppercase tracking-wider mb-4">
            Rayons.net
          </div>
          <h2 className="text-3xl font-heading font-extrabold mb-3 leading-tight">
            Tout ce dont vous avez besoin, <span className="text-[#C7D300]">en un seul endroit.</span>
          </h2>
          <p className="text-gray-300 text-base leading-relaxed max-w-lg">
            Rejoignez des centaines de clients et partenaires sur la marketplace unifiée Rayons.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="w-8 h-8 border-4 border-[#C7D300] border-t-transparent rounded-full animate-spin"></div></div>}>
      <LoginContent />
    </Suspense>
  );
}
