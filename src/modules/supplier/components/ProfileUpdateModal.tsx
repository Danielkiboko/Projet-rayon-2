"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Phone, X, ArrowRight } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";

interface ProfileUpdateModalProps {
  user: any;
  userData: any;
  onSuccess: () => void;
}

export default function ProfileUpdateModal({ user, userData, onSuccess }: ProfileUpdateModalProps) {
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storageKey = user?.uid ? `profile_update_dismissed_${user.uid}` : "profile_update_dismissed";
      const dismissed = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
      if (dismissed === "true") {
        setIsDismissed(true);
      }
    }
  }, [user?.uid]);

  const needsPhone = !(userData?.phone || userData?.phoneNumber || userData?.pendingProfile?.phone);

  // Si tout est à jour ou si l'utilisateur a reporté, on ne bloque pas
  if (!needsPhone || isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      const storageKey = user?.uid ? `profile_update_dismissed_${user.uid}` : "profile_update_dismissed";
      localStorage.setItem(storageKey, "true");
      sessionStorage.setItem(storageKey, "true");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Le numéro de téléphone est requis.");
      return;
    }
    
    setIsSubmitting(true);
    setError("");

    try {
      const userRef = doc(db, "users", user.uid);
      const cleanPhone = phone.trim();
      await setDoc(userRef, { 
        phone: cleanPhone,
        phoneNumber: cleanPhone 
      }, { merge: true });
      
      setIsDismissed(true);
      if (typeof window !== "undefined") {
        const storageKey = user?.uid ? `profile_update_dismissed_${user.uid}` : "profile_update_dismissed";
        localStorage.setItem(storageKey, "true");
        sessionStorage.setItem(storageKey, "true");
      }
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Une erreur est survenue lors de la mise à jour.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-[#140b2e] border border-primary/30 rounded-2xl shadow-2xl overflow-hidden relative"
      >
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors z-10"
          title="Fermer et compléter plus tard"
        >
          <X size={18} />
        </button>

        <div className="p-6 text-center border-b border-white/10 bg-black/20">
          <div className="w-16 h-16 bg-primary/20 text-primary-light rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Mise à jour du profil</h2>
          <p className="text-sm text-gray-300">
            Afin de recevoir les notifications d'activités et alertes en temps réel, veuillez renseigner votre numéro de contact.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          {needsPhone && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Phone size={14} /> Numéro de téléphone (SMS / WhatsApp)
              </label>
              <input
                type="tel"
                required
                placeholder="+243 81 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-3 bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-white transition-all"
              />
              <p className="text-xs text-gray-500 mt-1">
                Ce numéro vous permettra de recevoir des notifications urgentes par SMS.
              </p>
            </div>
          )}

          <div className="space-y-2 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-3 bg-primary hover:bg-primary-light text-white font-semibold rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 shadow-md"
            >
              {isSubmitting ? "Enregistrement en cours..." : "Enregistrer et continuer"}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="w-full px-4 py-2.5 text-xs text-gray-400 hover:text-white transition-colors flex items-center justify-center gap-1"
            >
              <span>Accéder directement à mon tableau de bord</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

