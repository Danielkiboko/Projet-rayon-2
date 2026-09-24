"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEffect, Suspense } from "react";
import { RayonsLogo } from "@/modules/shared/components/brand/RayonsLogo";

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
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
      // If user data is still loading, wait
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
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      router.replace(redirectUrl);
    } catch (err: any) {
      console.log("Erreur de connexion :", err.message);
      setError(err.message);
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
            <h1 className="text-3xl font-heading font-extrabold tracking-tight text-[#0F1D27]">Bon retour</h1>
            <p className="text-gray-500 text-sm">Connectez-vous pour accéder à votre console Rayons.net.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
              {error}
            </div>
          )}

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
              disabled={isLoading}
              className="w-full py-3.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-heading font-bold rounded-xl transition-all shadow-md shadow-[#C7D300]/20 flex justify-center items-center mt-3 cursor-pointer"
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
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
      <LoginContent />
    </Suspense>
  );
}
