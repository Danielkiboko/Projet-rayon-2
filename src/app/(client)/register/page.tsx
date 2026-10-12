"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";

import { Suspense } from "react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";

function RegisterContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
        createdAt: serverTimestamp()
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
