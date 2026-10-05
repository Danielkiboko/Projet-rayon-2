import { db } from "@/lib/firebase";
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  getDoc 
} from "firebase/firestore";
import { Ticket, TicketCategory, TicketPriority, TicketStatus } from "@/types/tickets";
import { sendClientInAppNotification } from "./inAppNotification";

export function generateTicketNumber(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `TCK-${Date.now().toString().slice(-4)}${randomNum.toString().slice(-2)}`;
}

export interface CreateTicketParams {
  subject: string;
  category: TicketCategory;
  priority?: TicketPriority;
  initialMessage: string;
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  creatorRole: "client" | "supplier" | "admin";
  creatorPhone?: string;
  supplierId?: string;
  supplierName?: string;
  orderId?: string;
  propertyId?: string;
  orderSummary?: {
    orderId: string;
    totalAmount?: number;
    itemsCount?: number;
    itemsDescription?: string;
    status?: string;
    createdAt?: any;
  };
  attachments?: string[];
}

export async function createTicket(params: CreateTicketParams): Promise<string> {
  const ticketNumber = generateTicketNumber();
  const ticketRef = doc(collection(db, "tickets"));
  
  const ticketData = {
    ticketNumber,
    subject: params.subject.trim(),
    category: params.category,
    priority: params.priority || "medium",
    status: "open",
    isArchived: false,
    
    creatorId: params.creatorId,
    creatorName: params.creatorName,
    creatorEmail: params.creatorEmail,
    creatorRole: params.creatorRole,
    creatorPhone: params.creatorPhone || "",

    supplierId: params.supplierId || null,
    supplierName: params.supplierName || null,
    orderId: params.orderId || null,
    propertyId: params.propertyId || null,
    orderSummary: params.orderSummary || null,
    attachments: params.attachments || [],

    lastMessage: params.initialMessage.trim(),
    lastMessageSenderRole: params.creatorRole,
    lastMessageSenderName: params.creatorName,
    lastMessageAt: serverTimestamp(),

    unreadByAdmin: params.creatorRole !== "admin",
    unreadByClient: params.creatorRole === "admin",
    unreadBySupplier: params.creatorRole === "admin" && !!params.supplierId,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(ticketRef, ticketData);

  // Add initial message to subcollection
  await addDoc(collection(db, "tickets", ticketRef.id, "messages"), {
    senderId: params.creatorId,
    senderName: params.creatorName,
    senderEmail: params.creatorEmail,
    senderRole: params.creatorRole,
    message: params.initialMessage.trim(),
    attachments: params.attachments || [],
    createdAt: serverTimestamp(),
  });

  // Notify Admin or user via in-app notification & email
  try {
    fetch("/api/tickets/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: ticketRef.id,
        ticketNumber,
        subject: params.subject,
        senderRole: params.creatorRole,
        senderName: params.creatorName,
        message: params.initialMessage,
        action: "create",
      }),
    }).catch((err) => console.warn("Ticket email notification error:", err));
  } catch (e) {
    // Ignore notification failures
  }

  return ticketRef.id;
}

export interface SendMessageParams {
  ticketId: string;
  ticketNumber: string;
  subject: string;
  message: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderRole: "client" | "supplier" | "admin";
  recipientEmail?: string;
  recipientName?: string;
  recipientRole?: "client" | "supplier";
  recipientId?: string;
  attachments?: string[];
}

export async function sendTicketReply(params: SendMessageParams): Promise<void> {
  const ticketRef = doc(db, "tickets", params.ticketId);

  // 1. Add message to subcollection
  await addDoc(collection(db, "tickets", params.ticketId, "messages"), {
    senderId: params.senderId,
    senderName: params.senderName,
    senderEmail: params.senderEmail || "",
    senderRole: params.senderRole,
    message: params.message.trim(),
    attachments: params.attachments || [],
    createdAt: serverTimestamp(),
  });

  // 2. Fetch current ticket to check if closed/archived
  const ticketSnap = await getDoc(ticketRef);
  const currentTicket = ticketSnap.exists() ? ticketSnap.data() : null;
  const wasClosedOrArchived = currentTicket?.status === "closed" || currentTicket?.status === "resolved" || currentTicket?.isArchived;

  // 3. Update ticket document
  const updateData: any = {
    lastMessage: params.message.trim(),
    lastMessageSenderRole: params.senderRole,
    lastMessageSenderName: params.senderName,
    lastMessageAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  // If a reply is sent (especially by client), automatically reactivate the ticket
  if (wasClosedOrArchived) {
    updateData.status = "in_progress";
    updateData.isArchived = false;
    updateData.reopenedAt = serverTimestamp();
  }

  if (params.senderRole === "admin") {
    updateData.unreadByClient = true;
    updateData.unreadBySupplier = true;
    updateData.unreadByAdmin = false;
  } else {
    updateData.unreadByAdmin = true;
    if (params.senderRole === "client") {
      updateData.unreadByClient = false;
    } else {
      updateData.unreadBySupplier = false;
    }
  }

  await updateDoc(ticketRef, updateData);

  // 4. In-App Notification
  if (params.senderRole === "admin" && params.recipientId) {
    await sendClientInAppNotification({
      userId: params.recipientId,
      clientId: params.recipientRole === "client" ? params.recipientId : undefined,
      supplierId: params.recipientRole === "supplier" ? params.recipientId : undefined,
      type: "system",
      title: `Réponse Support (${params.ticketNumber})`,
      message: params.message.slice(0, 100),
      link: params.recipientRole === "supplier" ? "/supplier/tickets" : "/dashboard/client",
    });
  }

  // 5. Trigger Email Notification
  try {
    fetch("/api/tickets/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticketId: params.ticketId,
        ticketNumber: params.ticketNumber,
        subject: params.subject,
        senderRole: params.senderRole,
        senderName: params.senderName,
        message: params.message,
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName,
        recipientRole: params.recipientRole,
        action: "reply",
      }),
    }).catch((err) => console.warn("Ticket email notification error:", err));
  } catch (e) {
    // Ignore notification failures
  }
}

/**
 * Met à jour le statut du ticket.
 * Règle automatique: Dès qu'une requête passe par résolue ("resolved"), 
 * elle est directement clôturée ("closed") et archivée (isArchived: true).
 */
export async function updateTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  const ticketRef = doc(db, "tickets", ticketId);
  const now = serverTimestamp();

  if (status === "resolved" || status === "closed") {
    await updateDoc(ticketRef, {
      status: "closed",
      isArchived: true,
      resolvedAt: now,
      updatedAt: now,
    });
  } else {
    await updateDoc(ticketRef, {
      status,
      isArchived: false,
      updatedAt: now,
    });
  }
}

/**
 * Réactive un ticket clôturé / archivé (par le client ou l'admin)
 */
export async function reopenTicket(ticketId: string, reopenedByRole: "client" | "supplier" | "admin" = "client"): Promise<void> {
  const ticketRef = doc(db, "tickets", ticketId);
  const now = serverTimestamp();
  
  await updateDoc(ticketRef, {
    status: "in_progress",
    isArchived: false,
    reopenedAt: now,
    updatedAt: now,
    unreadByAdmin: reopenedByRole !== "admin",
    unreadByClient: reopenedByRole === "admin",
  });
}

export function getCategoryBadge(category: TicketCategory) {
  switch (category) {
    case "order":
      return { label: "Commande", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
    case "payment":
      return { label: "Paiement", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" };
    case "delivery":
      return { label: "Livraison", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" };
    case "property":
      return { label: "Immobilier", color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20" };
    case "product":
      return { label: "Produit", color: "bg-purple-500/10 text-purple-500 border-purple-500/20" };
    case "technical":
      return { label: "Technique", color: "bg-rose-500/10 text-rose-500 border-rose-500/20" };
    case "account":
      return { label: "Compte", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" };
    default:
      return { label: "Général", color: "bg-gray-500/10 text-gray-400 border-gray-500/20" };
  }
}

export function getStatusBadge(status: TicketStatus) {
  switch (status) {
    case "open":
      return { label: "Ouvert", color: "bg-blue-500/15 text-blue-400 border-blue-500/30", dot: "bg-blue-500" };
    case "in_progress":
      return { label: "En cours", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-500" };
    case "resolved":
      return { label: "Résolu", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-500" };
    case "closed":
      return { label: "Fermé", color: "bg-gray-500/15 text-gray-400 border-gray-500/30", dot: "bg-gray-500" };
  }
}

export function getPriorityBadge(priority: TicketPriority) {
  switch (priority) {
    case "urgent":
      return { label: "Urgent", color: "text-rose-500 bg-rose-500/10" };
    case "high":
      return { label: "Haute", color: "text-orange-500 bg-orange-500/10" };
    case "medium":
      return { label: "Moyenne", color: "text-amber-500 bg-amber-500/10" };
    case "low":
      return { label: "Basse", color: "text-slate-400 bg-slate-500/10" };
  }
}
