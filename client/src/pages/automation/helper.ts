export interface Template {
  id: string;
  name: string;
  type: "marketing" | "utility" | "authentication";
}

export interface Step {
  id: string;
  templateId: string;
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