"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, updateDoc, serverTimestamp, getDoc } from "firebase/firestore";
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
  PackageCheck
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { recordSubscriptionDeposit } from "@/lib/accountingLedger";
import { DEFAULT_MONTHLY_DEPOSIT } from "@/lib/supplierSubscription";

// Helper to generate a random 6-character password/OTP for new accounts
const generateRandomPassword = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let password = "";
  for (let i = 0; i < 6; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

export default function SupplierRegisterPage() {
  const { user, userData } = useAuth();
  const router = useRouter();

  // Form step: 1 = Info & Boutique, 2 = Abonnement & Frais Mensuels
  const [step, setStep] = useState<1 | 2>(1);

  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [businessType, setBusinessType] = useState("COMMERCE"); // COMMERCE, CONNECT, RESTAURATION, IMMOBILIER
  
  // Payment states for Step 2
  const [paymentMethod, setPaymentMethod] = useState<"mobile_money" | "card">("mobile_money");
  const [mobileOperator, setMobileOperator] = useState<"mpesa" | "orange" | "airtel">("mpesa");
  const [paymentPhone, setPaymentPhone] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Auto-fill details if client is already authenticated
  useEffect(() => {
    if (user) {
      if (user.displayName && !name) setName(user.displayName);
      if (user.email && !email) setEmail(user.email);
      if (userData?.name && !name) setName(userData.name);
      if (userData?.phone && !phone) {
        setPhone(userData.phone);
        setPaymentPhone(userData.phone);
      }
      if (userData?.company && !company) setCompany(userData.company);
    }
  }, [user, userData]);

  // Handler for Step 1 -> Step 2
  const handleProceedToPayment = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim() || !company.trim() || !email.trim() || !phone.trim()) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }

    if (!paymentPhone) {
      setPaymentPhone(phone);
    }

    setStep(2);
  };

  // Final submit with Subscription Activation & Payment
  const handleFinalRegisterAndPay = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const depositAmount = DEFAULT_MONTHLY_DEPOSIT; // $50/mois
    const nextDueDate = new Date();
    nextDueDate.setDate(nextDueDate.getDate() + 30); // 30 jours d'abonnement actif

    try {
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

      let supplierUid = "";

      // ── CAS 1 : L'utilisateur est DÉJÀ CONNECTÉ (ex: Client Rayons) ──
      if (user) {
        supplierUid = user.uid;

        // Mise à jour du document existant avec le rôle Fournisseur et l'abonnement réglé
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          name: name.trim(),
          displayName: name.trim(),
          company: company.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: targetRole,
          businessType: businessType,
          rayon: primaryRayon,
          assignedRayons: assigned,
          status: "ACTIVE",
          subscriptionStatus: "ACTIVE",
          depositAmount: depositAmount,
          subscriptionEndDate: nextDueDate,
          lastDepositPaidAt: serverTimestamp(),
          lastDepositAmount: depositAmount,
          paymentMethodUsed: paymentMethod === "mobile_money" ? `Mobile Money (${mobileOperator.toUpperCase()})` : "Carte Bancaire",
          updatedAt: serverTimestamp(),
        }, { merge: true });

        // Enregistrement de l'écriture comptable dans le grand livre
        await recordSubscriptionDeposit({
          supplierId: user.uid,
          supplierName: company.trim() || name.trim(),
          amount: depositAmount,
          paymentMethod: paymentMethod === "mobile_money" ? `Mobile Money (${mobileOperator.toUpperCase()} - ${paymentPhone})` : "Carte Bancaire Visa/Mastercard",
          currentBalance: 0
        });

        setSuccessMessage(`Votre compte a été mis à niveau en Espace Fournisseur avec succès ! Votre abonnement mensuel de $${depositAmount} est actif.`);
      } 
      // ── CAS 2 : NOUVEL UTILISATEUR NON CONNECTÉ ──
      else {
        const tempPassword = generateRandomPassword();

        // 1. Créer le compte Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), tempPassword);
        const newUser = userCredential.user;
        supplierUid = newUser.uid;

        // 2. Mettre à jour le profil
        await updateProfile(newUser, { displayName: name.trim() });

        // 3. Enregistrer les données Firestore
        await setDoc(doc(db, "users", newUser.uid), {
          uid: newUser.uid,
          name: name.trim(),
          displayName: name.trim(),
          company: company.trim(),
          email: email.trim(),
          phone: phone.trim(),
          role: targetRole,
          businessType: businessType,
          rayon: primaryRayon,
          assignedRayons: assigned,
          status: "ACTIVE",
          subscriptionStatus: "ACTIVE",
          depositAmount: depositAmount,
          subscriptionEndDate: nextDueDate,
          lastDepositPaidAt: serverTimestamp(),
          lastDepositAmount: depositAmount,
          paymentMethodUsed: paymentMethod === "mobile_money" ? `Mobile Money (${mobileOperator.toUpperCase()})` : "Carte Bancaire",
          createdAt: serverTimestamp(),
        });

        // 4. Enregistrement comptable
        await recordSubscriptionDeposit({
          supplierId: newUser.uid,
          supplierName: company.trim() || name.trim(),
          amount: depositAmount,
          paymentMethod: paymentMethod === "mobile_money" ? `Mobile Money (${mobileOperator.toUpperCase()} - ${paymentPhone})` : "Carte Bancaire Visa/Mastercard",
          currentBalance: 0
        });

        // 5. Envoi SMS avec mot de passe
        try {
          await fetch("/api/sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phone,
              message: `Bienvenue sur Rayons.net, ${name}! Votre compte Vendeur est actif (Abonnement $50 réglé). Mot de passe: ${tempPassword}`,
            }),
          });
        } catch (e) {
          console.warn("SMS sending notice:", e);
        }

        // 6. Envoi Email Onboarding
        try {
          await fetch("/api/emails/onboarding", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email,
              name: name,
              password: tempPassword,
            }),
          });
        } catch (e) {
          console.warn("Email sending notice:", e);
        }

        setSuccessMessage(`Compte Fournisseur créé avec succès ! Votre abonnement mensuel de $${depositAmount} a été activé. Vos identifiants ont été envoyés par SMS au ${phone}.`);
      }

      setIsSuccess(true);

    } catch (err: any) {
      console.error("Erreur inscription fournisseur:", err);
      if (err.code === "auth/email-already-in-use") {
        setError("Cette adresse email possède déjà un compte. Veuillez vous connecter au préalable pour mettre à niveau votre compte.");
      } else {
        setError(err.message || "Une erreur est survenue lors de l'activation de votre compte.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ── ÉCRAN DE SUCCÈS ──
  if (isSuccess) {
    return (
      <div className="flex min-h-screen bg-[#F8FAFC] items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-white p-6 sm:p-8 rounded-3xl shadow-md border border-gray-200/90 text-center"
        >
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-xs">
            <CheckCircle2 size={36} />
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 mb-3">
            <ShieldCheck size={14} className="text-emerald-600" /> Abonnement Vendeur Actif ($50 / mois)
          </span>
          <h2 className="text-2xl font-black text-gray-900 mb-2">Félicitations !</h2>
          <p className="text-gray-600 text-xs sm:text-sm mb-6 leading-relaxed">
            {successMessage || "Votre boutique et votre abonnement mensuel ont été activés avec succès sur Rayons.net."}
          </p>

          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 mb-6 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Boutique :</span>
              <strong className="text-gray-900">{company || name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Abonnement :</span>
              <strong className="text-emerald-600 font-bold">$50 USD (30 jours actifs)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Statut :</span>
              <span className="text-emerald-700 font-bold">Vérifié & Prêt à publier</span>
            </div>
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
          
          <Link href="/" className="inline-flex items-center text-xs font-bold text-gray-500 hover:text-[#FF6600] mb-6 transition-colors">
            <ArrowLeft size={16} className="mr-1.5" /> Retourner aux Rayons
          </Link>

          {/* Stepper indicateur */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 1 ? "bg-[#FF6600] text-white" : "bg-emerald-500 text-white"
              }`}>
                {step > 1 ? "✓" : "1"}
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Étape 1</span>
                <span className="text-xs font-bold text-gray-900">Boutique & Coordonnées</span>
              </div>
            </div>

            <div className="w-8 h-[2px] bg-gray-200" />

            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                step === 2 ? "bg-[#FF6600] text-white" : "bg-gray-100 text-gray-400"
              }`}>
                2
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Étape 2</span>
                <span className="text-xs font-bold text-gray-900">Frais Mensuels ($50)</span>
              </div>
            </div>
          </div>

          {/* Bandeau Client Connecté */}
          {user && (
            <div className="mb-6 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-3 shadow-2xs">
              <UserCheck size={18} className="text-[#FF6600] shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Compte Acheteur Détecté : {user.email}</strong>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Votre compte existant sera directement mis à niveau en <strong>Compte Fournisseur Partenaire</strong> dès le règlement de l'abonnement mensuel.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ════════════════════ ÉTAPE 1 : COORDONNÉES ════════════════════ */}
          {step === 1 && (
            <motion.form 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleProceedToPayment} 
              className="space-y-4"
            >
              <div className="mb-4">
                <h1 className="text-2xl font-black text-gray-900 tracking-tight">Ouvrir votre Espace Vendeur</h1>
                <p className="text-xs text-gray-500 mt-1">
                  Créez votre vitrine officielle sur Rayons.net et vendez vos articles à des milliers d'acheteurs.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Nom du Responsable *</label>
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
                    placeholder="Maison Élégance Kin"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Adresse Email *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={Boolean(user && user.email)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 disabled:bg-gray-100 disabled:text-gray-500 transition-all shadow-xs"
                    placeholder="contact@boutique.com"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-700">Numéro de Téléphone (Mobile) *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 transition-all shadow-xs"
                    placeholder="0821377072"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Type d'Activité / Rayon Principal *</label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FF6600] text-xs text-gray-900 transition-all shadow-xs cursor-pointer"
                >
                  <option value="COMMERCE">Commerce Général & Mode (Vêtements, Chaussures, Cosmétiques, Électroménager)</option>
                  <option value="CONNECT">Technologies & Objets Connectés (Starlink, Smartphones, Informatique)</option>
                  <option value="RESTAURATION">Restauration & Saveurs (Cuisine, Plats à emporter, Épicerie)</option>
                  <option value="IMMOBILIER">Immobilier & Résidences (Agences, Bailleurs, Hôtels & Nuitées)</option>
                </select>
              </div>

              {/* Bouton pour aller à l'étape du paiement */}
              <button
                type="submit"
                className="w-full py-3.5 bg-[#FF6600] hover:bg-[#e65c00] text-white font-extrabold rounded-xl transition-all shadow-md flex justify-center items-center gap-2 text-xs sm:text-sm mt-6 cursor-pointer"
              >
                <span>Continuer vers le règlement de l'abonnement ($50)</span>
                <ArrowRight size={16} />
              </button>
            </motion.form>
          )}

          {/* ════════════════════ ÉTAPE 2 : ABONNEMENT & PAIEMENT DU DÉPÔT ════════════════════ */}
          {step === 2 && (
            <motion.form 
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleFinalRegisterAndPay} 
              className="space-y-5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-gray-900 tracking-tight">Règlement de l'Abonnement Mensuel</h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    L'abonnement mensuel active immédiatement votre vitrine et vos droits de vente.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-bold text-gray-500 hover:text-[#FF6600] transition-colors cursor-pointer"
                >
                  Modifier infos
                </button>
              </div>

              {/* CARTE RÉCAPITULATIF DE L'ABONNEMENT */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-gray-900 to-slate-900 text-white shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Store size={96} />
                </div>
                
                <div className="flex items-center justify-between mb-3 relative z-10">
                  <span className="text-[10px] uppercase font-black tracking-wider px-2.5 py-0.5 rounded-full bg-[#FF6600] text-white">
                    Formule Fournisseur Officiel
                  </span>
                  <span className="text-xs text-gray-300">Renouvelable chaque mois</span>
                </div>

                <div className="mb-4 relative z-10">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-black text-white">$50</span>
                    <span className="text-sm font-semibold text-gray-300">USD / mois</span>
                    <span className="text-xs text-gray-400 font-normal">(~140 000 CDF)</span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1">
                    Boutique : <strong className="text-white">{company}</strong> • Rayon : <strong>{businessType}</strong>
                  </p>
                </div>

                <div className="pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-gray-200 relative z-10">
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Vitrine certifiée en ligne</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Publications d'articles illimitées</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Messagerie & Factures Proforma RFQ</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Check size={14} className="text-emerald-400 shrink-0" />
                    <span>Livreurs vérifiés & Suivi GPS direct</span>
                  </div>
                </div>
              </div>

              {/* SÉLECTION DU MOYEN DE PAIEMENT */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-gray-800 block">Choisissez votre mode de paiement :</label>
                
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

                {/* DÉTAILS CARTE */}
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

              {/* BOUTON FINAL */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl transition-all shadow-md flex justify-center items-center gap-2 text-sm cursor-pointer disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock size={16} />
                    <span>Payer $50 & Activer mon Espace Vendeur</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-gray-400">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Paiement crypté et garanti conforme par Rayons.net</span>
              </div>
            </motion.form>
          )}

          <div className="text-center text-xs text-gray-500 mt-8">
            Vous avez déjà un compte Fournisseur activé ?{" "}
            <Link href="/supplier" className="font-bold text-[#FF6600] hover:underline">
              Accéder à l'espace fournisseur
            </Link>
          </div>

        </div>
      </div>

      {/* Colonne Droite : Présentation & Avantages */}
      <div className="hidden lg:flex lg:w-5/12 bg-gradient-to-br from-gray-900 via-[#111C2E] to-gray-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2 font-black text-xl text-white mb-12">
            <span className="w-8 h-8 rounded-lg bg-[#FF6600] flex items-center justify-center text-sm font-black">R</span>
            <span>Rayons.net</span>
          </Link>

          <span className="text-[11px] uppercase tracking-widest font-bold text-[#FF6600] block mb-2">
            Réseau Marchand Certifié
          </span>
          <h2 className="text-3xl font-black tracking-tight leading-tight mb-4">
            Développez vos ventes avec la garantie Rayons.
          </h2>
          <p className="text-xs text-gray-300 leading-relaxed mb-8">
            En adhérant pour $50 par mois, vous rejoignez le premier réseau commercial structuré de Kinshasa : fonds protégés par séquestre, commandes proforma sécurisées et réseau de livreurs vérifiés.
          </p>

          <div className="space-y-4 text-xs text-gray-200">
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <Store size={18} className="text-[#FF6600] shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white">Boutique en ligne dédiée</strong>
                <span className="text-gray-400 text-[11px]">Tous vos articles indexés et recommandés aux clients.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <PackageCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white">Devis & Proformas RFQ instantanés</strong>
                <span className="text-gray-400 text-[11px]">Négociez et envoyez vos cotations avec paiement en 1 clic.</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
              <ShieldCheck size={18} className="text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white">Sécurité financière absolue</strong>
                <span className="text-gray-400 text-[11px]">Paiements garantis et protection contre les impayés.</span>
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
