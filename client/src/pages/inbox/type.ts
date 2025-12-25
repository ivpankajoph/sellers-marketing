export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
}

export interface Message {
  id: string;
  contactId: string;
  content: string;
  type: string;
  direction: "inbound" | "outbound";
  status: string;
  timestamp: string;
  replyToMessageId?: string;
  replyToContent?: string;
  mediaUrl?: string;
}

export interface Chat {
  id: string;
  contactId: string;
  contact: Contact;
  lastMessage?: string;
  lastMessageTime?: string;
  lastInboundMessageTime?: string;
  lastInboundMessage?: string;
  unreadCount: number;
  status: string;
  windowExpiresAt?: string;
}

export interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[];
  status: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface ImportedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
}
