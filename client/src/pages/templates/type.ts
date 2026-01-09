export interface ButtonDef {
  type: "quick_reply" | "url" | "phone_number";
  text?: string;
  url?: string;
  phoneNumber?: string;
}

export interface Template {
  id: string;
  name: string;
  category: "marketing" | "utility" | "authentication";
  language: string;
  headerType: string | null;
  headerText: string | null;
  headerImageUrl: string | null;
  content: string;
  previewUrl: string | null;
  footer: string | null;
  buttons: ButtonDef[];
  status: "pending" | "approved" | "rejected";
  metaTemplateId?: string;
  metaStatus?: string;
  rejectionReason?: string;
  lastSyncedAt?: string;
  createdAt: string;
  updatedAt: string;
  variables?: string[];
}