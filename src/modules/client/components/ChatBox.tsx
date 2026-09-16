"use client";

import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, setDoc, limitToLast } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Send, Loader2, FileText } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ChatBoxProps {
  chatId: string;
  otherUserName?: string;
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

export function ChatBox({ chatId, otherUserName = "Utilisateur" }: ChatBoxProps) {
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
      limitToLast(50)
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

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !chatId) return;

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
        unreadSupplier: true,
        unreadClient: false,
        notified: false
      }, { merge: true });
      scrollToBottom();
    } catch (error) {
      console.error("Erreur d'envoi du message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handlePayDelivery = async (msg: Message) => {
    if (!user || !msg.proforma) return;

    if (msg.proforma.status === "paid") {
      if (msg.proforma.orderId) {
        window.location.href = `/order/${msg.proforma.orderId}/tracking`;
      } else {
        alert("Cette commande a déjà été confirmée.");
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

      alert("Paiement réussi ! La commande est envoyée aux livreurs.");
      window.location.href = `/order/${data.orderId}/tracking`;
    } catch (error: any) {
      console.error("Erreur de paiement", error);
      alert(error.message || "Erreur lors du paiement.");
    }
  };

  const formatMessageTime = (timestamp: any) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "HH:mm");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border border-gray-200">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-[450px] flex-1 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-bold text-gray-900">Discussion avec {otherUserName}</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 my-8">
            <p>Aucun message pour le moment.</p>
            <p className="text-sm">Envoyez un message pour démarrer la discussion.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === user?.uid;
            return (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[80%] ${isMe ? 'self-end items-end ml-auto' : 'self-start items-start'}`}
              >
                <div
                  className={`px-4 py-3 rounded-2xl ${
                    isMe 
                      ? (msg.type === 'proforma' ? 'bg-blue-600 text-white rounded-tr-sm border border-blue-500' : 'bg-blue-600 text-white rounded-tr-sm')
                      : (msg.type === 'proforma' ? 'bg-white border-2 border-gray-900 text-gray-900 rounded-tl-sm shadow-md' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm')
                  }`}
                >
                  {msg.type === 'proforma' && msg.proforma ? (
                    <div className="flex flex-col space-y-3 min-w-[240px]">
                      <div className={`font-bold border-b ${isMe ? 'border-blue-400' : 'border-gray-200'} pb-2 mb-1 flex items-center justify-between`}>
                        <span className="flex items-center gap-2"><FileText size={16} /> Offre Proforma</span>
                        {msg.proforma.status === 'paid' && <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-bold">Payé / Validé</span>}
                        {msg.proforma.status === 'pending' && <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded font-bold">En attente</span>}
                      </div>
                      <p className="font-bold text-base">{msg.proforma.productName}</p>
                      
                      <div className={`space-y-1.5 text-xs ${isMe ? 'text-blue-100' : 'text-gray-600'} bg-black/5 dark:bg-white/5 p-2.5 rounded-xl`}>
                        <div className="flex justify-between">
                          <span>Quantité :</span>
                          <span className={`font-bold ${isMe ? 'text-white' : 'text-gray-900'}`}>{msg.proforma.quantity} pièce(s)</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Prix unitaire :</span>
                          <span className={`font-medium ${isMe ? 'text-white' : 'text-gray-900'}`}>
                            ${Number(msg.proforma.unitPrice || (msg.proforma.price / (msg.proforma.quantity || 1))).toFixed(2)} / pc
                          </span>
                        </div>
                        <div className="flex justify-between border-t border-gray-200/40 dark:border-white/10 pt-1">
                          <span>Sous-total articles :</span>
                          <span className={`font-bold ${isMe ? 'text-white' : 'text-emerald-600'}`}>
                            {`${msg.proforma.quantity} × $${Number(msg.proforma.unitPrice || (msg.proforma.price / (msg.proforma.quantity || 1))).toFixed(2)} = $${Number(msg.proforma.totalPrice || msg.proforma.price).toFixed(2)}`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Frais de livraison :</span>
                          <span className={`font-medium ${isMe ? 'text-white' : 'text-gray-900'}`}>${Number(msg.proforma.deliveryFee ?? 3).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t border-gray-200/40 dark:border-white/10 pt-1 text-sm">
                          <span>Total Commande :</span>
                          <span className={isMe ? 'text-white' : 'text-gray-900'}>
                            ${(Number(msg.proforma.totalPrice || msg.proforma.price) + Number(msg.proforma.deliveryFee ?? 3)).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      <div className={`mt-2 pt-2 border-t ${isMe ? 'border-blue-400' : 'border-gray-200'}`}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={isMe ? 'text-blue-100' : 'text-gray-500'}>À payer au livreur en espèces :</span>
                          <span className={`font-bold ${isMe ? 'text-white' : 'text-gray-900'}`}>${Number(msg.proforma.totalPrice || msg.proforma.price).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-bold text-sm mb-3">
                          <span>À Payer Maintenant (Livraison):</span>
                          <span className="text-primary font-black">${Number(msg.proforma.deliveryFee ?? 3).toFixed(2)}</span>
                        </div>
                        
                        {!isMe && msg.proforma.status === 'pending' && (
                          <button 
                            onClick={() => handlePayDelivery(msg)}
                            className="w-full bg-primary hover:bg-primary-dark text-white py-2.5 rounded-xl font-bold transition-all flex items-center justify-center shadow-md text-sm"
                          >
                            Payer la Livraison (${Number(msg.proforma.deliveryFee ?? 3).toFixed(2)})
                          </button>
                        )}
                        
                        {msg.proforma.status === 'paid' && (
                          <div className="flex flex-col space-y-2 text-center mt-2">
                            <p className="text-xs text-green-600 font-medium bg-green-50 p-2 rounded-lg">
                              Livraison confirmée ! Le montant des articles (${Number(msg.proforma.totalPrice || msg.proforma.price).toFixed(2)}) sera remis en espèces au livreur à la réception.
                            </p>
                            {msg.proforma.orderId && (
                              <a href={`/order/${msg.proforma.orderId}/tracking`} className="w-full bg-blue-50 text-blue-700 py-2 rounded-lg font-medium text-sm hover:bg-blue-100 transition-colors block text-center mt-1">
                                Suivre la livraison en direct
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm">{msg.text}</p>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 mx-1">
                  {formatMessageTime(msg.createdAt)}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200 flex items-end gap-2">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
          placeholder="Écrivez votre message..."
          className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white resize-none max-h-32 min-h-[44px]"
          rows={1}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || isSending}
          className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSending ? (
            <Loader2 size={20} className="animate-spin" />
          ) : (
            <Send size={20} />
          )}
        </button>
      </form>
    </div>
  );
}
