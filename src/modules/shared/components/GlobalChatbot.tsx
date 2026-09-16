"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { X, Send, Loader2, MessageCircle, ChevronLeft, Building2, Shirt, Wifi } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { auth, db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, getDocs, where, setDoc, doc, updateDoc, increment, limit, limitToLast } from "firebase/firestore";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { useChat } from "@/context/ChatContext";

export function GlobalChatbot() {
  const router = useRouter();
  const pathname = usePathname();
  const { isChatOpen, closeChat, toggleChat, activeProduct, closeActiveProductChat } = useChat();
  const { user } = useAuth();
  
  // State for chat list and active chat
  const [userChats, setUserChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Guest Form State
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveredEmail, setRecoveredEmail] = useState("");

  // Determine active view:
  // 1. If not logged in -> Guest Auth form
  // 2. If logged in & activeProduct is set -> ChatDetail for activeProduct
  // 3. If logged in & selectedChatId is set -> ChatDetail for selectedChatId
  // 4. Otherwise -> ChatList

  // Fetch user chats if logged in
  useEffect(() => {
    if (!user || !isChatOpen) {
      if (!user) setUserChats([]);
      return;
    }

    const q = query(
      collection(db, "chats"),
      where("clientId", "==", user.uid),
      limit(25)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats: any[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetchedChats.sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      setUserChats(fetchedChats);
    }, (err) => {
      console.warn("GlobalChatbot userChats warning:", err.message);
    });
    return () => unsubscribe();
  }, [user, isChatOpen]);

  const [payingMessageId, setPayingMessageId] = useState<string | null>(null);

  const handlePayDelivery = async (msg: any) => {
    if (!user) return;
    if (payingMessageId) return;

    // Protection anti-doublon : si déjà payé, rediriger directement vers le suivi
    if (msg.proforma?.status === 'paid') {
      if (msg.proforma?.orderId) {
        closeChat();
        router.push(`/order/${msg.proforma.orderId}/tracking`);
      } else {
        alert("Cette commande a déjà été confirmée.");
      }
      return;
    }

    const currentChatRef = selectedChatId || (activeProduct ? `${user?.uid}_${activeProduct.supplierId}_${activeProduct.id}` : null);
    if (!currentChatRef) {
      alert("Erreur de session : impossible d'identifier la conversation.");
      return;
    }

    setPayingMessageId(msg.id);

    try {
      const res = await fetch("/api/orders/pay-proforma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId: currentChatRef,
          messageId: msg.id,
          clientId: user.uid,
          clientName: user.displayName || user.email || "Client",
          clientPhone: guestPhone || user.phoneNumber || "",
          clientAddress: "Kinshasa"
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Erreur lors de la validation du proforma.");
      }

      const isHotel = msg.proforma?.type === 'hotel';

      if (isHotel) {
        alert("Réservation confirmée avec succès ! L'établissement prépare votre arrivée.");
      } else {
        alert(`Paiement de livraison validé avec succès ! Commande #${data.orderId} transmise aux livreurs.`);
        closeChat();
        router.push(`/order/${data.orderId}/tracking`);
      }
    } catch (error: any) {
      console.error("Erreur paiement proforma:", error);
      alert(error.message || "Erreur lors de la confirmation du proforma.");
    } finally {
      setPayingMessageId(null);
    }
  };

  // 2. Resolve Active Chat (either from activeProduct or selectedChatId)
  const currentChatId = activeProduct 
    ? `${user?.uid}_${activeProduct.supplierId}_${activeProduct.id}`
    : selectedChatId;

  // Pre-initialize chat doc when activeProduct is active so document exists for Firestore rules & listeners
  useEffect(() => {
    if (!user || !activeProduct) return;
    const cid = `${user.uid}_${activeProduct.supplierId}_${activeProduct.id}`;
    const initChatDoc = async () => {
      try {
        await setDoc(doc(db, "chats", cid), {
          clientId: user.uid,
          supplierId: activeProduct.supplierId,
          productId: activeProduct.id,
          productName: activeProduct.name,
          propertyTitle: activeProduct.name,
          isHotel: activeProduct.type === "hotel",
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (e) {
        console.warn("Could not pre-init chat doc:", e);
      }
    };
    initChatDoc();
  }, [user, activeProduct]);

  // Mark chat as read when client opens it
  useEffect(() => {
    if (!selectedChatId || !user) return;
    updateDoc(doc(db, "chats", selectedChatId), {
      unreadClient: false
    }).catch(() => {});
  }, [selectedChatId, user]);

  // 3. Fetch messages for active chat
  useEffect(() => {
    if (!user || !currentChatId || !isChatOpen) {
      if (!user || !currentChatId) setMessages([]);
      return;
    }

    const q = query(
      collection(db, `chats/${currentChatId}/messages`),
      orderBy("createdAt", "asc"),
      limitToLast(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }, (err) => {
      console.warn("GlobalChatbot messages listener warning:", err.message);
    });

    return () => unsubscribe();
  }, [user, currentChatId, isChatOpen]);

  // Actions
  const handleGuestAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestEmail || !guestPhone) return;
    setIsAuthenticating(true);
    setAuthError("");

    try {
      try {
        await signInWithEmailAndPassword(auth, guestEmail, guestPhone);
      } catch (err: any) {
        if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
          const cred = await createUserWithEmailAndPassword(auth, guestEmail, guestPhone);
          await setDoc(doc(db, "users", cred.user.uid), {
            uid: cred.user.uid,
            email: guestEmail,
            phone: guestPhone,
            role: "CLIENT",
            isGuest: true,
            createdAt: serverTimestamp()
          });
        } else {
          throw err;
        }
      }
    } catch (error: any) {
      console.error("Guest Auth Error:", error);
      if (error.code === "auth/email-already-in-use") {
        setAuthError("Cet email est déjà utilisé avec un autre numéro de téléphone.");
      } else {
        setAuthError("Erreur d'authentification. Vérifiez vos identifiants.");
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleRecoverEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestPhone) return;
    
    setIsAuthenticating(true);
    setAuthError("");
    setRecoveredEmail("");

    try {
      const res = await fetch("/api/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: guestPhone })
      });
      const data = await res.json();
      
      if (res.ok && data.email) {
        setRecoveredEmail(data.email);
        setGuestEmail(data.email);
      } else {
        setAuthError(data.error || "Compte introuvable.");
      }
    } catch (error) {
      setAuthError("Erreur lors de la récupération.");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || !currentChatId) return;

    const msg = newMessage.trim();
    setNewMessage("");

    try {
      // Update chat doc first to satisfy Firestore security rules (which check chat doc clientId)
      const chatDocRef = doc(db, "chats", currentChatId);
      
      const updateData: any = {
        lastMessage: msg,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        unreadSupplier: true,
        notified: false,
        clientId: user.uid,
      };

      if (activeProduct) {
        updateData.supplierId = activeProduct.supplierId;
        updateData.propertyId = activeProduct.id; // generic ID
        updateData.productName = activeProduct.name;
        if (activeProduct.type === "hotel") {
          updateData.isHotel = true;
          updateData.propertyTitle = activeProduct.name;
        }
      }

      await setDoc(chatDocRef, updateData, { merge: true });

      // Now add the message
      await addDoc(collection(db, `chats/${currentChatId}/messages`), {
        text: msg,
        senderId: user.uid,
        createdAt: serverTimestamp()
      });

    } catch (error) {
      console.error("Erreur d'envoi du message:", error);
    }
  };

  const handleBackToList = () => {
    if (activeProduct) {
      closeActiveProductChat();
    } else {
      setSelectedChatId(null);
    }
  };

  // Do not show the client chatbot on dashboard routes
  const isDashboardRoute = pathname?.startsWith("/admin") || pathname?.startsWith("/supplier") || pathname?.startsWith("/driver") || pathname?.startsWith("/dashboard");
  if (isDashboardRoute) {
    return null;
  }

  if (!isChatOpen) {
    return (
      <button 
        onClick={toggleChat}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gray-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-gray-800 transition-transform hover:scale-105 z-50"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  // Header Title
  let headerTitle = "Mes Discussions";
  let headerSubtitle = "Discutez avec nos fournisseurs";
  let isHotelChat = false;
  if (activeProduct) {
    isHotelChat = activeProduct.type === "hotel";
    headerTitle = (isHotelChat ? "🏨 " : "") + activeProduct.name;
    headerSubtitle = isHotelChat ? "Séjour & Réservation hôtelière" : "Nouveau message";
  } else if (selectedChatId) {
    const chat = userChats.find(c => c.id === selectedChatId);
    if (chat) {
      isHotelChat = Boolean(chat.isHotel || chat.propertyTitle?.toLowerCase().includes("hotel"));
      headerTitle = (isHotelChat ? "🏨 " : "") + (chat.productName || chat.propertyTitle || "Discussion");
      headerSubtitle = isHotelChat ? "Réception & Réservation" : "En ligne";
    }
  }

  return (
    <div className="fixed bottom-6 right-6 w-[350px] sm:w-[400px] h-[550px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 text-white p-4 flex justify-between items-center shrink-0">
        <div className="flex items-center space-x-3 overflow-hidden">
          {(activeProduct || selectedChatId) && (
            <button onClick={handleBackToList} className="text-gray-300 hover:text-white">
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="truncate">
            <h4 className="font-bold text-sm truncate">{headerTitle}</h4>
            <p className="text-xs text-gray-400 truncate">{headerSubtitle}</p>
          </div>
        </div>
        <button onClick={closeChat} className="text-gray-400 hover:text-white transition-colors ml-2 shrink-0">
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      {!user ? (
        // Guest Auth View
        <div className="flex-1 p-6 overflow-y-auto bg-gray-50 flex flex-col justify-center">
          <div className="text-center mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {showRecovery ? "Récupérer mon email" : "Commencer la discussion"}
            </h3>
            <p className="text-sm text-gray-500">
              {showRecovery 
                ? "Entrez votre numéro de téléphone pour retrouver l'email."
                : "Veuillez renseigner vos coordonnées pour discuter. Ces informations permettront au vendeur de vous recontacter."}
            </p>
          </div>
          
          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl">
              {authError}
            </div>
          )}

          {recoveredEmail && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-xl">
              Votre email est : <strong>{recoveredEmail}</strong>
            </div>
          )}

          {showRecovery ? (
            <form onSubmit={handleRecoverEmail} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                <input
                  type="tel"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:outline-none"
                  placeholder="Ex: 085..."
                />
              </div>
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium flex justify-center items-center hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {isAuthenticating ? <Loader2 size={20} className="animate-spin" /> : "Trouver mon email"}
              </button>
              <button 
                type="button" 
                onClick={() => setShowRecovery(false)}
                className="w-full text-sm text-gray-500 hover:text-gray-900"
              >
                Retour à la connexion
              </button>
            </form>
          ) : (
            <form onSubmit={handleGuestAuth} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:outline-none"
                  placeholder="votre@email.com"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                  <button type="button" onClick={() => setShowRecovery(true)} className="text-xs text-blue-600 hover:underline">
                    Email oublié ?
                  </button>
                </div>
                <input
                  type="tel"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-900 focus:outline-none"
                  placeholder="Ex: 085..."
                />
              </div>
              <button
                type="submit"
                disabled={isAuthenticating}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium flex justify-center items-center hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {isAuthenticating ? <Loader2 size={20} className="animate-spin" /> : "Accéder au chat"}
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-gray-500">
                  Vous avez déjà un compte ?{" "}
                  <a href="/login" className="text-blue-600 hover:underline font-medium">
                    Se connecter
                  </a>
                </p>
              </div>
            </form>
          )}
        </div>
      ) : !activeProduct && !selectedChatId ? (
        // Chat List View
        <div className="flex-1 overflow-y-auto bg-gray-50 p-2">
          {userChats.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <MessageCircle size={48} className="text-gray-300 mb-4" />
              <p className="text-gray-500 text-sm">Vous n'avez pas encore de conversation en cours.</p>
              <p className="text-gray-400 text-xs mt-2">Parcourez nos produits et contactez un fournisseur pour commencer !</p>
            </div>
          ) : (
            <div className="space-y-2">
              {userChats.map(chat => {
                const isChatHotel = Boolean(chat.isHotel || chat.propertyTitle?.toLowerCase().includes("hotel"));
                return (
                  <button
                    key={chat.id}
                    onClick={() => setSelectedChatId(chat.id)}
                    className="w-full text-left bg-white p-3 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h5 className="font-bold text-sm text-gray-900 truncate pr-2 flex items-center gap-1.5">
                        {isChatHotel && <span className="text-sm">🏨</span>}
                        <span className="truncate">{chat.productName || chat.propertyTitle || "Discussion"}</span>
                      </h5>
                      {chat.unreadClient && (
                        <span className="w-2.5 h-2.5 bg-red-500 rounded-full shrink-0"></span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {chat.lastMessage || "Nouvelle conversation"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        // Chat Detail View
        <>
          <div className="flex-1 p-4 overflow-y-auto bg-gray-50 flex flex-col space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 text-sm my-auto">
                Envoyez votre premier message au vendeur.
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.senderId === user?.uid;
                const isHotelProforma = msg.proforma?.type === 'hotel';
                return (
                  <div key={msg.id} className={`flex flex-col max-w-[85%] ${isMe ? 'self-end' : 'self-start'}`}>
                    <div className={`p-3 rounded-2xl text-sm ${isMe ? 'bg-gray-900 text-white rounded-br-sm' : (msg.type === 'proforma' ? 'bg-white border-2 border-gray-900 text-gray-900 rounded-bl-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm')}`}>
                      {msg.type === 'proforma' && msg.proforma ? (
                        <div className="flex flex-col space-y-2 min-w-[240px]">
                          <div className="font-bold border-b border-gray-200 pb-2 mb-1 flex items-center justify-between">
                            <span>{isHotelProforma ? '🏨 Devis Séjour Hôtel' : '📄 Offre Proforma'}</span>
                            {msg.proforma.status === 'paid' && <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-bold">Confirmé</span>}
                            {msg.proforma.status === 'pending' && <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded font-bold">En attente</span>}
                          </div>
                          <p className="font-semibold text-base">{msg.proforma.productName}</p>
                          
                          <div className="space-y-1 text-xs text-gray-600 bg-gray-50 p-2.5 rounded-xl">
                            <div className="flex justify-between">
                              <span>{isHotelProforma ? 'Nuitées / Séjour :' : 'Quantité :'}</span>
                              <span className="font-bold text-gray-900">{msg.proforma.quantity} {isHotelProforma ? 'nuit(s)' : 'pièce(s)'}</span>
                            </div>
                            {!isHotelProforma && (
                              <div className="flex justify-between">
                                <span>Prix unitaire :</span>
                                <span className="font-medium text-gray-900">
                                  ${Number(msg.proforma.unitPrice || (msg.proforma.price / (msg.proforma.quantity || 1))).toFixed(2)} / pc
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between border-t border-gray-200 pt-1">
                              <span>{isHotelProforma ? 'Montant Total Séjour :' : 'Sous-total articles :'}</span>
                              <span className="font-bold text-emerald-600">
                                {!isHotelProforma
                                  ? `${msg.proforma.quantity} × $${Number(msg.proforma.unitPrice || (msg.proforma.price / (msg.proforma.quantity || 1))).toFixed(2)} = $${Number(msg.proforma.totalPrice || msg.proforma.price).toFixed(2)}`
                                  : `$${Number(msg.proforma.price).toFixed(2)}`}
                              </span>
                            </div>
                            {!isHotelProforma && (
                              <div className="flex justify-between">
                                <span>Frais de livraison :</span>
                                <span className="font-medium text-gray-900">${Number(msg.proforma.deliveryFee ?? 3).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold border-t border-gray-200 pt-1 text-sm">
                              <span>{isHotelProforma ? 'Total Séjour :' : 'Total Commande :'}</span>
                              <span className="text-gray-900">
                                ${(Number(msg.proforma.totalPrice || msg.proforma.price) + (isHotelProforma ? 0 : Number(msg.proforma.deliveryFee ?? 3))).toFixed(2)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            {!isHotelProforma && (
                              <div className="flex justify-between text-xs mb-1">
                                <span className="text-gray-500">À régler en espèces au livreur :</span>
                                <span className="font-bold text-gray-900">${Number(msg.proforma.totalPrice || msg.proforma.price).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold mb-3 text-sm">
                              <span>{isHotelProforma ? 'Total à Régler :' : 'À Payer Maintenant (Livraison):'}</span>
                              <span className="text-blue-600 font-black">
                                ${isHotelProforma ? Number(msg.proforma.price).toFixed(2) : Number(msg.proforma.deliveryFee ?? 3).toFixed(2)}
                              </span>
                            </div>
                            
                            {msg.proforma.status === 'pending' && (
                              <button 
                                onClick={() => handlePayDelivery(msg)}
                                disabled={payingMessageId === msg.id}
                                className="w-full bg-gray-900 text-white py-2.5 rounded-xl font-bold hover:bg-gray-800 disabled:opacity-60 transition-colors flex items-center justify-center shadow-sm text-xs cursor-pointer"
                              >
                                {payingMessageId === msg.id ? (
                                  <span className="flex items-center gap-1.5">
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>Validation en cours...</span>
                                  </span>
                                ) : (
                                  isHotelProforma ? 'Confirmer la Réservation' : `Payer la Livraison ($${Number(msg.proforma.deliveryFee ?? 3).toFixed(2)})`
                                )}
                              </button>
                            )}
                            
                            {msg.proforma.status === 'paid' && (
                              <div className="flex flex-col space-y-2 text-center mt-2">
                                <p className="text-xs text-green-600 font-medium bg-green-50 p-2 rounded-lg">
                                  {isHotelProforma 
                                    ? 'Réservation confirmée avec succès auprès de l\'établissement !' 
                                    : `Livraison payée. Le montant des articles ($${Number(msg.proforma.totalPrice || msg.proforma.price).toFixed(2)}) sera remis en espèces au livreur.`}
                                </p>
                                {msg.proforma.orderId && !isHotelProforma && (
                                  <a href={`/order/${msg.proforma.orderId}/tracking`} className="w-full bg-gray-100 text-gray-900 py-2 rounded-lg font-medium text-sm hover:bg-gray-200 transition-colors block text-center mt-1">
                                    Suivre la livraison en direct
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-gray-200 flex items-center">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Votre message..."
              className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="ml-2 w-10 h-10 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-gray-800 disabled:opacity-50 transition-colors shrink-0"
            >
              <Send size={16} className="-ml-0.5" />
            </button>
          </form>
        </>
      )}
    </div>
  );
}
