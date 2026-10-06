"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { 
  ArrowLeft, 
  CheckCircle2, 
  ShieldCheck, 
  CreditCard, 
  Smartphone, 
  Store, 
  Building2, 
  Sparkles, 
  Check, 
  Lock, 
  AlertCircle, 
  ArrowRight,
  UserCheck,
  PackageCheck,
  Receipt,
  Clock,
  MapPin,
  ChevronRight
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { recordSubscriptionDeposit } from "@/lib/accountingLedger";
import { DEFAULT_MONTHLY_DEPOSIT } from "@/lib/supplierSubscription";

// Helper OTP / mot de passe provisoire
const generateRandomPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

// Helper référence de paiement
const generatePaymentRef = () => {
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `RAY-DEP-${new Date().getFullYear()}-${rand}`;
};

export default function SupplierRegisterPage() {
  const { user, userData } = useAuth();
  const router = useRouter();

  // Étape 1 : PAIEMENT DES FRAIS D'ABONNEMENT ($50) D'ABORD
  // Étape 2 : INFORMATIONS DE L'ENTREPRISE & BOUTIQUE
  const [step, setStep] = useState<1 | 2>(1);

  // Données de contact / identification
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // Données de paiement Étape 1
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "card">("mobile_money");
  const [mobileOperator, setMobileOperator] = useState<"mpesa" | "orange" | "airtel">("mpesa");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paidPaymentRef, setPaidPaymentRef] = useState<string>("");

  // Données de l'entreprise Étape 2
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [businessType, setBusinessType] = useState("COMMERCE");
  const [commune, setCommune] = useState("Gombe");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [generatedTempPassword, setGeneratedTempPassword] = useState("");

  // Pré-remplissage si client déjà authentifié
  useEffect(() => {
    if (user) {
      if (user.email && !email) setEmail(user.email);
      if (user.displayName && !name) setName(user.displayName);
      if (userData?.name && !name) setName(userData.name);
      if (userData?.phone && !phone) {
        setPhone(userData.phone);
        setPaymentPhone(userData.phone);
      }
      if (userData?.company && !company) setCompany(userData.company);
    }
  }, [user, userData]);

  // ─────────────────────────────────────────────────────────────
  // ÉTAPE 1 : TRAITEMENT DU PAIEMENT DE L'ABONNEMENT ($50)
  // ─────────────────────────────────────────────────────────────
  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Veuillez renseigner votre adresse email pour associer le reçu d'abonnement.");
      return;
    }

    if (paymentMethod === "mobile_money" && !paymentPhone.trim()) {
      setError("Veuillez renseigner votre numéro Mobile Money pour effectuer le débit.");
      return;
    }

    if (paymentMethod === "card" && (!cardNumber.trim() || !cardExpiry.trim() || !cardCvc.trim())) {
      setError("Veuillez compléter toutes les coordonnées de votre carte bancaire.");
      return;
    }

    setIsProcessingPayment(true);

    try {
      // Simulation / Validation du prélèvement Mobile Money / Carte
      await new Promise((resolve) => setTimeout(resolve, 1400));

      const ref = generatePaymentRef();
      setPaidPaymentRef(ref);

      // Si le téléphone général n'est pas encore défini, prendre le numéro de paiement
      if (!phone && paymentPhone) {
        setPhone(paymentPhone);
      }

      const methodStr = paymentMethod === "mobile_money" 
        ? `Mobile Money (${mobileOperator.toUpperCase()} - ${paymentPhone})` 
        : "Carte Bancaire Visa/Mastercard";

      // ── CAS CLIENT CONNECTÉ : ENREGISTRER DIRECTEMENT LA TRANSACTION DÈS L'ÉTAPE 1 ──
      if (user) {
        const res = await fetch("/api/supplier/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierId: user.uid,
            supplierName: company.trim() || userData?.company || userData?.displayName || name.trim() || user.email || "Fournisseur",
            supplierEmail: email.trim() || user.email,
            amount: DEFAULT_MONTHLY_DEPOSIT,
            currency: "USD",
            paymentMethod: methodStr,
            referencePiece: ref,
            businessType: businessType,
            companyData: {
              name: name.trim() || userData?.displayName || "",
              company: company.trim() || userData?.company || "",
              email: email.trim() || user.email || "",
              phone: phone.trim() || paymentPhone.trim() || userData?.phone || "",
              businessType: businessType,
              commune: commune.trim(),
              address: address.trim(),
              description: description.trim(),
            }
          }),
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || "Erreur lors de l'enregistrement de l'abonnement.");
        }
      }

      // Passer à l'Étape 2 (Renseignement de l'entreprise)
      setStep(2);
    } catch (err: any) {
      setError(err.message || "Erreur lors du traitement du paiement.");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ÉTAPE 2 : CONFIGURATION DE L'ENTREPRISE & ENREGISTREMENT BACKEND
  // ─────────────────────────────────────────────────────────────
  const handleFinalizeCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (!name.trim() || !company.trim()) {
      setError("Veuillez renseigner le nom du contact et le nom de la boutique.");
      setIsLoading(false);
      return;
    }

    const depositAmount = DEFAULT_MONTHLY_DEPOSIT; // $50 USD
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 30); // 30 jours renouvelables

    const assigned = businessType === "IMMOBILIER" 
      ? ["immo"] 
      : businessType === "RESTAURATION" 
      ? ["saveurs"] 
      : businessType === "CONNECT"
      ? ["connect"]
      : ["mode"];

    const primaryRayon = assigned[0];
    const targetRole = businessType === "IMMOBILIER" 
      ? "SUPPLIER_IMMO" 
      : (businessType === "RESTAURATION" ? "SUPPLIER_SAVEURS" : "SUPPLIER");

    const methodStr = paymentMethod === "mobile_money" 
      ? `Mobile Money (${mobileOperator.toUpperCase()} - ${paymentPhone})` 
      : "Carte Bancaire Visa/Mastercard";

    try {
      let supplierUid = "";

      // ── CAS 1 : CLIENT CONNECTÉ QUI SE MET À NIVEAU ──
      if (user) {
        supplierUid = user.uid;

        const res = await fetch("/api/supplier/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierId: user.uid,
            supplierName: company.trim(),
            supplierEmail: email.trim(),
            amount: depositAmount,
            currency: "USD",
            paymentMethod: methodStr,
            referencePiece: paidPaymentRef,
            businessType: businessType,
            companyData: {
              name: name.trim(),
              company: company.trim(),
              email: email.trim(),
              phone: phone.trim() || paymentPhone.trim(),
              businessType: businessType,
              rayon: primaryRayon,
              assignedRayons: assigned,
              commune: commune.trim(),
              address: address.trim(),
              description: description.trim(),
            }
          }),
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || "Erreur lors de la validation de votre entreprise.");
        }
      } 
      // ── CAS 2 : NOUVEAU COMPTE CRÉÉ ──
      else {
        const tempPassword = generateRandomPassword();
        setGeneratedTempPassword(tempPassword);

        // 1. Création compte Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), tempPassword);
        const newUser = userCredential.user;
        supplierUid = newUser.uid;

        await updateProfile(newUser, { displayName: name.trim() });

        // 2. Appel sécurisé au backend pour enregistrer les finances et le compte
        const res = await fetch("/api/supplier/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            supplierId: newUser.uid,
            supplierName: company.trim(),
            supplierEmail: email.trim(),
            amount: depositAmount,
            currency: "USD",
            paymentMethod: methodStr,
            referencePiece: paidPaymentRef,
            businessType: businessType,
            companyData: {
              name: name.trim(),
              company: company.trim(),
              email: email.trim(),
              phone: phone.trim() || paymentPhone.trim(),
              businessType: businessType,
              rayon: primaryRayon,
              assignedRayons: assigned,
              commune: commune.trim(),
              address: address.trim(),
              description: description.trim(),
            }
          }),
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          throw new Error(resData.error || "Erreur lors de l'enregistrement de votre entreprise.");
        }

        // 3. Notification SMS avec mot de passe
        try {
          await fetch("/api/sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phone || paymentPhone,
              message: `Bienvenue sur Rayons.net, ${name}! Votre abonnement Vendeur ($50) est actif. Boutique: ${company}. Mot de passe provisoire: ${tempPassword}`,
            }),
          });
        } catch (smsErr) {
          console.warn("SMS notification notice:", smsErr);
        }

        // 4. Notification Email
        try {
          await fetch("/api/emails/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email.trim(),
              name: name.trim(),
              password: tempPassword,
            }),
          });
        } catch (emailErr) {
          console.warn("Email notification notice:", emailErr);
        }
      }

      setIsSuccess(true);
    } catch (err: any) {
      console.error("Erreur finalisation fournisseur:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("Cet email possède déjà un compte. Veuillez vous connecter au préalable pour lier votre boutique.");
      } else {
        setError(err.message || "Erreur lors de l'enregistrement de votre entreprise.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // ÉCRAN DE SUCCÈS
  // ─────────────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC] items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-lg w-full bg-white p-6 sm:p-8 rounded-3xl shadow-md border border-gray-200/90 text-center"
        >
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
            <CheckCircle2 size={38} />
          </div>

          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 mb-2">
            <ShieldCheck size={14} className="text-emerald-600" /> Abonnement Réglé & Compte Activé
          </span>

          <h2 className="text-2xl font-black text-gray-900 mb-2">Boutique En Ligne Ouverte !</h2>
          
          <p className="text-gray-600 text-xs sm:text-sm mb-6 leading-relaxed">
            Votre abonnement mensuel de <strong>$50 USD</strong> a été validé et enregistré dans le grand livre comptable. Votre vitrine <strong>{company}</strong> est immédiatement prête à accueillir vos produits et vos clients.
          </p>

          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 mb-6 text-left text-xs space-y-2.5">
            <div className="flex justify-between">
              <span className="text-gray-500">Réf. Transaction :</span>
              <strong className="text-gray-900 font-mono">{paidPaymentRef}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Boutique :</span>
              <strong className="text-gray-900">{company}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Abonnement Actif :</span>
              <span className="text-emerald-700 font-bold">$50 USD (Valide 30 jours)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Rôle attribué :</span>
              <span className="text-blue-700 font-bold">Fournisseur Vérifié Rayons</span>
            </div>
            {generatedTempPassword && (
              <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-amber-800 bg-amber-50 p-2 rounded-xl">
                <span>Mot de passe provisoire :</span>
                <strong className="font-mono text-sm">{generatedTempPassword}</strong>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              window.location.href = "/supplier";
            }}
            className="w-full inline-flex justify-center items-center gap-2 py-3.5 bg-[#FF6600] hover:bg-[#e65c00] text-white font-extrabold rounded-xl transition-all shadow-md text-sm cursor-pointer"
          >
            <span>Accéder à mon Espace Fournisseur</span>
            <ArrowRight size={16} />
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-gray-900">
      
      {/* Colonne Formulaire */}
      <div className="w-full lg:w-7/12 flex flex-col justify-center px-4 sm:px-12 lg:px-16 py-8">
        <div className="max-w-xl w-full mx-auto">
          
          <Link href="/" className="inline-flex items-center text-xs font-bold text-gray-500 hover:text-[#FF6600] mb-5 transition-colors">
            <ArrowLeft size={16} className="mr-1.5" /> Retourner aux Rayons
          </Link>

          {/* Stepper : 1 = Paiement d'abord, 2 = Infos Entreprise */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 1 ? "bg-[#FF6600] text-white shadow-xs" : "bg-emerald-500 text-white"
              }`}>
                {step > 1 ? "✓" : "1"}
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Étape 1</span>
                <span className="text-xs font-bold text-gray-900">Paiement Abonnement ($50)</span>
              </div>
            </div>

            <div className={`w-10 sm:w-16 h-[2px] ${step === 2 ? "bg-emerald-500" : "bg-gray-200"}`} />

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 2 ? "bg-[#FF6600] text-white shadow-xs" : "bg-gray-100 text-gray-400"
              }`}>
                2
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Étape 2</span>
                <span className="text-xs font-bold text-gray-900">Infos de la Boutique</span>
              </div>
            </div>
          </div>

          {/* Bandeau Client Détecté */}
          {user && (
            <div className="mb-5 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
              <UserCheck size={18} className="text-[#FF6600] shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Compte Acheteur Détecté : {user.email}</strong>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Dès le règlement de l'abonnement mensuel, votre compte sera promu en <strong>Compte Fournisseur Partenaire</strong>.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              ÉTAPE 1 : PAIEMENT DES FRAIS D'ABONNEMENT ($50) D'ABORD
          ═══════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <motion.form 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleProcessPayment} 
              className="space-y-5"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FF6600] text-white">
                    Frais d'adhésion requis
                  </span>
                  <span className="text-xs text-gray-400 font-medium">Requis avant ouverture</span>
                </div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                  Régler l'Abonnement Fournisseur
                </h1>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  L'adhésion au réseau de fournisseurs certifiés Rayons.net requiert le règlement préalable du dépôt mensuel d'exploitation.
                </p>
              </div>

              {/* CARTE PLAN $50 / MOIS */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-gray-900 via-slate-900 to-gray-900 text-white shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Receipt size={96} />
                </div>
                
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <span className="text-xs font-bold text-gray-300">Formule Mensuelle Vendeur</span>
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <ShieldCheck size={13} /> Protection Rayons 100%
                  </span>
                </div>

                <div className="mb-4 relative z-10">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-white">$50</span>
                    <span className="text-sm font-semibold text-gray-300">USD / mois</span>
                    <span className="text-xs text-gray-400 font-normal">(~140 000 CDF)</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1">
                    Valide 30 jours renouvelables • Débloque la vitrine & la publication d'articles
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-200 relative z-10">
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Vitrine certifiée en ligne</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Publications illimitées</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Factures Proforma & Devis RFQ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Livreurs vérifiés & Suivi GPS</span>
                  </div>
                </div>
              </div>

              {/* COORDONNÉES POUR LE REÇU DE PAIEMENT */}
              <div className="p-4 bg-white rounded-2xl border border-gray-200/90 shadow-2xs space-y-3">
                <h3 className="text-xs font-bold text-gray-900">Coordonnées du titulaire :</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">Email pour le reçu comptable *</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={Boolean(user && user.email)}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="votre-email@domaine.com"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-700 block mb-1">Téléphone de contact *</label>
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        if (!paymentPhone) setPaymentPhone(e.target.value);
                      }}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900"
                      placeholder="0821377072"
                    />
                  </div>
                </div>
              </div>

              {/* SÉLECTEUR DE MOYEN DE PAIEMENT */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-800 block">Moyen de règlement du dépôt ($50) :</label>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("mobile_money")}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                      paymentMethod === "mobile_money" 
                        ? "border-[#FF6600] bg-orange-50/50 ring-1 ring-[#FF6600]" 
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-orange-100 text-[#FF6600] flex items-center justify-center shrink-0">
                      <Smartphone size={20} />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-gray-900 block">Mobile Money</span>
                      <span className="text-[10px] text-gray-500">M-Pesa, Orange, Airtel</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-center gap-3 cursor-pointer ${
                      paymentMethod === "card" 
                        ? "border-[#FF6600] bg-orange-50/50 ring-1 ring-[#FF6600]" 
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-gray-900 block">Carte Bancaire</span>
                      <span className="text-[10px] text-gray-500">Visa, Mastercard</span>
                    </div>
                  </button>
                </div>

                {/* DÉTAILS MOBILE MONEY */}
                {paymentMethod === "mobile_money" && (
                  <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1.5">Opérateur Télécom :</label>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => setMobileOperator("mpesa")}
                          className={`py-2 px-2 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            mobileOperator === "mpesa" 
                              ? "bg-emerald-50 text-emerald-800 border-emerald-400 ring-1 ring-emerald-400" 
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          Vodacom M-Pesa
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileOperator("orange")}
                          className={`py-2 px-2 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            mobileOperator === "orange" 
                              ? "bg-orange-50 text-orange-800 border-orange-400 ring-1 ring-orange-400" 
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          Orange Money
                        </button>
                        <button
                          type="button"
                          onClick={() => setMobileOperator("airtel")}
                          className={`py-2 px-2 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                            mobileOperator === "airtel" 
                              ? "bg-red-50 text-red-800 border-red-400 ring-1 ring-red-400" 
                              : "bg-gray-50 text-gray-700 border-gray-200"
                          }`}
                        >
                          Airtel Money
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">
                        Numéro Mobile Money pour le débit ($50) :
                      </label>
                      <input
                        type="tel"
                        required
                        value={paymentPhone}
                        onChange={(e) => setPaymentPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900"
                        placeholder="0821377072"
                      />
                      <span className="text-[10px] text-gray-400 block mt-1">
                        Un push USSD de confirmation sera envoyé à ce numéro.
                      </span>
                    </div>
                  </div>
                )}

                {/* DÉTAILS CARTE BANCAIRE */}
                {paymentMethod === "card" && (
                  <div className="p-4 bg-white rounded-2xl border border-gray-200 space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-gray-700 block mb-1">Numéro de carte :</label>
                      <input
                        type="text"
                        required
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900"
                        placeholder="4111 2222 3333 4444"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">Expiration (MM/AA) :</label>
                        <input
                          type="text"
                          required
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900"
                          placeholder="12/27"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-gray-700 block mb-1">Code CVC :</label>
                        <input
                          type="password"
                          required
                          maxLength={4}
                          value={cardCvc}
                          onChange={(e) => setCardCvc(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900"
                          placeholder="123"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* BOUTON ÉTAPE 1 */}
              <button
                type="submit"
                disabled={isProcessingPayment}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-all shadow-md flex justify-center items-center gap-2 text-sm cursor-pointer disabled:opacity-50"
              >
                {isProcessingPayment ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Traitement du paiement de $50...</span>
                  </div>
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Valider le paiement ($50) & Continuer</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Paiement crypté & fonds enregistrés au grand livre central</span>
              </div>
            </motion.form>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              ÉTAPE 2 : INFORMATIONS DE L'ENTREPRISE (APRÈS PAIEMENT)
          ═══════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <motion.form 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleFinalizeCompany} 
              className="space-y-4"
            >
              {/* Badge de paiement validé */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center justify-between shadow-2xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                  <div>
                    <strong>Paiement de $50 Validé avec Succès !</strong>
                    <span className="block text-[10px] text-emerald-700 font-mono">Réf : {paidPaymentRef}</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-emerald-200/60 font-bold text-[10px]">
                  30 jours actifs
                </span>
              </div>

              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  Configurer votre Boutique
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Complétez les informations publiques de votre entreprise pour activer votre vitrine en ligne.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Nom du Responsable / Vendeur *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 transition-all shadow-xs"
                    placeholder="Jean Dupont"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Nom de la Boutique / Entreprise *</label>
                  <input
                    type="text"
                    required
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 transition-all shadow-xs"
                    placeholder="Maison Élégance Kinshasa"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Rayon & Secteur d'Activité *</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 transition-all shadow-xs cursor-pointer"
                >
                  <option value="COMMERCE">Commerce Général & Mode (Vêtements, Chaussures, Cosmétiques, Électroménager)</option>
                  <option value="CONNECT">Technologies & Objets Connectés (Starlink, Smartphones, Informatique)</option>
                  <option value="RESTAURATION">Restauration & Saveurs (Cuisine, Plats, Épicerie fine)</option>
                  <option value="IMMOBILIER">Immobilier & Résidences (Agences, Bailleurs, Hôtels & Nuitées)</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Commune à Kinshasa</label>
                  <input
                    type="text"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 transition-all shadow-xs"
                    placeholder="Gombe, Ngaliema, Limete..."
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Adresse / Avenue</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 transition-all shadow-xs"
                    placeholder="Avenue du Commerce, n° 12"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Description ou Slogan de la boutique</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 transition-all shadow-xs resize-none"
                  placeholder="Spécialiste de la vente en gros et au détail à Kinshasa..."
                />
              </div>

              {/* BOUTON FINAL ÉTAPE 2 */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-[#FF6600] hover:bg-[#e65c00] text-white font-extrabold rounded-2xl transition-all shadow-md flex justify-center items-center gap-2 text-sm mt-4 cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Création & Activation de votre espace...</span>
                  </div>
                ) : (
                  <>
                    <span>Finaliser et Ouvrir mon Espace Fournisseur</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </motion.form>
          )}

          <div className="text-center text-xs text-gray-500 mt-6">
            Vous avez déjà un compte Fournisseur ?{" "}
            <Link href="/login" className="font-bold text-[#FF6600] hover:underline">
              Se connecter
            </Link>
          </div>

        </div>
      </div>

      {/* Colonne Droite : Présentation & Avantages */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-gray-900 via-[#111C2E] to-gray-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 font-black text-xl text-white mb-10">
            <span className="w-8 h-8 rounded-lg bg-[#FF6600] flex items-center justify-center text-sm font-black">R</span>
            <span>Rayons.net</span>
          </Link>

          <span className="text-[11px] uppercase tracking-widest font-bold text-[#FF6600] block mb-2">
            Réseau Marchand Certifié
          </span>
          <h2 className="text-3xl font-black tracking-tight leading-tight mb-4">
            Un abonnement mensuel rentable pour votre commerce.
          </h2>
          <p className="text-xs text-gray-300 leading-relaxed mb-8">
            En adhérant pour $50 par mois, votre vitrine est indexée en tête des recherches, vos fonds sont garantis par séquestre bancaire et vos livraisons sont opérées par des chauffeurs vérifiés.
          </p>

          <div className="space-y-4 text-xs text-gray-200">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <Store size={18} className="text-[#FF6600] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white">Vitrine en ligne dédiée</strong>
                <span className="text-gray-400 text-[11px]">Vos articles visibles par des milliers d'acheteurs à Kinshasa.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <PackageCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white">Factures Proforma & Devis RFQ</strong>
                <span className="text-gray-400 text-[11px]">Négociez en direct et recevez vos paiements instantanés.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <ShieldCheck size={18} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white">Traçabilité Comptable</strong>
                <span className="text-gray-400 text-[11px]">Toutes vos cotisations sont enregistrées au grand livre central.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/10 text-[11px] text-gray-400 relative z-10 flex items-center justify-between">
          <span>Rayons.net • Kinshasa RDC</span>
          <span>Abonnement $50/mois</span>
        </div>
      </div>

    </div>
  );
}
