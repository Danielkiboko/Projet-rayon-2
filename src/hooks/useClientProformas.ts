"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export interface ClientProforma {
  chatId: string;
  messageId: string;
  supplierId: string;
  supplierName: string;
  productName: string;
  productId?: string | null;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  deliveryFee: number;
  grandTotal: number;
  status: string;
  orderId?: string;
  createdAt: any;
  type: string;
}

export function useClientProformas() {
  const { user } = useAuth();
  const [proformas, setProformas] = useState<ClientProforma[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      setProformas([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const messageUnsubs: (() => void)[] = [];

    // Query all chats where this user is client
    const qChats = query(
      collection(db, "chats"),
      where("clientId", "==", user.uid)
    );

    const unsubChats = onSnapshot(
      qChats,
      (snapshot) => {
        // Clean up previous message listeners
        messageUnsubs.forEach((unsub) => unsub());
        messageUnsubs.length = 0;

        if (snapshot.empty) {
          setProformas([]);
          setIsLoading(false);
          return;
        }

        const proformasMap = new Map<string, ClientProforma>();

        snapshot.docs.forEach((chatDoc) => {
          const chatData = chatDoc.data();
          const chatId = chatDoc.id;
          const supplierName =
            chatData.supplierName ||
            chatData.productName ||
            chatData.propertyTitle ||
            "Fournisseur Partenaire";
          const supplierId = chatData.supplierId;

          const qMsg = query(
            collection(db, "chats", chatId, "messages"),
            where("type", "==", "proforma")
          );

          const unsubMsg = onSnapshot(
            qMsg,
            (msgSnap) => {
              msgSnap.docs.forEach((msgDoc) => {
                const m = msgDoc.data();
                if (m.proforma) {
                  const pfKey = `${chatId}_${msgDoc.id}`;
                  const unitP =
                    Number(
                      m.proforma.unitPrice ||
                        m.proforma.price / (m.proforma.quantity || 1)
                    ) || 0;
                  const totalP =
                    Number(m.proforma.totalPrice || m.proforma.price) || 0;
                  const deliveryF = Number(m.proforma.deliveryFee ?? 3);

                  proformasMap.set(pfKey, {
                    chatId,
                    messageId: msgDoc.id,
                    supplierId: m.proforma.supplierId || supplierId,
                    supplierName,
                    productName:
                      m.proforma.productName || "Devis / Facture Proforma",
                    productId: m.proforma.productId || null,
                    quantity: Number(m.proforma.quantity) || 1,
                    unitPrice: unitP,
                    totalPrice: totalP,
                    deliveryFee: deliveryF,
                    grandTotal: totalP + deliveryF,
                    status: m.proforma.status || "pending",
                    orderId: m.proforma.orderId,
                    createdAt: m.createdAt,
                    type: m.proforma.type || "product",
                  });
                }
              });

              // Convert to sorted array (most recent first)
              const list = Array.from(proformasMap.values());
              list.sort((a, b) => {
                const tA = a.createdAt?.toMillis?.() || 0;
                const tB = b.createdAt?.toMillis?.() || 0;
                return tB - tA;
              });

              setProformas(list);
              setIsLoading(false);
            },
            (err) => {
              console.warn("useClientProformas messages error:", err);
              setIsLoading(false);
            }
          );

          messageUnsubs.push(unsubMsg);
        });
      },
      (err) => {
        console.warn("useClientProformas chats error:", err);
        setError(err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubChats();
      messageUnsubs.forEach((unsub) => unsub());
    };
  }, [user]);

  const pendingProformas = proformas.filter((p) => p.status === "pending");
  const pendingCount = pendingProformas.length;

  return {
    proformas,
    pendingProformas,
    pendingCount,
    isLoading,
    error,
  };
}
