"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";

import { Suspense } from "react";
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

function RegisterContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // 1. Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Update display name
      await updateProfile(user, {
        displayName: name
      });

      // 3. Create user profile in Firestore
      await setDoc(doc(db, "users", user.uid), {
        id: user.uid,
        email: user.email,
        displayName: name,
        role: "client",
        authProvider: "email",
        createdAt: serverTimestamp(),
        lastConnection: serverTimestamp(),
        isOnline: true,
      });

      // 4. Redirect
      router.replace(redirectUrl);
    } catch (err: any) {
      console.log("Erreur d'inscription :", err.code, err.message);
      if (err.code === "auth/email-already-in-use") {
        setError("Cette adresse email est déjà utilisée.");
      } else if (err.code === "auth/weak-password") {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
      } else {
        setError("Une erreur s'est produite lors de la création du compte.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setIsGoogleLoading(true);
    setError("");

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;

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
        return;
      } else if (err.code === "auth/popup-blocked") {
        setError("La fenêtre d'inscription a été bloquée par votre navigateur. Veuillez autoriser les fenêtres pop-up.");
      } else {
        setError(err.message || "Erreur lors de l'inscription avec Google.");
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
            <h1 className="text-3xl font-heading font-extrabold tracking-tight text-[#0F1D27]">Créer un compte</h1>
            <p className="text-gray-500 text-sm">Rejoignez la marketplace unifiée Rayons.net.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}

          {/* Bouton Inscription Google / Gmail */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={isLoading || isGoogleLoading}
            className="w-full py-3.5 px-4 bg-white hover:bg-gray-50 text-gray-700 font-heading font-bold text-sm border border-gray-200 rounded-xl transition-all shadow-xs flex items-center justify-center gap-3 active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            {isGoogleLoading ? (
              <div className="w-5 h-5 border-2 border-gray-400 border-t-gray-800 rounded-full animate-spin" />
            ) : (
              <>
                <GoogleIcon />
                <span>S'inscrire avec Google (Gmail)</span>
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

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-gray-700">Nom complet</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] focus:border-transparent text-[#0F1D27] transition-all shadow-xs"
                placeholder="Ex: Jean Dupont"
              />
            </div>

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
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-gray-700">Mot de passe</label>
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
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-heading font-bold rounded-xl transition-all shadow-md shadow-[#C7D300]/20 flex justify-center items-center mt-4 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-[#0F1D27]/30 border-t-[#0F1D27] rounded-full animate-spin" />
              ) : (
                "S'inscrire"
              )}
            </motion.button>
          </form>

          <div className="text-center text-sm text-gray-500 mt-8">
            Vous avez déjà un compte ?{" "}
            <Link href={redirectUrl !== "/" ? `/login?redirect=${redirectUrl}` : "/login"} className="font-heading font-bold text-[#0F1D27] hover:underline transition-colors">
              Se connecter
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Right Column: Hero Image with Brand Colors */}
      <div className="hidden lg:block lg:w-1/2 relative bg-[#0F1D27] overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=2000" 
          alt="Rayons Register Hero" 
          className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-luminosity"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F1D27] via-[#0F1D27]/60 to-transparent pointer-events-none" />
        <div className="absolute bottom-16 left-12 right-12 text-white">
          <div className="inline-block text-xs font-heading font-bold text-[#C7D300] bg-[#C7D300]/15 border border-[#C7D300]/30 px-3 py-1 rounded-full uppercase tracking-wider mb-4">
            Rayons.net
          </div>
          <h2 className="text-3xl font-heading font-extrabold mb-3 leading-tight">
            Une identité unifiée, <span className="text-[#C7D300]">trois expertises.</span>
          </h2>
          <p className="text-gray-300 text-base leading-relaxed max-w-lg">
            Connectez vos activités au réseau national et profitez d'outils professionnels pour votre commerce ou gestion immobilière.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]"><div className="w-8 h-8 border-4 border-[#C7D300] border-t-transparent rounded-full animate-spin"></div></div>}>
      <RegisterContent />
    </Suspense>
  );
}
