export interface Contact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
}

export interface Template {
  id: string;
  name: string;
  content: string;
  status: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
}

export interface BroadcastList {
  id: string;
  name: string;
  contacts: Array<{ name: string; phone: string; email?: string }>;
  createdAt: string;
}

export interface ImportedContact {
  name: string;
  phone: string;
  email?: string;
}

export interface SavedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  source?: string;
}

// Define response shape for type safety
export interface BroadcastResponse {
  successful: number;
  failed: number;
  error?: string;
  failedContacts?: Array<{ name: string; phone: string }>;
}