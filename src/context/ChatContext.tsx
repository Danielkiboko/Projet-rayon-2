"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import toast from "react-hot-toast";

export interface ProductInfo {
  id: string;
  supplierId: string;
  name: string;
  type?: string;
  price?: number;
  image?: string;
}

interface ChatContextType {
  isChatOpen: boolean;
  openChat: (supplierId?: string, productId?: string) => void;
  closeChat: () => void;
  toggleChat: () => void;
  
  activeProduct: ProductInfo | null;
  openChatForProduct: (product: ProductInfo) => void;
  closeActiveProductChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user } = useAuth();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState<ProductInfo | null>(null);

  const openChat = useCallback((supplierId?: string, productId?: string) => {
    const params = new URLSearchParams();
    params.set("tab", "messages");
    if (supplierId) params.set("supplierId", supplierId);
    if (productId) params.set("productId", productId);

    const targetUrl = `/dashboard/client?${params.toString()}`;

    if (!user) {
      toast("Connectez-vous pour échanger avec le vendeur dans votre Espace Client.", {
        icon: "💬",
      });
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
      return;
    }

    router.push(targetUrl);
  }, [user, router]);

  const openChatForProduct = useCallback((product: ProductInfo) => {
    setActiveProduct(product);

    // Keep full product payload (including base64 thumbnails if any) in sessionStorage
    // so we NEVER bloat or break URLs with giant data:image/... query strings.
    try {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          "rayons_pending_chat_product",
          JSON.stringify({
            id: product.id,
            supplierId: product.supplierId,
            name: product.name,
            price: product.price,
            image: product.image,
          })
        );
      }
    } catch {
      // Ignore storage quota / privacy mode errors; ClientChatsWidget will fetch from Firestore by productId
    }

    const params = new URLSearchParams();
    params.set("tab", "messages");
    if (product.supplierId) params.set("supplierId", product.supplierId);
    if (product.id) params.set("productId", product.id);
    if (product.name) params.set("productName", product.name);
    if (
      product.image &&
      !product.image.startsWith("data:") &&
      product.image.length <= 500
    ) {
      params.set("productImage", product.image);
    }
    if (product.price) params.set("productPrice", product.price.toString());

    const targetUrl = `/dashboard/client?${params.toString()}`;

    if (!user) {
      toast("Connectez-vous pour discuter avec le vendeur dans votre Espace Client.", {
        icon: "💬",
      });
      router.push(`/login?redirect=${encodeURIComponent(targetUrl)}`);
      return;
    }

    router.push(targetUrl);
  }, [user, router]);

  const closeChat = useCallback(() => setIsChatOpen(false), []);
  const toggleChat = useCallback(() => openChat(), [openChat]);
  const closeActiveProductChat = useCallback(() => setActiveProduct(null), []);

  const chatValue = useMemo(
    () => ({
      isChatOpen,
      openChat,
      closeChat,
      toggleChat,
      activeProduct,
      openChatForProduct,
      closeActiveProductChat,
    }),
    [isChatOpen, openChat, closeChat, toggleChat, activeProduct, openChatForProduct, closeActiveProductChat]
  );

  return (
    <ChatContext.Provider value={chatValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
