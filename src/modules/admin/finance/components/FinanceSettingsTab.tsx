"use client";

import React from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Lock,
  ShieldCheck,
  Sliders,
  X,
} from "lucide-react";

interface FinanceSettingsTabProps {
  isSuperAdmin: boolean;
  pendingProposal: any;
  financialSettings: any;
  financialHistory: any[];
  visaEnabled: boolean;
  setVisaEnabled: (v: boolean) => void;
  visaAutoBillingEnabled: boolean;
  setVisaAutoBillingEnabled: (v: boolean) => void;
  visaProviderName: string;
  setVisaProviderName: (v: string) => void;
  visaSubscriptionUrl: string;
  setVisaSubscriptionUrl: (v: string) => void;
  visaCheckoutUrl: string;
  setVisaCheckoutUrl: (v: string) => void;
  isSavingVisa: boolean;
  copiedWebhook: boolean;
  onApproveProposal: () => void;
  onOpenRejectModal: () => void;
  onOpenProposalModal: () => void;
  onSaveVisaConfig: (e: React.FormEvent) => void;
  onCopyWebhook: () => void;
}

export function FinanceSettingsTab({
  isSuperAdmin,
  pendingProposal,
  financialSettings,
  financialHistory,
  visaEnabled,
  setVisaEnabled,
  visaAutoBillingEnabled,
  setVisaAutoBillingEnabled,
  visaProviderName,
  setVisaProviderName,
  visaSubscriptionUrl,
  setVisaSubscriptionUrl,
  visaCheckoutUrl,
  setVisaCheckoutUrl,
  isSavingVisa,
  copiedWebhook,
  onApproveProposal,
  onOpenRejectModal,
  onOpenProposalModal,
  onSaveVisaConfig,
  onCopyWebhook,
}: FinanceSettingsTabProps) {
  return (
    <div className="space-y-4">
      {pendingProposal && pendingProposal.status === "PENDING_APPROVAL" && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="text-amber-400 shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-white">Proposition financière en attente d&apos;approbation</h3>
                <p className="text-xs text-amber-200/80">
                  Demandée par <strong>{pendingProposal.requestedByName}</strong> ({pendingProposal.requestedByRole})
                </p>
              </div>
            </div>
            {isSuperAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onApproveProposal}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold rounded-lg text-xs cursor-pointer"
                >
                  <Check size={13} /> Approuver
                </button>
                <button
                  onClick={onOpenRejectModal}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-500/20 text-rose-200 font-semibold rounded-lg text-xs border border-rose-500/30 cursor-pointer"
                >
                  <X size={13} /> Rejeter
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="bg-black/30 p-3 rounded-lg border border-white/[0.06]">
              <span className="text-[10px] text-gray-400 uppercase block">Taux USD / CDF</span>
              <span className="text-gray-500 line-through mr-2">{pendingProposal.current?.usdToFcRate}</span>
              <span className="font-bold text-[#C7D300]">➔ {pendingProposal.proposed?.usdToFcRate} FC</span>
            </div>
            <div className="bg-black/30 p-3 rounded-lg border border-white/[0.06]">
              <span className="text-[10px] text-gray-400 uppercase block">Commission Partenaire</span>
              <span className="text-gray-500 line-through mr-2">${pendingProposal.current?.referralCommissionUSD}</span>
              <span className="font-bold text-[#C7D300]">➔ ${pendingProposal.proposed?.referralCommissionUSD}</span>
            </div>
            <div className="bg-black/30 p-3 rounded-lg border border-white/[0.06]">
              <span className="text-[10px] text-gray-400 uppercase block">Abonnement Mensuel</span>
              <span className="text-gray-500 line-through mr-2">${pendingProposal.current?.monthlySubscriptionPrice}</span>
              <span className="font-bold text-[#C7D300]">➔ ${pendingProposal.proposed?.monthlySubscriptionPrice}</span>
            </div>
            <div className="bg-black/30 p-3 rounded-lg border border-white/[0.06]">
              <span className="text-[10px] text-gray-400 uppercase block">Réduction Promo</span>
              <span className="text-gray-500 line-through mr-2">-${pendingProposal.current?.promoDiscountUSD}</span>
              <span className="font-bold text-[#C7D300]">➔ -${pendingProposal.proposed?.promoDiscountUSD}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Paramètres Financiers Plateforme</h2>
            <p className="text-xs text-gray-400">Taux de change, tarification abonnement et commission partenaire</p>
          </div>
          <button
            onClick={onOpenProposalModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap"
          >
            <Sliders size={13} />
            <span>{isSuperAdmin ? "Modifier les paramètres" : "Proposer une modification"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Taux USD / CDF</span>
            <div className="text-xl font-bold text-white mt-1 tabular-nums">1 $ = {financialSettings?.usdToFcRate || 2850} FC</div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Commission Partenaire</span>
            <div className="text-xl font-bold text-[#C7D300] mt-1 tabular-nums">${financialSettings?.referralCommissionUSD || 5} USD</div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Abonnement Mensuel</span>
            <div className="text-xl font-bold text-white mt-1 tabular-nums">${financialSettings?.monthlySubscriptionPrice || 50} USD</div>
          </div>
          <div className="bg-black/30 p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] text-gray-400 uppercase font-semibold block">Réduction Code Promo</span>
            <div className="text-xl font-bold text-emerald-400 mt-1 tabular-nums">-${financialSettings?.promoDiscountUSD || 10} USD</div>
          </div>
        </div>
      </div>

      <form onSubmit={onSaveVisaConfig} className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 shrink-0">
              <CreditCard size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-white">
                  Paiement Carte Visa / Mastercard &amp; Prélèvement Automatique
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    financialSettings?.visaEnabled &&
                    (financialSettings?.visaSubscriptionUrl || financialSettings?.visaCheckoutUrl)
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/25"
                      : "bg-white/5 text-gray-400 border-white/10"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      financialSettings?.visaEnabled &&
                      (financialSettings?.visaSubscriptionUrl || financialSettings?.visaCheckoutUrl)
                        ? "bg-emerald-400"
                        : "bg-gray-500"
                    }`}
                  />
                  {financialSettings?.visaEnabled &&
                  (financialSettings?.visaSubscriptionUrl || financialSettings?.visaCheckoutUrl)
                    ? `Actif (${financialSettings?.visaProviderName || "Stripe"})`
                    : "En attente de lien"}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Configurez vos liens de paiement hébergés (HTTPS) pour les abonnements fournisseurs mensuels automatiques et les achats clients. Synchronisé en temps réel via Redis.
              </p>
            </div>
          </div>
          {isSuperAdmin ? (
            <button
              type="submit"
              disabled={isSavingVisa}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#C7D300] hover:bg-[#b5c000] disabled:opacity-50 text-[#0F1D27] font-bold text-xs rounded-lg cursor-pointer whitespace-nowrap transition-colors"
            >
              <ShieldCheck size={14} />
              <span>{isSavingVisa ? "Enregistrement..." : "Enregistrer les liens Visa"}</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-gray-400 whitespace-nowrap">
              <Lock size={12} /> Réservé Super Admin / DG
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="flex items-center justify-between gap-3 bg-black/30 p-3.5 rounded-xl border border-white/[0.06] cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-white block">Activer la Carte Visa</span>
              <span className="text-[11px] text-gray-400">Affiche l&apos;option Visa sur le site</span>
            </div>
            <input
              type="checkbox"
              checked={visaEnabled}
              disabled={!isSuperAdmin}
              onChange={(e) => setVisaEnabled(e.target.checked)}
              className="w-4 h-4 accent-[#C7D300] cursor-pointer disabled:opacity-50"
            />
          </label>

          <label className="flex items-center justify-between gap-3 bg-black/30 p-3.5 rounded-xl border border-white/[0.06] cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-white block">Prélèvement mensuel auto</span>
              <span className="text-[11px] text-gray-400">Renouvellement ${financialSettings?.monthlySubscriptionPrice || 50}/mois</span>
            </div>
            <input
              type="checkbox"
              checked={visaAutoBillingEnabled}
              disabled={!isSuperAdmin}
              onChange={(e) => setVisaAutoBillingEnabled(e.target.checked)}
              className="w-4 h-4 accent-[#C7D300] cursor-pointer disabled:opacity-50"
            />
          </label>

          <div className="bg-black/30 p-3.5 rounded-xl border border-white/[0.06]">
            <label className="text-[10px] text-gray-400 uppercase font-semibold block mb-1.5">
              Prestataire Passerelle
            </label>
            <select
              value={visaProviderName}
              disabled={!isSuperAdmin}
              onChange={(e) => setVisaProviderName(e.target.value)}
              className="w-full bg-[#0B151D] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#C7D300]/50 disabled:opacity-60"
            >
              <option value="Stripe">Stripe (Recommandé · Auto-Billing)</option>
              <option value="Flutterwave">Flutterwave (RDC / Afrique · Visa)</option>
              <option value="FlexPay">FlexPay RDC (Visa / Mastercard)</option>
              <option value="Maxicash">Maxicash (Visa / Mastercard)</option>
              <option value="CinetPay">CinetPay</option>
              <option value="PayPal">PayPal</option>
              <option value="Passerelle Visa">Autre passerelle HTTPS</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-gray-300 font-semibold uppercase tracking-wider">
                Lien Visa · Abonnement Fournisseur (${financialSettings?.monthlySubscriptionPrice || 50}/mois)
              </label>
              {visaSubscriptionUrl && (
                <a
                  href={visaSubscriptionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300"
                >
                  Tester <ExternalLink size={10} />
                </a>
              )}
            </div>
            <input
              type="url"
              value={visaSubscriptionUrl}
              disabled={!isSuperAdmin}
              onChange={(e) => setVisaSubscriptionUrl(e.target.value)}
              placeholder="https://buy.stripe.com/... (lien récurrent mensuel)"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 font-mono focus:outline-none focus:border-[#C7D300]/50 disabled:opacity-60"
            />
            <p className="text-[11px] text-gray-500">
              Utilisé dans l&apos;inscription fournisseur et la modale de renouvellement. Le paramètre <code className="text-gray-300">client_reference_id=sub_&#123;uid&#125;</code> est injecté automatiquement.
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-gray-300 font-semibold uppercase tracking-wider">
                Lien Visa · Boutique &amp; Achats Clients
              </label>
              {visaCheckoutUrl && (
                <a
                  href={visaCheckoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:text-sky-300"
                >
                  Tester <ExternalLink size={10} />
                </a>
              )}
            </div>
            <input
              type="url"
              value={visaCheckoutUrl}
              disabled={!isSuperAdmin}
              onChange={(e) => setVisaCheckoutUrl(e.target.value)}
              placeholder="https://buy.stripe.com/... ou lien checkout hébergé"
              className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-gray-600 font-mono focus:outline-none focus:border-[#C7D300]/50 disabled:opacity-60"
            />
            <p className="text-[11px] text-gray-500">
              Affiché dans le tunnel de commande client. La référence <code className="text-gray-300">client_reference_id=ord_&#123;orderId&#125;</code> permet la confirmation automatique.
            </p>
          </div>
        </div>

        <div className="bg-[#0B151D] border border-white/[0.08] rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400 block">
              Endpoint Webhook de Prélèvement Automatique (Fail-Closed · HMAC-SHA256)
            </span>
            <code className="text-xs font-mono text-white block truncate">
              {financialSettings?.visaWebhookEndpoint || "https://rayons.net/api/payments/visa-webhook"}
            </code>
            <p className="text-[11px] text-gray-400">
              À coller dans le tableau de bord de votre prestataire (événements <code className="text-gray-300">checkout.session.completed</code> &amp; <code className="text-gray-300">invoice.paid</code>) avec la variable serveur <code className="text-gray-300">STRIPE_WEBHOOK_SECRET</code> ou <code className="text-gray-300">VISA_WEBHOOK_SECRET</code>.
            </p>
          </div>
          <button
            type="button"
            onClick={onCopyWebhook}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-semibold text-white cursor-pointer shrink-0 transition-colors"
          >
            {copiedWebhook ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            <span>{copiedWebhook ? "Copié !" : "Copier l'URL Webhook"}</span>
          </button>
        </div>
      </form>

      <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-5 space-y-2.5">
        <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">Historique des validations</h3>
        {financialHistory.length === 0 ? (
          <p className="text-xs text-gray-500">Aucun changement récent enregistré.</p>
        ) : (
          <div className="divide-y divide-white/[0.05] text-xs">
            {financialHistory.map((h) => (
              <div key={h.id} className="py-2.5 flex items-center justify-between text-gray-400">
                <div>
                  <span className="font-semibold text-white">{h.reason || "Mise à jour financière"}</span>
                  <p className="text-[10px] text-gray-500">
                    Validé par {h.approvedByName || h.appliedByName || "Direction"} · Taux {h.values?.usdToFcRate} FC · Comm. ${h.values?.referralCommissionUSD}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-gray-500">
                  {h.appliedAt ? new Date(h.appliedAt).toLocaleDateString("fr-FR") : "Récent"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
