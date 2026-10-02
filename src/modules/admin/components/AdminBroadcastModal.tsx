"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, Send, Mail, Bell, CheckCircle2, AlertCircle, 
  Sparkles, Eye, Users, Building, UtensilsCrossed, 
  Shirt, Zap, FileText, Loader2
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export interface AdminBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (msg: string) => void;
}

type TargetRayon = "all" | "immo" | "mode" | "connect" | "saveurs";

interface MessageTemplate {
  id: string;
  name: string;
  icon: string;
  subject: string;
  message: string;
}

const PRESET_TEMPLATES: MessageTemplate[] = [
  {
    id: "announcement",
    name: "📢 Annonce plateforme",
    icon: "📢",
    subject: "Mise à jour importante sur votre espace partenaire Rayons.net",
    message: "Chers partenaires,\n\nNous venons de déployer de nouvelles améliorations sur votre portail fournisseur (suivi des encaissements de caisse, livrets de commandes et rapports d'activité).\n\nNous vous invitons à vous connecter sur rayons.net pour découvrir ces nouveautés et optimiser la gestion quotidienne de vos flux.\n\nL'équipe Direction Rayons.net reste à votre disposition.",
  },
  {
    id: "subscription_reminder",
    name: "💳 Rappel abonnement / dépôt",
    icon: "💳",
    subject: "Rappel concernant le renouvellement de votre abonnement partenaire",
    message: "Bonjour,\n\nNous vous rappelons que l'échéance de votre abonnement partenaire Rayons.net arrive à terme.\n\nAfin de garantir la continuité de l'affichage de vos annonces et la réception des commandes de vos clients, merci de régulariser votre compte depuis la rubrique Finance de votre espace.\n\nPour toute assistance, contactez le service comptabilité.",
  },
  {
    id: "quality_delivery",
    name: "📦 Qualité & Rapidité livraison",
    icon: "📦",
    subject: "Consignes de préparation des commandes et remise aux coursiers",
    message: "Chers partenaires commerçants et restaurateurs,\n\nAfin d'optimiser l'expérience client et réduire les délais de livraison à Kinshasa, nous vous demandons de valider et préparer vos colis dès réception de la notification sonore.\n\nAssurez-vous de bien emballer vos produits avant la prise en charge par notre réseau de livreurs Rayons.net.",
  },
  {
    id: "promotion_campaign",
    name: "🎉 Campagne promotionnelle",
    icon: "🎉",
    subject: "Nouvelle campagne promotionnelle — Mettez vos catalogues en avant !",
    message: "Chers partenaires,\n\nUne grande campagne de promotion est en cours sur Rayons.net auprès de nos clients kinois.\n\nC'est le moment idéal pour mettre à jour vos prix, publier de nouveaux articles ou biens disponibles, et profiter d'une visibilité maximale.\n\nBonnes ventes à tous !",
  },
];

export default function AdminBroadcastModal({ isOpen, onClose, onSuccess }: AdminBroadcastModalProps) {
  const { user } = useAuth();

  const [targetRayon, setTargetRayon] = useState<TargetRayon>("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; text: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const applyTemplate = (t: MessageTemplate) => {
    setSubject(t.subject);
    setMessage(t.message);
    setResult(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || !user) return;

    setIsSubmitting(true);
    setResult(null);

    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          targetRayon,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const successMsg = data.message || "Message diffusé avec succès par Email et Notification !";
        setResult({ success: true, text: successMsg });
        if (onSuccess) onSuccess(successMsg);
        setTimeout(() => {
          onClose();
          setResult(null);
          setSubject("");
          setMessage("");
        }, 2200);
      } else {
        setResult({ success: false, text: data.error || "Impossible d'envoyer le message." });
      }
    } catch (err: any) {
      console.error("Broadcast error:", err);
      setResult({ success: false, text: err.message || "Erreur réseau lors de la diffusion." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-[#0D151D] border border-white/10 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden my-6"
        >
          {/* Header Élégant */}
          <div className="relative p-6 border-b border-white/10 bg-gradient-to-r from-[#0F1D27] via-[#152a38] to-[#0F1D27]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#C7D300]/15 border border-[#C7D300]/30 flex items-center justify-center text-[#C7D300]">
                  <Send size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Écrire à tous les Partenaires
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Email + App
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Diffusez un message officiel reçu instantanément par email et dans la cloche de notification.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <form onSubmit={handleSend} className="p-6 space-y-5">
            {/* 1. Sélection des Destinataires */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-gray-300 block mb-2">
                1. Sélectionner les Destinataires
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: "all", label: "Tous", icon: Users, color: "text-[#C7D300]" },
                  { id: "immo", label: "Immo", icon: Building, color: "text-[#4C6EF5]" },
                  { id: "saveurs", label: "Saveurs", icon: UtensilsCrossed, color: "text-[#FF6B35]" },
                  { id: "mode", label: "Mode", icon: Shirt, color: "text-[#D4B08C]" },
                  { id: "connect", label: "Connect", icon: Zap, color: "text-[#00B5A5]" },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = targetRayon === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTargetRayon(item.id as TargetRayon)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-[#C7D300]/15 border-[#C7D300] text-white shadow-lg shadow-[#C7D300]/10 scale-[1.02]"
                          : "bg-black/30 border-white/10 text-gray-400 hover:border-white/20 hover:text-white"
                      }`}
                    >
                      <Icon size={18} className={`mb-1 ${item.color}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Modèles Rapides (Gain de temps pour l'admin) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-[#C7D300]" />
                  2. Modèles Prédéfinis (Optionnel)
                </label>
                {(subject || message) && (
                  <button
                    type="button"
                    onClick={() => { setSubject(""); setMessage(""); }}
                    className="text-[11px] text-gray-400 hover:text-white"
                  >
                    Effacer
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_TEMPLATES.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => applyTemplate(tmpl)}
                    className="text-left p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-xs group"
                  >
                    <div className="font-semibold text-white group-hover:text-[#C7D300] flex items-center gap-1.5">
                      <span>{tmpl.icon}</span>
                      <span className="truncate">{tmpl.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Objet & Message */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-300 block mb-1">
                  Objet du message (Sujet de l'email)
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Ex : Information importante concernant vos paiements..."
                  className="w-full px-4 py-2.5 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-300">
                    Corps du message
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-[11px] text-[#C7D300] hover:underline flex items-center gap-1"
                  >
                    <Eye size={12} />
                    {showPreview ? "Masquer l'aperçu" : "Aperçu de l'email"}
                  </button>
                </div>
                <textarea
                  required
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Rédigez votre annonce ou message aux fournisseurs ici..."
                  className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#C7D300] leading-relaxed resize-none"
                />
              </div>
            </div>

            {/* Aperçu en direct si activé */}
            {showPreview && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-gray-400 border-b border-white/10 pb-2">
                  <span className="font-semibold text-white">Aperçu Réception Fournisseur</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><Mail size={12} className="text-emerald-400" /> Boîte Email</span>
                    <span className="flex items-center gap-1"><Bell size={12} className="text-blue-400" /> Cloche App</span>
                  </div>
                </div>
                <p className="font-bold text-white text-sm">{subject || "(Sans objet)"}</p>
                <div className="text-gray-300 whitespace-pre-line leading-relaxed max-h-40 overflow-y-auto pr-2">
                  {message || "(Votre texte apparaîtra ici)"}
                </div>
              </motion.div>
            )}

            {/* Notification de Statut / Résultat */}
            {result && (
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-2.5 text-xs font-semibold ${
                  result.success
                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                    : "bg-red-500/15 border-red-500/30 text-red-300"
                }`}
              >
                {result.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{result.text}</span>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !subject.trim() || !message.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#C7D300] to-[#b5c000] text-[#0F1D27] font-bold text-sm shadow-lg shadow-[#C7D300]/20 hover:brightness-110 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Diffusion en cours...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Diffuser à tous ({targetRayon.toUpperCase()})</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
