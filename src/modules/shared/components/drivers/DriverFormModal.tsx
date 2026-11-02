"use client";

import React, { useState } from "react";
import { Truck, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase";
import ResponsiveModal from "@/modules/shared/components/ui/ResponsiveModal";

interface DriverFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDriverCreated: () => void;
  targetSupplierId?: string | null;
  title?: string;
}

export default function DriverFormModal({
  isOpen,
  onClose,
  onDriverCreated,
  targetSupplierId = null,
  title,
}: DriverFormModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notificationMethod, setNotificationMethod] = useState<"email" | "sms">("email");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setName("");
    setEmail("");
    setNotificationMethod("email");
    setPhoneNumber("");
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error("Authentification requise pour cette action.");
      }

      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          displayName: name.trim(),
          role: "driver",
          targetSupplierId: targetSupplierId || null,
          notificationMethod,
          phoneNumber: notificationMethod === "sms" ? phoneNumber.trim() : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la création du compte livreur");
      }

      resetForm();
      onDriverCreated();
      onClose();
    } catch (err: any) {
      console.error("Driver creation error:", err);
      setError(err.message || "Une erreur est survenue lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isIndep = !targetSupplierId;
  const modalTitle = title || (isIndep ? "Créer un Livreur Indépendant" : "Ajouter un livreur");
  const modalSubtitle = isIndep
    ? "Ce livreur pourra recevoir des courses de tous les fournisseurs"
    : "Ce livreur sera rattaché exclusivement à vos livraisons";

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      subtitle={modalSubtitle}
      icon={<Truck size={20} />}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl text-red-400 text-xs sm:text-sm">
            {error}
          </div>
        )}

        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-300 text-xs leading-relaxed">
          Choisissez comment notifier le livreur. L'application mobile et ses identifiants lui seront envoyés instantanément.
        </div>

        {/* Méthode de notification */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-gray-300">
            Méthode de notification
          </label>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-xs sm:text-sm text-white cursor-pointer select-none">
              <input
                type="radio"
                name="notificationMethod"
                value="email"
                checked={notificationMethod === "email"}
                onChange={() => setNotificationMethod("email")}
                className="text-[#C7D300] focus:ring-[#C7D300] bg-black/20 border-white/10"
              />
              <span>E-mail</span>
            </label>
            <label className="flex items-center gap-2 text-xs sm:text-sm text-white cursor-pointer select-none">
              <input
                type="radio"
                name="notificationMethod"
                value="sms"
                checked={notificationMethod === "sms"}
                onChange={() => setNotificationMethod("sms")}
                className="text-[#C7D300] focus:ring-[#C7D300] bg-black/20 border-white/10"
              />
              <span>SMS</span>
            </label>
          </div>
        </div>

        {/* Champ Téléphone (si SMS) */}
        {notificationMethod === "sms" && (
          <div className="space-y-1">
            <label className="text-xs sm:text-sm font-medium text-gray-300">
              Numéro de téléphone (avec indicatif)
            </label>
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+243..."
              className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm"
            />
          </div>
        )}

        {/* Nom */}
        <div className="space-y-1">
          <label className="text-xs sm:text-sm font-medium text-gray-300">
            Nom et prénom du livreur
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Jean Dupont"
            className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm"
          />
        </div>

        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs sm:text-sm font-medium text-gray-300">
            Adresse E-mail (identifiant de connexion)
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jean.dupont@email.com"
            className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm"
          />
        </div>

        {/* Actions */}
        <div className="pt-4 flex items-center justify-end gap-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs sm:text-sm font-medium text-gray-400 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold rounded-xl text-xs sm:text-sm shadow-md shadow-[#C7D300]/20 transition-all flex items-center gap-2 disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            <span>{isSubmitting ? "Création en cours..." : "Créer le compte"}</span>
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
