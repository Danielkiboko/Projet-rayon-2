"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, AlertCircle, HelpCircle, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createTicket } from "@/lib/ticketService";
import { TicketCategory, TicketPriority } from "@/types/tickets";

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (ticketId: string) => void;
  role: "client" | "supplier";
  defaultOrderId?: string;
  defaultSupplierId?: string;
}

export function NewTicketModal({
  isOpen,
  onClose,
  onCreated,
  role,
  defaultOrderId,
  defaultSupplierId,
}: NewTicketModalProps) {
  const { user, userData } = useAuth();

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>("order");
  const [priority, setPriority] = useState<TicketPriority>("medium");
  const [orderId, setOrderId] = useState(defaultOrderId || "");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!subject.trim() || !message.trim()) {
      setError("Veuillez renseigner le sujet et votre message.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const creatorName =
        userData?.displayName ||
        userData?.company ||
        userData?.name ||
        user.displayName ||
        (role === "supplier" ? "Fournisseur" : "Client");

      const ticketId = await createTicket({
        subject: subject.trim(),
        category,
        priority,
        initialMessage: message.trim(),
        creatorId: user.uid,
        creatorName,
        creatorEmail: user.email || "",
        creatorRole: role,
        creatorPhone: userData?.phone || userData?.phoneNumber || "",
        orderId: orderId.trim() || undefined,
        supplierId: defaultSupplierId || (role === "supplier" ? (userData?.parentSupplierId || user.uid) : undefined),
      });

      onClose();
      if (onCreated) onCreated(ticketId);
    } catch (err: any) {
      console.error("Error creating ticket:", err);
      setError(err.message || "Erreur lors de la création du ticket.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#0f172a] text-white border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <HelpCircle size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Nouveau ticket d'assistance</h2>
              <p className="text-xs text-slate-400">
                {role === "supplier"
                  ? "Contactez l'administration de Rayons.net"
                  : "Notre équipe et nos partenaires vous répondent rapidement"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Sujet */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Sujet de votre demande *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Problème avec ma commande, Erreur de facturation..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Catégorie */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Catégorie *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="order">📦 Commande</option>
                <option value="delivery">🚚 Livraison</option>
                <option value="payment">💳 Paiement & Facturation</option>
                <option value="product">🛍️ Produit / Article</option>
                <option value="property">🏢 Immobilier / Visite</option>
                <option value="account">👤 Compte & Profil</option>
                <option value="technical">⚙️ Technique / Bug</option>
                <option value="general">❓ Autre demande</option>
              </select>
            </div>

            {/* Priorité */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Priorité
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="low">🟢 Basse (simple question)</option>
                <option value="medium">🟡 Moyenne (besoin normal)</option>
                <option value="high">🟠 Haute (bloquant)</option>
                <option value="urgent">🔴 Urgente (critique)</option>
              </select>
            </div>
          </div>

          {/* Numéro de commande (facultatif) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Numéro de commande ou Référence (facultatif)
            </label>
            <div className="relative">
              <FileText size={16} className="absolute left-3.5 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="Ex: CMD-12345"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Message détaillé */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description détaillée de votre problème *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Expliquez en détail votre situation, les étapes effectuées, ou toute information utile pour vous aider..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !subject.trim() || !message.trim()}
              className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-medium text-sm shadow-lg shadow-purple-500/25 transition-all"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Envoi...</span>
                </>
              ) : (
                <>
                  <Send size={15} />
                  <span>Soumettre le ticket</span>
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
