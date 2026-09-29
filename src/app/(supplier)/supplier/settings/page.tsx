"use client";

import { useState, useEffect } from "react";
import { 
  Save, 
  Phone, 
  Palette, 
  Building2, 
  ShieldCheck, 
  AlertCircle, 
  FileText, 
  CheckCircle2, 
  MapPin, 
  Sparkles,
  Info,
  Edit3,
  Clock,
  ArrowRight,
  ShieldAlert,
  Eye,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import LogoUploadArea from "@/modules/shared/components/shared/LogoUploadArea";

const SUBMIT_STEPS = [
  "Optimisation du logo WebP transparent...",
  "Mise à jour instantanée des coordonnées...",
  "Transmission sécurisée pour validation légale..."
];

export default function SupplierSettingsPage() {
  const { user, userData } = useAuth();
  
  // Coordonnées & Visuel
  const [phoneNumber, setPhoneNumber] = useState("");
  const [address, setAddress] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#8b5cf6");
  const [logoUrl, setLogoUrl] = useState("");
  
  // Identité Légale & Facturation (Devis, Factures & Reçus)
  const [companyName, setCompanyName] = useState("");
  const [rccm, setRccm] = useState("");
  const [idNat, setIdNat] = useState("");
  const [nif, setNif] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Contrôle de l'affichage du formulaire vs. Carte récapitulative
  const [isEditing, setIsEditing] = useState(false);
  const [hasSubmittedSuccessfully, setHasSubmittedSuccessfully] = useState(false);

  const isPendingApproval = userData?.profileUpdateStatus === "PENDING_APPROVAL" || hasSubmittedSuccessfully;
  const rayonLabel = userData?.rayon?.name || userData?.rayon || "Rayons.net";

  useEffect(() => {
    if (userData) {
      if (userData.phone || userData.phoneNumber) setPhoneNumber(userData.phone || userData.phoneNumber);
      if (userData.address) setAddress(userData.address);
      if (userData.primaryColor) setPrimaryColor(userData.primaryColor);
      if (userData.logoUrl || userData.logo) setLogoUrl(userData.logoUrl || userData.logo);
      if (userData.companyName || userData.company) setCompanyName(userData.companyName || userData.company);
      if (userData.rccm) setRccm(userData.rccm);
      if (userData.idNat) setIdNat(userData.idNat);
      if (userData.nif) setNif(userData.nif);

      // Si des modifications étaient en attente, pré-remplir avec les valeurs soumises
      if (userData.pendingProfile) {
        if (userData.pendingProfile.logoUrl) setLogoUrl(userData.pendingProfile.logoUrl);
        if (userData.pendingProfile.companyName) setCompanyName(userData.pendingProfile.companyName);
        if (userData.pendingProfile.rccm) setRccm(userData.pendingProfile.rccm);
        if (userData.pendingProfile.idNat) setIdNat(userData.pendingProfile.idNat);
        if (userData.pendingProfile.nif) setNif(userData.pendingProfile.nif);
        if (userData.pendingProfile.phone) setPhoneNumber(userData.pendingProfile.phone);
        if (userData.pendingProfile.primaryColor) setPrimaryColor(userData.pendingProfile.primaryColor);
      }

      // Si le profil est déjà en attente d'approbation et que l'utilisateur n'a pas expressément cliqué pour éditer,
      // on affiche la vue récapitulative par défaut
      if (userData.profileUpdateStatus === "PENDING_APPROVAL" && !isEditing) {
        setIsEditing(false);
      } else if (userData.profileUpdateStatus !== "PENDING_APPROVAL" && !hasSubmittedSuccessfully) {
        setIsEditing(true);
      }
    }
  }, [userData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    setSuccess("");
    setError("");

    try {
      // Effet d'écriture / simulation visuelle séquentielle de traitement haute technologie
      setProcessingStep(SUBMIT_STEPS[0]);
      await new Promise(r => setTimeout(r, 450));
      
      setProcessingStep(SUBMIT_STEPS[1]);
      await new Promise(r => setTimeout(r, 450));
      
      setProcessingStep(SUBMIT_STEPS[2]);

      const userRef = doc(db, "users", user.uid);

      const currentApprovedCompany = (userData?.companyName || userData?.company || "").trim();
      const currentApprovedRccm = (userData?.rccm || "").trim();
      const currentApprovedIdNat = (userData?.idNat || "").trim();
      const currentApprovedNif = (userData?.nif || "").trim();

      const newCompany = companyName.trim();
      const newRccm = rccm.trim();
      const newIdNat = idNat.trim();
      const newNif = nif.trim();

      // Détecter si des champs légaux et fiscaux sensibles ont changé
      const legalFieldsChanged = 
        (newCompany !== currentApprovedCompany) ||
        (newRccm !== currentApprovedRccm) ||
        (newIdNat !== currentApprovedIdNat) ||
        (newNif !== currentApprovedNif);

      // 1. Mises à jour directes immédiates (visuel, contact, marque blanche)
      const immediateUpdateData: any = {
        phone: phoneNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        address: address.trim(),
        logoUrl: logoUrl,
        logo: logoUrl,
        primaryColor: primaryColor,
        updatedAt: new Date().toISOString()
      };

      if (legalFieldsChanged || !userData?.profileUpdateStatus) {
        // Enregistrement sécurisé : les identifiants fiscaux/légaux sont soumis à vérification
        const pendingProfile: any = {
          phone: phoneNumber.trim(),
          primaryColor: primaryColor,
          logoUrl: logoUrl,
          companyName: newCompany,
          rccm: newRccm,
          idNat: newIdNat,
          nif: newNif,
          address: address.trim(),
          submittedAt: new Date().toISOString()
        };

        await updateDoc(userRef, {
          ...immediateUpdateData,
          pendingProfile,
          profileUpdateStatus: "PENDING_APPROVAL"
        });

        setSuccess(
          "Vos paramètres ont été mis à jour avec succès ! Votre logo WebP et vos coordonnées sont actifs. Vos identifiants légaux sont en cours de validation."
        );
      } else {
        if (!userData?.companyName && newCompany) {
          immediateUpdateData.companyName = newCompany;
        }

        await updateDoc(userRef, immediateUpdateData);
        setSuccess("Vos paramètres de profil et votre logo WebP ont été enregistrés avec succès.");
      }

      await new Promise(r => setTimeout(r, 400));
      setHasSubmittedSuccessfully(true);
      // Faire disparaître le formulaire de façon fluide
      setIsEditing(false);
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors de la mise à jour : " + (err.message || "Une erreur est survenue"));
    } finally {
      setIsLoading(false);
      setProcessingStep(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2.5">
            <Building2 className="text-[#C7D300]" size={28} />
            <span>Paramètres du Profil Fournisseur</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Gérez votre identité commerciale, votre logo au format WebP et vos paramètres de facturation.
          </p>
        </div>

        {userData?.profileUpdateStatus === "APPROVED" && !hasSubmittedSuccessfully && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold self-start shadow-sm">
            <ShieldCheck size={16} />
            <span>Identité & Fiscalité Vérifiées</span>
          </div>
        )}
      </div>

      {/* Traitement en direct avec effet d'écriture animée */}
      <AnimatePresence>
        {processingStep && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-5 bg-[#0F1D27] border border-[#C7D300]/40 rounded-2xl shadow-2xl relative overflow-hidden"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-[#C7D300]/15 flex items-center justify-center text-[#C7D300] shrink-0">
                <div className="w-4 h-4 border-2 border-[#C7D300] border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-[#C7D300] uppercase tracking-wider">Traitement sécurisé</span>
                <p className="text-sm font-semibold text-white tracking-wide font-mono animate-pulse">
                  {processingStep}
                </p>
              </div>
            </div>
            {/* Barre de progression fluide */}
            <motion.div 
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
              className="absolute bottom-0 left-0 h-1 bg-[#C7D300]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alerte Erreur */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm rounded-2xl flex items-start gap-3"
        >
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-rose-400" />
          <p className="font-medium">{error}</p>
        </motion.div>
      )}

      {/* VUE 1 : Carte Récapitulative 'Modifications en cours de validation' */}
      <AnimatePresence mode="wait">
        {!isEditing && (
          <motion.div
            key="summary-view"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="space-y-6"
          >
            {/* Bannière d'état En cours de validation */}
            <div className="p-6 bg-gradient-to-br from-[#0F1D27] to-[#0B151C] border border-amber-500/30 rounded-3xl shadow-2xl relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                    <Clock size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                        {isPendingApproval ? "Modifications en cours de validation" : "Profil Fournisseur Actif"}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-white mt-0.5">
                      {companyName || userData?.displayName || "Votre Entreprise"}
                    </h2>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 text-white rounded-xl text-xs font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm self-start sm:self-auto"
                >
                  <Edit3 size={15} className="text-[#C7D300]" />
                  <span>Modifier à nouveau</span>
                </button>
              </div>

              {/* Explication claire du niveau de sécurité */}
              <div className="mt-5 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200/90 leading-relaxed flex items-start gap-3">
                <Info size={18} className="text-amber-400 shrink-0 mt-0.5" />
                <p>
                  <strong className="text-white">Vos données visuelles sont actives :</strong> Votre nouveau logo WebP et vos coordonnées sont déjà appliqués sur vos documents et votre profil. Vos identifiants légaux et fiscaux (RCCM, NIF, ID Nat) ont été transmis à l'administration de Rayons.net pour validation de conformité.
                </p>
              </div>

              {/* Récapitulatif structuré des informations transmises */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bloc Logo WebP & Visuel */}
                <div className="p-4 bg-black/40 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                    <span>Logo WebP & Marque</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check size={13} /> Actif
                    </span>
                  </div>

                  <div className="flex items-center gap-4 pt-1">
                    <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/15 p-2 flex items-center justify-center shrink-0">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <Building2 size={24} className="text-gray-500" />
                      )}
                    </div>
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold text-white">Logo optimisé WebP</p>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400">Couleur :</span>
                        <div className="w-4 h-4 rounded-full border border-white/30" style={{ backgroundColor: primaryColor }} />
                        <span className="font-mono text-gray-300">{primaryColor}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bloc Contact & Téléphone */}
                <div className="p-4 bg-black/40 border border-white/10 rounded-2xl space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                    <span>Contact & Siège</span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <Check size={13} /> Actif
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs pt-1">
                    <div>
                      <span className="text-gray-400">Téléphone direct : </span>
                      <strong className="text-white">{phoneNumber || "Non renseigné"}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400">Adresse physique : </span>
                      <span className="text-gray-300">{address || "Non renseignée"}</span>
                    </div>
                  </div>
                </div>

                {/* Bloc Identité Fiscale & RCCM */}
                <div className="md:col-span-2 p-4 bg-black/40 border border-white/10 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between text-xs text-gray-400 font-bold uppercase tracking-wider">
                    <span>Mentions Légales & Fiscales</span>
                    <span className="text-amber-400 flex items-center gap-1 font-semibold">
                      <Clock size={13} /> En attente de validation
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 text-xs">
                    <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">RCCM</span>
                      <strong className="text-white font-mono">{rccm || "En cours..."}</strong>
                    </div>

                    <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">ID. NAT</span>
                      <strong className="text-white font-mono">{idNat || "En cours..."}</strong>
                    </div>

                    <div className="p-2.5 bg-white/5 rounded-xl border border-white/5">
                      <span className="text-[10px] text-gray-400 block uppercase font-bold">NIF</span>
                      <strong className="text-white font-mono">{nif || "En cours..."}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action de réouverture du formulaire */}
              <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-gray-400">
                  Besoin d'ajuster une faute de frappe ou de changer votre logo ?
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0B151C] font-black rounded-xl text-xs shadow-lg shadow-[#C7D300]/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Edit3 size={15} />
                  <span>Ouvrir le formulaire de modification</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* VUE 2 : Formulaire de Saisie & Édition */}
        {isEditing && (
          <motion.div
            key="editing-form"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.97 }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
            className="space-y-6"
          >
            {/* Bouton de retour vers le récapitulatif si déjà en attente */}
            {isPendingApproval && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs text-gray-300 font-semibold transition-colors"
                >
                  <Eye size={14} className="text-[#C7D300]" />
                  <span>Voir le statut de validation</span>
                </button>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
              {/* SECTION 1: Logo & Identité Visuelle */}
              <div className="bg-[#0B151C]/90 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#C7D300]/10 border border-[#C7D300]/20 flex items-center justify-center text-[#C7D300]">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Logo de l'Entreprise (Format WebP)</h2>
                      <p className="text-xs text-gray-400">Ce logo s'affichera sur votre profil public et sur tous vos devis, factures & reçus.</p>
                    </div>
                  </div>
                  <span className="hidden sm:inline-block px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-gray-300">
                    WebP 512×512 Max
                  </span>
                </div>

                <LogoUploadArea 
                  logoUrl={logoUrl}
                  companyName={companyName || userData?.displayName || "Votre Entreprise"}
                  onLogoChange={(webpDataUrl) => {
                    setLogoUrl(webpDataUrl);
                    setSuccess("");
                  }}
                  onClear={() => {
                    setLogoUrl("");
                    setSuccess("");
                  }}
                  disabled={isLoading}
                />
              </div>

              {/* SECTION 2: Coordonnées & Contact */}
              <div className="bg-[#0B151C]/90 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Phone className="text-[#C7D300]" size={20} />
                    <span>Coordonnées Commerciales & Contact</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Informations utilisées pour vous joindre et imprimées sur vos documents de commande.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Numéro de téléphone <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Phone size={18} />
                      </div>
                      <input 
                        type="text" 
                        required
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="Ex: +243 81 234 5678" 
                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Adresse physique du siège / magasin
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <MapPin size={18} />
                      </div>
                      <input 
                        type="text" 
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Ex: 12 Boulevard du 30 Juin, Gombe, Kinshasa" 
                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 3: Identité Légale & Facturation (Devis, Factures) */}
              <div className="bg-[#0B151C]/90 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <FileText className="text-[#C7D300]" size={20} />
                      <span>Identité Légale & Facturation</span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Mentions fiscales obligatoires imprimées en en-tête de vos factures et devis officiels.
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-gray-300 self-start">
                    <ShieldCheck size={14} className="text-[#C7D300]" />
                    <span>Contrôle de sécurité modérateur</span>
                  </div>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Raison Sociale / Nom Officiel de l'Entreprise
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                        <Building2 size={18} />
                      </div>
                      <input 
                        type="text" 
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Ex: Établissements Rayons RDC SARL" 
                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                        RCCM <span className="text-gray-500 font-normal">(Registre Commerce)</span>
                      </label>
                      <input 
                        type="text" 
                        value={rccm}
                        onChange={(e) => setRccm(e.target.value)}
                        placeholder="Ex: CD/KNG/RCCM/20-B-12345" 
                        className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                        ID. NAT <span className="text-gray-500 font-normal">(Identification Nat.)</span>
                      </label>
                      <input 
                        type="text" 
                        value={idNat}
                        onChange={(e) => setIdNat(e.target.value)}
                        placeholder="Ex: 01-83-N12345P" 
                        className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                        Numéro d'Impôt (NIF)
                      </label>
                      <input 
                        type="text" 
                        value={nif}
                        onChange={(e) => setNif(e.target.value)}
                        placeholder="Ex: A1234567Z" 
                        className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm uppercase"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-2.5 text-xs text-gray-300">
                    <Info size={16} className="text-[#C7D300] shrink-0 mt-0.5" />
                    <p>
                      Ces identifiants légaux garantissent la conformité juridique de vos devis et factures édités via Rayons.net. Toute modification de ces identifiants passe par une revue rapide des administrateurs.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 4: Apparence & Marque Blanche */}
              <div className="bg-[#0B151C]/90 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
                <div className="border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Palette className="text-[#C7D300]" size={20} />
                    <span>Personnalisation & Couleur de Marque</span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1">
                    Couleur distinctive de votre enseigne appliquée aux en-têtes et boutons de vos devis.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <input 
                      type="color" 
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-12 w-12 rounded-2xl cursor-pointer bg-transparent border-2 border-white/20 p-1" 
                    />
                    <div className="relative w-44">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                        <Palette size={16} />
                      </div>
                      <input 
                        type="text" 
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        placeholder="#8b5cf6" 
                        className="w-full pl-9 pr-3 py-2 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-xs font-mono uppercase" 
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { label: "Violet Rayons", color: "#8b5cf6" },
                      { label: "Lime Signature", color: "#C7D300" },
                      { label: "Saveurs Orange", color: "#FF6B35" },
                      { label: "Mode Terracotta", color: "#D4B08C" },
                      { label: "Connect Teal", color: "#00B5A5" },
                      { label: "Immo Royal", color: "#4C6EF5" },
                    ].map((c) => (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setPrimaryColor(c.color)}
                        className={`w-7 h-7 rounded-xl border transition-transform hover:scale-110 ${
                          primaryColor.toLowerCase() === c.color.toLowerCase() ? "border-white ring-2 ring-white/50" : "border-transparent"
                        }`}
                        style={{ backgroundColor: c.color }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Aperçu en direct de l'en-tête de facture */}
                <div className="pt-2">
                  <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Aperçu en direct sur vos factures & devis
                  </span>
                  <div className="bg-white rounded-2xl p-4 text-gray-900 border border-gray-200 shadow-md flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 p-1 flex items-center justify-center overflow-hidden shrink-0">
                        {logoUrl ? (
                          <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <Building2 size={24} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: primaryColor }}>
                          Émetteur officiel
                        </div>
                        <div className="text-sm font-black text-gray-900 leading-tight">
                          {companyName || userData?.displayName || "Nom de votre Entreprise"}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {phoneNumber || "+243 00 000 0000"} {address ? `• ${address}` : ""}
                        </div>
                        {(rccm || nif) && (
                          <div className="text-[10px] text-gray-400 mt-0.5 font-mono">
                            {[rccm ? `RCCM : ${rccm}` : null, nif ? `NIF : ${nif}` : null].filter(Boolean).join(" | ")}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="hidden sm:block text-right border-l pl-4 border-gray-200">
                      <div className="text-[11px] font-bold text-gray-400 uppercase">Document PDF</div>
                      <div className="text-xs font-bold text-gray-800">RAY-FAC-2026</div>
                      <div className="text-[10px] text-emerald-600 font-semibold mt-1">Conforme Rayons.net</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bouton de sauvegarde */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-gray-500 order-2 sm:order-1">
                  Rayon actif : <span className="text-gray-300 font-medium capitalize">{rayonLabel}</span>
                </p>

                <div className="flex items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
                  {isPendingApproval && (
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-5 py-3 bg-white/5 hover:bg-white/10 text-gray-300 text-xs font-bold rounded-2xl transition-colors"
                    >
                      Annuler
                    </button>
                  )}

                  <button 
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-8 py-3 bg-[#C7D300] hover:bg-[#b5c000] text-[#0B151C] font-black rounded-2xl shadow-lg shadow-[#C7D300]/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {isLoading ? (
                      <div className="w-5 h-5 border-2 border-[#0B151C]/30 border-t-[#0B151C] rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save size={18} />
                        <span>Enregistrer les modifications</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
