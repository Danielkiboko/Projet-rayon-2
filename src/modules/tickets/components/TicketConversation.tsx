"use client";

import { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { 
  Send, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Store, 
  User, 
  HelpCircle, 
  ChevronLeft,
  AlertTriangle,
  RotateCcw,
  ShoppingBag,
  Image as ImageIcon,
  Archive,
  ExternalLink,
  Trash2,
  X
} from "lucide-react";
import { 
  Ticket, 
  TicketMessage, 
  TicketStatus, 
  TicketPriority 
} from "@/types/tickets";
import { 
  sendTicketReply, 
  updateTicketStatus, 
  reopenTicket,
  getCategoryBadge, 
  getStatusBadge, 
  getPriorityBadge 
} from "@/lib/ticketService";
import { optimizeImageToWebP } from "@/lib/imageOptimizer";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface TicketConversationProps {
  ticket: Ticket;
  userRole: "admin" | "supplier" | "client";
  onBack?: () => void;
  onStatusChange?: (newStatus: TicketStatus) => void;
}

export function TicketConversation({
  ticket,
  userRole,
  onBack,
  onStatusChange,
}: TicketConversationProps) {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<TicketStatus>(ticket.status);
  const [isArchived, setIsArchived] = useState<boolean>(!!ticket.isArchived);
  const [replyAttachments, setReplyAttachments] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentStatus(ticket.status);
    setIsArchived(!!ticket.isArchived || ticket.status === "closed");
  }, [ticket.status, ticket.isArchived]);

  // Mark unread as read when viewed
  useEffect(() => {
    if (!ticket?.id || !user) return;
    const ticketRef = doc(db, "tickets", ticket.id);
    if (userRole === "admin" && ticket.unreadByAdmin) {
      updateDoc(ticketRef, { unreadByAdmin: false }).catch(() => {});
    } else if (userRole === "client" && ticket.unreadByClient) {
      updateDoc(ticketRef, { unreadByClient: false }).catch(() => {});
    } else if (userRole === "supplier" && ticket.unreadBySupplier) {
      updateDoc(ticketRef, { unreadBySupplier: false }).catch(() => {});
    }
  }, [ticket?.id, ticket?.unreadByAdmin, ticket?.unreadByClient, ticket?.unreadBySupplier, userRole, user]);

  // Listen to messages
  useEffect(() => {
    if (!ticket?.id) return;
    const q = query(
      collection(db, "tickets", ticket.id, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: TicketMessage[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as TicketMessage[];
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 80);
    });

    return () => unsubscribe();
  }, [ticket?.id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.type.startsWith("image/")) {
          const optimized = await optimizeImageToWebP(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.75,
          });
          newUrls.push(optimized.dataUrl);
        }
      }
      setReplyAttachments((prev) => [...prev, ...newUrls].slice(0, 3));
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && replyAttachments.length === 0) || !user || isSending) return;

    const messageText = newMessage.trim();
    const attachmentsToSend = [...replyAttachments];
    setNewMessage("");
    setReplyAttachments([]);
    setIsSending(true);

    try {
      const senderName =
        userData?.displayName ||
        userData?.company ||
        userData?.name ||
        user.displayName ||
        (userRole === "admin" ? "Support Rayons.net" : userRole === "supplier" ? "Fournisseur" : "Client");

      let recipientEmail = ticket.creatorEmail;
      let recipientName = ticket.creatorName;
      let recipientRole: "client" | "supplier" = ticket.creatorRole === "supplier" ? "supplier" : "client";
      let recipientId = ticket.creatorId;

      await sendTicketReply({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        message: messageText || "Image jointe",
        senderId: user.uid,
        senderName,
        senderEmail: user.email || "",
        senderRole: userRole,
        recipientEmail,
        recipientName,
        recipientRole,
        recipientId,
        attachments: attachmentsToSend.length > 0 ? attachmentsToSend : undefined,
      });

      // If it was closed/archived, it is automatically reactivated to in_progress
      if (currentStatus === "closed" || isArchived) {
        setCurrentStatus("in_progress");
        setIsArchived(false);
        if (onStatusChange) onStatusChange("in_progress");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    try {
      if (newStatus === "resolved" || newStatus === "closed") {
        setCurrentStatus("closed");
        setIsArchived(true);
      } else {
        setCurrentStatus(newStatus);
        setIsArchived(false);
      }
      await updateTicketStatus(ticket.id, newStatus);
      if (onStatusChange) onStatusChange(newStatus);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleReopenTicket = async () => {
    try {
      await reopenTicket(ticket.id, userRole);
      setCurrentStatus("in_progress");
      setIsArchived(false);
      if (onStatusChange) onStatusChange("in_progress");
    } catch (err) {
      console.error("Error reopening ticket:", err);
    }
  };

  const catBadge = getCategoryBadge(ticket.category);
  const statusBadge = getStatusBadge(currentStatus);
  const priorityBadge = getPriorityBadge(ticket.priority);

  // Canned responses for Admins
  const adminCanned = [
    "Bonjour, nous avons bien pris en charge votre demande et vérifions cela de suite.",
    "Pourriez-vous nous préciser votre référence de commande ou une capture d'écran ?",
    "Le problème a été résolu. Veuillez vérifier de votre côté.",
    "Nous avons transmis votre requête au fournisseur concerné pour traitement immédiat.",
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="mt-0.5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {ticket.ticketNumber}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${catBadge.color}`}>
                {catBadge.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${priorityBadge.color}`}>
                {priorityBadge.label}
              </span>
              {isArchived && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-400">
                  <Archive size={11} />
                  <span>Archivé</span>
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white line-clamp-1">{ticket.subject}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
              <span>Par <strong className="text-slate-200">{ticket.creatorName}</strong> ({ticket.creatorRole})</span>
              <span>•</span>
              <span>{ticket.creatorEmail}</span>
              {ticket.supplierName && (
                <>
                  <span>•</span>
                  <span className="text-amber-400 font-medium flex items-center gap-1">
                    <Store size={12} />
                    Fournisseur: {ticket.supplierName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status controls */}
        <div className="flex items-center gap-2 self-end sm:self-center">
          {userRole === "admin" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Statut :</span>
              <select
                value={currentStatus}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-1.5 text-white font-medium focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="open">🔵 Ouvert</option>
                <option value="in_progress">🟡 En cours</option>
                <option value="resolved">🟢 Résolu (Clôturer & Archiver)</option>
                <option value="closed">⚪ Clôturé & Archivé</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-semibold ${statusBadge.color}`}>
                <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                {currentStatus === "closed" ? "Clôturé / Archivé" : statusBadge.label}
              </span>

              {/* Client can mark resolved (which automatically closes & archives) */}
              {currentStatus !== "closed" && currentStatus !== "resolved" ? (
                <button
                  onClick={() => handleStatusChange("resolved")}
                  className="flex items-center gap-1 text-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-medium transition-colors shadow-xs"
                  title="Marquer comme résolu : clôture et archive automatiquement la requête"
                >
                  <CheckCircle2 size={14} />
                  <span>Problème résolu</span>
                </button>
              ) : (
                /* Client can reactivate manually */
                <button
                  onClick={handleReopenTicket}
                  className="flex items-center gap-1.5 text-xs bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl font-medium transition-colors"
                >
                  <RotateCcw size={13} />
                  <span>Réactiver la requête</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Linked Activity / Order Card Banner */}
      {(ticket.orderSummary || ticket.orderId) && (
        <div className="px-5 py-3 bg-purple-950/30 border-b border-purple-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
              <ShoppingBag size={16} />
            </div>
            <div>
              <p className="font-semibold text-white flex items-center gap-1.5">
                <span>Commande liée :</span>
                <span className="font-mono text-purple-300">
                  #{ticket.orderSummary?.orderId?.slice(-6)?.toUpperCase() || ticket.orderId}
                </span>
                {ticket.orderSummary?.status && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    Statut: {ticket.orderSummary.status}
                  </span>
                )}
              </p>
              <p className="text-slate-400 text-[11px] mt-0.5">
                {ticket.orderSummary?.itemsDescription
                  ? `Articles : ${ticket.orderSummary.itemsDescription}`
                  : "Détails de la vente et des articles associés"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            {ticket.orderSummary?.totalAmount !== undefined && (
              <div>
                <span className="text-slate-400">Montant : </span>
                <span className="font-bold text-white">
                  {ticket.orderSummary.totalAmount.toLocaleString()} CDF
                </span>
              </div>
            )}
            {ticket.supplierName && (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2.5 py-1 rounded-lg border border-amber-500/20 font-medium">
                <Store size={12} />
                <span>Fournisseur : {ticket.supplierName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Closed & Archived Banner notice */}
      {isArchived && (
        <div className="px-5 py-2.5 bg-slate-800/80 border-b border-slate-700/60 flex items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <Archive size={15} className="text-amber-400 shrink-0" />
            <span>
              Cette requête est actuellement <strong>clôturée et archivée</strong>. Vous pouvez la réactiver à tout moment en cliquant sur le bouton ou en écrivant un nouveau message.
            </span>
          </div>
          <button
            onClick={handleReopenTicket}
            className="text-xs bg-purple-600 hover:bg-purple-500 text-white px-3 py-1 rounded-lg font-medium transition-colors shrink-0"
          >
            Réactiver
          </button>
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-900/50">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          const isAdmin = msg.senderRole === "admin";
          const isSupplier = msg.senderRole === "supplier";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                {isAdmin ? (
                  <span className="flex items-center gap-1 font-semibold text-purple-400">
                    <ShieldCheck size={13} />
                    <span>Support Rayons.net (Admin)</span>
                  </span>
                ) : isSupplier ? (
                  <span className="flex items-center gap-1 font-semibold text-amber-400">
                    <Store size={13} />
                    <span>{msg.senderName} (Fournisseur)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-medium text-slate-300">
                    <User size={13} />
                    <span>{msg.senderName}</span>
                  </span>
                )}
                <span>•</span>
                <span>
                  {msg.createdAt?.seconds
                    ? format(new Date(msg.createdAt.seconds * 1000), "d MMM à HH:mm", { locale: fr })
                    : "À l'instant"}
                </span>
              </div>

              <div
                className={`max-w-[88%] sm:max-w-[75%] rounded-2xl p-3.5 sm:p-4 text-sm leading-relaxed ${
                  isAdmin
                    ? "bg-gradient-to-br from-purple-900/60 to-indigo-900/60 border border-purple-500/30 text-white shadow-lg shadow-purple-900/20"
                    : isMe
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                    : "bg-slate-800 border border-slate-700/80 text-slate-200"
                }`}
              >
                {msg.message && <p className="whitespace-pre-wrap">{msg.message}</p>}

                {/* Attachments rendering */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/10 flex flex-wrap gap-2">
                    {msg.attachments.map((imgUrl, imgIdx) => (
                      <div
                        key={imgIdx}
                        onClick={() => setPreviewImage(imgUrl)}
                        className="w-24 h-24 rounded-xl overflow-hidden border border-white/20 cursor-pointer hover:opacity-90 transition-opacity bg-black/30"
                      >
                        <img
                          src={imgUrl}
                          alt="Pièce jointe"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Admin Quick Replies */}
      {userRole === "admin" && (
        <div className="px-4 py-2 bg-slate-950/40 border-t border-slate-800/80 overflow-x-auto flex items-center gap-2 scrollbar-none">
          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Réponses types :</span>
          {adminCanned.map((canned, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setNewMessage(canned)}
              className="text-xs text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700 px-2.5 py-1 rounded-lg shrink-0 transition-colors"
            >
              {canned.slice(0, 32)}...
            </button>
          ))}
        </div>
      )}

      {/* Reply Input Bar */}
      <div className="p-3 sm:p-4 border-t border-slate-800 bg-slate-950/80">
        {/* Reply attachments preview */}
        {replyAttachments.length > 0 && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-slate-900 border border-slate-800 rounded-xl">
            {replyAttachments.map((img, idx) => (
              <div key={idx} className="relative group w-12 h-12 rounded-lg overflow-hidden border border-slate-700">
                <img src={img} alt="Aperçu" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => setReplyAttachments((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-red-400 transition-opacity"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            <span className="text-[11px] text-slate-400">Photo(s) prête(s) à être envoyée(s)</span>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          {/* Add Image Button */}
          <label className="p-2.5 rounded-xl bg-slate-900 border border-slate-700/80 hover:border-purple-500/60 text-slate-400 hover:text-purple-300 cursor-pointer transition-colors shrink-0">
            {isUploadingImage ? (
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            ) : (
              <ImageIcon size={18} />
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

          <input
            type="text"
            placeholder={
              isArchived
                ? "Écrire un message pour réactiver automatiquement cette requête..."
                : userRole === "admin"
                ? "Écrire une réponse d'assistance officielle..."
                : "Écrire un message ou apporter des précisions..."
            }
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={isSending}
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <button
            type="submit"
            disabled={isSending || (!newMessage.trim() && replyAttachments.length === 0)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium text-sm shadow-lg shadow-purple-600/25 transition-all shrink-0"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={15} />
                <span className="hidden sm:inline">
                  {isArchived ? "Envoyer & Réactiver" : "Envoyer"}
                </span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Lightbox / Zoom Modal for Images */}
      {previewImage && (
        <div 
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img 
              src={previewImage} 
              alt="Photo agrandie" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl" 
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

