"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { MessageSquare, Send, User, Lock, Package } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, doc, updateDoc } from "firebase/firestore";
import { motion } from "framer-motion";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";

type Chat = {
  id: string;
  clientId: string;
  supplierId: string;
  propertyTitle?: string;
  productName?: string;
  isHotel?: boolean;
  lastMessage: string;
  updatedAt: any;
};

type ChatMessage = {
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
    type?: 'hotel' | 'product';
    status: 'pending' | 'paid' | 'delivered';
    orderId?: string;
    paidAt?: any;
  };
};

export default function SupplierMessagesPage() {
  const { user, userData } = useAuth();
  const activeSupplierId = userData?.parentSupplierId || user?.uid;
  const subscriptionInfo = evaluateSupplierSubscription(userData);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newChatMessage, setNewChatMessage] = useState("");
  
  const [showProformaForm, setShowProformaForm] = useState(false);
  const [proformaQuantity, setProformaQuantity] = useState(1);
  const [proformaPrice, setProformaPrice] = useState(0);

  // Fetch chats list
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "chats"),
      where("supplierId", "==", activeSupplierId)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      // Sort by updatedAt descending locally since we didn't add an index for it yet
      fetchedChats.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      setChats(fetchedChats);
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch messages for active chat
  useEffect(() => {
    if (!activeChatId) {
      setChatMessages([]);
      return;
    }
    const q = query(
      collection(db, "chats", activeChatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setChatMessages(msgs);
    });
    return () => unsubscribe();
  }, [activeChatId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subscriptionInfo.isBlocked) {
      alert("Envoi impossible : Votre compte est actuellement suspendu pour impayé de dépôt mensuel. Veuillez régulariser votre compte dans l'espace Finance.");
      return;
    }
    if (!newChatMessage.trim() || !user || !activeChatId) return;

    try {
      await addDoc(collection(db, "chats", activeChatId, "messages"), {
        text: newChatMessage,
        senderId: activeSupplierId,
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, "chats", activeChatId), {
        lastMessage: newChatMessage,
        updatedAt: serverTimestamp()
      });
      
      setNewChatMessage("");
    } catch (err) {
      console.error("Error sending message", err);
    }
  };

  const activeChat = chats.find(c => c.id === activeChatId);
  const isHotelChat = Boolean(
    activeChat?.isHotel ||
    activeChat?.propertyTitle?.toLowerCase().includes("hotel") ||
    activeChat?.productName?.toLowerCase().includes("hotel")
  );

  const handleSendProforma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChatId) return;
    
    try {
      const isHotel = isHotelChat;
      await addDoc(collection(db, "chats", activeChatId, "messages"), {
        text: isHotel ? "Devis / Réservation Séjour Hôtel" : "Facture Proforma (Offre)",
        senderId: activeSupplierId,
        createdAt: serverTimestamp(),
        type: 'proforma',
        proforma: {
          productId: activeChat?.propertyTitle ? null : (activeChat?.productName || "Produit"),
          productName: activeChat?.propertyTitle || activeChat?.productName || (isHotel ? "Séjour Hôtel" : "Produit"),
          quantity: proformaQuantity,
          price: proformaPrice,
          deliveryFee: isHotel ? 0 : 3, // $0 pour hôtel, $3 fixe pour e-commerce
          type: isHotel ? 'hotel' : 'product',
          status: 'pending'
        }
      });
      
      await updateDoc(doc(db, "chats", activeChatId), {
        lastMessage: isHotel ? "🏨 Devis Séjour envoyé" : "📄 Nouveau Proforma envoyé",
        updatedAt: serverTimestamp()
      });
      
      setShowProformaForm(false);
      setProformaQuantity(1);
      setProformaPrice(0);
    } catch (err) {
      console.error("Error sending proforma", err);
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Messages</h1>
        <p className="text-sm text-gray-400">Communiquez avec vos clients.</p>
      </div>

      <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-xl">
        
        {/* Chats List Sidebar */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-white/10 flex flex-col bg-black/20">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-semibold text-white flex items-center">
              <MessageSquare size={18} className="mr-2 text-primary-light" />
              Conversations ({chats.length})
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            {chats.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>Aucune conversation</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {chats.map(chat => {
                  const isChatHotel = chat.isHotel || chat.propertyTitle?.toLowerCase().includes("hotel") || chat.productName?.toLowerCase().includes("hotel");
                  return (
                    <button
                      key={chat.id}
                      onClick={() => setActiveChatId(chat.id)}
                      className={`w-full p-4 text-left transition-colors flex items-center space-x-3 hover:bg-white/5 ${
                        activeChatId === chat.id ? "bg-white/10 border-l-4 border-primary" : "border-l-4 border-transparent"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary-light flex-shrink-0">
                        {isChatHotel ? <span className="text-base">🏨</span> : <User size={18} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {isChatHotel 
                            ? `Hôtel: ${chat.propertyTitle || chat.productName}` 
                            : (chat.propertyTitle ? `Bien: ${chat.propertyTitle}` : chat.productName ? `Produit: ${chat.productName}` : `Client: ${chat.clientId.substring(0,6)}...`)}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{chat.lastMessage || "Nouveau message"}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Chat Box area */}
        <div className="flex-1 flex flex-col bg-transparent">
          {!activeChatId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <MessageSquare size={32} className="text-gray-600" />
              </div>
              <p className="font-medium text-gray-400">Sélectionnez une conversation</p>
              <p className="text-sm mt-1 text-center">Les messages de vos clients apparaîtront ici.</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 bg-black/20 flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary-light mr-3">
                    {isHotelChat ? <span className="text-sm">🏨</span> : <User size={16} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Client {activeChat?.clientId.substring(0,6)}...</p>
                    <p className="text-xs text-gray-400">
                      {isHotelChat 
                        ? `Séjour Hôtelier : ${activeChat?.propertyTitle || activeChat?.productName}` 
                        : (activeChat?.propertyTitle ? `Bien : ${activeChat?.propertyTitle}` : activeChat?.productName ? `Produit : ${activeChat?.productName}` : "Discussion active")}
                    </p>
                  </div>
                </div>
                {isHotelChat && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium flex items-center gap-1">
                    🏨 Hôtellerie
                  </span>
                )}
              </div>

              {/* Messages History */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                    Aucun message. Envoyez un message pour commencer.
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isMe = msg.senderId === activeSupplierId;
                    const isSystem = msg.senderId === 'system';
                    
                    if (isSystem) {
                      return (
                         <div key={msg.id} className="flex justify-center my-2">
                           <span className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-full text-center">
                             {msg.text}
                           </span>
                         </div>
                      );
                    }
                    
                    return (
                      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div 
                          className={`max-w-[75%] p-3 text-sm shadow-sm ${
                            isMe 
                              ? (msg.type === 'proforma' ? 'bg-primary/90 text-white rounded-2xl rounded-tr-sm border border-primary-light' : 'bg-primary text-white rounded-2xl rounded-tr-sm')
                              : 'bg-white/10 text-gray-100 rounded-2xl rounded-tl-sm border border-white/5'
                          }`}
                        >
                          {msg.type === 'proforma' && msg.proforma ? (
                            <div className="flex flex-col space-y-2 min-w-[200px]">
                              <div className="font-bold border-b border-white/20 pb-1 mb-1 flex items-center justify-between">
                                <span>{msg.proforma.type === 'hotel' ? '🏨 Devis Séjour Hôtel' : '📄 Proforma'}</span>
                                {msg.proforma.status === 'paid' && <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded">Confirmé</span>}
                                {msg.proforma.status === 'pending' && <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded">En attente</span>}
                              </div>
                              <p className="font-semibold">{msg.proforma.productName}</p>
                              <div className="flex justify-between text-xs opacity-90">
                                <span>{msg.proforma.type === 'hotel' ? 'Nuitées :' : 'Quantité :'}</span>
                                <span>{msg.proforma.quantity}</span>
                              </div>
                              <div className="flex justify-between text-xs opacity-90">
                                <span>{msg.proforma.type === 'hotel' ? 'Tarif total séjour :' : 'Prix total prod. :'}</span>
                                <span>{msg.proforma.price} $</span>
                              </div>
                              {msg.proforma.type !== 'hotel' && (
                                <div className="flex justify-between text-xs opacity-90">
                                  <span>Frais Livraison:</span>
                                  <span>{msg.proforma.deliveryFee} $</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold border-t border-white/20 pt-1 mt-1">
                                <span>{msg.proforma.type === 'hotel' ? 'Total Séjour :' : 'À Payer Maintenant (Livraison):'}</span>
                                <span>{msg.proforma.type === 'hotel' ? `${msg.proforma.price} $` : `${msg.proforma.deliveryFee} $`}</span>
                              </div>

                              {msg.proforma.status === 'paid' && (
                                <div className="mt-2 pt-2 border-t border-white/20 flex flex-col gap-1.5">
                                  <div className="flex items-center justify-between text-xs bg-black/30 p-2 rounded-lg">
                                    <span className="font-semibold text-white">
                                      Commande #{msg.proforma.orderId ? msg.proforma.orderId.substring(0, 12) : 'Validée'}
                                    </span>
                                    <span className="text-[10px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded font-bold">
                                      Transmise aux livreurs
                                    </span>
                                  </div>
                                  <Link
                                    href="/supplier/orders"
                                    className="w-full bg-white/20 hover:bg-white/30 text-white py-1.5 px-2.5 rounded-lg text-xs font-semibold text-center transition-colors flex items-center justify-center gap-1.5"
                                  >
                                    <Package size={13} />
                                    <span>Gérer dans Commandes</span>
                                  </Link>
                                </div>
                              )}
                            </div>
                          ) : (
                            msg.text
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t border-white/10 bg-black/20 flex flex-col space-y-3">
                {showProformaForm && (
                  <form onSubmit={handleSendProforma} className="bg-white/5 p-4 rounded-xl border border-primary/30 flex gap-4 items-end animate-fade-in">
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">
                        {isHotelChat ? "Nombre de Nuitées" : "Quantité"}
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        value={proformaQuantity} 
                        onChange={e => setProformaQuantity(parseInt(e.target.value) || 1)} 
                        className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white" 
                        required 
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs text-gray-400 mb-1">
                        {isHotelChat ? "Tarif Total Séjour ($)" : "Prix Négocié ($)"}
                      </label>
                      <input 
                        type="number" 
                        min="0" 
                        value={proformaPrice} 
                        onChange={e => setProformaPrice(parseInt(e.target.value) || 0)} 
                        className="w-full bg-black/20 border border-white/10 rounded px-3 py-2 text-white" 
                        required 
                      />
                    </div>
                    <button type="submit" className="bg-primary hover:bg-primary-light text-white px-4 py-2 rounded font-medium h-[42px] whitespace-nowrap">
                      {isHotelChat ? "Envoyer Devis Séjour" : "Envoyer Proforma"}
                    </button>
                    <button type="button" onClick={() => setShowProformaForm(false)} className="text-gray-400 hover:text-white px-2 h-[42px]">
                      Annuler
                    </button>
                  </form>
                )}
                
                {subscriptionInfo.isBlocked ? (
                  <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3 text-red-300">
                    <div className="flex items-center gap-2 text-xs">
                      <Lock className="w-4 h-4 text-red-400 shrink-0" />
                      <span>Messagerie suspendue : Dépôt mensuel impayé. Veuillez régulariser votre compte pour converser avec vos clients.</span>
                    </div>
                    <Link href="/supplier/finance" className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-sm">
                      Régulariser ($50)
                    </Link>
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowProformaForm(!showProformaForm)}
                      className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors border border-white/10 flex items-center justify-center text-base"
                      title={isHotelChat ? "Générer Devis Séjour Hôtel" : "Générer Proforma"}
                    >
                      {isHotelChat ? "🏨" : "📄"}
                    </button>
                    <form onSubmit={handleSendMessage} className="flex flex-1 space-x-2">
                      <input
                        type="text"
                        value={newChatMessage}
                        onChange={(e) => setNewChatMessage(e.target.value)}
                        placeholder={isHotelChat ? "Répondre au client pour son séjour..." : "Écrivez votre message..."}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-500 transition-all"
                      />
                      <button
                        type="submit"
                        disabled={!newChatMessage.trim()}
                        className="bg-primary hover:bg-primary-light text-white p-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        <Send size={20} />
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
      </div>
    </div>
  );
}
