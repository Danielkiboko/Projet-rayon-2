"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Briefcase,
  Users,
  Building2,
  Coins,
  TrendingUp,
  Search,
  ExternalLink,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  Check,
  Send,
  Eye,
  UserPlus,
  ArrowRight,
  Store,
  DollarSign
} from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { hasAdminAccess } from "@/lib/permissions";
import ResponsiveModal from "@/modules/shared/components/ui/ResponsiveModal";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

interface PartnerUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  partnerCode: string;
  referralCode: string;
  balance: number;
  totalEarned: number;
  createdAt: string | null;
  suppliersCount: number;
  suppliers: PartnerSupplier[];
}

interface PartnerSupplier {
  id: string;
  name: string;
  email: string;
  phone: string;
  rayon: string;
  subscriptionStatus: string;
  subscriptionEndDate: any;
  createdAt: string | null;
  totalCommissions: number;
  paymentsCount: number;
  partnerId: string;
  partnerName: string;
  partnerCode: string;
}

export default function AdminPartnersPage() {
  const { user, userData } = useAuth();
  const [partners, setPartners] = useState<PartnerUser[]>([]);
  const [allPartnerSuppliers, setAllPartnerSuppliers] = useState<PartnerSupplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"partners" | "suppliers">("partners");

  // Modal Details Fournisseurs d'un Partenaire
  const [selectedPartner, setSelectedPartner] = useState<PartnerUser | null>(null);

  // Modal Payout
  const [payoutPartner, setPayoutPartner] = useState<PartnerUser | null>(null);
  const [payoutMethod, setPayoutMethod] = useState("Vodacom M-Pesa");
  const [isProcessingPayout, setIsProcessingPayout] = useState(false);

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchPartnersAndSuppliers = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch all partners (users with role == 'PARTNER' or isPartner == true)
      const qPartners1 = query(collection(db, "users"), where("role", "==", "PARTNER"));
      const qPartners2 = query(collection(db, "users"), where("isPartner", "==", true));
      const [snapP1, snapP2] = await Promise.all([getDocs(qPartners1), getDocs(qPartners2)]);

      const partnersMap: Record<string, PartnerUser> = {};

      const processPartner = (docSnap: any) => {
        if (partnersMap[docSnap.id]) return;
        const d = docSnap.data();
        const code = d.partnerCode || d.referralCode || "---";
        partnersMap[docSnap.id] = {
          id: docSnap.id,
          name: d.displayName || d.name || d.company || d.email || "Partenaire",
          email: d.email || "",
          phone: d.phone || d.phoneNumber || "",
          partnerCode: code,
          referralCode: code,
          balance: Number(d.partnerBalance || d.referralBalance) || 0,
          totalEarned: Number(d.partnerTotalEarned || d.referralTotalEarned) || 0,
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
          suppliersCount: 0,
          suppliers: [],
        };
      };

      snapP1.forEach(processPartner);
      snapP2.forEach(processPartner);

      // 2. Fetch referrals relationships
      const referralsSnap = await getDocs(collection(db, "referrals"));
      const relationsMap: Record<string, any> = {};
      referralsSnap.forEach((docSnap) => {
        relationsMap[docSnap.id] = docSnap.data();
      });

      // 3. Fetch all suppliers created by partners
      const qSuppliers = query(
        collection(db, "users"),
        where("role", "in", ["SUPPLIER", "supplier", "SUPPLIER_IMMO", "SUPPLIER_MODE", "SUPPLIER_CONNECT", "SUPPLIER_SAVEURS"])
      );
      const suppliersSnap = await getDocs(qSuppliers);

      const partnerSuppliersList: PartnerSupplier[] = [];

      suppliersSnap.forEach((docSnap) => {
        const d = docSnap.data();
        const partnerId = d.referredByPartnerId || d.referredBy || (d.creatorRole === "PARTNER" ? d.createdBy : null);

        if (partnerId && partnersMap[partnerId]) {
          const relation = relationsMap[docSnap.id] || {};
          const supplierItem: PartnerSupplier = {
            id: docSnap.id,
            name: d.company || d.companyName || d.displayName || d.name || "Boutique",
            email: d.email || "",
            phone: d.phone || d.phoneNumber || "",
            rayon: d.rayon || (Array.isArray(d.assignedRayons) && d.assignedRayons[0]) || "Non assigné",
            subscriptionStatus: d.subscriptionStatus || "TRIAL",
            subscriptionEndDate: d.subscriptionEndDate,
            createdAt: d.createdAt?.toDate ? d.createdAt.toDate().toISOString() : null,
            totalCommissions: Number(relation.totalCommissions || 0),
            paymentsCount: Number(relation.paymentsCount || 0),
            partnerId,
            partnerName: partnersMap[partnerId].name,
            partnerCode: partnersMap[partnerId].partnerCode,
          };

          partnerSuppliersList.push(supplierItem);
          partnersMap[partnerId].suppliers.push(supplierItem);
          partnersMap[partnerId].suppliersCount += 1;
        }
      });

      setPartners(Object.values(partnersMap));
      setAllPartnerSuppliers(partnerSuppliersList);
    } catch (err: any) {
      console.error("Error fetching partners:", err);
      toast.error("Impossible de charger la liste des partenaires.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPartnersAndSuppliers();
  }, [user]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success("Code copié !");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleProcessPayout = async () => {
    if (!payoutPartner) return;
    setIsProcessingPayout(true);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Vous devez être connecté.");

      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "PAYOUT",
          referrerId: payoutPartner.id,
          paymentMethod: payoutMethod,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors du versement");
      }

      toast.success(data.message || `Commissions versées avec succès à ${payoutPartner.name} !`);
      setPayoutPartner(null);
      fetchPartnersAndSuppliers();
    } catch (err: any) {
      console.error("Payout error:", err);
      toast.error(err.message || "Erreur lors du versement.");
    } finally {
      setIsProcessingPayout(false);
    }
  };

  // KPIs
  const totalPartners = partners.length;
  const totalRecruitedSuppliers = allPartnerSuppliers.length;
  const totalEarnedCommissions = partners.reduce((sum, p) => sum + p.totalEarned, 0);
  const totalPendingCommissions = partners.reduce((sum, p) => sum + p.balance, 0);

  // Filtering
  const filteredPartners = partners.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.partnerCode.toLowerCase().includes(q) ||
      p.phone.toLowerCase().includes(q)
    );
  });

  const filteredSuppliers = allPartnerSuppliers.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.partnerName.toLowerCase().includes(q) ||
      s.rayon.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Partenaires & Apporteurs d'Affaires
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#C7D300]/20 text-[#C7D300] border border-[#C7D300]/30">
              Réseau d'Affiliation
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-1 max-w-3xl">
            Suivi des partenaires agréés, de leurs codes d'affiliation, et de l'ensemble des boutiques fournisseurs qu'ils ont enregistrées dans la base centrale.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/clients"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] transition-all shadow-md shadow-[#C7D300]/20 active:scale-95 cursor-pointer"
          >
            <UserPlus size={15} />
            <span>Nommer un Partenaire (via Clients)</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0F1D27]/80 border border-white/[0.08] rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Partenaires Agréés</span>
            <div className="w-8 h-8 rounded-xl bg-[#C7D300]/10 text-[#C7D300] flex items-center justify-center">
              <Briefcase size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{totalPartners}</div>
          <p className="text-[11px] text-gray-400">Comptes apporteurs d'affaires</p>
        </div>

        <div className="bg-[#0F1D27]/80 border border-white/[0.08] rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Boutiques Recrutées</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Building2 size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">{totalRecruitedSuppliers}</div>
          <p className="text-[11px] text-gray-400">Fournisseurs créés par les partenaires</p>
        </div>

        <div className="bg-[#0F1D27]/80 border border-white/[0.08] rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Commissions Cumulées</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">${totalEarnedCommissions.toFixed(2)}</div>
          <p className="text-[11px] text-gray-400">Total généré à 5$ / réabonnement</p>
        </div>

        <div className="bg-[#0F1D27]/80 border border-white/[0.08] rounded-2xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-gray-400 text-xs">
            <span>Commissions en Attente</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Coins size={16} />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 tracking-tight">${totalPendingCommissions.toFixed(2)}</div>
          <p className="text-[11px] text-gray-400">Soldes prêts pour virement Mobile Money</p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("partners")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "partners"
                ? "bg-[#C7D300] text-[#0F1D27] shadow-md shadow-[#C7D300]/20"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Briefcase size={14} />
            <span>Liste des Partenaires ({partners.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === "suppliers"
                ? "bg-[#C7D300] text-[#0F1D27] shadow-md shadow-[#C7D300]/20"
                : "text-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Store size={14} />
            <span>Boutiques Créées par Partenaires ({allPartnerSuppliers.length})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder={activeTab === "partners" ? "Rechercher un partenaire..." : "Rechercher une boutique..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 bg-black/40 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#C7D300]"
          />
        </div>
      </div>

      {/* Tab 1: Liste des Partenaires */}
      {activeTab === "partners" && (
        <div className="bg-[#0F1D27]/90 border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
          {isLoading ? (
            <div className="p-12 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-[#C7D300] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs">Chargement des partenaires...</p>
            </div>
          ) : filteredPartners.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-2">
              <Briefcase size={36} className="mx-auto text-gray-600" />
              <p className="text-sm font-semibold text-gray-300">Aucun partenaire trouvé.</p>
              <p className="text-xs text-gray-500">
                Vous pouvez convertir un client existant en Partenaire depuis la page <Link href="/admin/clients" className="text-[#C7D300] underline">Clients</Link>.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-black/20 text-gray-400 uppercase text-[10px] font-semibold border-b border-white/[0.06]">
                  <tr>
                    <th className="px-5 py-4">Partenaire</th>
                    <th className="px-5 py-4">Contact</th>
                    <th className="px-5 py-4">Code d'Affiliation</th>
                    <th className="px-5 py-4">Fournisseurs Créés</th>
                    <th className="px-5 py-4">Solde Disponible</th>
                    <th className="px-5 py-4">Total Commissions</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredPartners.map((partner) => (
                    <tr key={partner.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-[#C7D300]/10 text-[#C7D300] border border-[#C7D300]/20 flex items-center justify-center font-bold text-xs shrink-0">
                            {partner.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{partner.name}</div>
                            <div className="text-[10px] text-gray-500 font-mono">ID: {partner.id.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <div className="text-gray-200">{partner.email}</div>
                          {partner.phone && <div className="text-[11px] text-gray-400 font-mono">{partner.phone}</div>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#C7D300] bg-[#C7D300]/10 px-2 py-0.5 rounded border border-[#C7D300]/25 text-xs">
                            {partner.partnerCode}
                          </span>
                          <button
                            onClick={() => handleCopy(partner.partnerCode, partner.id)}
                            className="p-1 rounded bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
                            title="Copier le code"
                          >
                            {copiedCode === partner.id ? <Check size={12} className="text-[#C7D300]" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <button
                          onClick={() => setSelectedPartner(partner)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/25 hover:bg-purple-500/20 font-bold text-xs transition-colors cursor-pointer"
                        >
                          <Building2 size={12} />
                          <span>{partner.suppliersCount} boutique{partner.suppliersCount > 1 ? "s" : ""}</span>
                        </button>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-bold text-emerald-400 text-sm">
                          ${partner.balance.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-gray-300">
                          ${partner.totalEarned.toFixed(2)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedPartner(partner)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 text-xs font-semibold transition-colors cursor-pointer"
                            title="Voir les boutiques de ce partenaire"
                          >
                            Détails boutiques
                          </button>
                          {partner.balance > 0 && (
                            <button
                              onClick={() => setPayoutPartner(partner)}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                              title="Payer les commissions par Mobile Money"
                            >
                              <DollarSign size={12} />
                              <span>Régler</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Toutes les Boutiques Créées par Partenaires */}
      {activeTab === "suppliers" && (
        <div className="bg-[#0F1D27]/90 border border-white/[0.08] rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 sm:p-5 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white">Boutiques et Fournisseurs Recrutés</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Ces boutiques ont été créées via des partenaires. Elles sont directement administrées par la Direction Centrale.
              </p>
            </div>
            <Link
              href="/admin/suppliers"
              className="text-xs text-[#C7D300] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Ouvrir la console Fournisseurs</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          {filteredSuppliers.length === 0 ? (
            <div className="p-12 text-center text-gray-500 space-y-2">
              <Store size={36} className="mx-auto text-gray-600" />
              <p className="text-sm font-semibold text-gray-300">Aucune boutique affiliée trouvée.</p>
              <p className="text-xs text-gray-500">
                Les boutiques créées par vos partenaires apparaîtront automatiquement ici.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-black/20 text-gray-400 uppercase text-[10px] font-semibold border-b border-white/[0.06]">
                  <tr>
                    <th className="px-5 py-4">Boutique</th>
                    <th className="px-5 py-4">Partenaire Recruteur</th>
                    <th className="px-5 py-4">Rayon d'Activité</th>
                    <th className="px-5 py-4">Statut Abonnement</th>
                    <th className="px-5 py-4">Date de Création</th>
                    <th className="px-5 py-4 text-right">Commissions Rapportées</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredSuppliers.map((supplier) => (
                    <tr key={supplier.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-bold text-xs shrink-0">
                            {supplier.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-white">{supplier.name}</div>
                            <div className="text-[10px] text-gray-400">{supplier.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-purple-300 flex items-center gap-1">
                            <Briefcase size={12} />
                            <span>{supplier.partnerName}</span>
                          </span>
                          <span className="font-mono text-[10px] text-[#C7D300]">
                            Code: {supplier.partnerCode}
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300 uppercase font-semibold text-[10px]">
                          {supplier.rayon}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {supplier.subscriptionStatus === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 size={11} /> Actif
                          </span>
                        ) : supplier.subscriptionStatus === "TRIAL" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                            <Clock size={11} /> Période d'essai
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertCircle size={11} /> Suspendu
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-400">
                        {supplier.createdAt ? new Date(supplier.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="font-bold text-emerald-400 text-sm">
                          +${supplier.totalCommissions.toFixed(2)}
                        </span>
                        <div className="text-[10px] text-gray-500">
                          {supplier.paymentsCount} renouvellement(s)
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL : Détail des boutiques d'un Partenaire */}
      <ResponsiveModal
        isOpen={!!selectedPartner}
        onClose={() => setSelectedPartner(null)}
        title={`Boutiques de ${selectedPartner?.name}`}
        subtitle={`Code Partenaire : ${selectedPartner?.partnerCode} • ${selectedPartner?.suppliersCount || 0} boutique(s) rattachée(s)`}
        icon={<Building2 size={20} className="text-[#C7D300]" />}
        maxWidth="lg"
      >
        {selectedPartner && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 flex items-center justify-between">
              <div>
                <p className="font-bold text-white">Commissions de ce partenaire :</p>
                <p className="text-[11px] text-gray-300">
                  Solde à verser : <strong className="text-emerald-400">${selectedPartner.balance.toFixed(2)}</strong> • Total gagné : <strong>${selectedPartner.totalEarned.toFixed(2)}</strong>
                </p>
              </div>
              {selectedPartner.balance > 0 && (
                <button
                  onClick={() => {
                    setPayoutPartner(selectedPartner);
                    setSelectedPartner(null);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
                >
                  Régler le solde
                </button>
              )}
            </div>

            {selectedPartner.suppliers.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-6">
                Ce partenaire n'a pas encore enregistré de boutique fournisseur.
              </p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {selectedPartner.suppliers.map((s) => (
                  <div key={s.id} className="p-3 rounded-xl bg-black/40 border border-white/5 flex items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-white flex items-center gap-2">
                        <span>{s.name}</span>
                        <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300">
                          {s.rayon}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-400">{s.email}</div>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="font-bold text-emerald-400">
                        +${s.totalCommissions.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {s.subscriptionStatus === "ACTIVE" ? "✅ Abonnement Actif" : s.subscriptionStatus === "TRIAL" ? "⏱️ En essai" : "⛔ Suspendu"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPartner(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>

      {/* MODAL : Payout / Règlement des Commissions */}
      <ResponsiveModal
        isOpen={!!payoutPartner}
        onClose={() => !isProcessingPayout && setPayoutPartner(null)}
        title="Règlement des Commissions Partenaire"
        subtitle={`Virement Mobile Money pour ${payoutPartner?.name}`}
        icon={<Coins size={20} className="text-emerald-400" />}
        maxWidth="md"
      >
        {payoutPartner && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-gray-300">Montant des commissions dues :</span>
                <span className="text-xl font-extrabold text-emerald-400">${payoutPartner.balance.toFixed(2)} USD</span>
              </div>
              <div className="text-[11px] text-gray-400">
                Bénéficiaire : <strong className="text-white">{payoutPartner.name}</strong> ({payoutPartner.phone || payoutPartner.email})
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-300">
                Mode de Versement
              </label>
              <select
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-400 cursor-pointer"
              >
                <option value="Vodacom M-Pesa">Vodacom M-Pesa</option>
                <option value="Airtel Money">Airtel Money</option>
                <option value="Orange Money">Orange Money</option>
                <option value="Caisse centrale / Espèces">Caisse centrale / Espèces</option>
              </select>
            </div>

            <p className="text-[11px] text-gray-400 bg-white/5 p-3 rounded-xl border border-white/5">
              En confirmant ce paiement, le solde disponible du partenaire sera réinitialisé à 0, le total payé sera incrémenté, et toutes les commissions en attente seront marquées comme payées dans le registre comptable.
            </p>

            <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isProcessingPayout}
                onClick={() => setPayoutPartner(null)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isProcessingPayout}
                onClick={handleProcessPayout}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {isProcessingPayout ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Enregistrement...</span>
                  </div>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Confirmer le Versement de ${payoutPartner.balance.toFixed(2)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </ResponsiveModal>
    </div>
  );
}

