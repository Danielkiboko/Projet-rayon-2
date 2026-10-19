"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Gift,
  DollarSign,
  Users,
  TrendingUp,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Wallet,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function AdminReferralsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingPayoutId, setProcessingPayoutId] = useState<string | null>(null);

  const fetchAdminReferrals = async () => {
    if (!user) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/referrals", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        toast.error(json.error || "Impossible de charger les parrainages.");
      }
    } catch (err: any) {
      console.error("Error loading admin referrals:", err);
      toast.error("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminReferrals();
  }, [user]);

  const handlePayout = async (referrer: any) => {
    const balance = referrer.referralBalance || 0;
    if (balance <= 0) return;

    const confirmMsg = `Confirmez-vous le versement de $${balance.toFixed(2)} USD à ${referrer.name} ?\n\nCette action va :\n1. Remettre son solde de parrainage à 0\n2. Passer l'écriture de décaissement dans le Grand Livre\n3. Enregistrer l'entrée dans son livre de caisse\n4. Notifier le commerçant par email et sur son compte.`;

    if (!confirm(confirmMsg)) return;

    setProcessingPayoutId(referrer.id);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/admin/referrals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "PAYOUT",
          referrerId: referrer.id,
          paymentMethod: "Caisse centrale / Mobile Money",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Erreur lors du versement.");
      }

      toast.success(json.message || "Commissions versées avec succès !");
      fetchAdminReferrals();
    } catch (err: any) {
      toast.error(err.message || "Erreur versement.");
    } finally {
      setProcessingPayoutId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-full border-3 border-white/10 border-t-[#C7D300] animate-spin mb-3" />
        <p className="text-xs text-gray-400">Chargement de la gestion des parrainages...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const referrers = (data?.referrers || []).filter((r: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.code?.toLowerCase().includes(q)
    );
  });
  const commissions = data?.commissions || [];

  return (
    <div className="space-y-6 pb-12">
      <Toaster position="top-right" />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Gift size={20} />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Programme Parrainage & Commissions</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Supervision centrale des codes promos, filleuls rattachés et reversement des commissions de 5 USD / réabonnement.
          </p>
        </div>

        <button
          onClick={fetchAdminReferrals}
          className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/10 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={14} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* KPI METRICS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-[#0F1D27] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Commissions en attente</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-400">${stats.totalPending?.toFixed(2) || "0.00"}</div>
          <span className="text-[10px] text-gray-400 mt-1 block">À verser aux parrains</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1D27] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Commissions versées</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400">${stats.totalPaid?.toFixed(2) || "0.00"}</div>
          <span className="text-[10px] text-gray-400 mt-1 block">Déjà réglées par la caisse</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1D27] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Total commissions générées</span>
            <span className="p-1.5 rounded-lg bg-[#C7D300]/10 text-[#C7D300]">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-[#C7D300]">${stats.totalEarned?.toFixed(2) || "0.00"}</div>
          <span className="text-[10px] text-gray-400 mt-1 block">{stats.totalCommissionsCount || 0} commissions au total</span>
        </div>

        <div className="p-4 rounded-2xl bg-[#0F1D27] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Réseau Filleuls</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Users size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-white">{stats.totalFilleuls || 0}</div>
          <span className="text-[10px] text-gray-400 mt-1 block">Commerçants parrainés actifs</span>
        </div>
      </div>

      {/* TABLEAU DES PARRAINS & VERSEMENTS */}
      <div className="bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-sm space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">Parrains & Soldes à reverser</h2>
            <p className="text-xs text-gray-400">Liste des boutiques possédant un code promo et des filleuls rattachés.</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, code..."
              className="w-full pl-9 pr-3.5 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-xs text-white placeholder-gray-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-y border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Fournisseur Parrain</th>
                <th className="py-3 px-5">Code Promo</th>
                <th className="py-3 px-5 text-center">Filleuls</th>
                <th className="py-3 px-5">Total Gagné</th>
                <th className="py-3 px-5">Déjà Versé</th>
                <th className="py-3 px-5 font-bold text-amber-400">Solde Dû</th>
                <th className="py-3 px-5 text-right">Action Versement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-200">
              {referrers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Aucun parrain trouvé.
                  </td>
                </tr>
              ) : (
                referrers.map((r: any) => {
                  const hasPending = (r.referralBalance || 0) > 0;
                  const isProcessing = processingPayoutId === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-white">{r.name}</div>
                        <div className="text-[11px] text-gray-400">{r.email || r.phone || "---"}</div>
                      </td>
                      <td className="py-3.5 px-5">
                        <span className="font-mono text-[11px] font-bold px-2.5 py-1 rounded-md bg-white/5 text-[#C7D300] border border-white/10">
                          {r.code || "---"}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 text-center">
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold text-[11px]">
                          {r.referralCount || 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-gray-300">
                        ${(r.referralTotalEarned || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-5 font-semibold text-emerald-400">
                        ${(r.referralPaidTotal || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-5 font-black text-amber-400 text-sm">
                        ${(r.referralBalance || 0).toFixed(2)}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        {hasPending ? (
                          <button
                            onClick={() => handlePayout(r)}
                            disabled={isProcessing}
                            className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-gray-950 font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 ml-auto cursor-pointer disabled:opacity-50"
                          >
                            <Wallet size={13} />
                            <span>{isProcessing ? "Versement..." : `Verser $${r.referralBalance.toFixed(2)}`}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-500 italic">À jour</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DERNIÈRES COMMISSIONS ENREGISTRÉES */}
      <div className="bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-sm p-5 space-y-4">
        <div>
          <h2 className="text-base font-bold text-white">Dernières Commissions Générées</h2>
          <p className="text-xs text-gray-400">Journal en temps réel des attributions de commissions de 5 USD.</p>
        </div>

        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/5 border-y border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-5">Date</th>
                <th className="py-3 px-5">Parrain Bénéficiaire</th>
                <th className="py-3 px-5">Filleul Payeur</th>
                <th className="py-3 px-5">Réf Paiement</th>
                <th className="py-3 px-5">Montant</th>
                <th className="py-3 px-5 text-right">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-200">
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    Aucune commission récente.
                  </td>
                </tr>
              ) : (
                commissions.map((c: any) => (
                  <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-5 text-gray-400">
                      {c.createdAt ? new Date(c.createdAt).toLocaleDateString("fr-FR") : "---"}
                    </td>
                    <td className="py-3 px-5 font-bold text-white">{c.referrerName || "---"}</td>
                    <td className="py-3 px-5 text-gray-300">{c.filleulName || "---"}</td>
                    <td className="py-3 px-5 font-mono text-[11px] text-gray-400">{c.paymentRef || "---"}</td>
                    <td className="py-3 px-5 font-black text-emerald-400">+${c.amount.toFixed(2)} USD</td>
                    <td className="py-3 px-5 text-right">
                      {c.status === "PAID" ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                          Versé
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-bold text-[10px]">
                          En attente
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
