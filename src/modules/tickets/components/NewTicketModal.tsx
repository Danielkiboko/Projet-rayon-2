"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Send, 
  AlertCircle, 
  HelpCircle, 
  ShoppingBag, 
  Image as ImageIcon, 
  Trash2, 
  Store, 
  Check, 
  Upload,
  Calendar,
  DollarSign
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createTicket } from "@/lib/ticketService";
import { TicketCategory, TicketPriority } from "@/types/tickets";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { optimizeImageToWebP } from "@/lib/imageOptimizer";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

  // Client Orders list for linking activities
  const [clientOrders, setClientOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Images upload
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Fetch client orders on mount if role === "client"
  useEffect(() => {
    if (!isOpen || !user || role !== "client") return;

    let isMounted = true;
    setLoadingOrders(true);

    const fetchOrders = async () => {
      try {
        const q = query(
          collection(db, "orders"),
          where("clientId", "==", user.uid),
          limit(50)
        );
        const snapshot = await getDocs(q);
        if (!isMounted) return;

        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        list.sort((a: any, b: any) => {
          const tA = a.createdAt?.toMillis?.() ?? (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const tB = b.createdAt?.toMillis?.() ?? (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return tB - tA;
        });

        setClientOrders(list);

        // Pre-select if defaultOrderId provided
        if (defaultOrderId) {
          const matched = list.find((o) => o.id === defaultOrderId);
          if (matched) {
            setSelectedOrder(matched);
            setOrderId(matched.id);
          }
        }
      } catch (err) {
        console.warn("Could not fetch client orders for ticket:", err);
      } finally {
        if (isMounted) setLoadingOrders(false);
      }
    };

    fetchOrders();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user, role, defaultOrderId]);

  // When selected order changes, auto-associate supplier
  const handleOrderChange = (selectedId: string) => {
    setOrderId(selectedId);
    if (!selectedId) {
      setSelectedOrder(null);
      return;
    }

    const matched = clientOrders.find((o) => o.id === selectedId);
    if (matched) {
      setSelectedOrder(matched);
      // Auto-suggest category if not set
      if (category === "general") {
        setCategory("order");
      }
      // If subject is empty, give a clean default
      if (!subject) {
        setSubject(`Demande relative à la commande #${matched.id.slice(-6).toUpperCase()}`);
      }
    } else {
      setSelectedOrder(null);
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    setError(null);

    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          // Compress via optimizeImageToWebP
          const optimized = await optimizeImageToWebP(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.75,
          });
          newUrls.push(optimized.dataUrl);
        }
      }

      setAttachments((prev) => [...prev, ...newUrls].slice(0, 5)); // Cap at 5 images
    } catch (err: any) {
      console.error("Image optimization error:", err);
      setError("Impossible de charger cette image. Veuillez réessayer.");
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

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

      // Extract supplier from selected order if any
      let associatedSupplierId = defaultSupplierId;
      let associatedSupplierName: string | undefined;

      if (selectedOrder) {
        // Try to find supplier on order or order items
        associatedSupplierId =
          selectedOrder.supplierId ||
          selectedOrder.items?.find((it: any) => it.supplierId)?.supplierId ||
          defaultSupplierId;

        associatedSupplierName =
          selectedOrder.supplierName ||
          selectedOrder.items?.find((it: any) => it.supplierName)?.supplierName;
      } else if (role === "supplier") {
        associatedSupplierId = userData?.parentSupplierId || user.uid;
        associatedSupplierName = creatorName;
      }

      // Order summary payload
      const orderSummary = selectedOrder
        ? {
            orderId: selectedOrder.id,
            totalAmount: selectedOrder.totalAmount || selectedOrder.total || 0,
            itemsCount: selectedOrder.items?.length || 1,
            itemsDescription:
              selectedOrder.items?.map((it: any) => it.name || it.title).join(", ") || "",
            status: selectedOrder.status || "pending",
            createdAt: selectedOrder.createdAt || null,
          }
        : undefined;

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
        orderId: selectedOrder ? selectedOrder.id : orderId.trim() || undefined,
        supplierId: associatedSupplierId || undefined,
        supplierName: associatedSupplierName || undefined,
        orderSummary,
        attachments: attachments.length > 0 ? attachments : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-slate-900 text-white border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <HelpCircle size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Nouveau ticket d'assistance</h2>
              <p className="text-xs text-slate-400">
                {role === "supplier"
                  ? "Contactez l'administration de Rayons.net"
                  : "Assistance directe avec l'administration et le fournisseur de votre achat"}
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
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Activity / Purchases Dropdown for Clients */}
          {role === "client" && (
            <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag size={14} className="text-purple-400" />
                  <span>Associer à un achat ou une activité</span>
                </label>
                {loadingOrders && (
                  <span className="text-[10px] text-slate-500 animate-pulse">Chargement de vos achats...</span>
                )}
              </div>

              <select
                value={orderId}
                onChange={(e) => handleOrderChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- Aucune commande spécifique (Demande générale) --</option>
                {clientOrders.map((ord) => {
                  const dateStr = ord.createdAt?.seconds
                    ? format(new Date(ord.createdAt.seconds * 1000), "d MMM yyyy", { locale: fr })
                    : "";
                  const total = ord.totalAmount || ord.total || 0;
                  const itemCount = ord.items?.length || 1;
                  const firstItem = ord.items?.[0]?.name || ord.items?.[0]?.title || "Commande";
                  return (
                    <option key={ord.id} value={ord.id}>
                      📦 Cmd #{ord.id.slice(-6).toUpperCase()} • {firstItem} {itemCount > 1 ? `(+${itemCount - 1})` : ""} • {total.toLocaleString()} CDF {dateStr ? `(${dateStr})` : ""}
                    </option>
                  );
                })}
              </select>

              {/* Order preview details if selected */}
              {selectedOrder && (
                <div className="mt-2.5 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-medium text-slate-200">
                    <span className="flex items-center gap-1.5 text-purple-300">
                      <Check size={13} className="text-purple-400" />
                      Commande #{selectedOrder.id.slice(-6).toUpperCase()} sélectionnée
                    </span>
                    <span className="font-bold text-white">
                      {(selectedOrder.totalAmount || selectedOrder.total || 0).toLocaleString()} CDF
                    </span>
                  </div>

                  {/* Supplier info notice */}
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-300/90 pt-1 border-t border-purple-500/15">
                    <Store size={13} className="shrink-0 text-amber-400" />
                    <span>
                      {selectedOrder.supplierName || selectedOrder.items?.[0]?.supplierName
                        ? `Le fournisseur "${selectedOrder.supplierName || selectedOrder.items?.[0]?.supplierName}" sera automatiquement associé au ticket.`
                        : "Le fournisseur associé à cette vente sera directement intégré dans la conversation."}
                    </span>
                  </div>
                </div>
              )}
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
              placeholder="Ex: Colis incomplet, Retard de livraison, Question produit..."
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

          {/* Message détaillé */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description détaillée de votre situation *
            </label>
            <textarea
              required
              rows={4}
              placeholder="Expliquez en détail votre demande ou votre réclamation..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          {/* Photo Attachments (Photos de preuve, reçu, colis, etc.) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon size={14} className="text-purple-400" />
                <span>Photos / Preuves jointes (Optionnel)</span>
              </label>
              <span className="text-[10px] text-slate-400">Max 5 photos</span>
            </div>

            {/* Thumbnail previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {attachments.map((imgUrl, index) => (
                  <div key={index} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-slate-700 bg-slate-800">
                    <img
                      src={imgUrl}
                      alt={`Preuve ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            {attachments.length < 5 && (
              <label className="flex items-center justify-center gap-2 p-3 border border-dashed border-slate-700 hover:border-purple-500/60 rounded-xl bg-slate-950/40 hover:bg-slate-900/60 cursor-pointer text-xs text-slate-400 hover:text-purple-300 transition-all">
                {isUploadingImage ? (
                  <>
                    <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    <span>Traitement et compression de l'image...</span>
                  </>
                ) : (
                  <>
                    <Upload size={15} />
                    <span>Ajouter une image ou photo (reçu, photo de l'article, capture...)</span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isUploadingImage}
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            )}
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
                  <span>Création en cours...</span>
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

