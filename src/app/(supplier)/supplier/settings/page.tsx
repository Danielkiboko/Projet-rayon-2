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
  Check,
  Lock,
  Upload,
  Trash2,
  IdCard,
  CreditCard
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import LogoUploadArea from "@/modules/shared/components/shared/LogoUploadArea";
import { optimizeImageToWebP } from "@/lib/imageOptimizer";

const SUBMIT_STEPS = [
  "Optimisation du logo WebP transparent...",
  "Mise à jour instantanée des coordonnées...",
  "Transmission sécurisée pour validation légale..."
];

export default function SupplierSettingsPage() {
  const { user, userData } = useAuth();
  
  // Coordonnées & Visuel
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [payoutPhone, setPayoutPhone] = useState("");
  const [payoutProvider, setPayoutProvider] = useState("MPESA");
  const [address, setAddress] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#8b5cf6");
  const [logoUrl, setLogoUrl] = useState("");
  
  // Identité du Gérant & Pièces d'Identité (KYC Base de données)
  const [idDocumentType, setIdDocumentType] = useState("CARTE_ELECTEUR");
  const [idDocumentNumber, setIdDocumentNumber] = useState("");
  const [nationality, setNationality] = useState("Congolaise (RDC)");
  const [idDocumentFrontUrl, setIdDocumentFrontUrl] = useState("");
  const [idDocumentBackUrl, setIdDocumentBackUrl] = useState("");
  const [uploadingIdSide, setUploadingIdSide] = useState<"front" | "back" | null>(null);

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
      if (userData.whatsappPhone) setWhatsappPhone(userData.whatsappPhone);
      if (userData.payoutPhone) setPayoutPhone(userData.payoutPhone);
      if (userData.payoutProvider) setPayoutProvider(userData.payoutProvider);
      if (userData.address) setAddress(userData.address);
      if (userData.primaryColor) setPrimaryColor(userData.primaryColor);
      if (userData.logoUrl || userData.logo) setLogoUrl(userData.logoUrl || userData.logo);
      if (userData.companyName || userData.company) setCompanyName(userData.companyName || userData.company);
      if (userData.rccm) setRccm(userData.rccm);
      if (userData.idNat) setIdNat(userData.idNat);
      if (userData.nif) setNif(userData.nif);
      if (userData.idDocumentType) setIdDocumentType(userData.idDocumentType);
      if (userData.idDocumentNumber) setIdDocumentNumber(userData.idDocumentNumber);
      if (userData.nationality) setNationality(userData.nationality);
      if (userData.idDocumentFrontUrl) setIdDocumentFrontUrl(userData.idDocumentFrontUrl);
      if (userData.idDocumentBackUrl) setIdDocumentBackUrl(userData.idDocumentBackUrl);

      // Si des modifications étaient en attente, pré-remplir avec les valeurs soumises
      if (userData.pendingProfile) {
        if (userData.pendingProfile.logoUrl) setLogoUrl(userData.pendingProfile.logoUrl);
        if (userData.pendingProfile.companyName) setCompanyName(userData.pendingProfile.companyName);
        if (userData.pendingProfile.rccm) setRccm(userData.pendingProfile.rccm);
        if (userData.pendingProfile.idNat) setIdNat(userData.pendingProfile.idNat);
        if (userData.pendingProfile.nif) setNif(userData.pendingProfile.nif);
        if (userData.pendingProfile.phone) setPhoneNumber(userData.pendingProfile.phone);
        if (userData.pendingProfile.whatsappPhone) setWhatsappPhone(userData.pendingProfile.whatsappPhone);
        if (userData.pendingProfile.payoutPhone) setPayoutPhone(userData.pendingProfile.payoutPhone);
        if (userData.pendingProfile.payoutProvider) setPayoutProvider(userData.pendingProfile.payoutProvider);
        if (userData.pendingProfile.primaryColor) setPrimaryColor(userData.pendingProfile.primaryColor);
        if (userData.pendingProfile.idDocumentType) setIdDocumentType(userData.pendingProfile.idDocumentType);
        if (userData.pendingProfile.idDocumentNumber) setIdDocumentNumber(userData.pendingProfile.idDocumentNumber);
        if (userData.pendingProfile.nationality) setNationality(userData.pendingProfile.nationality);
        if (userData.pendingProfile.idDocumentFrontUrl) setIdDocumentFrontUrl(userData.pendingProfile.idDocumentFrontUrl);
        if (userData.pendingProfile.idDocumentBackUrl) setIdDocumentBackUrl(userData.pendingProfile.idDocumentBackUrl);
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

  const handleUploadIdPhoto = async (file: File, side: "front" | "back") => {
    setUploadingIdSide(side);
    setError("");
    try {
      const optimized = await optimizeImageToWebP(file, {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.82,
      });
      if (side === "front") {
        setIdDocumentFrontUrl(optimized.dataUrl);
      } else {
        setIdDocumentBackUrl(optimized.dataUrl);
      }
    } catch (err) {
      console.error("ID photo optimization error:", err);
      setError("Impossible de compresser l'image de la pièce d'identité.");
    } finally {
      setUploadingIdSide(null);
    }
  };

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
      const currentIdNumber = (userData?.idDocumentNumber || "").trim();

      const newCompany = companyName.trim();
      const newRccm = rccm.trim();
      const newIdNat = idNat.trim();
      const newNif = nif.trim();
      const newIdNumber = idDocumentNumber.trim();

      // Détecter si des champs légaux, fiscaux ou d'identité sensibles ont changé
      const legalFieldsChanged = 
        (newCompany !== currentApprovedCompany) ||
        (newRccm !== currentApprovedRccm) ||
        (newIdNat !== currentApprovedIdNat) ||
        (newNif !== currentApprovedNif) ||
        (newIdNumber !== currentIdNumber) ||
        (idDocumentFrontUrl !== (userData?.idDocumentFrontUrl || "")) ||
        (idDocumentBackUrl !== (userData?.idDocumentBackUrl || ""));

      // 1. Mises à jour directes immédiates en base de données (numéros, pièces d'identité, visuel, contact)
      const immediateUpdateData: any = {
        phone: phoneNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        whatsappPhone: whatsappPhone.trim(),
        payoutPhone: payoutPhone.trim(),
        payoutProvider,
        address: address.trim(),
        logoUrl: logoUrl,
        logo: logoUrl,
        primaryColor: primaryColor,
        idDocumentType,
        idDocumentNumber: newIdNumber,
        nationality: nationality.trim(),
        idDocumentFrontUrl,
        idDocumentBackUrl,
        updatedAt: new Date().toISOString()
      };

      const pendingProfile: any = {
        phone: phoneNumber.trim(),
        whatsappPhone: whatsappPhone.trim(),
        payoutPhone: payoutPhone.trim(),
        payoutProvider,
        primaryColor: primaryColor,
        logoUrl: logoUrl,
        companyName: newCompany,
        rccm: newRccm,
        idNat: newIdNat,
        nif: newNif,
        address: address.trim(),
        idDocumentType,
        idDocumentNumber: newIdNumber,
        nationality: nationality.trim(),
        idDocumentFrontUrl,
        idDocumentBackUrl,
        submittedAt: new Date().toISOString()
      };

      // Enregistrer via l'API sécurisée (avec fallback Firestore direct)
      try {
        const token = await auth.currentUser?.getIdToken();
        await fetch("/api/users/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ...immediateUpdateData,
            companyName: newCompany,
            rccm: newRccm,
            idNat: newIdNat,
            nif: newNif,
          }),
        });
      } catch (apiErr) {
        console.warn("API profile fallback to updateDoc:", apiErr);
      }

      if (legalFieldsChanged || !userData?.profileUpdateStatus) {
        await updateDoc(userRef, {
          ...immediateUpdateData,
          pendingProfile,
          profileUpdateStatus: "PENDING_APPROVAL"
        });

        setSuccess(
          "Vos numéros, coordonnées et pièces d'identité ont été enregistrés dans la base de données ! Vos identifiants légaux sont en cours de validation."
        );
      } else {
        if (!userData?.companyName && newCompany) {
          immediateUpdateData.companyName = newCompany;
        }

        await updateDoc(userRef, immediateUpdateData);
        setSuccess("Vos coordonnées, numéros et pièces d'identité ont été enregistrés avec succès.");
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

              {/* SECTION 2: Coordonnées & Contact (Nom verrouillé + Numéros modifiables) */}
              <div className="bg-[#0B151C]/90 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
                <div className="border-b border-white/10 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <Phone className="text-[#C7D300]" size={20} />
                      <span>Titulaire & Coordonnées de Contact</span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Vous pouvez modifier vos numéros et votre adresse à tout moment. Le nom du titulaire est verrouillé.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[11px] font-bold text-amber-300 self-start">
                    <Lock size={12} /> Nom verrouillé
                  </span>
                </div>

                {/* Nom complet verrouillé */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Nom du titulaire (Non modifiable)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        disabled
                        readOnly
                        value={userData?.displayName || userData?.name || user?.displayName || "Partenaire Rayons"}
                        className="w-full pl-4 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-300 font-bold text-sm cursor-not-allowed opacity-80"
                      />
                      <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      Email du compte (Identifiant)
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        disabled
                        readOnly
                        value={userData?.email || user?.email || ""}
                        className="w-full pl-4 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 font-mono text-sm cursor-not-allowed opacity-80"
                      />
                      <Lock size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Numéro de téléphone principal <span className="text-rose-400">*</span>
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
                      Numéro WhatsApp Commercial
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-emerald-400">
                        <Phone size={18} />
                      </div>
                      <input 
                        type="text" 
                        value={whatsappPhone}
                        onChange={(e) => setWhatsappPhone(e.target.value)}
                        placeholder="Ex: +243 85 234 5678" 
                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm" 
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Opérateur Mobile Money
                    </label>
                    <select
                      value={payoutProvider}
                      onChange={(e) => setPayoutProvider(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm"
                    >
                      <option value="MPESA">Vodacom M-Pesa</option>
                      <option value="ORANGE">Orange Money</option>
                      <option value="AIRTEL">Airtel Money</option>
                      <option value="AFRIMONEY">AfriMoney</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Numéro Mobile Money (Paiements)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#C7D300]">
                        <CreditCard size={18} />
                      </div>
                      <input
                        type="text"
                        value={payoutPhone}
                        onChange={(e) => setPayoutPhone(e.target.value)}
                        placeholder="+243 81/84/89/99..."
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
                        placeholder="Ex: 12 Bd du 30 Juin, Gombe" 
                        className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2B: Identité du Gérant & Pièce d'Identité (Gérée en Base de Données) */}
              <div className="bg-[#0B151C]/90 border border-white/10 rounded-3xl p-6 sm:p-7 shadow-xl space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <IdCard className="text-[#C7D300]" size={22} />
                      <span>Pièce d&apos;Identité & Identification du Fournisseur</span>
                    </h2>
                    <p className="text-xs text-gray-400 mt-1">
                      Ajoutez votre pièce d&apos;identité officielle et son numéro. Ces éléments sont enregistrés et gérés dans la base de données Rayons.net.
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C7D300]/10 border border-[#C7D300]/25 text-[11px] font-bold text-[#C7D300] self-start">
                    <ShieldCheck size={14} /> Dossier KYC Base de données
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Type de pièce d&apos;identité
                    </label>
                    <select
                      value={idDocumentType}
                      onChange={(e) => setIdDocumentType(e.target.value)}
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm"
                    >
                      <option value="CARTE_ELECTEUR">Carte d&apos;Électeur (RDC)</option>
                      <option value="PASSEPORT">Passeport Biométrique</option>
                      <option value="PERMIS_CONDUIRE">Permis de Conduire</option>
                      <option value="CARTE_IDENTITE">Carte d&apos;Identité Nationale</option>
                      <option value="AUTRE">Autre Document Officiel</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Numéro de la pièce d&apos;identité
                    </label>
                    <input
                      type="text"
                      value={idDocumentNumber}
                      onChange={(e) => setIdDocumentNumber(e.target.value)}
                      placeholder="Ex: NN 30192837465"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm font-mono uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                      Nationalité
                    </label>
                    <input
                      type="text"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      placeholder="Congolaise (RDC)"
                      className="w-full px-4 py-2.5 bg-black/40 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-white text-sm"
                    />
                  </div>
                </div>

                {/* Upload Recto & Verso */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Photo / Scan Pièce — RECTO
                      </span>
                      {idDocumentFrontUrl && (
                        <button
                          type="button"
                          onClick={() => setIdDocumentFrontUrl("")}
                          className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={13} /> Supprimer
                        </button>
                      )}
                    </div>

                    {idDocumentFrontUrl ? (
                      <div className="relative h-36 w-full rounded-xl overflow-hidden bg-black/60 border border-white/15">
                        <img
                          src={idDocumentFrontUrl}
                          alt="Pièce d'identité Recto"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-white/15 hover:border-[#C7D300]/50 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-all p-4 text-center">
                        <Upload size={22} className="text-[#C7D300] mb-2" />
                        <span className="text-xs font-bold text-gray-200">
                          {uploadingIdSide === "front" ? "Compression WebP..." : "Cliquez pour ajouter le Recto"}
                        </span>
                        <span className="text-[11px] text-gray-400 mt-0.5">
                          Image compressée et stockée en base de données
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadIdPhoto(f, "front");
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        Photo / Scan Pièce — VERSO
                      </span>
                      {idDocumentBackUrl && (
                        <button
                          type="button"
                          onClick={() => setIdDocumentBackUrl("")}
                          className="text-xs text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 size={13} /> Supprimer
                        </button>
                      )}
                    </div>

                    {idDocumentBackUrl ? (
                      <div className="relative h-36 w-full rounded-xl overflow-hidden bg-black/60 border border-white/15">
                        <img
                          src={idDocumentBackUrl}
                          alt="Pièce d'identité Verso"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center h-36 rounded-xl border-2 border-dashed border-white/15 hover:border-[#C7D300]/50 bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer transition-all p-4 text-center">
                        <Upload size={22} className="text-[#C7D300] mb-2" />
                        <span className="text-xs font-bold text-gray-200">
                          {uploadingIdSide === "back" ? "Compression WebP..." : "Cliquez pour ajouter le Verso"}
                        </span>
                        <span className="text-[11px] text-gray-400 mt-0.5">
                          Optionnel pour un passeport
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadIdPhoto(f, "back");
                          }}
                        />
                      </label>
                    )}
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
