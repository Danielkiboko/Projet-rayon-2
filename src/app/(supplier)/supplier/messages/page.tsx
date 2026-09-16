"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { MessageSquare, Send, User, Lock, Package } from "lucide-react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot, addDoc, orderBy, serverTimestamp, doc, updateDoc, getDoc, limit } from "firebase/firestore";
import { motion } from "framer-motion";
import { evaluateSupplierSubscription } from "@/lib/supplierSubscription";

type Chat = {
  id: string;
  clientId: string;
  supplierId: string;
  propertyTitle?: string;
  productName?: string;
  productId?: string;
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
    brand?: string;
    quantity: number;
    unitPrice?: number;
    totalPrice?: number;
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
  const [proformaUnitPrice, setProformaUnitPrice] = useState<number>(0);
  const [supplierProducts, setSupplierProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [currentProductStock, setCurrentProductStock] = useState<number | null>(null);
  const [productBrand, setProductBrand] = useState<string>("");

  // Fetch supplier products for stock & pricing
  useEffect(() => {
    if (!user || !activeSupplierId) return;
    const qProds = query(
      collection(db, "products"),
      where("supplierId", "==", activeSupplierId),
      limit(100)
    );
    const unsub = onSnapshot(qProds, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setSupplierProducts(list);
    }, (err) => console.warn("Error loading supplier products for messages:", err));
    return () => unsub();
  }, [user, activeSupplierId]);

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

  const activeChat = chats.find(c => c.id === activeChatId);
  const isHotelChat = Boolean(
    activeChat?.isHotel ||
    activeChat?.propertyTitle?.toLowerCase().includes("hotel") ||
    activeChat?.productName?.toLowerCase().includes("hotel")
  );

  // Sync selected product & stock when active chat changes
  useEffect(() => {
    if (!activeChat) return;
    const targetProdId = activeChat.productId || "";
    setSelectedProductId(targetProdId);
  }, [activeChatId]);

  // Resolve current product stock and default unit price
  useEffect(() => {
    if (isHotelChat) {
      setCurrentProductStock(null);
      return;
    }

    const resolveProductDetails = async () => {
      // 1. Chercher dans les produits déjà chargés du fournisseur
      let matched = supplierProducts.find(p => p.id === selectedProductId);
      if (!matched && activeChat?.productName) {
        matched = supplierProducts.find(p => {
          const pTitle = p.title?.fr || p.title?.en || p.title || p.name || p.productName || "";
          return pTitle.toLowerCase() === activeChat.productName?.toLowerCase();
        });
      }

      if (matched) {
        const stk = Number(matched.stock ?? 0);
        setCurrentProductStock(stk);
        setProductBrand(matched.brand || "");
        if (proformaUnitPrice === 0 && Number(matched.price) > 0) {
          setProformaUnitPrice(Number(matched.price));
        }
        return;
      }

      // 2. Si non trouvé en local, chercher directement dans Firestore
      if (selectedProductId) {
        try {
          const snap = await getDoc(doc(db, "products", selectedProductId));
          if (snap.exists()) {
            const data = snap.data();
            const stk = Number(data.stock ?? 0);
            setCurrentProductStock(stk);
            setProductBrand(data.brand || "");
            if (proformaUnitPrice === 0 && Number(data.price) > 0) {
              setProformaUnitPrice(Number(data.price));
            }
          } else {
            setCurrentProductStock(null);
          }
        } catch (err) {
          console.warn("Could not fetch product details for chat:", err);
          setCurrentProductStock(null);
        }
      }
    };

    resolveProductDetails();
  }, [selectedProductId, supplierProducts, activeChatId, isHotelChat]);

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

  const calculatedTotalProducts = Number(((proformaUnitPrice || 0) * (proformaQuantity || 1)).toFixed(2));

  const handleSendProforma = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !activeChatId) return;

    const isHotel = isHotelChat;

    // 1. VÉRIFICATION DU STOCK STRICTEMENT OBLIGATOIRE
    if (!isHotel && currentProductStock !== null) {
      if (currentProductStock <= 0) {
        alert("Impossible de générer la facture proforma : ce produit est actuellement en rupture totale de stock (0 pièce disponible).");
        return;
      }
      if (proformaQuantity > currentProductStock) {
        alert(`Stock insuffisant ! Vous demandez ${proformaQuantity} pièces alors qu'il n'y a que ${currentProductStock} pièce(s) disponible(s) en stock.`);
        return;
      }
    }

    if (calculatedTotalProducts <= 0 && !isHotel) {
      alert("Veuillez saisir un prix unitaire valide supérieur à 0.");
      return;
    }
    
    try {
      const resolvedProdId = selectedProductId || activeChat?.productId || null;
      const resolvedProdName = activeChat?.propertyTitle || activeChat?.productName || (isHotel ? "Séjour Hôtel" : "Produit");
      const deliveryFee = isHotel ? 0 : 3;

      await addDoc(collection(db, "chats", activeChatId, "messages"), {
        text: isHotel ? "Devis / Réservation Séjour Hôtel" : `Facture Proforma (${proformaQuantity}x ${resolvedProdName})`,
        senderId: activeSupplierId,
        createdAt: serverTimestamp(),
        type: 'proforma',
        proforma: {
          productId: resolvedProdId,
          productName: resolvedProdName,
          brand: productBrand || undefined,
          quantity: proformaQuantity,
          unitPrice: proformaUnitPrice,
          totalPrice: calculatedTotalProducts,
          price: calculatedTotalProducts, // Rétro-compatibilité
          deliveryFee: deliveryFee,
          type: isHotel ? 'hotel' : 'product',
          status: 'pending',
          supplierId: activeSupplierId
        }
      });
      
      await updateDoc(doc(db, "chats", activeChatId), {
        lastMessage: isHotel ? "🏨 Devis Séjour envoyé" : `📄 Proforma envoyé : ${proformaQuantity}x à $${proformaUnitPrice}`,
        updatedAt: serverTimestamp()
      });
      
      setShowProformaForm(false);
      setProformaQuantity(1);
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
                            <div className="flex flex-col space-y-2 min-w-[240px]">
                              <div className="font-bold border-b border-white/20 pb-1 mb-1 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  {msg.proforma.type === 'hotel' ? '🏨 Devis Séjour Hôtel' : '📄 Facture Proforma'}
                                </span>
                                {msg.proforma.status === 'paid' && <span className="bg-green-500 text-white text-xs px-2 py-0.5 rounded font-bold">Confirmé</span>}
                                {msg.proforma.status === 'pending' && <span className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded font-bold">En attente</span>}
                              </div>
                              <div>
                                <p className="font-bold text-sm text-white">{msg.proforma.productName}</p>
                                {msg.proforma.brand && (
                                  <span className="text-[10px] bg-white/10 text-gray-300 px-1.5 py-0.5 rounded font-medium">
                                    Marque : {msg.proforma.brand}
                                  </span>
                                )}
                              </div>
                              
                              <div className="bg-black/25 rounded-lg p-2.5 space-y-1 text-xs border border-white/10">
                                <div className="flex justify-between text-gray-300">
                                  <span>{msg.proforma.type === 'hotel' ? 'Nuitées :' : 'Quantité :'}</span>
                                  <span className="font-bold text-white">{msg.proforma.quantity} {msg.proforma.type === 'hotel' ? 'nuit(s)' : 'pièce(s)'}</span>
                                </div>
                                {msg.proforma.type !== 'hotel' && (
                                  <div className="flex justify-between text-gray-300">
                                    <span>Prix unitaire :</span>
                                    <span className="font-medium text-white">${Number(msg.proforma.unitPrice || (msg.proforma.price / (msg.proforma.quantity || 1))).toFixed(2)} / pc</span>
                                  </div>
                                )}
                                <div className="flex justify-between text-gray-300 border-t border-white/10 pt-1">
                                  <span>{msg.proforma.type === 'hotel' ? 'Tarif total séjour :' : 'Sous-total produits :'}</span>
                                  <span className="font-bold text-emerald-400">
                                    {msg.proforma.type !== 'hotel' 
                                      ? `${msg.proforma.quantity} x $${Number(msg.proforma.unitPrice || (msg.proforma.price / (msg.proforma.quantity || 1))).toFixed(2)} = $${Number(msg.proforma.totalPrice || msg.proforma.price).toFixed(2)}`
                                      : `$${Number(msg.proforma.price).toFixed(2)}`}
                                  </span>
                                </div>
                                {msg.proforma.type !== 'hotel' && (
                                  <div className="flex justify-between text-gray-300">
                                    <span>Frais Livraison :</span>
                                    <span className="font-medium text-white">${Number(msg.proforma.deliveryFee ?? 3).toFixed(2)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold border-t border-white/20 pt-1 text-white">
                                  <span>{msg.proforma.type === 'hotel' ? 'Total Séjour :' : 'Total Commande :'}</span>
                                  <span className="text-sm">
                                    ${(Number(msg.proforma.totalPrice || msg.proforma.price) + (msg.proforma.type === 'hotel' ? 0 : Number(msg.proforma.deliveryFee ?? 3))).toFixed(2)}
                                  </span>
                                </div>
                                {msg.proforma.type !== 'hotel' && (
                                  <div className="text-[11px] text-amber-300 flex justify-between pt-0.5">
                                    <span>À régler au livreur :</span>
                                    <span className="font-bold">${Number(msg.proforma.totalPrice || msg.proforma.price).toFixed(2)}</span>
                                  </div>
                                )}
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
                            <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
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
                  <form onSubmit={handleSendProforma} className="bg-white/5 p-4 rounded-xl border border-primary/30 flex flex-col space-y-3 animate-fade-in">
                    {/* En-tête avec informations du produit et stock */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                      <div>
                        <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                          <span>{isHotelChat ? "🏨 Devis Réservation Séjour" : "📄 Générateur de Facture Proforma"}</span>
                        </h4>
                        <p className="text-xs text-gray-300 mt-0.5">
                          {activeChat?.propertyTitle || activeChat?.productName || "Produit du catalogue"}
                          {productBrand && <span className="ml-1.5 text-[10px] bg-white/10 text-amber-300 px-1.5 py-0.5 rounded font-semibold">{productBrand}</span>}
                        </p>
                      </div>

                      {!isHotelChat && currentProductStock !== null && (
                        <div>
                          {currentProductStock <= 0 ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 font-bold flex items-center gap-1">
                              🔴 Rupture Totale (0 pièce en stock)
                            </span>
                          ) : currentProductStock < 10 ? (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30 font-bold flex items-center gap-1">
                              ⚠️ Moins de 10 pcs ({currentProductStock} disponibles)
                            </span>
                          ) : (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold flex items-center gap-1">
                              🟢 En stock ({currentProductStock} pièces disponibles)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Si le produit est en rupture de stock */}
                    {!isHotelChat && currentProductStock !== null && currentProductStock <= 0 && (
                      <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2">
                        <span>🔴</span>
                        <span>
                          <strong>Produit épuisé :</strong> Ce produit a 0 pièce en stock. Vous ne pouvez pas émettre de proforma tant qu'un réassort n'a pas été effectué.
                        </span>
                      </div>
                    )}

                    {/* Alerte si la quantité saisie dépasse le stock */}
                    {!isHotelChat && currentProductStock !== null && currentProductStock > 0 && proformaQuantity > currentProductStock && (
                      <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-xs text-red-200 flex items-center gap-2">
                        <span>⚠️</span>
                        <span>
                          <strong>Stock insuffisant :</strong> Vous demandez <strong>{proformaQuantity} pièces</strong> alors qu'il n'y a que <strong>{currentProductStock} pièce(s)</strong> disponibles en magasin.
                        </span>
                      </div>
                    )}

                    {/* Champs de saisie : Quantité & Prix unitaire */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-300 mb-1 font-medium">
                          {isHotelChat ? "Nombre de Nuitées" : "Quantité demandée (Pièces)"}
                        </label>
                        <input 
                          type="number" 
                          min="1" 
                          max={isHotelChat ? 365 : (currentProductStock !== null && currentProductStock > 0 ? currentProductStock : undefined)}
                          value={proformaQuantity} 
                          onChange={e => setProformaQuantity(parseInt(e.target.value) || 1)} 
                          className={`w-full bg-black/30 border rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 ${
                            !isHotelChat && currentProductStock !== null && proformaQuantity > currentProductStock
                              ? "border-red-500 ring-1 ring-red-500"
                              : "border-white/15 focus:ring-primary"
                          }`} 
                          required 
                        />
                        {!isHotelChat && currentProductStock !== null && (
                          <span className="text-[11px] text-gray-400 mt-1 block">
                            Stock max disponible : <strong>{currentProductStock} pièce(s)</strong>
                          </span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs text-gray-300 mb-1 font-medium">
                          {isHotelChat ? "Tarif Total Séjour ($)" : "Prix Unitaire ($ / pièce)"}
                        </label>
                        <input 
                          type="number" 
                          step="0.01"
                          min="0.01" 
                          value={proformaUnitPrice || ""} 
                          onChange={e => setProformaUnitPrice(parseFloat(e.target.value) || 0)} 
                          placeholder="ex: 5.00"
                          className="w-full bg-black/30 border border-white/15 rounded-xl px-3.5 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary" 
                          required 
                        />
                        <span className="text-[11px] text-gray-400 mt-1 block">
                          Prix par pièce
                        </span>
                      </div>
                    </div>

                    {/* Bloc de calcul automatique du total */}
                    <div className="bg-black/30 border border-white/10 rounded-xl p-3 text-xs space-y-1.5">
                      <div className="flex justify-between text-gray-300">
                        <span>Sous-total articles :</span>
                        <span className="font-bold text-white">
                          {proformaQuantity} pc(s) × ${Number(proformaUnitPrice || 0).toFixed(2)} = <strong className="text-emerald-400">${calculatedTotalProducts.toFixed(2)}</strong>
                        </span>
                      </div>
                      {!isHotelChat && (
                        <div className="flex justify-between text-gray-300">
                          <span>Frais de livraison Rayons (payé d'avance) :</span>
                          <span className="font-medium text-white">$3.00</span>
                        </div>
                      )}
                      <div className="border-t border-white/10 pt-1.5 flex justify-between font-bold text-sm text-white">
                        <span>Total Général Proforma :</span>
                        <span className="text-primary-light">
                          ${(calculatedTotalProducts + (isHotelChat ? 0 : 3)).toFixed(2)}
                        </span>
                      </div>
                      {!isHotelChat && (
                        <div className="text-[11px] text-amber-300 flex justify-between pt-0.5">
                          <span>À encaisser en espèces par le livreur :</span>
                          <span className="font-bold">${calculatedTotalProducts.toFixed(2)}</span>
                        </div>
                      )}
                    </div>

                    {/* Boutons d'action */}
                    <div className="flex items-center justify-end gap-2.5 pt-1">
                      <button 
                        type="button" 
                        onClick={() => setShowProformaForm(false)} 
                        className="text-gray-400 hover:text-white px-3 py-2 text-xs font-semibold rounded-xl hover:bg-white/5 transition-colors"
                      >
                        Annuler
                      </button>
                      <button 
                        type="submit" 
                        disabled={
                          !isHotelChat && currentProductStock !== null && (
                            currentProductStock <= 0 || 
                            proformaQuantity > currentProductStock || 
                            proformaUnitPrice <= 0
                          )
                        }
                        className="bg-primary hover:bg-primary-light text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <span>{isHotelChat ? "Envoyer Devis Séjour" : `Envoyer Proforma ($${calculatedTotalProducts.toFixed(2)})`}</span>
                      </button>
                    </div>
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
