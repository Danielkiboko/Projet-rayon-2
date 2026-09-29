"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Navigation } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function DriverLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Verify role
      const token = await userCredential.user.getIdTokenResult();
      if (token.claims.role !== "driver") {
        // Fallback to checking firestore if claim is missing
        const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
        if (!userDoc.exists() || userDoc.data().role !== "driver") {
          throw new Error("Accès refusé. Ce compte n'est pas un compte livreur.");
        }
      }
      
      router.push("/driver");
    } catch (err: any) {
      console.error("Erreur de connexion:", err);
      if (err.message.includes("Accès refusé")) {
        setError(err.message);
        auth.signOut();
      } else {
        setError("Email ou mot de passe incorrect.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-b from-[#0F1D27] to-[#0B151C]">
      <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-8 shadow-lg shadow-primary/20">
        <Navigation size={32} className="text-white" />
      </div>
      
      <h1 className="text-3xl font-bold text-white mb-2 text-center">Rayons Driver</h1>
      <p className="text-gray-400 text-center mb-10">Portail sécurisé des livreurs</p>

      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Mail className="text-gray-500" size={20} />
            </div>
            <input 
              type="email" 
              placeholder="Adresse Email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-primary text-white text-lg placeholder-gray-500" 
            />
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Lock className="text-gray-500" size={20} />
            </div>
            <input 
              type="password" 
              placeholder="Mot de passe" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-black/40 border border-white/10 rounded-2xl focus:outline-none focus:border-primary text-white text-lg placeholder-gray-500" 
            />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={isLoading || !email || !password}
          className="w-full py-4 bg-primary hover:bg-primary-light text-white font-bold rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-primary/20"
        >
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            "Se connecter"
          )}
        </button>
      </form>

      <p className="mt-12 text-xs text-gray-500 text-center">
        Accès restreint au personnel autorisé Rayons.NET.
      </p>
    </div>
  );
}
