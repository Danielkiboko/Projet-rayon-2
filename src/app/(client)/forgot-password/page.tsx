"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Veuillez entrer votre adresse email.");
      return;
    }
    
    setIsLoading(true);
    setError("");
    
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 404) {
          setError("Aucun compte ne correspond à cette adresse email.");
          return;
        }
        throw new Error(data.error || "Erreur lors de l'envoi de l'email.");
      }

      setSuccess(true);
    } catch (apiErr: any) {
      // Fallback to client-side Firebase Auth reset if needed
      try {
        await sendPasswordResetEmail(auth, email);
        setSuccess(true);
      } catch (err: any) {
        console.error("Erreur de réinitialisation :", err.message);
        if (err.code === "auth/user-not-found") {
          setError("Aucun compte ne correspond à cette adresse email.");
        } else if (err.code === "auth/invalid-email") {
          setError("Adresse email invalide.");
        } else {
          setError(apiErr.message || "Une erreur est survenue. Veuillez réessayer plus tard.");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      
      {/* Left Column: Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-16 lg:px-24">
        <Link href="/login" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 mb-12 transition-colors">
          <ArrowLeft size={16} className="mr-2" /> Retour à la connexion
        </Link>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md w-full"
        >
          <div className="space-y-2 mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">Mot de passe oublié ?</h1>
            <p className="text-gray-500">Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {success ? (
            <div className="mb-6 p-6 bg-green-50 border border-green-100 text-green-800 rounded-xl text-center flex flex-col items-center">
              <CheckCircle2 size={48} className="text-green-500 mb-4" />
              <h3 className="font-bold text-lg mb-2">Email envoyé !</h3>
              <p className="text-sm">
                Vérifiez votre boîte de réception (et vos spams). Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.
              </p>
              <Link href="/login" className="mt-6 font-bold text-green-700 hover:text-green-900 transition-colors underline">
                Retourner à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-5">
              <div className="space-y-1">
                <label className="text-sm font-bold text-gray-700">Adresse Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-gray-900 transition-all shadow-sm"
                  placeholder="votre@email.com"
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl transition-colors shadow-sm flex justify-center items-center mt-2"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  "Envoyer le lien"
                )}
              </motion.button>
            </form>
          )}
        </motion.div>
      </div>

      {/* Right Column: Hero Image */}
      <div className="hidden lg:block lg:w-1/2 relative bg-gray-100 overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1618060932014-4deda4932554?auto=format&fit=crop&q=80&w=2000" 
          alt="Reset Password Hero" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent pointer-events-none" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <h2 className="text-3xl font-bold mb-2">Sécurité avant tout.</h2>
          <p className="text-gray-200 text-lg">Retrouvez l'accès à votre compte Rayon en toute simplicité.</p>
        </div>
      </div>
    </div>
  );
}
