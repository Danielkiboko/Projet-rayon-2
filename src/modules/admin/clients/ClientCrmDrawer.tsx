"use client";

import { useEffect, useState } from "react";
import {
  X,
  Phone,
  Mail,
  MessageCircle,
  ShoppingBag,
  LifeBuoy,
  Tag,
  Save,
  Send,
  ShieldOff,
  ShieldCheck,
  Loader2,
  Calendar,
  MapPin,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import toast from "react-hot-toast";

export interface CrmClientSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  isOnline: boolean;
  createdAt: Date | null;
  crmTags?: string[];
  crmNote?: string;
  isSuspended?: boolean;
}

const CRM_TAG_OPTIONS = [
  { id: "VIP", label: "VIP", cls: "bg-[#C7D300]/15 text-[#C7D300] border-[#C7D300]/35" },
  { id: "FIDÈLE", label: "Fidèle", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
  { id: "PRO", label: "Pro / Entreprise", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  { id: "À RELANCER", label: "À relancer", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  { id: "À SURVEILLER", label: "À surveiller", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
];

export default function ClientCrmDrawer({
  client,
  onClose,
  onUpdated,
}: {
  client: CrmClientSummary | null;
  onClose: () => void;
  onUpdated?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [isSuspended, setIsSuspended] = useState(false);
  const [savingCrm, setSavingCrm] = useState(false);
  const [togglingSuspend, setTogglingSuspend] = useState(false);

  // Notification directe
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMsg, setNotifMsg] = useState("");
  const [sendingNotif, setSendingNotif] = useState(false);

  useEffect(() => {
    if (!client) return;
    let active = true;
    setLoading(true);
    setTags(client.crmTags || []);
    setNote(client.crmNote || "");
    setIsSuspended(Boolean(client.isSuspended));

    (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const res = await fetch(`/api/admin/clients/crm?uid=${encodeURIComponent(client.id)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
        const json = await res.json();
        if (active && json.success) {
          setDetail(json);
          setTags(json.profile?.crmTags || []);
          setNote(json.profile?.crmNote || "");
          setIsSuspended(Boolean(json.profile?.isSuspended));
        }
      } catch (err) {
        console.error("[CRM DRAWER]", err);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [client]);

  if (!client) return null;

  const toggleTag = (tagId: string) => {
    setTags((prev) => (prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]));
  };

  const handleSaveCrm = async () => {
    setSavingCrm(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/clients/crm", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "UPDATE_CRM",
          uid: client.id,
          crmTags: tags,
          crmNote: note,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erreur sauvegarde CRM");
      toast.success("Fiche CRM enregistrée !");
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSavingCrm(false);
    }
  };

  const handleToggleSuspend = async () => {
    const nextState = !isSuspended;
    const msg = nextState
      ? `Suspendre le compte client "${client.name}" ? (Ses commandes et son historique sont conservés.)`
      : `Réactiver le compte client "${client.name}" ?`;
    if (!confirm(msg)) return;

    setTogglingSuspend(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/clients/crm", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "TOGGLE_SUSPEND",
          uid: client.id,
          isSuspended: nextState,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erreur mise à jour statut");
      setIsSuspended(nextState);
      toast.success(nextState ? "Compte client suspendu." : "Compte client réactivé !");
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setTogglingSuspend(false);
    }
  };

  const handleSendDirectNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle.trim() || !notifMsg.trim()) return;
    setSendingNotif(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch("/api/admin/clients/crm", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          action: "SEND_MESSAGE",
          uid: client.id,
          title: notifTitle.trim(),
          message: notifMsg.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Erreur envoi notification");
      toast.success("Notification envoyée au client !");
      setNotifTitle("");
      setNotifMsg("");
    } catch (err: any) {
      toast.error(err.message || "Erreur");
    } finally {
      setSendingNotif(false);
    }
  };

  const cleanPhone = (client.phone || "").replace(/[^0-9]/g, "");
  const waText = encodeURIComponent(`Bonjour ${client.name}, ici le Service Client Rayons.net. Comment pouvons-nous vous aider aujourd'hui ?`);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} />
      <aside className="relative z-10 w-full max-w-lg h-dvh bg-[#0B151C] border-l border-white/10 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3 bg-[#0F1D27] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-200 font-bold text-sm shrink-0">
              {(client.name || "C").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white truncate">{client.name}</h2>
                {isSuspended ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/15 text-red-400 border border-red-500/25">
                    Suspendu
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
                    Actif
                  </span>
                )}
              </div>
              <p className="text-[11px] text-gray-400 truncate">
                {client.email || "Sans email"} {client.phone ? `· ${client.phone}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto rayons-scroll p-5 space-y-5">
          {/* Canaux directs */}
          <div className="flex flex-wrap items-center gap-2">
            {cleanPhone && (
              <>
                <a
                  href={`https://wa.me/${cleanPhone}?text=${waText}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors"
                >
                  <MessageCircle size={13} />
                  <span>WhatsApp</span>
                </a>
                <a
                  href={`tel:${client.phone}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 text-xs font-semibold transition-colors"
                >
                  <Phone size={13} />
                  <span>Appeler</span>
                </a>
              </>
            )}
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 text-xs font-semibold transition-colors"
              >
                <Mail size={13} />
                <span>Email</span>
              </a>
            )}
            <button
              type="button"
              onClick={handleToggleSuspend}
              disabled={togglingSuspend}
              className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 ${
                isSuspended
                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25"
                  : "bg-red-500/10 text-red-300 border-red-500/25 hover:bg-red-500/20"
              }`}
            >
              {isSuspended ? <ShieldCheck size={13} /> : <ShieldOff size={13} />}
              <span>{isSuspended ? "Réactiver" : "Suspendre"}</span>
            </button>
          </div>

          {detail?.profile?.address && (
            <div className="flex items-center gap-2 text-xs text-gray-300 bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2">
              <MapPin size={13} className="text-[#C7D300] shrink-0" />
              <span>{detail.profile.address}</span>
            </div>
          )}

          {/* 3 Mini KPIs Client */}
          {loading ? (
            <div className="py-6 flex items-center justify-center gap-2 text-xs text-gray-400">
              <Loader2 size={16} className="animate-spin text-[#C7D300]" />
              <span>Chargement de l&apos;historique client...</span>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <div className="bg-[#0F1A23] border border-white/[0.08] rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Commandes</p>
                  <p className="text-lg font-bold text-white tabular-nums mt-0.5">
                    {detail?.summary?.ordersCount ?? 0}
                  </p>
                </div>
                <div className="bg-[#0F1A23] border border-white/[0.08] rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Total Dépensé</p>
                  <p className="text-lg font-bold text-[#C7D300] tabular-nums mt-0.5">
                    ${Math.round(detail?.summary?.totalSpentUSD ?? 0).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="bg-[#0F1A23] border border-white/[0.08] rounded-xl p-3">
                  <p className="text-[10px] text-gray-400 uppercase font-semibold">Panier Moyen</p>
                  <p className="text-lg font-bold text-sky-400 tabular-nums mt-0.5">
                    ${Math.round(detail?.summary?.avgBasketUSD ?? 0).toLocaleString("fr-FR")}
                  </p>
                </div>
              </div>

              {/* Tags & Notes CRM */}
              <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wide">
                  <Tag size={14} className="text-[#C7D300]" />
                  <span>Segmentation &amp; Note Interne CRM</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {CRM_TAG_OPTIONS.map((opt) => {
                    const active = tags.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => toggleTag(opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          active
                            ? opt.cls
                            : "bg-white/[0.03] text-gray-400 border-white/10 hover:text-white"
                        }`}
                      >
                        {active ? "✓ " : "+ "}
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ex: Client fidèle Gombe, préfère les livraisons en fin de journée..."
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-hidden focus:border-[#C7D300]"
                />

                <button
                  type="button"
                  onClick={handleSaveCrm}
                  disabled={savingCrm}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#C7D300] hover:bg-[#b5c000] text-[#0F1D27] text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save size={13} />
                  <span>{savingCrm ? "Enregistrement..." : "Enregistrer la fiche CRM"}</span>
                </button>
              </div>

              {/* Notification Directe au Client */}
              <form
                onSubmit={handleSendDirectNotif}
                className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-4 space-y-2.5"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wide">
                  <Send size={13} className="text-sky-400" />
                  <span>Envoyer une Notification Directe (App + Web)</span>
                </div>
                <input
                  type="text"
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder="Titre (ex: Offre spéciale client VIP)"
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-hidden focus:border-sky-400"
                  required
                />
                <textarea
                  rows={2}
                  value={notifMsg}
                  onChange={(e) => setNotifMsg(e.target.value)}
                  placeholder="Votre message personnalisé..."
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-xs text-white placeholder:text-gray-500 focus:outline-hidden focus:border-sky-400"
                  required
                />
                <button
                  type="submit"
                  disabled={sendingNotif}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Send size={13} />
                  <span>{sendingNotif ? "Envoi..." : "Envoyer au client"}</span>
                </button>
              </form>

              {/* Historique des Commandes */}
              <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wide">
                    <ShoppingBag size={13} className="text-[#C7D300]" />
                    <span>Commandes Récentes ({detail?.orders?.length ?? 0})</span>
                  </div>
                </div>
                {(detail?.orders || []).length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">Aucune commande enregistrée pour ce client.</p>
                ) : (
                  <div className="divide-y divide-white/[0.05]">
                    {detail.orders.slice(0, 8).map((o: any) => (
                      <div key={o.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="font-mono font-bold text-white">#{o.id.slice(0, 6).toUpperCase()}</span>
                          <span className="text-gray-500 ml-2">
                            {o.createdAt ? new Date(o.createdAt).toLocaleDateString("fr-FR") : "—"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300 font-semibold">
                            {o.status}
                          </span>
                          <span className="font-bold text-[#C7D300] tabular-nums">
                            ${Number(o.totalAmount || 0).toFixed(0)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historique des Tickets SAV */}
              <div className="bg-[#0F1A23] border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wide">
                  <LifeBuoy size={13} className="text-amber-400" />
                  <span>Tickets SAV ({detail?.tickets?.length ?? 0})</span>
                </div>
                {(detail?.tickets || []).length === 0 ? (
                  <p className="text-xs text-gray-500 py-2">Aucun ticket SAV ouvert par ce client.</p>
                ) : (
                  <div className="divide-y divide-white/[0.05]">
                    {detail.tickets.slice(0, 6).map((tk: any) => (
                      <div key={tk.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-200 truncate">{tk.subject}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300 uppercase shrink-0">
                          {tk.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {client.createdAt && (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
                  <Calendar size={12} />
                  <span>Inscrit le {client.createdAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</span>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
