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
  RotateCcw
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
  getCategoryBadge, 
  getStatusBadge, 
  getPriorityBadge 
} from "@/lib/ticketService";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentStatus(ticket.status);
  }, [ticket.status]);

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

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
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
        message: messageText,
        senderId: user.uid,
        senderName,
        senderEmail: user.email || "",
        senderRole: userRole,
        recipientEmail,
        recipientName,
        recipientRole,
        recipientId,
      });

      // If it was closed and user replies, reopen or put in_progress
      if (currentStatus === "closed" || currentStatus === "resolved") {
        await handleStatusChange("in_progress");
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    try {
      setCurrentStatus(newStatus);
      await updateTicketStatus(ticket.id, newStatus);
      if (onStatusChange) onStatusChange(newStatus);
    } catch (err) {
      console.error("Error updating status:", err);
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
    "Nous avons transmis votre requête au service concerné pour traitement immédiat.",
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
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white line-clamp-1">{ticket.subject}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-400">
              <span>Par <strong className="text-slate-200">{ticket.creatorName}</strong> ({ticket.creatorRole})</span>
              <span>•</span>
              <span>{ticket.creatorEmail}</span>
              {ticket.orderId && (
                <>
                  <span>•</span>
                  <span className="text-indigo-400 font-mono">Cmd: {ticket.orderId}</span>
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
                <option value="resolved">🟢 Résolu</option>
                <option value="closed">⚪ Fermé</option>
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border font-semibold ${statusBadge.color}`}>
                <span className={`w-2 h-2 rounded-full ${statusBadge.dot}`} />
                {statusBadge.label}
              </span>
              {currentStatus !== "resolved" && currentStatus !== "closed" && (
                <button
                  onClick={() => handleStatusChange("resolved")}
                  className="flex items-center gap-1 text-xs bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1.5 rounded-xl transition-colors"
                  title="Marquer comme résolu si votre problème a été réglé"
                >
                  <CheckCircle2 size={14} />
                  <span>Problème réglé</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

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
                className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-3.5 sm:p-4 text-sm leading-relaxed ${
                  isAdmin
                    ? "bg-gradient-to-br from-purple-900/60 to-indigo-900/60 border border-purple-500/30 text-white shadow-lg shadow-purple-900/20"
                    : isMe
                    ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                    : "bg-slate-800 border border-slate-700/80 text-slate-200"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.message}</p>
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
        {currentStatus === "closed" ? (
          <div className="flex items-center justify-between p-3 bg-slate-800/60 border border-slate-700 rounded-xl text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-slate-400" />
              Ce ticket est actuellement fermé. Vous pouvez le rouvrir en écrivant un nouveau message ci-dessous.
            </span>
            <button
              onClick={() => handleStatusChange("open")}
              className="text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1"
            >
              <RotateCcw size={13} />
              Rouvrir
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2 mt-2">
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
            className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
          />
          <button
            type="submit"
            disabled={isSending || !newMessage.trim()}
            className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-medium text-sm shadow-lg shadow-purple-600/25 transition-all shrink-0"
          >
            {isSending ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
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
  );
}
