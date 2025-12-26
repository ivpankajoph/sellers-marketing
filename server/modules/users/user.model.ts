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
  { id: 'dashboard', name: 'Dashboard', icon: 'LayoutDashboard', path: '/' },
  { id: 'window-inbox', name: '24-Hour Window Inbox', icon: 'Clock', path: '/inbox/window' },
  { id: 'inbox', name: 'Inbox', icon: 'MessageSquare', path: '/inbox' },
  { id: 'contacts', name: 'Contacts', icon: 'Users', path: '/contacts' },
  { id: 'broadcast', name: 'Broadcast', icon: 'Radio', path: '/broadcast' },
  { id: 'templates', name: 'Templates', icon: 'FileText', path: '/templates' },
  { id: 'ai-agents', name: 'AI Agents', icon: 'Bot', path: '/ai-agents' },
  { id: 'whatsapp-leads', name: 'WhatsApp Leads', icon: 'UserPlus', path: '/whatsapp-leads' },
  { id: 'facebook-leads', name: 'Facebook Leads', icon: 'Facebook', path: '/facebook-leads' },
  { id: 'auto-reply', name: 'Auto Reply System', icon: 'Zap', path: '/auto-reply' },
  { id: 'flow-builder', name: 'Flow Builder', icon: 'GitBranch', path: '/flow-builder' },
  { id: 'reports-campaign', name: 'Campaign Performance', icon: 'BarChart3', path: '/reports/campaign-performance' },
  { id: 'reports-blocked', name: 'Blocked Contacts', icon: 'Ban', path: '/reports/blocked-contacts' },
  { id: 'reports-engagement', name: 'User Engagement', icon: 'TrendingUp', path: '/reports/user-engagement' },
  { id: 'settings', name: 'Settings', icon: 'Settings', path: '/settings' },
  { id: 'user-management', name: 'User Management', icon: 'UserCog', path: '/user-management' }
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
