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

export interface TicketMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderEmail?: string;
  senderRole: "client" | "supplier" | "admin";
  message: string;
  createdAt: any;
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

  // Last message & indicators
  lastMessage?: string;
  lastMessageSenderRole?: "client" | "supplier" | "admin";
  lastMessageSenderName?: string;
  lastMessageAt?: any;
  
  // Unread flags
  unreadByAdmin?: boolean;
  unreadByClient?: boolean;
  unreadBySupplier?: boolean;

  createdAt: any;
  updatedAt: any;
}
