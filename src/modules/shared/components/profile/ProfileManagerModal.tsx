"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Lock,
  Phone,
  MapPin,
  ShieldCheck,
  FileText,
  Upload,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  CreditCard,
  Sparkles,
  Trash2,
  Save,
  IdCard,
  Globe,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { optimizeImageToWebP } from "@/lib/imageOptimizer";
import { isSupplier } from "@/lib/permissions";

interface ProfileManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRoleLabel?: string;
}

const KINSHASA_COMMUNES = [
  "Gombe",
  "Ngaliema",
  "Kintambo",
  "Bandalungwa",
  "Limete",
  "Kasa-Vubu",
  "Lingwala",
  "Barumbu",
  "Kinshasa",
  "Kalamu",
  "Ngiri-Ngiri",
  "Bumbu",
  "Selembao",
  "Makala",
  "Lemba",
  "Matete",
  "Ngaba",
  "Kisenso",
  "Mont-Ngafula",
  "Ndjili",
  "Masina",
  "Kimbanseke",
  "Nsele",
  "Maluku",
  "Lubumbashi",
  "Goma",
  "Matadi",
  "Kolwezi",
];

export default function ProfileManagerModal({
  isOpen,
  onClose,
  userRoleLabel,
}: ProfileManagerModalProps) {
  const { user, userData } = useAuth();
  const isSupplierAccount = isSupplier(userData);

  const [activeTab, setActiveTab] = useState<"contact" | "identity">("contact");

  // Editable Contact & Profile states
  const [phone, setPhone] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [payoutProvider, setPayoutProvider] = useState("MPESA");
  const [commune, setCommune] = useState("");
  const [address, setAddress] = useState("");
  const [bio, setBio] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  // Identity & KYC states (managed in Firestore database)
  const [idDocumentType, setIdDocumentType] = useState("CARTE_ELECTEUR");
  const [idDocumentNumber, setIdDocumentNumber] = useState("");
  const [nationality, setNationality] = useState("Congolaise (RDC)");
  const [idDocumentFrontUrl, setIdDocumentFrontUrl] = useState("");
  const [idDocumentBackUrl, setIdDocumentBackUrl] = useState("");

  // Legal / Company fields for Suppliers
  const [companyName, setCompanyName] = useState("");
  const [rccm, setRccm] = useState("");
  const [idNat, setIdNat] = useState("");
  const [nif, setNif] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Sync state with userData when modal opens
  useEffect(() => {
    if (isOpen && userData) {
      setPhone(userData.phone || userData.phoneNumber || userData.pendingProfile?.phone || "");
      setWhatsappPhone(userData.whatsappPhone || userData.pendingProfile?.whatsappPhone || "");
      setPayoutPhone(userData.payoutPhone || userData.pendingProfile?.payoutPhone || "");
      setPayoutProvider(userData.payoutProvider || userData.pendingProfile?.payoutProvider || "MPESA");
      setCommune(userData.commune || userData.pendingProfile?.commune || "");
      setAddress(userData.address || userData.pendingProfile?.address || "");
      setBio(userData.bio || "");
      setLogoUrl(userData.logoUrl || userData.logo || userData.photoURL || "");

      setIdDocumentType(
        userData.idDocumentType ||
          userData.pendingProfile?.idDocumentType ||
          "CARTE_ELECTEUR"
      );
      setIdDocumentNumber(
        userData.idDocumentNumber ||
          userData.pendingProfile?.idDocumentNumber ||
          ""
      );
      setNationality(
        userData.nationality ||
          userData.pendingProfile?.nationality ||
          "Congolaise (RDC)"
      );
      setIdDocumentFrontUrl(
        userData.idDocumentFrontUrl ||
          userData.pendingProfile?.idDocumentFrontUrl ||
          ""
      );
      setIdDocumentBackUrl(
        userData.idDocumentBackUrl ||
          userData.pendingProfile?.idDocumentBackUrl ||
          ""
      );

      setCompanyName(
        userData.companyName ||
          userData.company ||
          userData.pendingProfile?.companyName ||
          ""
      );
      setRccm(userData.rccm || userData.pendingProfile?.rccm || "");
      setIdNat(userData.idNat || userData.pendingProfile?.idNat || "");
      setNif(userData.nif || userData.pendingProfile?.nif || "");
      setSuccessMsg("");
      setErrorMsg("");
    }
  }, [isOpen, userData]);

  if (!isOpen) return null;

  const lockedDisplayName =
    userData?.displayName ||
    userData?.name ||
    [userData?.firstName, userData?.lastName].filter(Boolean).join(" ") ||
    user?.displayName ||
    "Titulaire du compte";

  const lockedEmail = userData?.email || user?.email || "";

  const handleImageUpload = async (
    file: File,
    target: "logo" | "idFront" | "idBack"
  ) => {
    setUploadingField(target);
    setErrorMsg("");
    try {
      const optimized = await optimizeImageToWebP(file, {
        maxWidth: target === "logo" ? 512 : 1024,
        maxHeight: target === "logo" ? 512 : 1024,
        quality: 0.82,
      });

      if (target === "logo") {
        setLogoUrl(optimized.dataUrl);
      } else if (target === "idFront") {
        setIdDocumentFrontUrl(optimized.dataUrl);
      } else if (target === "idBack") {
        setIdDocumentBackUrl(optimized.dataUrl);
      }
    } catch (err: any) {
      console.error("Image optimization error:", err);
      setErrorMsg("Impossible de traiter l'image sélectionnée.");
    } finally {
      setUploadingField(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    const payload = {
      phone: phone.trim(),
      whatsappPhone: whatsappPhone.trim(),
      payoutPhone: payoutPhone.trim(),
      payoutProvider,
      commune: commune.trim(),
      address: address.trim(),
      bio: bio.trim(),
      logoUrl,
      companyName: companyName.trim(),
      rccm: rccm.trim(),
      idNat: idNat.trim(),
      nif: nif.trim(),
      idDocumentType,
      idDocumentNumber: idDocumentNumber.trim(),
      nationality: nationality.trim(),
      idDocumentFrontUrl,
      idDocumentBackUrl,
    };

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/users/profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur serveur lors de la sauvegarde.");
      }

      setSuccessMsg(
        "Vos coordonnées et vos pièces d'identité ont été enregistrées dans la base de données !"
      );
    } catch (apiErr: any) {
      console.warn("API profile fallback to client Firestore:", apiErr);
      try {
        // Fallback direct client Firestore update (never touching displayName/name)
        await setDoc(
          doc(db, "users", user.uid),
          {
            phone: payload.phone,
            phoneNumber: payload.phone,
            whatsappPhone: payload.whatsappPhone,
            payoutPhone: payload.payoutPhone,
            payoutProvider: payload.payoutProvider,
            commune: payload.commune,
            address: payload.address,
            bio: payload.bio,
            logoUrl: payload.logoUrl,
            logo: payload.logoUrl,
            photoURL: payload.logoUrl,
            companyName: payload.companyName,
            rccm: payload.rccm,
            idNat: payload.idNat,
            nif: payload.nif,
            idDocumentType: payload.idDocumentType,
            idDocumentNumber: payload.idDocumentNumber,
            nationality: payload.nationality,
            idDocumentFrontUrl: payload.idDocumentFrontUrl,
            idDocumentBackUrl: payload.idDocumentBackUrl,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
        setSuccessMsg("Profil et identité mis à jour avec succès !");
      } catch (fsErr: any) {
        setErrorMsg(
          fsErr.message || "Erreur lors de l'enregistrement de votre profil."
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            className="w-full max-w-2xl bg-[#0F1D27] border border-white/15 rounded-3xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col text-white"
          >
            {/* Header */}
            <div className="px-5 py-4 sm:px-6 sm:py-5 border-b border-white/10 flex items-center justify-between bg-[#0B151C]/90 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-[#C7D300]/15 border border-[#C7D300]/30 flex items-center justify-center text-[#C7D300] overflow-hidden shrink-0">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={lockedDisplayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={22} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base sm:text-lg font-extrabold text-white truncate">
                      Mon Profil & Identité
                    </h2>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C7D300]/15 text-[#C7D300] border border-[#C7D300]/30">
                      {userRoleLabel || userData?.role || "Compte"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 truncate mt-0.5">
                    Gérez votre numéro, vos coordonnées et vos pièces d&apos;identité en base de données
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="px-5 sm:px-6 pt-3 bg-[#0B151C]/50 border-b border-white/10 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab("contact")}
                className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === "contact"
                    ? "border-[#C7D300] text-[#C7D300] bg-white/5"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <Phone size={15} />
                <span>Coordonnées & Numéros</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("identity")}
                className={`px-4 py-2.5 text-xs sm:text-sm font-bold rounded-t-xl border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === "identity"
                    ? "border-[#C7D300] text-[#C7D300] bg-white/5"
                    : "border-transparent text-gray-400 hover:text-white"
                }`}
              >
                <IdCard size={16} />
                <span>Pièce d&apos;Identité & KYC</span>
                {(idDocumentNumber || idDocumentFrontUrl) ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                ) : (
                  <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[9px] uppercase">
                    À compléter
                  </span>
                )}
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form
              onSubmit={handleSaveProfile}
              className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1"
            >
              {successMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2.5">
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2.5">
                  <AlertCircle size={18} className="text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* LOCKED IDENTITY BANNER (Name cannot be modified) */}
              <div className="p-4 rounded-2xl bg-black/35 border border-white/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                    <Lock size={13} className="text-amber-400" />
                    Identité Principale (Verrouillée)
                  </span>
                  <span className="text-[10px] font-semibold text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
                    Modification du nom désactivée
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Nom complet du titulaire
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={lockedDisplayName}
                        disabled
                        readOnly
                        className="w-full px-3.5 py-2 pr-9 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-xs sm:text-sm font-bold cursor-not-allowed select-none opacity-80"
                      />
                      <Lock
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-gray-400 mb-1">
                      Email de connexion
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={lockedEmail}
                        disabled
                        readOnly
                        className="w-full px-3.5 py-2 pr-9 bg-white/5 border border-white/10 rounded-xl text-gray-400 text-xs sm:text-sm font-mono cursor-not-allowed select-none opacity-80"
                      />
                      <Lock
                        size={14}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {activeTab === "contact" ? (
                <div className="space-y-5">
                  {/* Avatar / Logo upload */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-black/40 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                        {logoUrl ? (
                          <img
                            src={logoUrl}
                            alt="Avatar"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User size={24} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-white">
                          Photo de Profil / Logo Enseigne
                        </h4>
                        <p className="text-[11px] text-gray-400">
                          Convertie automatiquement en WebP léger et enregistrée en base.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-white cursor-pointer transition-all flex items-center gap-1.5">
                        <Upload size={14} className="text-[#C7D300]" />
                        <span>
                          {uploadingField === "logo" ? "Compression..." : "Changer la photo"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleImageUpload(f, "logo");
                          }}
                        />
                      </label>
                      {logoUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoUrl("")}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                          title="Supprimer la photo"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Phone Numbers Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1.5">
                        Numéro de téléphone principal <span className="text-[#C7D300]">*</span>
                      </label>
                      <div className="relative">
                        <Phone
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="tel"
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+243 81 000 0000"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1.5">
                        Numéro WhatsApp Direct
                      </label>
                      <div className="relative">
                        <Phone
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400"
                        />
                        <input
                          type="tel"
                          value={whatsappPhone}
                          onChange={(e) => setWhatsappPhone(e.target.value)}
                          placeholder="+243 85 000 0000"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Mobile Money Payout Number */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1.5">
                        Opérateur Mobile Money
                      </label>
                      <select
                        value={payoutProvider}
                        onChange={(e) => setPayoutProvider(e.target.value)}
                        className="w-full px-3 py-2.5 bg-black/50 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                      >
                        <option value="MPESA">Vodacom M-Pesa</option>
                        <option value="ORANGE">Orange Money</option>
                        <option value="AIRTEL">Airtel Money</option>
                        <option value="AFRIMONEY">AfriMoney</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-300 mb-1.5">
                        Numéro Mobile Money (Réception / Paiements)
                      </label>
                      <div className="relative">
                        <CreditCard
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#C7D300]"
                        />
                        <input
                          type="tel"
                          value={payoutPhone}
                          onChange={(e) => setPayoutPhone(e.target.value)}
                          placeholder="+243 81/84/89/99 ..."
                          className="w-full pl-10 pr-3.5 py-2.5 bg-black/50 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Address & Commune */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1.5">
                        Commune / Ville
                      </label>
                      <select
                        value={commune}
                        onChange={(e) => setCommune(e.target.value)}
                        className="w-full px-3 py-2.5 bg-black/40 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                      >
                        <option value="">Sélectionner...</option>
                        {KINSHASA_COMMUNES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-gray-300 mb-1.5">
                        Adresse physique complète (Siège / Bureau / Boutique)
                      </label>
                      <div className="relative">
                        <MapPin
                          size={15}
                          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Ex: N°14 Av. de la Justice, Gombe, Kinshasa"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Fonction / Bio */}
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">
                      Fonction / Présentation courte
                    </label>
                    <input
                      type="text"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Ex: Gérant principal, Responsable commercial..."
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                    />
                  </div>
                </div>
              ) : (
                /* TAB 2: PIÈCE D'IDENTITÉ & KYC (BASE DE DONNÉES) */
                <div className="space-y-5">
                  <div className="p-3.5 rounded-2xl bg-[#C7D300]/10 border border-[#C7D300]/25 text-xs text-gray-200 flex items-start gap-3">
                    <ShieldCheck size={18} className="text-[#C7D300] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-white">
                        Enregistrement sécurisé dans la base de données Rayons.net
                      </p>
                      <p className="text-gray-300 mt-0.5 leading-relaxed">
                        Renseignez votre pièce d&apos;identité officielle (numéro et photos recto/verso) ainsi que vos références commerciales. Ces éléments sont conservés dans votre dossier partenaire.
                      </p>
                    </div>
                  </div>

                  {/* Type de pièce, Numéro & Nationalité */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1.5">
                        Type de pièce d&apos;identité <span className="text-[#C7D300]">*</span>
                      </label>
                      <select
                        value={idDocumentType}
                        onChange={(e) => setIdDocumentType(e.target.value)}
                        className="w-full px-3 py-2.5 bg-black/40 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                      >
                        <option value="CARTE_ELECTEUR">Carte d&apos;Électeur (RDC)</option>
                        <option value="PASSEPORT">Passeport Biométrique</option>
                        <option value="PERMIS_CONDUIRE">Permis de Conduire</option>
                        <option value="CARTE_IDENTITE">Carte d&apos;Identité Nationale</option>
                        <option value="AUTRE">Autre Document Officiel</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1.5">
                        Numéro de la pièce <span className="text-[#C7D300]">*</span>
                      </label>
                      <input
                        type="text"
                        value={idDocumentNumber}
                        onChange={(e) => setIdDocumentNumber(e.target.value)}
                        placeholder="Ex: NN 30192837465"
                        className="w-full px-3.5 py-2.5 bg-black/40 border border-white/15 rounded-xl text-white text-xs sm:text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1.5">
                        Nationalité
                      </label>
                      <div className="relative">
                        <Globe
                          size={14}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          value={nationality}
                          onChange={(e) => setNationality(e.target.value)}
                          placeholder="Congolaise (RDC)"
                          className="w-full pl-9 pr-3 py-2.5 bg-black/40 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Upload Recto / Verso Pièce d'identité */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* RECTO */}
                    <div className="p-4 rounded-2xl bg-black/35 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          Pièce d&apos;identité — RECTO
                        </span>
                        {idDocumentFrontUrl && (
                          <button
                            type="button"
                            onClick={() => setIdDocumentFrontUrl("")}
                            className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={12} /> Retirer
                          </button>
                        )}
                      </div>

                      {idDocumentFrontUrl ? (
                        <div className="relative h-32 w-full rounded-xl overflow-hidden bg-black/50 border border-white/15">
                          <img
                            src={idDocumentFrontUrl}
                            alt="Pièce Recto"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/15 hover:border-[#C7D300]/50 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-all p-3 text-center">
                          <Upload size={20} className="text-[#C7D300] mb-1.5" />
                          <span className="text-xs font-semibold text-gray-200">
                            {uploadingField === "idFront"
                              ? "Compression WebP..."
                              : "Ajouter la photo Recto"}
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            JPG, PNG ou WebP (optimisé auto)
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageUpload(f, "idFront");
                            }}
                          />
                        </label>
                      )}
                    </div>

                    {/* VERSO */}
                    <div className="p-4 rounded-2xl bg-black/35 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">
                          Pièce d&apos;identité — VERSO
                        </span>
                        {idDocumentBackUrl && (
                          <button
                            type="button"
                            onClick={() => setIdDocumentBackUrl("")}
                            className="text-[11px] text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={12} /> Retirer
                          </button>
                        )}
                      </div>

                      {idDocumentBackUrl ? (
                        <div className="relative h-32 w-full rounded-xl overflow-hidden bg-black/50 border border-white/15">
                          <img
                            src={idDocumentBackUrl}
                            alt="Pièce Verso"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center h-32 rounded-xl border-2 border-dashed border-white/15 hover:border-[#C7D300]/50 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-all p-3 text-center">
                          <Upload size={20} className="text-[#C7D300] mb-1.5" />
                          <span className="text-xs font-semibold text-gray-200">
                            {uploadingField === "idBack"
                              ? "Compression WebP..."
                              : "Ajouter la photo Verso"}
                          </span>
                          <span className="text-[10px] text-gray-400 mt-0.5">
                            Optionnel pour passeport
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleImageUpload(f, "idBack");
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Références commerciales & fiscales (Fournisseur) */}
                  {isSupplierAccount && (
                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                      <div className="flex items-center gap-2">
                        <Building2 size={16} className="text-[#C7D300]" />
                        <h4 className="text-xs sm:text-sm font-bold text-white">
                          Identité Commerciale & Numéros Légaux
                        </h4>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-gray-300 mb-1">
                            Nom Commercial / Boutique / Entreprise
                          </label>
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            placeholder="Ex: Établissements Kivu Tech SARL"
                            className="w-full px-3.5 py-2 bg-black/40 border border-white/15 rounded-xl text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-300 mb-1">
                            RCCM
                          </label>
                          <input
                            type="text"
                            value={rccm}
                            onChange={(e) => setRccm(e.target.value)}
                            placeholder="CD/KNG/RCCM/..."
                            className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-gray-300 mb-1">
                            ID. NAT / NIF
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={idNat}
                              onChange={(e) => setIdNat(e.target.value)}
                              placeholder="ID. NAT"
                              className="w-full px-2.5 py-2 bg-black/40 border border-white/15 rounded-xl text-white text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                            />
                            <input
                              type="text"
                              value={nif}
                              onChange={(e) => setNif(e.target.value)}
                              placeholder="NIF"
                              className="w-full px-2.5 py-2 bg-black/40 border border-white/15 rounded-xl text-white text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Buttons */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2.5 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-[#C7D300]/20 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save size={16} />
                  <span>
                    {isSaving
                      ? "Enregistrement en base..."
                      : "Enregistrer dans la base de données"}
                  </span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

