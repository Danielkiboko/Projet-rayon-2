export type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketCategory = 
  | "order" 
  | "payment" 
  | "delivery" 
  | "property"
  | "product" 
  | "technical" 
  | "account" 
  | "general";

export type FirestoreDate = {
  seconds?: number;
  nanoseconds?: number;
  toMillis?: () => number;
  toDate?: () => Date;
  [key: string]: unknown;
} | null | undefined;

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderRole: "client" | "supplier" | "admin";
  message: string;
  attachments?: string[];
  createdAt: FirestoreDate;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  
  // Requester
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  creatorRole: "client" | "supplier" | "admin";
  creatorPhone?: string;

  // Attached context
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
    createdAt?: FirestoreDate;
  };
  attachments?: string[];

  // Archiving & resolution lifecycle
  isArchived?: boolean;
  resolvedAt?: FirestoreDate;
  reopenedAt?: FirestoreDate;

  // Last message & indicators
  lastMessage?: string;
  lastMessageSenderRole?: "client" | "supplier" | "admin";
  lastMessageSenderName?: string;
  lastMessageAt?: FirestoreDate;
  
  // Unread flags
  unreadByAdmin?: boolean;
  unreadByClient?: boolean;
  unreadBySupplier?: boolean;

  createdAt: FirestoreDate;
  updatedAt: FirestoreDate;
}
