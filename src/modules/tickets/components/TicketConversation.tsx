"use client";

import React, { useEffect, useState, useRef } from "react";
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
  X,
  Lock,
  Sparkles
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

interface TicketTheme {
  name: string;
  color: string;
  glowColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  isLightColor: boolean;
}

function getTicketTheme(ticket: Ticket): TicketTheme {
  const cat = (ticket.category || "").toLowerCase();
  
  if (cat === "property" || cat === "immo") {
    return {
      name: "Rayons Immo",
      color: "#4C6EF5",
      glowColor: "rgba(76, 110, 245, 0.25)",
      badgeBg: "rgba(76, 110, 245, 0.12)",
      badgeBorder: "rgba(76, 110, 245, 0.3)",
      badgeText: "#4C6EF5",
      isLightColor: false,
    };
  }

  if (cat === "technical" || cat === "connect") {
    return {
      name: "Rayons Connect",
      color: "#00B5A5",
      glowColor: "rgba(0, 181, 165, 0.25)",
      badgeBg: "rgba(0, 181, 165, 0.12)",
      badgeBorder: "rgba(0, 181, 165, 0.3)",
      badgeText: "#00B5A5",
      isLightColor: false,
    };
  }

  if (cat === "mode") {
    return {
      name: "Rayons Mode",
      color: "#D4B08C",
      glowColor: "rgba(212, 176, 140, 0.25)",
      badgeBg: "rgba(212, 176, 140, 0.12)",
      badgeBorder: "rgba(212, 176, 140, 0.3)",
      badgeText: "#D4B08C",
      isLightColor: true,
    };
  }

  if (cat === "saveurs") {
    return {
      name: "Rayons Saveurs",
      color: "#FF6B35",
      glowColor: "rgba(255, 107, 53, 0.25)",
      badgeBg: "rgba(255, 107, 53, 0.12)",
      badgeBorder: "rgba(255, 107, 53, 0.3)",
      badgeText: "#FF6B35",
      isLightColor: false,
    };
  }

  // Rayons Officiel (Paiement, Commande, Produit, Général, Compte, etc.)
  return {
    name: "Rayons.net",
    color: "#C7D300",
    glowColor: "rgba(199, 211, 0, 0.25)",
    badgeBg: "rgba(199, 211, 0, 0.12)",
    badgeBorder: "rgba(199, 211, 0, 0.35)",
    badgeText: "#C7D300",
    isLightColor: true,
  };
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

  const theme = getTicketTheme(ticket);

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

  const isClosedOrArchived = currentStatus === "closed" || currentStatus === "resolved" || isArchived;

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isClosedOrArchived) return;
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

      const recipientEmail = ticket.creatorEmail;
      const recipientName = ticket.creatorName;
      const recipientRole: "client" | "supplier" = ticket.creatorRole === "supplier" ? "supplier" : "client";
      const recipientId = ticket.creatorId;

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
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (userRole !== "admin") return;
    try {
      if (newStatus === "resolved" || newStatus === "closed") {
        setCurrentStatus("closed");
        setIsArchived(true);
      } else {
        setCurrentStatus(newStatus);
        setIsArchived(false);
      }
      await updateTicketStatus(ticket.id, newStatus, userRole);
      if (onStatusChange) onStatusChange(newStatus);
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const handleReopenTicket = async () => {
    if (userRole !== "admin") return;
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
    <div className="flex flex-col h-full bg-[#0F1D27] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
      {/* Header — Compact and responsive */}
      <div className="px-3 py-2.5 sm:px-5 sm:py-3.5 border-b border-white/10 bg-[#0B151D]/90 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              title="Retour à la liste"
              aria-label="Retour"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-0.5">
              {/* Ticket number styled with Rayons brand theme */}
              <span 
                className="font-mono font-bold text-xs px-2.5 py-0.5 rounded-lg border shadow-xs"
                style={{
                  color: theme.badgeText,
                  backgroundColor: theme.badgeBg,
                  borderColor: theme.badgeBorder,
                }}
              >
                {ticket.ticketNumber}
              </span>

              {/* Rayon universe badge if specific */}
              {theme.name !== "Rayons.net" && (
                <span 
                  className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md border"
                  style={{
                    color: theme.color,
                    backgroundColor: theme.badgeBg,
                    borderColor: theme.badgeBorder,
                  }}
                >
                  {theme.name}
                </span>
              )}

              <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium ${catBadge.color}`}>
                {catBadge.label}
              </span>

              <span className={`text-[11px] px-2 py-0.5 rounded-md font-medium ${priorityBadge.color}`}>
                {priorityBadge.label}
              </span>

              {isArchived && (
                <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-400">
                  <Archive size={11} />
                  <span>Archivé</span>
                </span>
              )}
            </div>

            <h2 className="text-sm sm:text-base font-heading font-extrabold text-white truncate leading-snug">
              {ticket.subject}
            </h2>

            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
              <span className="truncate">Par <strong className="text-gray-200">{ticket.creatorName}</strong> ({ticket.creatorRole})</span>
              <span>•</span>
              <span className="truncate">{ticket.creatorEmail}</span>
              {ticket.supplierName && (
                <>
                  <span>•</span>
                  <span className="text-amber-400 font-medium flex items-center gap-1 truncate">
                    <Store size={11} />
                    {ticket.supplierName}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status controls */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          {userRole === "admin" ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Statut :</span>
              <select
                value={isClosedOrArchived ? "closed" : currentStatus}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                className="bg-white/10 border border-white/15 text-xs rounded-xl px-2.5 py-1 text-white font-medium focus:outline-none"
              >
                <option value="open" className="bg-[#0F1D27]">🔵 Ouvert</option>
                <option value="in_progress" className="bg-[#0F1D27]">🟡 En cours</option>
                <option value="resolved" className="bg-[#0F1D27]">🟢 Résolu (Clôturer)</option>
                <option value="closed" className="bg-[#0F1D27]">⚪ Clôturé &amp; Archivé</option>
              </select>

              {isClosedOrArchived && (
                <button
                  type="button"
                  onClick={handleReopenTicket}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-xl font-bold transition-all shadow-xs"
                  style={{
                    backgroundColor: theme.color,
                    color: theme.isLightColor ? "#0F1D27" : "#FFFFFF",
                  }}
                  title="Réactiver le ticket et déverrouiller les échanges"
                >
                  <RotateCcw size={12} />
                  <span>Réactiver</span>
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-xl border font-semibold ${statusBadge.color}`}>
                <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                {isClosedOrArchived ? "Clôturé" : statusBadge.label}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Linked Activity / Order Card Banner — Compact & Styled with Rayons Theme */}
      {(ticket.orderSummary || ticket.orderId) && (
        <div className="px-3 sm:px-5 py-2 bg-[#142430]/90 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-xs"
              style={{ backgroundColor: `${theme.color}20`, color: theme.color }}
            >
              <ShoppingBag size={14} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-white flex items-center gap-1.5 text-xs truncate">
                <span className="text-gray-300">Commande :</span>
                <span className="font-mono font-black" style={{ color: theme.color }}>
                  #{ticket.orderSummary?.orderId?.slice(-6)?.toUpperCase() || ticket.orderId}
                </span>
                {ticket.orderSummary?.status && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/10 text-gray-200 border border-white/10">
                    {ticket.orderSummary.status}
                  </span>
                )}
              </p>
              <p className="text-gray-400 text-[11px] truncate">
                {ticket.orderSummary?.itemsDescription
                  ? ticket.orderSummary.itemsDescription
                  : "Articles et détails de la commande"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] ml-auto shrink-0">
            {ticket.orderSummary?.totalAmount !== undefined && (
              <div className="bg-black/30 px-2 py-0.5 rounded-md border border-white/10">
                <span className="text-gray-400">Total : </span>
                <span className="font-bold text-white">
                  {ticket.orderSummary.totalAmount.toLocaleString()} CDF
                </span>
              </div>
            )}
            {ticket.supplierName && (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-md border border-amber-500/20 font-medium text-[11px]">
                <Store size={11} />
                <span>{ticket.supplierName}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Closed & Archived Banner notice */}
      {isArchived && (
        <div className="px-3 sm:px-5 py-2 bg-white/5 border-b border-white/10 flex items-center justify-between gap-3 text-xs text-gray-300 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Archive size={14} className="text-[#C7D300] shrink-0" />
            <span className="truncate">
              Requête <strong>clôturée</strong>.
            </span>
          </div>
          {userRole === "admin" && (
            <button
              onClick={handleReopenTicket}
              className="text-xs px-2.5 py-1 rounded-lg font-bold transition-all shrink-0"
              style={{
                backgroundColor: theme.color,
                color: theme.isLightColor ? "#0F1D27" : "#FFFFFF",
              }}
            >
              Réactiver
            </button>
          )}
        </div>
      )}

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-3.5 bg-[#0B151D] min-h-0">
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.uid;
          const isAdmin = msg.senderRole === "admin";
          const isSupplier = msg.senderRole === "supplier";

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-gray-400">
                {isAdmin ? (
                  <span className="flex items-center gap-1 font-bold text-[#C7D300]">
                    <ShieldCheck size={13} />
                    <span>Support Rayons.net</span>
                  </span>
                ) : isSupplier ? (
                  <span className="flex items-center gap-1 font-semibold text-amber-400">
                    <Store size={13} />
                    <span>{msg.senderName} (Fournisseur)</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 font-medium text-gray-300">
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

              {/* Message Bubble — Brand Rayons Theme */}
              <div
                className={`max-w-[88%] sm:max-w-[75%] rounded-2xl p-3 sm:p-3.5 text-sm leading-relaxed shadow-lg ${
                  isMe
                    ? "rounded-tr-xs"
                    : "rounded-tl-xs bg-[#142430] border border-white/10 text-white"
                }`}
                style={
                  isMe
                    ? {
                        backgroundColor: theme.color,
                        color: theme.isLightColor ? "#0F1D27" : "#FFFFFF",
                        boxShadow: `0 4px 14px ${theme.glowColor}`,
                      }
                    : isAdmin
                    ? {
                        borderColor: `${theme.color}40`,
                      }
                    : undefined
                }
              >
                {/* Admin certified tag in bubble */}
                {!isMe && isAdmin && (
                  <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-[#C7D300] mb-1">
                    <Sparkles size={11} />
                    <span>Assistance Officielle Rayons</span>
                  </div>
                )}

                {msg.message && <p className="whitespace-pre-wrap font-medium">{msg.message}</p>}

                {/* Attachments rendering */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-white/15 flex flex-wrap gap-2">
                    {msg.attachments.map((imgUrl, imgIdx) => (
                      <div
                        key={imgIdx}
                        onClick={() => setPreviewImage(imgUrl)}
                        className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border border-white/20 cursor-pointer hover:opacity-90 transition-opacity bg-black/40"
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

      {/* Admin Quick Replies & Input Bar */}
      {isClosedOrArchived ? (
        <div className="p-3 sm:p-4 border-t border-white/10 bg-[#0B151D] flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Lock size={16} />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Requête clôturée</p>
              <p className="text-[11px] text-gray-400">
                Les échanges sont verrouillés. {userRole === "admin" ? "Vous pouvez la réactiver pour autoriser à nouveau les réponses." : "Un administrateur peut réactiver ce ticket si besoin."}
              </p>
            </div>
          </div>
          {userRole === "admin" && (
            <button
              type="button"
              onClick={handleReopenTicket}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all shadow-md shrink-0"
              style={{
                backgroundColor: theme.color,
                color: theme.isLightColor ? "#0F1D27" : "#FFFFFF",
              }}
            >
              <RotateCcw size={13} />
              <span>Réactiver</span>
            </button>
          )}
        </div>
      ) : (
        <div className="shrink-0">
          {userRole === "admin" && (
            <div className="px-3 py-1.5 bg-[#0B151D] border-t border-white/10 overflow-x-auto flex items-center gap-1.5 scrollbar-none">
              <span className="text-[10px] uppercase font-bold text-gray-400 shrink-0">Réponses types :</span>
              {adminCanned.map((canned, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setNewMessage(canned)}
                  className="text-xs text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 px-2 py-0.5 rounded-lg shrink-0 transition-colors"
                >
                  {canned.slice(0, 30)}...
                </button>
              ))}
            </div>
          )}

          {/* Reply Input Bar */}
          <div className="p-2.5 sm:p-3.5 border-t border-white/10 bg-[#0F1D27]">
            {/* Reply attachments preview */}
            {replyAttachments.length > 0 && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-black/30 border border-white/10 rounded-xl">
                {replyAttachments.map((img, idx) => (
                  <div key={idx} className="relative group w-12 h-12 rounded-lg overflow-hidden border border-white/20">
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
                <span className="text-[11px] text-gray-400">Photo(s) prête(s) à être envoyée(s)</span>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              {/* Add Image Button */}
              <label 
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white cursor-pointer transition-colors shrink-0"
                title="Joindre une photo"
              >
                {isUploadingImage ? (
                  <div 
                    className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                    style={{ borderColor: theme.color, borderTopColor: "transparent" }}
                  />
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
                  userRole === "admin"
                    ? "Écrire une réponse d'assistance officielle..."
                    : "Écrire un message ou apporter des précisions..."
                }
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                disabled={isSending}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none transition-all"
                style={{
                  outlineColor: theme.color,
                }}
              />

              <button
                type="submit"
                disabled={isSending || (!newMessage.trim() && replyAttachments.length === 0)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-extrabold text-sm transition-all shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                style={{
                  backgroundColor: theme.color,
                  color: theme.isLightColor ? "#0F1D27" : "#FFFFFF",
                  boxShadow: `0 4px 14px ${theme.glowColor}`,
                }}
              >
                {isSending ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={15} />
                    <span className="hidden sm:inline">Envoyer</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

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
