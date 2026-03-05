export interface Template {
  id: string;
  name: string;
  type: "marketing" | "utility" | "authentication";
  category?: "marketing" | "utility" | "authentication";
  status?: string;
  metaTemplateId?: string;
}

export interface Step {
  id: string;
  templateId: string;
  template_name?: string;
  scheduleType: "delay" | "specific";
  delayDays?: number;
  delayHours?: number;
  specificDate?: string;
  specificTime?: string;
}

export interface Campaign {
  _id: string;
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed";
  steps: Step[];
  contacts: any[];
  createdAt: string;
}
