"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Edit3, 
  Save, 
  X, 
  Package, 
  FileText, 
  Hotel, 
  Calendar, 
  MessageSquare, 
  LifeBuoy, 
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  Truck,
  Sparkles,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { KINSHASA_COMMUNES } from "@/lib/kinshasaDelivery";
import Link from "next/link";

interface ClientProfileSectionProps {
  ordersCount?: number;
  activeOrdersCount?: number;
  proformasCount?: number;
  hotelsCount?: number;
  visitsCount?: number;
  onSelectTab: (tab: any) => void;
  onLogout?: () => void;
}

export default function ClientProfileSection({
  ordersCount = 0,
  activeOrdersCount = 0,
  proformasCount = 0,
  hotelsCount = 0,
  visitsCount = 0,
  onSelectTab,
  onLogout,
}: ClientProfileSectionProps) {
  const { user, userData, signOut } = useAuth();
  const router = useRouter();

  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(() => {
    const raw = userData?.displayName || userData?.name || user?.displayName || "";
    if (raw && raw.trim().toLowerCase() !== "client") return raw.trim();
    const emailStr = userData?.email || user?.email || "";
    if (emailStr.includes("@")) {
      const local = emailStr.split("@")[0].replace(/[._\-+]/g, " ").replace(/\d+$/g, "").trim();
      return local.split(" ").filter(Boolean).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") || emailStr.split("@")[0];
    }
    return "";
  });
  const [phone, setPhone] = useState(userData?.phone || userData?.phoneNumber || user?.phoneNumber || "");
  const [commune, setCommune] = useState(userData?.commune || "Gombe");
  const [address, setAddress] = useState(userData?.address || "");
  const [deliveryNotes, setDeliveryNotes] = useState(userData?.deliveryNotes || "");

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  const rawProfileName = displayName || userData?.displayName || userData?.name || user?.displayName;
  const clientDisplayName = (rawProfileName && rawProfileName.trim().toLowerCase() !== "client")
    ? rawProfileName.trim()
    : (user?.email || userData?.email)
    ? (() => {
        const emailStr = (user?.email || userData?.email || "");
        const local = emailStr.split("@")[0].replace(/[._\-+]/g, " ").replace(/\d+$/g, "").trim();
        const formatted = local.split(" ").filter(Boolean).map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
        return formatted || emailStr.split("@")[0] || "Acheteur";
      })()
    : "Acheteur";
  const clientEmail = userData?.email || user?.email || "Non renseigné";
  const clientPhone = phone || "Aucun numéro de contact";

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    try {
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        displayName: displayName.trim(),
        name: displayName.trim(),
        phone: phone.trim(),
        phoneNumber: phone.trim(),
        commune: commune,
        address: address.trim(),
        deliveryNotes: deliveryNotes.trim(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      setSaveSuccess(true);
      setIsEditing(false);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error("Erreur sauvegarde profil client:", err);
      setSaveError(err.message || "Erreur lors de la mise à jour de vos coordonnées.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOut = async () => {
    if (onLogout) {
      onLogout();
      return;
    }
    try {
      await signOut();
      router.replace("/login");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header Card Profil Client */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-gray-200/80 shadow-xs relative overflow-hidden">
        {/* Decorative backdrop glow */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-[#FF6600]/10 via-[#FF6600]/5 to-transparent rounded-full blur-2xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-5">
            {/* Avatar */}
            <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-tr from-[#0F1D27] via-[#1c3040] to-[#FF6600] text-white font-black text-2xl sm:text-3xl flex items-center justify-center shadow-lg shadow-[#0F1D27]/20 shrink-0 relative">
              {clientDisplayName.charAt(0).toUpperCase()}
              <div 
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-xs text-white shadow-xs" 
                title="Compte Vérifié & Actif"
              >
                ✓
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
                  {clientDisplayName}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <ShieldCheck size={11} className="text-emerald-600" /> Compte Client Vérifié
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <Mail size={13} className="text-gray-400" />
                  {clientEmail}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone size={13} className="text-gray-400" />
                  {clientPhone}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Protection Acheteur Rayons active sur toutes vos transactions</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-[#FF6600] text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
              >
                <Edit3 size={14} />
                <span>Modifier mes infos</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                <X size={14} />
                <span>Annuler</span>
              </button>
            )}
          </div>
        </div>

        {saveSuccess && (
          <div className="mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>Vos informations de profil et de livraison ont été mises à jour avec succès !</span>
          </div>
        )}
      </div>

      {/* 2. Formulaire de modification du Profil (si activé) */}
      {isEditing && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-7 border border-gray-200 shadow-md"
        >
          <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-100">
            <div>
              <h3 className="text-base font-bold text-gray-900">Mettre à jour mes coordonnées</h3>
              <p className="text-xs text-gray-500">Ces informations facilitent la livraison rapide de vos colis à Kinshasa.</p>
            </div>
          </div>

          {saveError && (
            <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-bold mb-1 text-[11px]">
                  Nom et Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: David Mwamba"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#FF6600]/30 focus:border-[#FF6600] outline-hidden"
                />
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1 text-[11px]">
                  Numéro de Téléphone (WhatsApp / Appel pour les livreurs) *
                </label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex: +243 81 000 0000"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#FF6600]/30 focus:border-[#FF6600] outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 font-bold mb-1 text-[11px]">
                  Commune de résidence à Kinshasa *
                </label>
                <select
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-[#FF6600]/30 focus:border-[#FF6600] outline-hidden"
                >
                  {KINSHASA_COMMUNES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-700 font-bold mb-1 text-[11px]">
                  Adresse ou Repère précis (Avenue, Numéro, Réf) *
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ex: Av. Colonel Mondjiba n°30, Réf. Utexafrica..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#FF6600]/30 focus:border-[#FF6600] outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-gray-700 font-bold mb-1 text-[11px]">
                Instructions complémentaires pour la livraison (facultatif)
              </label>
              <input
                type="text"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder="Ex: Sonner au portail noir, appeler avant d'arriver..."
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-[#FF6600]/30 focus:border-[#FF6600] outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#FF6600] hover:bg-[#e05a00] text-white text-xs font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save size={14} />
                <span>{isSaving ? "Enregistrement..." : "Enregistrer les modifications"}</span>
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* 3. Adresse de livraison enregistrée (Aperçu direct) */}
      {!isEditing && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <MapPin size={17} />
              </div>
              <h3 className="font-bold text-gray-900 text-sm">Adresse de livraison par défaut</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="text-xs text-[#FF6600] hover:underline font-bold"
            >
              Modifier
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs bg-gray-50 p-4 rounded-2xl border border-gray-100">
            <div>
              <span className="text-gray-400 block font-medium text-[11px]">Commune de Kinshasa</span>
              <span className="font-bold text-gray-900 text-sm mt-0.5 block">{commune || "Kinshasa"}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium text-[11px]">Adresse / Avenue</span>
              <span className="font-semibold text-gray-800 text-xs mt-0.5 block">{address || "Non renseignée"}</span>
            </div>
            <div>
              <span className="text-gray-400 block font-medium text-[11px]">Instructions livreur</span>
              <span className="text-gray-600 text-xs mt-0.5 block">{deliveryNotes || "Standard"}</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Raccourcis Rapides vers les Espaces d'Achats & Suivis */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs">
        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
          <span>Mes Espaces & Activités Rayons</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          
          {/* Mes Commandes */}
          <button
            type="button"
            onClick={() => onSelectTab("orders")}
            className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-orange-50/60 border border-gray-200/70 hover:border-[#FF6600]/40 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF6600] flex items-center justify-center shrink-0">
                <Package size={20} />
              </div>
              <div>
                <span className="font-bold text-gray-900 text-xs block group-hover:text-[#FF6600] transition-colors">
                  Mes Achats & Commandes
                </span>
                <span className="text-[11px] text-gray-500">
                  {ordersCount} commande{ordersCount > 1 ? "s" : ""} ({activeOrdersCount} en cours)
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-[#FF6600] transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Proformas */}
          <button
            type="button"
            onClick={() => onSelectTab("proformas")}
            className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-amber-50/60 border border-gray-200/70 hover:border-amber-400/50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <FileText size={20} />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-gray-900 text-xs block group-hover:text-amber-700 transition-colors">
                    Devis & Proformas (RFQ)
                  </span>
                  {proformasCount > 0 && (
                    <span className="px-1.5 py-0.2 bg-amber-500 text-white font-black text-[9px] rounded-full animate-pulse">
                      {proformasCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] text-gray-500">
                  {proformasCount} facture(s) en attente de validation
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-amber-700 transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Hôtels */}
          <button
            type="button"
            onClick={() => onSelectTab("hotels")}
            className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-blue-50/60 border border-gray-200/70 hover:border-blue-400/50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                <Hotel size={20} />
              </div>
              <div>
                <span className="font-bold text-gray-900 text-xs block group-hover:text-blue-700 transition-colors">
                  Hôtels & Séjours
                </span>
                <span className="text-[11px] text-gray-500">
                  {hotelsCount} réservation{hotelsCount > 1 ? "s" : ""}
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-700 transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Visites Immo */}
          <button
            type="button"
            onClick={() => onSelectTab("visits")}
            className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-emerald-50/60 border border-gray-200/70 hover:border-emerald-400/50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Calendar size={20} />
              </div>
              <div>
                <span className="font-bold text-gray-900 text-xs block group-hover:text-emerald-700 transition-colors">
                  Visites Immobilières
                </span>
                <span className="text-[11px] text-gray-500">
                  {visitsCount} rendez-vous de visite
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-emerald-700 transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Messagerie Vendeurs */}
          <button
            type="button"
            onClick={() => onSelectTab("messages")}
            className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-orange-50/60 border border-gray-200/70 hover:border-orange-400/50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#FF6600] flex items-center justify-center shrink-0">
                <MessageSquare size={20} />
              </div>
              <div>
                <span className="font-bold text-gray-900 text-xs block group-hover:text-[#FF6600] transition-colors">
                  Messagerie Fournisseurs
                </span>
                <span className="text-[11px] text-gray-500">
                  Négociations directes & Devis
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-[#FF6600] transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* Assistance SAV */}
          <button
            type="button"
            onClick={() => onSelectTab("tickets")}
            className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-purple-50/60 border border-gray-200/70 hover:border-purple-400/50 transition-all text-left group cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                <LifeBuoy size={20} />
              </div>
              <div>
                <span className="font-bold text-gray-900 text-xs block group-hover:text-purple-700 transition-colors">
                  Assistance & Réclamations
                </span>
                <span className="text-[11px] text-gray-500">
                  Support client garanti 7j/7
                </span>
              </div>
            </div>
            <ChevronRight size={16} className="text-gray-400 group-hover:text-purple-700 transition-transform group-hover:translate-x-0.5" />
          </button>

        </div>
      </div>

      {/* 5. Sécurité et Déconnexion */}
      <div className="bg-white rounded-3xl p-6 border border-gray-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="font-bold text-gray-900 text-sm">Gestion de session</h4>
          <p className="text-xs text-gray-500">
            Déconnectez-vous en toute sécurité sur cet appareil. Vos commandes et conversations restent sauvegardées.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
        >
          <LogOut size={15} />
          <span>Se déconnecter</span>
        </button>
      </div>

    </div>
  );
}
