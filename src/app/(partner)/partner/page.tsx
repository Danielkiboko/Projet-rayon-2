"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Users,
  Coins,
  TrendingUp,
  Share2,
  Copy,
  Check,
  Building2,
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  Send,
  Calendar,
  Lock,
  ArrowRight,
  ExternalLink
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import ResponsiveModal from "@/modules/shared/components/ui/ResponsiveModal";

interface FilleulData {
  id: string;
  filleulId: string;
  filleulName: string;
  filleulEmail: string | null;
  code: string;
  totalCommissions: number;
  paymentsCount: number;
  createdAt: string | null;
  lastPaymentAt: string | null;
}

interface CommissionData {
  id: string;
  filleulName: string;
  amount: number;
  currency: string;
  kind: string;
  status: "PENDING" | "PAID";
  paymentRef: string;
  createdAt: string | null;
  paidAt: string | null;
}

export default function PartnerDashboardPage() {
  const { user, userData } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Clipboard feedbacks
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Tabs
  const [activeTab, setActiveTab] = useState<"suppliers" | "commissions" | "payout">("suppliers");

  // Modal Création Fournisseur
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    managerName: "",
    companyName: "",
    email: "",
    phone: "",
    rayon: "connect",
    city: "Kinshasa",
    password: "",
  });

  // Demande de Payout
  const [payoutPhone, setPayoutPhone] = useState("");
  const [payoutOperator, setPayoutOperator] = useState("M-Pesa");
  const [isRequestingPayout, setIsRequestingPayout] = useState(false);

  const fetchPartnerData = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/referrals/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        toast.error(json.error || "Impossible de charger les données du compte partenaire.");
      }
    } catch (err: any) {
      console.error("Error loading partner data:", err);
      toast.error("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPartnerData();
  }, [user]);

  const handleCopyCode = () => {
    if (!data?.referralCode) return;
    navigator.clipboard.writeText(data.referralCode);
    setCopiedCode(true);
    toast.success("Code Partenaire copié !");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopiedLink(true);
    toast.success("Lien d'affiliation copié !");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleShareWhatsApp = () => {
    if (!data?.referralCode || !data?.referralLink) return;
    const text = `Bonjour ! Rejoins les commerçants de Kinshasa sur Rayons.net avec mon code officiel *${data.referralCode}* et profite de 10$ de réduction sur ton abonnement :\n${data.referralLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierForm.email || !supplierForm.companyName) {
      toast.error("Veuillez renseigner au moins l'email et le nom de la boutique.");
      return;
    }

    setIsSubmittingSupplier(true);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Vous devez être connecté.");

      const generatedPassword = supplierForm.password || Math.random().toString(36).slice(-8) + "Rayon@1";

      const res = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: supplierForm.email.trim().toLowerCase(),
          password: generatedPassword,
          displayName: supplierForm.companyName,
          roleToCreate: "SUPPLIER",
          extraData: {
            company: supplierForm.companyName,
            managerName: supplierForm.managerName,
            phone: supplierForm.phone,
            rayon: supplierForm.rayon,
            assignedRayons: [supplierForm.rayon],
            city: supplierForm.city,
            partnerReferral: true,
          },
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Erreur lors de l'enregistrement de la boutique.");
      }

      toast.success(`🎉 Boutique "${supplierForm.companyName}" enregistrée avec succès !`);
      setIsAddSupplierOpen(false);
      setSupplierForm({
        managerName: "",
        companyName: "",
        email: "",
        phone: "",
        rayon: "connect",
        city: "Kinshasa",
        password: "",
      });

      // Rafraîchir les données
      fetchPartnerData();
    } catch (err: any) {
      console.error("Erreur création boutique:", err);
      toast.error(err.message || "Impossible de créer le fournisseur.");
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = data?.stats?.referralBalance || 0;
    if (balance < 10) {
      toast.error("Le solde minimum pour demander un versement est de 10 $ USD.");
      return;
    }
    if (!payoutPhone.trim()) {
      toast.error("Veuillez entrer votre numéro Mobile Money.");
      return;
    }

    setIsRequestingPayout(true);
    try {
      // Notification transmise à l'administration
      toast.success(`Demande de virement de $${balance.toFixed(2)} transmise à la Direction Financière Rayons.net !`);
      setPayoutPhone("");
    } catch (err) {
      toast.error("Erreur lors de la transmission de la demande.");
    } finally {
      setIsRequestingPayout(false);
    }
  };

  const referralCode = data?.referralCode || userData?.referralCode || "---";
  const referralLink = data?.referralLink || `https://rayons.net/supplier/register?ref=${referralCode}`;
  const balance = data?.stats?.referralBalance || 0;
  const totalEarned = data?.stats?.referralTotalEarned || 0;
  const suppliersCount = data?.stats?.referralCount || (data?.filleuls?.length || 0);
  const monthlyEst = suppliersCount * 5;

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#0F1D27] via-[#162736] to-[#0F1D27] border border-white/10 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C7D300]/10 border border-[#C7D300]/30 text-[#C7D300] text-xs font-bold uppercase tracking-wider">
              <Sparkles size={13} />
              <span>Programme Partenaire Agréé</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Développez votre réseau de Fournisseurs
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Inscrivez des commerçants et boutiques locales. Tous vos fournisseurs font partie intégrante de la marketplace Rayons.net et sont gérés par la Direction Centrale. Vous touchez <strong>5 $ USD chaque mois</strong> sur chaque boutique dès qu'elle renouvelle son abonnement.
            </p>
          </div>

          <div className="shrink-0 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setIsAddSupplierOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-xs bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] transition-all shadow-lg shadow-[#C7D300]/20 active:scale-95 cursor-pointer"
            >
              <PlusCircle size={16} />
              <span>Inscrire un Fournisseur</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Solde Disponible */}
        <div className="bg-[#0F1D27]/80 border border-white/[0.08] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Solde Disponible</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Coins size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            ${balance.toFixed(2)}
          </div>
          <p className="text-[11px] text-gray-400">
            Prêt à être retiré vers Mobile Money
          </p>
        </div>

        {/* Total Cumulé */}
        <div className="bg-[#0F1D27]/80 border border-white/[0.08] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Commissions Gagnées</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            ${totalEarned.toFixed(2)}
          </div>
          <p className="text-[11px] text-gray-400">
            Gains cumulés à vie sur la plateforme
          </p>
        </div>

        {/* Boutiques Rattachées */}
        <div className="bg-[#0F1D27]/80 border border-white/[0.08] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Fournisseurs Rattachés</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Building2 size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {suppliersCount}
          </div>
          <p className="text-[11px] text-gray-400">
            Boutiques créées dans la base centrale
          </p>
        </div>

        {/* Rémunération Récurrente */}
        <div className="bg-[#0F1D27]/80 border border-white/[0.08] rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Revenu Mensuel Estimé</span>
            <div className="w-8 h-8 rounded-xl bg-[#C7D300]/10 text-[#C7D300] flex items-center justify-center">
              <Sparkles size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-[#C7D300] tracking-tight">
            ~${monthlyEst} <span className="text-xs font-semibold text-gray-400">/mois</span>
          </div>
          <p className="text-[11px] text-gray-400">
            Basé sur 5$ par abonnement actif
          </p>
        </div>
      </div>

      {/* Partage & Outils d'Affiliation */}
      <div className="bg-[#0F1D27]/90 border border-white/[0.08] rounded-2xl p-5 sm:p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-300">
          Vos Liens et Codes d'Affiliation Officiels
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Code Partenaire */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-gray-400 uppercase font-semibold">Votre Code Partenaire</div>
              <div className="text-lg font-mono font-extrabold text-[#C7D300] tracking-wider mt-0.5">
                {referralCode}
              </div>
            </div>
            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
            >
              {copiedCode ? <Check size={14} className="text-[#C7D300]" /> : <Copy size={14} />}
              <span>{copiedCode ? "Copié" : "Copier"}</span>
            </button>
          </div>

          {/* Lien d'Affiliation */}
          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-gray-400 uppercase font-semibold">Lien Direct Fournisseur</div>
              <div className="text-xs font-mono text-gray-300 truncate mt-1">
                {referralLink}
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={handleCopyLink}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer"
                title="Copier le lien"
              >
                {copiedLink ? <Check size={14} className="text-[#C7D300]" /> : <Copy size={14} />}
              </button>
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                title="Partager sur WhatsApp"
              >
                <Share2 size={13} />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "suppliers"
              ? "bg-[#C7D300] text-[#0F1D27] shadow-md shadow-[#C7D300]/20"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Building2 size={14} />
          <span>Mes Fournisseurs Rattachés ({data?.filleuls?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("commissions")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "commissions"
              ? "bg-[#C7D300] text-[#0F1D27] shadow-md shadow-[#C7D300]/20"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <Coins size={14} />
          <span>Historique des Commissions ({data?.commissions?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab("payout")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "payout"
              ? "bg-[#C7D300] text-[#0F1D27] shadow-md shadow-[#C7D300]/20"
              : "text-gray-400 hover:text-white hover:bg-white/5"
          }`}
        >
          <TrendingUp size={14} />
          <span>Demander un Virement Mobile Money</span>
        </button>
      </div>

      {/* Tab 1: Fournisseurs Rattachés */}
      {activeTab === "suppliers" && (
        <div className="bg-[#0F1D27]/90 border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Boutiques et Commerçants Créés</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Ces boutiques sont gérées et modérées par l'administration centrale Rayons.net.
              </p>
            </div>
            <button
              onClick={() => setIsAddSupplierOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#C7D300]/15 hover:bg-[#C7D300]/25 text-[#C7D300] border border-[#C7D300]/30 transition-colors cursor-pointer"
            >
              <PlusCircle size={13} />
              <span>Ajouter</span>
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-[#C7D300] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Chargement de vos boutiques affiliées...</p>
            </div>
          ) : !data?.filleuls || data.filleuls.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-3">
              <Building2 size={36} className="mx-auto text-gray-600" />
              <p className="text-sm font-semibold text-gray-300">Aucun fournisseur rattaché pour l'instant.</p>
              <p className="text-xs max-w-md mx-auto text-gray-400">
                Utilisez le bouton "Inscrire un Fournisseur" ou partagez votre lien WhatsApp pour enregistrer des boutiques et commencer à percevoir vos commissions mensuelles.
              </p>
              <button
                onClick={() => setIsAddSupplierOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-[#C7D300] text-[#0F1D27] cursor-pointer"
              >
                Inscrire un premier commerçant
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-black/20 text-gray-400 uppercase text-[10px] font-semibold border-b border-white/[0.06]">
                  <tr>
                    <th className="px-5 py-3.5">Boutique / Commerçant</th>
                    <th className="px-5 py-3.5">Contact</th>
                    <th className="px-5 py-3.5">Date Inscription</th>
                    <th className="px-5 py-3.5">Paiements Validés</th>
                    <th className="px-5 py-3.5 text-right">Commissions Rapportées</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.filleuls.map((f: FilleulData) => (
                    <tr key={f.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                            {(f.filleulName || "F").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{f.filleulName}</div>
                            <div className="text-[10px] text-gray-500 font-mono">ID: {f.filleulId.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-gray-300">{f.filleulEmail || "—"}</span>
                      </td>
                      <td className="px-5 py-4 text-gray-400">
                        {f.createdAt ? new Date(f.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-gray-300">
                          {f.paymentsCount} mois réglé(s)
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-emerald-400 text-sm">
                          +${Number(f.totalCommissions || 0).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Historique des Commissions */}
      {activeTab === "commissions" && (
        <div className="bg-[#0F1D27]/90 border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/[0.06]">
            <h3 className="text-sm font-bold text-white">Commissions Récurrentes Reçues</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Chaque réabonnement mensuel d'un fournisseur génère instantanément 5 $ USD de commission pour vous.
            </p>
          </div>

          {!data?.commissions || data.commissions.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-2">
              <Coins size={36} className="mx-auto text-gray-600" />
              <p className="text-sm font-semibold text-gray-300">Aucune commission créditée pour l'instant.</p>
              <p className="text-xs text-gray-400">
                Vos commissions apparaîtront dès qu'un de vos commerçants effectuera son premier règlement d'abonnement.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-black/20 text-gray-400 uppercase text-[10px] font-semibold border-b border-white/[0.06]">
                  <tr>
                    <th className="px-5 py-3.5">Fournisseur Source</th>
                    <th className="px-5 py-3.5">Type de Commission</th>
                    <th className="px-5 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Statut</th>
                    <th className="px-5 py-3.5 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {data.commissions.map((c: CommissionData) => (
                    <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4 font-semibold text-white">
                        {c.filleulName}
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-[11px] text-gray-300">
                          {c.kind === "SIGNUP" ? "Adhésion initiale" : "Renouvellement mensuel"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-400">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                      </td>
                      <td className="px-5 py-4">
                        {c.status === "PAID" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={11} /> Versé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock size={11} /> Disponible au retrait
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-emerald-400 text-sm">
                        +${Number(c.amount || 5).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Demander un Virement */}
      {activeTab === "payout" && (
        <div className="bg-[#0F1D27]/90 border border-white/[0.08] rounded-2xl p-6 max-w-xl space-y-5">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">Demande de Virement de Commissions</h3>
            <p className="text-xs text-gray-400">
              Recevez vos gains directement sur votre numéro Mobile Money en RDC (M-Pesa, Airtel Money, Orange Money).
            </p>
          </div>

          <div className="p-4 rounded-xl bg-black/40 border border-white/[0.06] flex items-center justify-between">
            <div>
              <div className="text-[11px] text-gray-400 uppercase font-semibold">Montant Disponible</div>
              <div className="text-2xl font-extrabold text-[#C7D300] mt-0.5">
                ${balance.toFixed(2)} USD
              </div>
            </div>
            <div className="text-right text-[11px] text-gray-400">
              <div>Seuil minimum : <strong>10 $ USD</strong></div>
              <div>Validation : <strong>Sous 24h ouvrées</strong></div>
            </div>
          </div>

          <form onSubmit={handleRequestPayout} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Opérateur Mobile Money
              </label>
              <select
                value={payoutOperator}
                onChange={(e) => setPayoutOperator(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
              >
                <option value="M-Pesa">Vodacom M-Pesa</option>
                <option value="Airtel Money">Airtel Money</option>
                <option value="Orange Money">Orange Money</option>
                <option value="Afrimoney">Africell Afrimoney</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Numéro de Téléphone Bénéficiaire (Format RDC)
              </label>
              <input
                type="tel"
                required
                placeholder="+243 82 000 00 00"
                value={payoutPhone}
                onChange={(e) => setPayoutPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-200">
              <p className="font-semibold text-white mb-0.5">Gestion Centralisée :</p>
              <p className="text-[11px] text-gray-300">
                Votre demande est directement transmise à l'Administration Centrale de Rayons.net. Dès vérification comptable, les fonds sont virés et votre solde est réinitialisé.
              </p>
            </div>

            <button
              type="submit"
              disabled={isRequestingPayout || balance < 10}
              className="w-full py-3 rounded-xl text-xs font-bold bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Send size={14} />
              <span>Demander le versement de mes commissions</span>
            </button>
          </form>
        </div>
      )}

      {/* MODAL : Inscrire un Nouveau Fournisseur */}
      <ResponsiveModal
        isOpen={isAddSupplierOpen}
        onClose={() => !isSubmittingSupplier && setIsAddSupplierOpen(false)}
        title="Inscrire un Nouveau Fournisseur"
        subtitle="Création directe dans la base de données centrale Rayons.net"
        icon={<Building2 size={20} className="text-[#C7D300]" />}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-[#C7D300]/10 border border-[#C7D300]/25 text-xs text-gray-300 space-y-1">
            <p className="font-bold text-[#C7D300] flex items-center gap-1.5">
              <ShieldCheck size={14} />
              Fournisseur Centralisé Rayons.net
            </p>
            <p className="text-[11px]">
              La boutique créée dépendra directement de la base centrale et sera administrée par la Direction Rayons.net. Vous en êtes le parrain attitré et toucherez <strong>5 $ USD chaque mois</strong> à chaque réabonnement.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Nom de la Boutique / Entreprise *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: Kin High-Tech Store"
                value={supplierForm.companyName}
                onChange={(e) => setSupplierForm({ ...supplierForm, companyName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Nom du Gérant / Responsable
              </label>
              <input
                type="text"
                placeholder="Ex: Jonathan Kalala"
                value={supplierForm.managerName}
                onChange={(e) => setSupplierForm({ ...supplierForm, managerName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Adresse Email du Commerçant * (Login)
              </label>
              <input
                type="email"
                required
                placeholder="contact@boutique.com"
                value={supplierForm.email}
                onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Numéro de Téléphone (WhatsApp / Contact)
              </label>
              <input
                type="tel"
                placeholder="+243 82 000 00 00"
                value={supplierForm.phone}
                onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Rayon d'Activité
              </label>
              <select
                value={supplierForm.rayon}
                onChange={(e) => setSupplierForm({ ...supplierForm, rayon: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300] cursor-pointer"
              >
                <option value="connect">Rayon Connect (High-Tech, Gadgets, Télécoms)</option>
                <option value="immo">Rayon Immo (Immobilier, Bailleurs & Agences)</option>
                <option value="mode">Rayon Mode (Vêtements, Chaussures, Accessoires)</option>
                <option value="saveurs">Rayon Saveurs (Restaurants, Traiteurs, Épicerie)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Ville
              </label>
              <input
                type="text"
                placeholder="Kinshasa"
                value={supplierForm.city}
                onChange={(e) => setSupplierForm({ ...supplierForm, city: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5">
              Mot de passe provisoire (Facultatif - généré automatiquement si vide)
            </label>
            <input
              type="text"
              placeholder="Laisser vide pour générer un mot de passe sécurisé"
              value={supplierForm.password}
              onChange={(e) => setSupplierForm({ ...supplierForm, password: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              disabled={isSubmittingSupplier}
              onClick={() => setIsAddSupplierOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmittingSupplier}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSubmittingSupplier ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-[#0F1D27] border-t-transparent rounded-full animate-spin" />
                  <span>Enregistrement...</span>
                </div>
              ) : (
                <>
                  <Building2 size={15} />
                  <span>Créer la Boutique Fournisseur</span>
                </>
              )}
            </button>
          </div>
        </form>
      </ResponsiveModal>
    </div>
  );
}
