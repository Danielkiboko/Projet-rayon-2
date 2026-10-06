"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc, limitToLast } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Send, Loader2, FileText, Smile, Image as ImageIcon, Paperclip, Phone, Globe, CheckCheck, Sparkles, ClipboardList } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ChatBoxProps {
  chatId: string;
  otherUserName?: string;
  hideHeader?: boolean;
  onOpenNotes?: () => void;
  onOpenOrderModal?: () => void;
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
  type?: 'text' | 'proforma';
  proforma?: {
    productId?: string;
    productName?: string;
    brand?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
    price: number;
    deliveryFee: number;
    type?: 'hotel' | 'product';
    status: 'pending' | 'paid' | 'delivered';
    orderId?: string;
  };
}

export function ChatBox({ 
  chatId, 
  otherUserName = "Fournisseur", 
  hideHeader = false,
  onOpenNotes,
  onOpenOrderModal
}: ChatBoxProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId) return;

    setIsLoading(true);
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc"),
      limitToLast(60)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      setMessages(msgs);
      setIsLoading(false);
      scrollToBottom();
    }, (error) => {
      console.warn("ChatBox messages listener warning:", error.message);
      setIsLoading(false);
    });

    // Mark as read for client when opened
    updateDoc(doc(db, "chats", chatId), {
      unreadClient: false
    }).catch(() => {});

    return () => unsubscribe();
  }, [chatId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newMessage.trim() || !user || !chatId || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage("");
    setIsSending(true);

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: messageText,
        senderId: user.uid,
        createdAt: serverTimestamp(),
      });
      await setDoc(doc(db, "chats", chatId), {
        lastMessage: messageText,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadSupplier: true
      }, { merge: true });

      scrollToBottom();
    } catch (error) {
      console.error("Erreur envoi message:", error);
      setNewMessage(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const handlePayProforma = async (msg: Message) => {
    if (!msg.proforma || !user) return;

    if (msg.proforma.status === 'paid') {
      if (msg.proforma.orderId) {
        window.location.href = `/order/${msg.proforma.orderId}/tracking`;
      }
      return;
    }

    try {
      const res = await fetch("/api/orders/pay-proforma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: chatId,
          messageId: msg.id,
          clientId: user.uid,
          clientName: user.displayName || user.email || "Client",
          clientPhone: user.phoneNumber || "",
          clientAddress: "Kinshasa"
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors du paiement");
      }

      window.location.href = `/order/${data.orderId}/tracking`;
    } catch (error: any) {
      console.error("Erreur de paiement", error);
      alert(error.message || "Erreur lors du règlement de la proforma.");
    }
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "HH:mm");
  };

  const formatMessageDate = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "yyyy-MM-dd HH:mm");
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#F9FAFB]">
        <Loader2 className="w-7 h-7 text-[#FF6600] animate-spin" />
      </div>
    );
  }

  // Find latest pending proforma if any
  const latestPendingProforma = messages.slice().reverse().find(m => m.type === "proforma" && m.proforma?.status === "pending");

  return (
    <div className="flex flex-col h-full min-h-[480px] flex-1 bg-white overflow-hidden">
      
      {/* Header (hidden if embedded into widget that has its own header) */}
      {!hideHeader && (
        <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-800 text-xs">
              {otherUserName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-sm">{otherUserName}</h3>
              <span className="text-[10px] text-emerald-600 font-medium">● En ligne</span>
            </div>
          </div>
        </div>
      )}

      {/* Messages Thread (Alibaba Style) */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#F8FAFC]">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 my-12">
            <p className="font-semibold text-gray-600 text-sm mb-1">Démarrer la négociation</p>
            <p className="text-xs text-gray-400">
              Posez vos questions sur les prix, quantités ou délais de livraison au fournisseur.
            </p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === user?.uid;
            const showDateHeader = index === 0 || (messages[index - 1]?.createdAt && msg.createdAt);

            return (
              <div key={msg.id} className="space-y-1">
                {/* Date separator like Alibaba */}
                {index === 0 && msg.createdAt && (
                  <div className="flex justify-center my-2">
                    <span className="text-[11px] text-gray-400 bg-gray-100/80 px-2.5 py-0.5 rounded-full font-medium">
                      {formatMessageDate(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? 'self-end items-end ml-auto' : 'self-start items-start'}`}>
                  <div
                    className={`px-4 py-3 rounded-2xl shadow-2xs text-xs sm:text-sm leading-relaxed ${
                      isMe 
                        ? (msg.type === 'proforma' 
                            ? 'bg-[#FF6600] text-white rounded-tr-xs' 
                            : 'bg-[#FFF3E0] text-gray-900 border border-[#FFE0B2] rounded-tr-xs')
                        : (msg.type === 'proforma' 
                            ? 'bg-white border-2 border-amber-400 text-gray-900 rounded-tl-xs shadow-xs' 
                            : 'bg-white border border-gray-200/90 text-gray-900 rounded-tl-xs')
                    }`}
                  >
                    {msg.type === 'proforma' && msg.proforma ? (
                      /* Proforma Quote Card */
                      <div className="flex flex-col space-y-2.5 min-w-[260px] text-xs">
                        <div className="font-bold border-b border-amber-200 pb-1.5 flex items-center justify-between text-amber-900">
                          <span className="flex items-center gap-1.5 font-black uppercase text-[11px] tracking-wider">
                            <FileText size={15} className="text-[#FF6600]" /> Facture Proforma Offcielle
                          </span>
                          {msg.proforma.status === 'paid' && (
                            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                              Validé & Payé ✓
                            </span>
                          )}
                          {msg.proforma.status === 'pending' && (
                            <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold animate-pulse">
                              En attente
                            </span>
                          )}
                        </div>

                        <p className="font-black text-sm text-gray-900">{msg.proforma.productName}</p>
                        
                        <div className="space-y-1 text-gray-700 bg-gray-50/90 p-2.5 rounded-xl border border-gray-100">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Quantité :</span>
                            <span className="font-bold text-gray-900">{msg.proforma.quantity} pièce(s)</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Prix unitaire :</span>
                            <span className="font-semibold text-gray-900">
                              ${Number(msg.proforma.unitPrice || (msg.proforma.price / (msg.proforma.quantity || 1))).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-500">Livraison :</span>
                            <span className="font-semibold text-gray-900">${Number(msg.proforma.deliveryFee ?? 3).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between font-bold border-t border-gray-200 pt-1 text-xs">
                            <span className="text-gray-900">Total à régler :</span>
                            <span className="text-[#FF6600] font-black text-sm">
                              ${(Number(msg.proforma.totalPrice || msg.proforma.price) + Number(msg.proforma.deliveryFee ?? 3)).toFixed(2)}
                            </span>
                          </div>
                        </div>
                        
                        {!isMe && msg.proforma.status === 'pending' && (
                          <button 
                            type="button"
                            onClick={() => handlePayProforma(msg)}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm text-xs cursor-pointer active:scale-98"
                          >
                            <span>Valider & Payer la Proforma</span>
                          </button>
                        )}
                        
                        {msg.proforma.status === 'paid' && msg.proforma.orderId && (
                          <a 
                            href={`/order/${msg.proforma.orderId}/tracking`} 
                            className="w-full bg-emerald-50 text-emerald-800 border border-emerald-200 py-1.5 rounded-xl font-bold text-xs hover:bg-emerald-100 transition-colors block text-center"
                          >
                            Suivre l'expédition en direct →
                          </a>
                        )}
                      </div>
                    ) : (
                      <p>{msg.text}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-0.5 px-1">
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isMe && <span className="text-gray-400">Vu</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Action Bar Above Input (Exact Alibaba Style) */}
      <div className="px-4 py-2 bg-white border-t border-gray-100 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
        <button
          type="button"
          onClick={() => onOpenNotes ? onOpenNotes() : alert("Notes de discussion sauvegardées pour ce fournisseur.")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200/80 text-[11px] font-bold text-gray-700 transition-colors cursor-pointer shrink-0"
        >
          <ClipboardList size={13} className="text-gray-500" />
          <span>Voir les notes de discussion</span>
        </button>

        {latestPendingProforma ? (
          <button
            type="button"
            onClick={() => handlePayProforma(latestPendingProforma)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-[11px] font-bold text-emerald-800 transition-colors cursor-pointer shrink-0"
          >
            <FileText size={13} className="text-emerald-600" />
            <span>Valider la Proforma en attente</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setNewMessage("Bonjour, pouvez-vous m'envoyer une facture proforma pour ce produit avec vos meilleurs délais de livraison ?");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200/80 text-[11px] font-bold text-[#FF6600] transition-colors cursor-pointer shrink-0"
          >
            <Sparkles size={13} />
            <span>Demander une Proforma / Devis</span>
          </button>
        )}
      </div>

      {/* Toolbar Icons Above Textarea (Smileys, Images, Attachments, Translate) */}
      <div className="px-4 pt-2 bg-white flex items-center justify-between text-gray-400 border-t border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button type="button" className="hover:text-gray-700 transition-colors cursor-pointer" title="Émojis">
            <Smile size={18} />
          </button>
          <button 
            type="button" 
            onClick={() => alert("Pour partager une photo ou spécification technique, vous pouvez glisser-déposer votre fichier ou l'envoyer via le chat.")}
            className="hover:text-gray-700 transition-colors cursor-pointer" 
            title="Image"
          >
            <ImageIcon size={18} />
          </button>
          <button 
            type="button" 
            onClick={() => alert("Partage de documents de conformité / bons de commande disponible.")}
            className="hover:text-gray-700 transition-colors cursor-pointer" 
            title="Fichier"
          >
            <Paperclip size={18} />
          </button>
          <button 
            type="button" 
            onClick={() => {
              setNewMessage("Pouvez-vous me contacter par téléphone ou WhatsApp pour finaliser la commande ?");
            }}
            className="hover:text-gray-700 transition-colors cursor-pointer" 
            title="Contact direct"
          >
            <Phone size={17} />
          </button>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-gray-400 font-medium">
          <Globe size={13} />
          <span>Traduction auto : FR</span>
        </div>
      </div>

      {/* Input Area (Exact Alibaba Multi-line Textarea + Envoyer Button) */}
      <form onSubmit={handleSendMessage} className="p-3 sm:p-4 bg-white pt-2">
        <div className="relative">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="Tapez ici pour envoyer un message au fournisseur..."
            className="w-full bg-transparent border-0 p-1 text-xs sm:text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 resize-none min-h-[50px] max-h-32"
            rows={2}
          />

          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] text-gray-400 hidden sm:inline">
              Appuyez sur « Entrée » pour envoyer, « Shift+Entrée » pour une nouvelle ligne
            </span>

            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="ml-auto px-5 py-2 bg-gray-900 hover:bg-[#FF6600] text-white text-xs font-bold rounded-xl transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-98 flex items-center gap-1.5"
            >
              {isSending ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Envoi...</span>
                </>
              ) : (
                <span>Envoyer</span>
              )}
            </button>
          </div>
        </div>
      </form>

    </div>
  );
}
