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
    quantity: number;
    price: number;
    deliveryFee: number;
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
                    <div className="flex flex-col space-y-3 min-w-[220px]">
                      <div className={`font-bold border-b ${isMe ? 'border-blue-400' : 'border-gray-200'} pb-2 mb-1 flex items-center justify-between`}>
                        <span className="flex items-center gap-2"><FileText size={16} /> Offre Proforma</span>
                        {msg.proforma.status === 'paid' && <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-bold">Payé</span>}
                        {msg.proforma.status === 'pending' && <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded font-bold">En attente</span>}
                      </div>
                      <p className="font-semibold text-base">{msg.proforma.productName}</p>
                      <div className={`flex justify-between text-xs ${isMe ? 'text-blue-100' : 'text-gray-600'}`}>
                        <span>Quantité:</span>
                        <span className={`font-medium ${isMe ? 'text-white' : 'text-gray-900'}`}>{msg.proforma.quantity}</span>
                      </div>
                      <div className={`flex justify-between text-xs ${isMe ? 'text-blue-100' : 'text-gray-600'}`}>
                        <span>Prix Total Prod.:</span>
                        <span className={`font-medium ${isMe ? 'text-white' : 'text-gray-900'}`}>{msg.proforma.price} $</span>
                      </div>
                      <div className={`flex justify-between text-xs ${isMe ? 'text-blue-100' : 'text-gray-600'}`}>
                        <span>Frais Livraison:</span>
                        <span className={`font-medium ${isMe ? 'text-white' : 'text-gray-900'}`}>{msg.proforma.deliveryFee} $</span>
                      </div>
                      
                      <div className={`mt-3 pt-3 border-t ${isMe ? 'border-blue-400' : 'border-gray-200'}`}>
                        <div className="flex justify-between font-bold mb-3">
                          <span>À Payer (Livraison):</span>
                          <span>{msg.proforma.deliveryFee} $</span>
                        </div>
                        
                        {!isMe && msg.proforma.status === 'pending' && (
                          <button 
                            onClick={() => handlePayDelivery(msg)}
                            className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800 transition-colors flex items-center justify-center shadow-sm"
                          >
                            Payer la Livraison
                          </button>
                        )}
                        
                        {msg.proforma.status === 'paid' && (
                          <div className="flex flex-col space-y-2 text-center mt-2">
                            <p className="text-xs text-green-600 font-medium bg-green-50 p-2 rounded-lg">Livraison payée. Le produit sera payé à la livraison.</p>
                            {msg.proforma.orderId && (
                              <a href={`/order/${msg.proforma.orderId}/tracking`} className="w-full bg-blue-50 text-blue-700 py-2 rounded-lg font-medium text-sm hover:bg-blue-100 transition-colors block text-center mt-2">
                                Suivre la livraison
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
