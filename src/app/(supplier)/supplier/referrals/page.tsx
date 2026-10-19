"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Users,
  DollarSign,
  Send,
  Mail,
  Sparkles,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

export default function SupplierReferralsPage() {
  const { user, userData } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Formulaire d'invitation
  const [inviteEmails, setInviteEmails] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);

  // Onglet sélectionné
  const [activeTab, setActiveTab] = useState<"filleuls" | "commissions" | "invites">("filleuls");

  const fetchReferralData = async () => {
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
        toast.error(json.error || "Impossible de charger les données de parrainage.");
      }
    } catch (err: any) {
      console.error("Error loading referrals:", err);
      toast.error("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferralData();
  }, [user]);

  const handleCopyCode = () => {
    if (!data?.referralCode) return;
    navigator.clipboard.writeText(data.referralCode);
    setCopiedCode(true);
    toast.success("Code promo copié !");
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopiedLink(true);
    toast.success("Lien de parrainage copié !");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleShareWhatsApp = () => {
    if (!data?.referralCode || !data?.referralLink) return;
    const text = `Bonjour ! Rejoins les commerçants de Kinshasa sur Rayons.net avec mon code promo *${data.referralCode}* et profite de 10$ de réduction sur ton abonnement :\n${data.referralLink}`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const handleSendInvites = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmails.trim()) {
      toast.error("Veuillez saisir au moins une adresse email.");
      return;
    }
    setSendingInvites(true);
    try {
      const token = await user?.getIdToken();
      const res = await fetch("/api/referrals/invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          emails: inviteEmails,
          personalMessage: personalMessage.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Échec de l'envoi des invitations.");
      }

      toast.success(json.message || "Invitation(s) envoyée(s) !");
      setInviteEmails("");
      setPersonalMessage("");
      fetchReferralData();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi.");
    } finally {
      setSendingInvites(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-white">
        <div className="w-12 h-12 rounded-full border-3 border-white/10 border-t-[#C7D300] animate-spin mb-3" />
        <p className="text-xs text-gray-400">Chargement de votre espace parrainage...</p>
      </div>
    );
  }

  const stats = data?.stats || {};
  const code = data?.referralCode || "---";
  const link = data?.referralLink || "";
  const filleuls = data?.filleuls || [];
  const commissions = data?.commissions || [];
  const invites = data?.invites || [];

  return (
    <div className="space-y-6 pb-12">
      <Toaster position="top-right" />

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#C7D300]/10 text-[#C7D300]">
              <Gift size={20} />
            </span>
            <h1 className="text-2xl font-black text-white tracking-tight">Programme de Parrainage</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1 max-w-xl">
            Invitez d'autres commerçants et entrepreneurs sur Rayons.net. Vous gagnez{" "}
            <strong className="text-[#C7D300]">5 USD de commission à vie</strong> sur chacun de leurs paiements d'abonnement,
            et ils bénéficient de <strong className="text-emerald-400">10 USD de réduction</strong> sur leur prochain mois.
          </p>
        </div>

        {stats.pendingDiscount > 0 && (
          <div className="px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <Sparkles size={16} className="text-emerald-400 shrink-0" />
            <span>
              Réduction active sur votre prochain abonnement : <strong>-${stats.pendingDiscount} USD</strong>
            </span>
          </div>
        )}
      </div>

      {/* BANNIÈRE CODE & LIEN DE PARRAINAGE */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-[#13222e] via-[#0F1D27] to-[#162734] border border-white/10 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#C7D300]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 items-center">
          <div className="lg:col-span-7 space-y-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#C7D300] bg-[#C7D300]/10 px-3 py-1 rounded-full">
              <Sparkles size={12} /> Votre Code Promo Exclusif
            </span>
            <h2 className="text-3xl font-black text-white tracking-wider font-mono">{code}</h2>
            <p className="text-xs text-gray-300 leading-relaxed">
              Partagez ce code ou votre lien direct. Dès qu'un commerçant s'inscrit avec ce code et active son compte, vous
              êtes automatiquement rattaché comme son parrain.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={handleCopyCode}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 border border-white/10 cursor-pointer"
              >
                {copiedCode ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedCode ? "Copié !" : "Copier le code"}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className="px-4 py-2.5 bg-[#C7D300] hover:bg-[#b8c200] text-[#0F1D27] rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-[#C7D300]/20 cursor-pointer"
              >
                {copiedLink ? <Check size={14} /> : <Share2 size={14} />}
                <span>{copiedLink ? "Lien copié !" : "Copier mon lien d'invitation"}</span>
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer"
              >
                <ExternalLink size={14} />
                <span>Partager sur WhatsApp</span>
              </button>
            </div>
          </div>

          {/* RÉSUMÉ RÈGLE */}
          <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-4 text-xs space-y-2.5">
            <div className="font-bold text-white flex items-center gap-1.5">
              <HelpCircle size={14} className="text-[#C7D300]" />
              <span>Comment fonctionne la commission ?</span>
            </div>
            <ul className="space-y-1.5 text-gray-300 text-[11px] leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="text-[#C7D300] font-black">•</span>
                <span>
                  <strong>5 USD à l'inscription</strong> : Dès que votre invité règle son 1er abonnement ($50).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#C7D300] font-black">•</span>
                <span>
                  <strong>5 USD à chaque réabonnement mensuel</strong> : Valable <em>à vie</em> tant que le filleul renouvelle.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-black">•</span>
                <span>
                  <strong>10 USD de réduction pour votre invité</strong> : Sur son prochain mois de cotisation.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 font-black">•</span>
                <span>
                  <strong>Versement sur demande</strong> : Retirez vos gains en cash ou Mobile Money via la caisse centrale.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* KPI STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Solde en attente */}
        <div className="p-4 rounded-2xl bg-[#0F1D27] border border-white/10 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Solde à recevoir</span>
            <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-white">${stats.referralBalance?.toFixed(2) || "0.00"}</div>
          <span className="text-[10px] text-amber-400 font-medium mt-1 block">Prêt pour versement admin</span>
        </div>

        {/* Total gagné à vie */}
        <div className="p-4 rounded-2xl bg-[#0F1D27] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Total gagné à vie</span>
            <span className="p-1.5 rounded-lg bg-[#C7D300]/10 text-[#C7D300]">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-[#C7D300]">${stats.referralTotalEarned?.toFixed(2) || "0.00"}</div>
          <span className="text-[10px] text-gray-400 mt-1 block">Commissions cumulées</span>
        </div>

        {/* Déjà versé */}
        <div className="p-4 rounded-2xl bg-[#0F1D27] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Total déjà perçu</span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-400">${stats.referralPaidTotal?.toFixed(2) || "0.00"}</div>
          <span className="text-[10px] text-gray-400 mt-1 block">Versé par la caisse centrale</span>
        </div>

        {/* Nombre de filleuls */}
        <div className="p-4 rounded-2xl bg-[#0F1D27] border border-white/10 shadow-sm">
          <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
            <span>Filleuls rattachés</span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
              <Users size={16} />
            </span>
          </div>
          <div className="text-2xl font-black text-white">{filleuls.length}</div>
          <span className="text-[10px] text-gray-400 mt-1 block">Boutiques partenaires actives</span>
        </div>
      </div>

      {/* FORMULAIRE D'INVITATION PAR EMAIL */}
      <div className="p-6 rounded-3xl bg-[#0F1D27] border border-white/10 space-y-4">
        <div className="flex items-center gap-2">
          <Mail size={18} className="text-[#C7D300]" />
          <h3 className="text-base font-bold text-white">Inviter des confrères commerçants par Email</h3>
        </div>
        <p className="text-xs text-gray-400">
          Envoyez directement une invitation officielle Rayons.net avec votre code promo et les avantages détaillés.
        </p>

        <form onSubmit={handleSendInvites} className="space-y-3">
          <div>
            <label className="text-[11px] font-bold text-gray-300 block mb-1">
              Adresses email des confrères (séparées par une virgule ou espace) :
            </label>
            <input
              type="text"
              required
              value={inviteEmails}
              onChange={(e) => setInviteEmails(e.target.value)}
              placeholder="boutique1@gmail.com, contact@magasin.cd"
              className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-xs text-white placeholder-gray-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-gray-300 block mb-1">
              Message personnalisé (facultatif) :
            </label>
            <textarea
              rows={2}
              value={personalMessage}
              onChange={(e) => setPersonalMessage(e.target.value)}
              placeholder="Ex : Salut ! C'est Daniel. Je t'invite à ouvrir ta boutique sur Rayons.net pour vendre en ligne à Kinshasa."
              className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C7D300] text-xs text-white placeholder-gray-500 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={sendingInvites || !inviteEmails.trim()}
              className="px-5 py-2.5 bg-[#C7D300] hover:bg-[#b5bf00] text-[#0F1D27] font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Send size={14} />
              <span>{sendingInvites ? "Envoi en cours..." : "Envoyer les invitations"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* TABLEAU / ONGLETS */}
      <div className="space-y-4">
        {/* Switch d'onglets */}
        <div className="flex border-b border-white/10 gap-2">
          <button
            onClick={() => setActiveTab("filleuls")}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === "filleuls" ? "text-[#C7D300]" : "text-gray-400 hover:text-white"
            }`}
          >
            <span>Mes Filleuls ({filleuls.length})</span>
            {activeTab === "filleuls" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C7D300] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("commissions")}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === "commissions" ? "text-[#C7D300]" : "text-gray-400 hover:text-white"
            }`}
          >
            <span>Historique des Commissions ({commissions.length})</span>
            {activeTab === "commissions" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C7D300] rounded-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab("invites")}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
              activeTab === "invites" ? "text-[#C7D300]" : "text-gray-400 hover:text-white"
            }`}
          >
            <span>Invitations envoyées ({invites.length})</span>
            {activeTab === "invites" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#C7D300] rounded-full" />
            )}
          </button>
        </div>

        {/* TAB 1 : MES FILLEULS */}
        {activeTab === "filleuls" && (
          <div className="bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-sm">
            {filleuls.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                <Users size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="font-bold text-gray-300">Aucun filleul rattaché pour le moment.</p>
                <p>Partagez votre code promo ou envoyez des invitations pour commencer à toucher des commissions à vie.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Boutique Filleul</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Inscrit le</th>
                      <th className="py-3 px-4 text-center">Paiements validés</th>
                      <th className="py-3 px-4 text-right">Commissions générées</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-200">
                    {filleuls.map((f: any) => (
                      <tr key={f.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-[#C7D300]/10 text-[#C7D300] flex items-center justify-center font-bold text-xs shrink-0">
                            {f.filleulName?.charAt(0).toUpperCase() || "B"}
                          </span>
                          <span>{f.filleulName}</span>
                        </td>
                        <td className="py-3 px-4 text-gray-400">{f.filleulEmail || "---"}</td>
                        <td className="py-3 px-4 text-gray-400">
                          {f.createdAt ? new Date(f.createdAt).toLocaleDateString("fr-FR") : "---"}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 font-bold text-[11px]">
                            {f.paymentsCount || 0} mois
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-[#C7D300]">
                          +${Number(f.totalCommissions || 0).toFixed(2)} USD
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2 : HISTORIQUE DES COMMISSIONS */}
        {activeTab === "commissions" && (
          <div className="bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-sm">
            {commissions.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                <DollarSign size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="font-bold text-gray-300">Aucune commission enregistrée pour l'instant.</p>
                <p>Chaque fois qu'un de vos filleuls s'abonne ou se réabonne, une entrée de 5 USD sera créditée ici.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Filleul</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Réf Paiement</th>
                      <th className="py-3 px-4">Montant</th>
                      <th className="py-3 px-4 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-200">
                    {commissions.map((c: any) => (
                      <tr key={c.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 text-gray-400">
                          {c.createdAt ? new Date(c.createdAt).toLocaleDateString("fr-FR") : "---"}
                        </td>
                        <td className="py-3 px-4 font-bold text-white">{c.filleulName}</td>
                        <td className="py-3 px-4">
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-gray-300">
                            {c.kind === "SIGNUP" ? "Adhésion initiale" : "Réabonnement"}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-gray-400 text-[11px]">{c.paymentRef || "---"}</td>
                        <td className="py-3 px-4 font-black text-emerald-400">+${c.amount.toFixed(2)} USD</td>
                        <td className="py-3 px-4 text-right">
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3 : INVITATIONS ENVOYÉES */}
        {activeTab === "invites" && (
          <div className="bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-sm">
            {invites.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs space-y-2">
                <Send size={32} className="mx-auto text-gray-600 mb-2" />
                <p className="font-bold text-gray-300">Aucune invitation envoyée pour le moment.</p>
                <p>Utilisez le formulaire ci-dessus pour inviter des commerçants par email.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/10 text-gray-400 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Destinataire</th>
                      <th className="py-3 px-4">Envoyée le</th>
                      <th className="py-3 px-4 text-right">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-gray-200">
                    {invites.map((inv: any) => (
                      <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-medium text-white">{inv.email}</td>
                        <td className="py-3 px-4 text-gray-400">
                          {inv.sentAt ? new Date(inv.sentAt).toLocaleDateString("fr-FR") : "---"}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {inv.status === "REGISTERED" ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold text-[10px]">
                              Inscrit & abonné
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-gray-500/10 text-gray-400 font-bold text-[10px]">
                              Invitation envoyée
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
