"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  serverTimestamp, 
  getDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  MessageSquare, 
  ChevronLeft, 
  Maximize2, 
  Search, 
  CheckCheck, 
  MoreHorizontal, 
  ClipboardList, 
  Megaphone, 
  Sparkles, 
  ChevronDown, 
  Archive,
  Store,
  Check,
  X,
  ExternalLink
} from "lucide-react";
import Link from "next/link";
import { ChatBox } from "@/modules/client/components/ChatBox";

interface ClientChatsWidgetProps {
  embedded?: boolean;
  onChatSelected?: (chatId: string) => void;
  ordersCount?: number;
  notificationsCount?: number;
  proformasCount?: number;
  onSelectTab?: (tab: "orders" | "proformas" | "hotels" | "visits" | "messages" | "tickets") => void;
}

// Preset realistic product thumbnails for Alibaba experience if not provided in chat doc
const DEFAULT_PRODUCT_THUMBNAILS = [
  "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=150&auto=format&fit=crop&q=80", // Electric Motorbike / Scooter (like Alibaba)
  "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=150&auto=format&fit=crop&q=80", // Headphones / Tech
  "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=150&auto=format&fit=crop&q=80", // Shoes / Sneakers
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=150&auto=format&fit=crop&q=80", // Smartwatch
  "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=150&auto=format&fit=crop&q=80", // Apparel / Accessories
];

// Preset realistic sales avatars (like Alibaba Shirley Xiao, Ahane Xu, etc.)
const DEFAULT_VENDOR_AVATARS = [
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop&q=80"
];

export function ClientChatsWidget({ 
  embedded = false,
  ordersCount = 0,
  notificationsCount = 0,
  proformasCount = 0,
  onSelectTab
}: ClientChatsWidgetProps) {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const paramSupplierId = searchParams.get("supplierId");
  const paramChatId = searchParams.get("chatId");
  const paramProductId = searchParams.get("productId");
  const paramProductName = searchParams.get("productName");
  const paramProductImage = searchParams.get("productImage");
  const paramProductPrice = searchParams.get("productPrice");

  const [chats, setChats] = useState<any[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Alibaba search & filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "unread" | "ordered" | "proformas">("all");
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  // 1. Listen to all client chats
  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }

    const q = query(
      collection(db, "chats"),
      where("clientId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedChats: any[] = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      }));

      // Sort by updatedAt desc
      fetchedChats.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || a.lastMessageTime?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || b.lastMessageTime?.toMillis?.() || 0;
        return timeB - timeA;
      });

      setChats(fetchedChats);
      setIsLoading(false);
    }, (err) => {
      console.warn("Client chats listener warning:", err.message);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, router]);

  // 2. Handle searchParams (supplierId, chatId, productId) & auto-selection
  useEffect(() => {
    if (!user || isLoading) return;

    const resolveChat = async () => {
      // Direct chatId provided
      if (paramChatId) {
        setActiveChatId(paramChatId);
        return;
      }

      // supplierId provided
      if (paramSupplierId) {
        const existing = chats.find(c => c.supplierId === paramSupplierId);
        if (existing) {
          setActiveChatId(existing.id);
          // If product context was provided, link it to the conversation
          if (paramProductName || paramProductImage) {
            updateDoc(doc(db, "chats", existing.id), {
              productName: paramProductName || existing.productName,
              productId: paramProductId || existing.productId || null,
              productImage: paramProductImage || existing.productImage || null,
              productPrice: paramProductPrice || existing.productPrice || null,
              updatedAt: serverTimestamp(),
            }).catch(() => {});
          }
        } else {
          // Initialize a new chat with this supplier
          try {
            const supplierDoc = await getDoc(doc(db, "users", paramSupplierId));
            const supplierData = supplierDoc.data() || {};
            const supplierName = supplierData.displayName || supplierData.businessName || supplierData.email || "Fournisseur";

            const newChatId = `${user.uid}_${paramSupplierId}`;
            await setDoc(doc(db, "chats", newChatId), {
              clientId: user.uid,
              clientName: user.displayName || user.email || "Client VIP",
              supplierId: paramSupplierId,
              supplierName: supplierName,
              productName: paramProductName || supplierName,
              productId: paramProductId || null,
              productImage: paramProductImage || null,
              productPrice: paramProductPrice || null,
              propertyTitle: paramProductName || supplierName,
              updatedAt: serverTimestamp(),
              createdAt: serverTimestamp(),
            }, { merge: true });

            setActiveChatId(newChatId);
          } catch (e) {
            console.warn("Error resolving supplier chat:", e);
          }
        }
        return;
      }

      // Default auto-select first conversation on large desktop only
      if (!activeChatId && chats.length > 0 && typeof window !== "undefined" && window.innerWidth >= 1024) {
        setActiveChatId(chats[0].id);
      }
    };

    resolveChat();
  }, [paramChatId, paramSupplierId, paramProductId, paramProductName, paramProductImage, paramProductPrice, chats, isLoading, user, activeChatId]);

  // Mark all discussions as read (Sweep icon like Alibaba)
  const handleMarkAllAsRead = async () => {
    if (!user || isMarkingRead || chats.length === 0) return;
    setIsMarkingRead(true);
    try {
      const batch = writeBatch(db);
      chats.forEach((chat) => {
        if (chat.unreadClient) {
          const chatRef = doc(db, "chats", chat.id);
          batch.update(chatRef, { unreadClient: false });
        }
      });
      await batch.commit();
    } catch (err) {
      console.warn("Could not mark all chats read:", err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  // Filtered discussions
  const filteredChats = useMemo(() => {
    return chats.filter((c) => {
      // Tab filter
      if (activeFilter === "unread" && !c.unreadClient) return false;
      if (activeFilter === "ordered" && !c.orderId && !c.hasOrder) return false;
      if (activeFilter === "proformas" && !c.lastMessage?.includes("Proforma") && !c.lastMessage?.includes("Devis")) return false;

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const titleMatch = (c.propertyTitle || c.productName || "").toLowerCase().includes(q);
        const supplierMatch = (c.supplierName || c.companyName || "").toLowerCase().includes(q);
        const msgMatch = (c.lastMessage || "").toLowerCase().includes(q);
        return titleMatch || supplierMatch || msgMatch;
      }

      return true;
    });
  }, [chats, activeFilter, searchQuery]);

  const unreadCount = useMemo(() => {
    return chats.filter((c) => Boolean(c.unreadClient)).length;
  }, [chats]);

  const formatChatTime = (timestamp: any) => {
    if (!timestamp) return "08:02";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  };

  if (!user) {
    return <div className="p-8 text-center text-gray-400">Chargement...</div>;
  }

  const activeChat = chats.find(c => c.id === activeChatId);
  const activeChatName = activeChat?.propertyTitle || activeChat?.productName || activeChat?.supplierName || "Agent / Vendeur";

  return (
    <div className={`flex flex-1 bg-white rounded-3xl shadow-sm border border-gray-200/90 overflow-hidden ${embedded ? 'min-h-[640px] h-[720px]' : 'min-h-[680px]'}`}>
      
      {/* ────────────────── ALIBABA CONVERSATION HUB (LEFT PANEL / MOBILE FULL) ────────────────── */}
      <div className={`w-full md:w-5/12 lg:w-4/12 border-r border-gray-200 flex flex-col bg-white ${activeChatId ? 'hidden md:flex' : 'flex'}`}>
        
        {/* 1. Header Alibaba "Messagerie" */}
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Messagerie</h1>
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              title="Marquer toutes les discussions comme lues"
              disabled={isMarkingRead || unreadCount === 0}
              className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-30 cursor-pointer"
            >
              <CheckCheck size={18} />
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className={`p-2 rounded-xl transition-colors cursor-pointer ${
                isSearchOpen ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-100"
              }`}
              title="Rechercher une discussion"
            >
              <Search size={18} />
            </button>

            {embedded && (
              <Link 
                href="/dashboard/client/chats" 
                className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                title="Plein écran"
              >
                <Maximize2 size={16} />
              </Link>
            )}

            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors cursor-pointer"
              title="Options"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        </div>

        {/* Search input bar (when search is toggled) */}
        {isSearchOpen && (
          <div className="px-4 py-2 border-b border-gray-100 bg-gray-50/90 flex items-center gap-2">
            <Search size={15} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Rechercher par vendeur, boutique, message..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-transparent text-xs text-gray-900 placeholder-gray-400 focus:outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-gray-400 hover:text-gray-600">
                <X size={14} />
              </button>
            )}
          </div>
        )}

        {/* 2. Alibaba Top Shortcut Cards (Commandes, Notification, Projets) */}
        <div className="p-3 sm:p-4 grid grid-cols-3 gap-2 border-b border-gray-100 bg-gray-50/50">
          
          {/* Card 1: Commandes */}
          <button
            type="button"
            onClick={() => {
              if (onSelectTab) onSelectTab("orders");
              else window.location.href = "/dashboard/client?tab=orders";
            }}
            className="p-2.5 rounded-2xl bg-[#FFF9EE] border border-[#FFE8C8] text-left hover:scale-[1.02] active:scale-98 transition-all relative flex flex-col justify-between cursor-pointer"
          >
            {ordersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#FF3B30] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[17px] text-center shadow-xs">
                {ordersCount > 99 ? "99+" : ordersCount}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-[#B87000] mb-1">
              <ClipboardList size={14} />
              <span className="text-[11px] font-bold text-gray-900">Commandes</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight line-clamp-2">
              Vous avez des commandes à suivre...
            </p>
          </button>

          {/* Card 2: Notification */}
          <button
            type="button"
            onClick={() => {
              if (onSelectTab) onSelectTab("tickets");
              else window.location.href = "/dashboard/client?tab=tickets";
            }}
            className="p-2.5 rounded-2xl bg-[#F0F6FF] border border-[#DCE8FC] text-left hover:scale-[1.02] active:scale-98 transition-all relative flex flex-col justify-between cursor-pointer"
          >
            {notificationsCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-[#FF3B30] text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[17px] text-center shadow-xs">
                {notificationsCount > 99 ? "99+" : notificationsCount}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-blue-600 mb-1">
              <Megaphone size={14} />
              <span className="text-[11px] font-bold text-gray-900">Notification</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight line-clamp-2">
              ► Mode alertes : ACTIVÉ
            </p>
          </button>

          {/* Card 3: Projets / RFQ */}
          <button
            type="button"
            onClick={() => {
              if (onSelectTab) onSelectTab("proformas");
              else window.location.href = "/dashboard/client?tab=proformas";
            }}
            className="p-2.5 rounded-2xl bg-white border border-gray-200 text-left hover:scale-[1.02] active:scale-98 transition-all relative flex flex-col justify-between cursor-pointer shadow-2xs"
          >
            {proformasCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded-full min-w-[17px] text-center shadow-xs animate-pulse">
                {proformasCount}
              </span>
            )}
            <div className="flex items-center gap-1.5 text-amber-500 mb-1">
              <Sparkles size={14} />
              <span className="text-[11px] font-bold text-gray-900">Projets</span>
            </div>
            <p className="text-[10px] text-gray-500 leading-tight line-clamp-2">
              Devis & Proformas RFQ
            </p>
          </button>

        </div>

        {/* 3. Alibaba Filter Pills (Non lus, Commandé, Mes étiquettes) */}
        <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between gap-2 overflow-x-auto scrollbar-none bg-white">
          <div className="flex items-center gap-2">
            
            {/* Non lus Pill */}
            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === "unread" ? "all" : "unread")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeFilter === "unread"
                  ? "bg-[#FFF0E6] text-[#FF6600] border border-[#FFD1B3]"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span>Non lus</span>
              {unreadCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#FF3B30] text-white text-[10px] font-black flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Commandé Pill */}
            <button
              type="button"
              onClick={() => setActiveFilter(activeFilter === "ordered" ? "all" : "ordered")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === "ordered"
                  ? "bg-[#FFF0E6] text-[#FF6600] border border-[#FFD1B3]"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Commandé
            </button>

            {/* Mes étiquettes / Tous Pill */}
            <button
              type="button"
              onClick={() => setActiveFilter("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <span>Toutes</span>
              <ChevronDown size={13} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setActiveFilter("proformas")}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title="Boîte de devis / RFQ"
          >
            <Archive size={16} />
          </button>
        </div>

        {/* 4. Conversation List (Exact Alibaba signature rows) */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {isLoading ? (
            <div className="p-8 text-center text-gray-400 text-xs">Chargement de vos échanges Alibaba...</div>
          ) : filteredChats.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <MessageSquare size={40} className="mx-auto mb-2 text-gray-300" />
              <p className="font-bold text-gray-700 text-sm mb-1">Aucune discussion trouvée</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                {activeFilter === "unread"
                  ? "Vous êtes à jour ! Aucun nouveau message non lu."
                  : "Contactez un vendeur depuis un rayon pour démarrer une discussion."}
              </p>
            </div>
          ) : (
            filteredChats.map((chat, idx) => {
              const isSelected = activeChatId === chat.id;
              const hasUnread = Boolean(chat.unreadClient);
              const vendorName = chat.supplierName || chat.contactName || chat.productName || "Shirley Xiao";
              const companyName = chat.companyName || chat.storeName || (chat.isHotel ? "Hôtel Partenaire Rayons" : "Wuxi Ladea Ev Co., Ltd.");
              const lastMsg = chat.lastMessage || "Bonjour, je suis disponible pour vous renseigner.";
              const chatTime = formatChatTime(chat.updatedAt || chat.lastMessageTime);

              // Product thumbnail image
              const productThumb = chat.productImage || chat.imageUrl || chat.propertyImage || DEFAULT_PRODUCT_THUMBNAILS[idx % DEFAULT_PRODUCT_THUMBNAILS.length];
              const vendorAvatar = chat.supplierAvatar || DEFAULT_VENDOR_AVATARS[idx % DEFAULT_VENDOR_AVATARS.length];

              return (
                <button
                  key={chat.id}
                  type="button"
                  onClick={() => setActiveChatId(chat.id)}
                  className={`w-full text-left p-3.5 sm:p-4 hover:bg-gray-50/80 transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                    isSelected ? "bg-amber-50/30 border-l-4 border-[#FF6600]" : ""
                  }`}
                >
                  {/* Left: Round Avatar with Alibaba Unread Red Dot/Badge */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                      <img
                        src={vendorAvatar}
                        alt={vendorName}
                        className="w-full h-full object-cover"
                        onError={(e: any) => {
                          e.target.src = "/images/placeholder.png";
                        }}
                      />
                    </div>
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#FF3B30] text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow-xs">
                        1
                      </span>
                    )}
                  </div>

                  {/* Middle Column: Vendor Name, Store Name, Message with [Non lus] */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-900 text-sm truncate">
                        {vendorName}
                      </span>
                      <span className="text-[11px] text-gray-400 shrink-0 font-medium">
                        {chatTime}
                      </span>
                    </div>

                    <div className="text-[11px] text-gray-400 truncate mt-0.5">
                      {companyName}
                    </div>

                    <div className="text-xs text-gray-600 truncate mt-1">
                      {hasUnread ? (
                        <>
                          <span className="text-[#FF6600] font-bold">[Non lus] </span>
                          <span className="text-gray-900 font-medium">{lastMsg}</span>
                        </>
                      ) : (
                        <span className="text-gray-500">{lastMsg}</span>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Product Thumbnail Image */}
                  <div className="w-11 h-11 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-gray-50">
                    <img
                      src={productThumb}
                      alt="Article"
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.target.src = "/images/placeholder.png";
                      }}
                    />
                  </div>
                </button>
              );
            })
          )}
        </div>

      </div>

      {/* ────────────────── CHAT AREA (RIGHT PANEL / MOBILE EXPANDED) ────────────────── */}
      <div className={`flex-1 flex flex-col bg-white ${!activeChatId ? 'hidden md:flex' : 'flex'}`}>
        {activeChatId ? (
          <div className="h-full flex flex-col flex-1 min-h-0">
            {/* Conversation Header with back button & product context */}
            <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/70">
              <button 
                onClick={() => setActiveChatId(null)}
                className="flex items-center gap-1 text-xs font-bold text-[#FF6600] hover:text-[#e05a00] cursor-pointer md:hidden"
              >
                <ChevronLeft size={18} />
                <span>Retour</span>
              </button>

              <div className="text-center md:text-left truncate px-2 flex-1">
                <div className="text-xs sm:text-sm font-bold text-gray-900 truncate">{activeChatName}</div>
                <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" /> En ligne • Vendeur Vérifié Rayons
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-gray-200 text-xs font-bold text-gray-700 hover:text-[#FF6600] hover:border-[#FF6600]/40 transition-colors shadow-2xs"
                  title="Continuer mes achats sur Rayons"
                >
                  <span>Rayons</span>
                  <ExternalLink size={12} />
                </Link>
                {embedded && (
                  <Link 
                    href={`/dashboard/client/chats?chatId=${activeChatId}`} 
                    className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                  >
                    <Maximize2 size={13} />
                  </Link>
                )}
              </div>
            </div>

            {/* Product inquiry banner if the chat has a product */}
            {(activeChat?.productName || activeChat?.productId) && (
              <div className="px-4 py-2.5 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {activeChat.productImage && (
                    <img 
                      src={activeChat.productImage} 
                      alt="" 
                      className="w-9 h-9 rounded-lg object-cover border border-amber-200 shrink-0 bg-white" 
                    />
                  )}
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">Demande produit :</span>
                    <p className="font-bold text-gray-900 truncate text-xs">{activeChat.productName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {activeChat.productPrice && (
                    <span className="font-black text-gray-900 text-xs">
                      ${activeChat.productPrice}
                    </span>
                  )}
                  {activeChat.productId && (
                    <Link
                      href={`/product/${activeChat.productId}`}
                      className="text-[11px] font-bold text-[#FF6600] hover:underline"
                    >
                      Voir l'article
                    </Link>
                  )}
                </div>
              </div>
            )}
            
            {/* Embedded ChatBox */}
            <div className="flex-1 flex flex-col min-h-0">
              <ChatBox 
                chatId={activeChatId} 
                otherUserName={activeChatName} 
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-8 text-center bg-gray-50/30">
            <div className="w-16 h-16 rounded-3xl bg-amber-50 text-[#FF6600] border border-amber-200/60 flex items-center justify-center mb-3 shadow-xs">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-gray-800 font-bold text-base mb-1">Centre de Messagerie Acheteur</h3>
            <p className="text-xs text-gray-400 max-w-sm">
              Sélectionnez une discussion à gauche pour échanger en direct, négocier vos prix ou régler vos factures proforma certifiées.
            </p>
          </div>
        )}
      </div>
      
    </div>
  );
}

export default ClientChatsWidget;
