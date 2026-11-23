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
import toast from "react-hot-toast";
import ValidationSuccessView from "@/modules/shared/components/ui/ValidationSuccessView";

export default function AdminReferralsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [processingPayoutId, setProcessingPayoutId] = useState<string | null>(null);
  const [validationSuccessMsg, setValidationSuccessMsg] = useState("");

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

      setValidationSuccessMsg(json.message || `Commissions versées avec succès à ${referrer.name} !`);
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
    <div className="space-y-5 pb-16">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">Parrainages &amp; Commissions</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-white/[0.06] text-gray-300 border border-white/10">
              $5 / réabonnement
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Supervision des codes promos, filleuls rattachés et reversement des commissions.
          </p>
        </div>

        <button
          onClick={fetchAdminReferrals}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/[0.04] hover:bg-white/[0.08] text-gray-200 rounded-lg text-xs font-semibold transition-colors border border-white/10 whitespace-nowrap cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw size={13} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* 4 Cartes KPI Exécutives */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">À Verser</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400"><Clock size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-amber-400 tabular-nums tracking-tight">${stats.totalPending?.toFixed(2) || "0.00"}</p>
          <p className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">Commissions en attente</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Versées</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400"><CheckCircle2 size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums tracking-tight">${stats.totalPaid?.toFixed(2) || "0.00"}</p>
          <p className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">Déjà réglées par la caisse</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Total Généré</span>
            <span className="p-1.5 rounded-lg bg-white/[0.05] text-gray-300"><TrendingUp size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">${stats.totalEarned?.toFixed(2) || "0.00"}</p>
          <p className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">{stats.totalCommissionsCount || 0} commission(s) au total</p>
        </div>

        <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-4 flex flex-col justify-between gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Réseau Filleuls</span>
            <span className="p-1.5 rounded-lg bg-white/[0.05] text-gray-300"><Users size={14} /></span>
          </div>
          <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{stats.totalFilleuls || 0}</p>
          <p className="text-[11px] text-gray-400 pt-1 border-t border-white/[0.06]">Commerçants parrainés</p>
        </div>
      </div>

      {validationSuccessMsg ? (
        <ValidationSuccessView
          title="C'est fait !"
          message={validationSuccessMsg}
          badgeLabel="Versement Parrainage Validé"
          onDone={() => setValidationSuccessMsg("")}
        />
      ) : (
        <>
      {/* TABLEAU DES PARRAINS & VERSEMENTS */}
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-white">Parrains &amp; Soldes à Reverser</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">Boutiques possédant un code promo et des filleuls rattachés.</p>
          </div>

          <div className="relative w-full sm:w-56">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher nom, code..."
              className="w-full pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/10 rounded-lg focus:outline-none focus:border-white/25 text-[11px] text-white placeholder-gray-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.01] border-b border-white/[0.08] text-gray-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Parrain</th>
                <th className="py-3 px-4 whitespace-nowrap">Code</th>
                <th className="py-3 px-4 text-center whitespace-nowrap">Filleuls</th>
                <th className="py-3 px-4 whitespace-nowrap">Total Gagné</th>
                <th className="py-3 px-4 whitespace-nowrap">Versé</th>
                <th className="py-3 px-4 whitespace-nowrap">Solde Dû</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-gray-200">
              {referrers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-500">
                    Aucun parrain trouvé.
                  </td>
                </tr>
              ) : (
                referrers.map((r: any) => {
                  const hasPending = (r.referralBalance || 0) > 0;
                  const isProcessing = processingPayoutId === r.id;

                  return (
                    <tr key={r.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{r.name}</div>
                        <div className="text-[11px] text-gray-500">{r.email || r.phone || "—"}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-white/[0.05] text-[#C7D300] border border-white/10">
                          {r.code || "—"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center tabular-nums font-semibold text-gray-300">
                        {r.referralCount || 0}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-300 tabular-nums">
                        ${(r.referralTotalEarned || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-emerald-400 tabular-nums">
                        ${(r.referralPaidTotal || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 font-bold text-amber-400 tabular-nums">
                        ${(r.referralBalance || 0).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasPending ? (
                          <button
                            onClick={() => handlePayout(r)}
                            disabled={isProcessing}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#C7D300]/15 hover:bg-[#C7D300]/25 text-[#C7D300] border border-[#C7D300]/30 font-semibold rounded-lg text-[11px] transition-colors ml-auto whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            <Wallet size={12} />
                            <span>{isProcessing ? "Versement..." : `Verser $${r.referralBalance.toFixed(2)}`}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-gray-500">À jour</span>
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
      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/[0.08]">
          <h2 className="text-sm font-bold text-white">Dernières Commissions Générées</h2>
          <p className="text-[11px] text-gray-400 mt-0.5">Journal des attributions de commissions de $5 USD.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.01] border-b border-white/[0.08] text-gray-500 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 whitespace-nowrap">Date</th>
                <th className="py-3 px-4 whitespace-nowrap">Parrain</th>
                <th className="py-3 px-4 whitespace-nowrap">Filleul</th>
                <th className="py-3 px-4 whitespace-nowrap">Réf Paiement</th>
                <th className="py-3 px-4 whitespace-nowrap">Montant</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05] text-gray-200">
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
        </>
      )}
    </div>
  );
}
