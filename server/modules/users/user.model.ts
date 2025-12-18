import mongoose, { Document, Schema } from 'mongoose';
import crypto from 'crypto';

export interface ISystemUser extends Document {
  id: string;
  email: string;
  name: string;
  username: string;
  password: string;
  role: 'super_admin' | 'sub_admin' | 'manager' | 'user';
  pageAccess: string[];
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const SystemUserSchema = new Schema<ISystemUser>({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['super_admin', 'sub_admin', 'manager', 'user'],
    default: 'user'
  },
  pageAccess: [{ type: String }],
  isActive: { type: Boolean, default: true },
  createdBy: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

SystemUserSchema.pre('save', function() {
  this.updatedAt = new Date();
});

export const SystemUser = mongoose.model<ISystemUser>('SystemUser', SystemUserSchema);

export const AVAILABLE_PAGES = [
  {
    id: "dashboard",
    name: "Dashboard",
    icon: "LayoutDashboard",
    path: "/",
    children: [],
  },

  {
    id: "window-inbox",
    name: "24-Hour Window",
    icon: "Clock",
    path: "/inbox/window",
    children: [],
  },

  {
    id: "inbox",
    name: "Inbox",
    icon: "MessageSquare",
    path: "/inbox",
    children: [],
  },

  {
    id: "broadcast",
    name: "Campaigns",
    icon: "Megaphone",
    path: "/campaigns",
    children: [
      { id: "broadcasts", name: "Broadcasts", path: "/campaigns/broadcast" },
      { id: "schedule-messages", name: "Schedule Messages", path: "/campaigns/schedule" },
    ],
  },

  {
    id: "auto-reply",
    name: "Automation",
    icon: "GitBranch",
    path: "/automation/dashboard",
    children: [
      { id: "automation-triggers", name: "Triggers", path: "/automation/triggers" },
      { id: "whatsapp-flows", name: "Flows", path: "/whatsapp/flows" },
      { id: "drip-campaigns", name: "Drip Campaigns", path: "/automation/campaigns" },
      { id: "automation-analytics", name: "Analytics", path: "/automation/analytics" },
      { id: "interest-lists", name: "Interest Lists", path: "/automation/interest" },
      { id: "follow-up", name: "Follow-up", path: "/automation/follow-up" },
    ],
  },

  {
    id: "flow-builder",
    name: "Connect Apps",
    icon: "LayoutGrid",
    path: "/apps/connect",
    children: [],
  },

  {
    id: "templates",
    name: "Templates",
    icon: "FileText",
    path: "/templates",
    children: [
      { id: "add-template", name: "Add Template", path: "/templates/add" },
      { id: "manage-templates", name: "Manage Templates", path: "/templates/manage" },
    ],
  },

  {
    id: "billing",
    name: "Usage & Billing",
    icon: "FileText",
    path: "/settings/billing",
    children: [
      { id: "billing-credits", name: "Billing & Credits", path: "/settings/billing" },
      { id: "spending", name: "Spending", path: "/reports/spending" },
      { id: "contact-usage", name: "Contact Usage Dashboard", path: "/contactusagedashboard" },
      { id: "ai-tokens", name: "AI Tokens", path: "/aitokens" },
      { id: "whatsapp-tokens", name: "WhatsApp Tokens", path: "/whatsapptokens" },
    ],
  },

  {
    id: "ai-agents",
    name: "AI Agent",
    icon: "Bot",
    path: "/ai",
    children: [
      { id: "all-agents", name: "All Agents", path: "/ai/agents" },
      { id: "new-agent", name: "New Agent", path: "/ai/new" },
      { id: "prefilled-text", name: "Pre-filled Text", path: "/ai/prefilled" },
    ],
  },

  {
    id: "facebook-leads",
    name: "Facebook",
    icon: "Facebook",
    path: "/facebook",
    children: [
      { id: "facebook-forms", name: "Lead Forms", path: "/facebook/forms" },
      { id: "facebook-leads-list", name: "Leads", path: "/facebook/leads" },
    ],
  },

  {
    id: "reports-campaign",
    name: "Reports",
    icon: "BarChart3",
    path: "/reports",
    children: [
      { id: "delivery-report", name: "Delivery Report", path: "/reports/delivery" },
      { id: "broadcast-report", name: "Broadcast Report", path: "/reports/broadcast" },
      { id: "campaign-performance", name: "Campaign Performance", path: "/campaigns/report" },
      { id: "agent-performance", name: "Agent Performance", path: "/reports/agents" },
      { id: "contact-analytics", name: "Contact Analytics", path: "/reports/contacts" },
      { id: "lead-assignments", name: "Lead Assignments", path: "/reports/lead-assignments" },
      { id: "user-activity", name: "User Activity", path: "/reports/user-activity" },
      { id: "blocked-contacts", name: "Blocked Contacts", path: "/reports/blocked" },
      { id: "user-engagement", name: "User Engagement", path: "/reports/user-engagement" },
    ],
  },

  {
    id: "contacts",
    name: "Contacts",
    icon: "Users",
    path: "/contacts",
    children: [],
  },

  {
    id: "user-management",
    name: "User Management",
    icon: "UserCog",
    path: "/user-management",
    children: [],
  },

  {
    id: "settings",
    name: "Settings",
    icon: "Settings",
    path: "/settings",
    children: [
      { id: "profile-details", name: "Profile Details", path: "/settings/profile" },
      { id: "webhook-api", name: "Webhook & API", path: "/settings/api" },
    ],
  },
];


export const ROLE_LABELS: Record<string, string> = {
  'super_admin': 'Super Admin',
  'sub_admin': 'Sub Admin',
  'manager': 'Manager',
  'user': 'Regular User'
};

export function generateUsername(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const suffix = crypto.randomBytes(3).toString('hex');
  return `${base}${suffix}`;
}

export function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
