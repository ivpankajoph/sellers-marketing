import mongoose, { Schema, Document, Model } from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();
let isConnected = false;

export async function connectToMongoDB(): Promise<void> {
  if (isConnected) return;

  const mongoUrl = process.env.MONGODB_URL;
  if (!mongoUrl) {
    console.error('[MongoDB] MONGODB_URL not configured');
    return;
  }

  try {
    await mongoose.connect(mongoUrl, {
      dbName: 'whatsapp_dashboard',
    });
    isConnected = true;
    console.log('[MongoDB] Connected successfully');
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
  }
}

const AgentSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  systemPrompt: { type: String, default: '' },
  instructions: { type: String, default: '' },
  welcomeMessage: { type: String, default: '' },
  model: { type: String, default: 'gpt-4o' },
  temperature: { type: Number, default: 0.7 },
  maxTokens: { type: Number, default: 500 },
  isActive: { type: Boolean, default: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'agents' });

const FormSchema = new Schema({
  id: { type: String, required: true, unique: true },
  fbFormId: { type: String, required: true },
  name: { type: String, required: true },
  status: { type: String, default: 'active' },
  pageId: { type: String },
  pageName: { type: String },
  leadCount: { type: Number, default: 0 },
  createdTime: { type: String },
  createdAt: { type: String },
  syncedAt: { type: String, required: true },
}, { collection: 'forms' });

const LeadSchema = new Schema({
  id: { type: String, required: true, unique: true },
  fbLeadId: { type: String },
  formId: { type: String, required: true },
  formName: { type: String },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  fieldData: { type: Schema.Types.Mixed, default: {} },
  createdTime: { type: String },
  createdAt: { type: String },
  syncedAt: { type: String },
  autoReplySent: { type: Boolean, default: false },
  autoReplyMessage: { type: String },
  autoReplySentAt: { type: String },
}, { collection: 'leads' });

const MappingSchema = new Schema({
  id: { type: String, required: true, unique: true },
  formId: { type: String, required: true },
  formName: { type: String },
  agentId: { type: String, required: true },
  agentName: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'mappings' });

const QualificationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  contactId: { type: String, required: true },
  contactName: { type: String },
  contactPhone: { type: String },
  category: { type: String, enum: ['interested', 'not_interested', 'pending'], default: 'pending' },
  source: { type: String, enum: ['ai_chat', 'campaign', 'ad', 'lead_form', 'manual'], default: 'ai_chat' },
  campaignId: { type: String },
  campaignName: { type: String },
  agentId: { type: String },
  agentName: { type: String },
  messageCount: { type: Number, default: 0 },
  lastMessage: { type: String },
  keywords: { type: [String], default: [] },
  notes: { type: String },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'ai_qualifications' });

const BroadcastListSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  contacts: [{
    name: { type: String },
    phone: { type: String },
    email: { type: String },
    tags: { type: [String] },
  }],
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'broadcast_lists' });

const ScheduledMessageSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  messageType: { type: String, enum: ['template', 'custom', 'ai_agent'], required: true },
  templateName: { type: String },
  customMessage: { type: String },
  agentId: { type: String },
  contactIds: { type: [String] },
  listId: { type: String },
  scheduledAt: { type: String, required: true },
  status: { type: String, enum: ['scheduled', 'sent', 'failed', 'cancelled'], default: 'scheduled' },
  recipientCount: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  createdAt: { type: String, required: true },
}, { collection: 'scheduled_messages' });

const BroadcastLogSchema = new Schema({
  id: { type: String, required: true, unique: true },
  campaignName: { type: String, required: true },
  contactName: { type: String, required: true },
  contactPhone: { type: String, required: true },
  messageType: { type: String, enum: ['template', 'custom', 'ai_agent'], required: true },
  templateName: { type: String },
  message: { type: String },
  status: { type: String, enum: ['sent', 'delivered', 'failed', 'pending'], default: 'pending' },
  messageId: { type: String },
  error: { type: String },
  timestamp: { type: String, required: true },
  replied: { type: Boolean, default: false },
  repliedAt: { type: String },
}, { collection: 'broadcast_logs' });

const ImportedContactSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, default: '' },
  tags: { type: [String], default: [] },
  source: { type: String, default: 'import' },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'imported_contacts' });

const ContactAgentSchema = new Schema({
  id: { type: String, required: true, unique: true },
  contactId: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  agentId: { type: String, required: true },
  agentName: { type: String },
  conversationHistory: [{
    role: { type: String, enum: ['user', 'assistant'] },
    content: { type: String },
    timestamp: { type: String }
  }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'contact_agents' });

const ContactSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  email: { type: String, default: '' },
  tags: { type: [String], default: [] },
  notes: { type: String, default: '' },
  interestStatus: { type: String, enum: ['interested', 'not_interested', 'neutral', 'pending'], default: 'pending', index: true },
  interestConfidence: { type: Number, default: 0 },
  lastInterestUpdate: { type: Date },
  lastInboundAt: { type: Date },
  assignedDripCampaignIds: { type: [String], default: [] },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'contacts' });

const InterestClassificationLogSchema = new Schema({
  contactId: { type: String, required: true, index: true },
  contactPhone: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  messageContent: { type: String, required: true },
  previousStatus: { type: String, enum: ['interested', 'not_interested', 'neutral', 'pending'] },
  newStatus: { type: String, enum: ['interested', 'not_interested', 'neutral', 'pending'], required: true },
  confidence: { type: Number, required: true },
  classificationMethod: { type: String, enum: ['ai', 'keyword', 'manual'], required: true },
  aiResponse: { type: String },
  keywords: { type: [String], default: [] },
  triggeredCampaigns: { type: [String], default: [] },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'interest_classification_logs' });

InterestClassificationLogSchema.index({ userId: 1, createdAt: -1 });
InterestClassificationLogSchema.index({ contactId: 1, createdAt: -1 });

const MessageSchema = new Schema({
  id: { type: String, required: true, unique: true },
  contactId: { type: String, required: true, index: true },
  content: { type: String, required: true },
  type: { type: String, default: 'text' },
  direction: { type: String, enum: ['inbound', 'outbound'], required: true },
  status: { type: String, default: 'sent' },
  timestamp: { type: String, required: true },
  agentId: { type: String },
  replyToMessageId: { type: String },
  replyToContent: { type: String },
  mediaUrl: { type: String },
  whatsappMessageId: { type: String, index: true },
}, { collection: 'messages' });

const ChatSchema = new Schema({
  id: { type: String, required: true, unique: true },
  contactId: { type: String, required: true, unique: true, index: true },
  lastMessage: { type: String },
  lastMessageTime: { type: String },
  lastInboundMessageTime: { type: String },
  lastInboundMessage: { type: String },
  unreadCount: { type: Number, default: 0 },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  notes: { type: [String], default: [] },
}, { collection: 'chats' });

const CampaignSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  message: { type: String },
  contactIds: { type: [String], default: [] },
  status: { type: String, default: 'draft' },
  scheduledAt: { type: String },
  sentCount: { type: Number, default: 0 },
  deliveredCount: { type: Number, default: 0 },
  readCount: { type: Number, default: 0 },
  repliedCount: { type: Number, default: 0 },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'campaigns' });

const TemplateSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  category: { type: String, default: 'utility' },
  content: { type: String, required: true },
  variables: { type: [String], default: [] },
  status: { type: String, default: 'pending' },
  language: { type: String, default: 'en' },
  metaTemplateId: { type: String },
  metaStatus: { type: String },
  rejectionReason: { type: String },
  lastSyncedAt: { type: String },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'templates' });

const AutomationSchema = new Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  trigger: { type: String, required: true },
  message: { type: String },
  delay: { type: Number },
  delayUnit: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'automations' });

const UserSchema = new Schema({
  id: { type: String, required: true, unique: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String },
  role: { type: String, default: 'user' },
  createdAt: { type: String, required: true },
}, { collection: 'users' });

const TeamMemberSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String },
  role: { type: String, default: 'agent' },
  permissions: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  createdAt: { type: String, required: true },
}, { collection: 'team_members' });

const WhatsappSettingsSchema = new Schema({
  id: { type: String, required: true, unique: true },
  phoneNumberId: { type: String },
  businessAccountId: { type: String },
  accessToken: { type: String },
  webhookVerifyToken: { type: String },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'whatsapp_settings' });

const BillingSchema = new Schema({
  id: { type: String, required: true, unique: true },
  credits: { type: Number, default: 0 },
  transactions: [{
    id: { type: String },
    type: { type: String, enum: ['purchase', 'usage'] },
    amount: { type: Number },
    description: { type: String },
    createdAt: { type: String },
  }],
}, { collection: 'billing' });

const PrefilledTextMappingSchema = new Schema({
  id: { type: String, required: true, unique: true },
  prefilledText: { type: String, required: true },
  agentId: { type: String, required: true },
  agentName: { type: String },
  isActive: { type: Boolean, default: true },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'prefilled_text_mappings' });

const ScheduledBroadcastSchema = new Schema({
  id: { type: String, required: true, unique: true },
  contacts: [{
    name: { type: String },
    phone: { type: String },
    email: { type: String },
    tags: { type: [String] },
  }],
  messageType: { type: String, enum: ['template', 'custom', 'ai_agent'], required: true },
  templateName: { type: String },
  customMessage: { type: String },
  agentId: { type: String },
  campaignName: { type: String, required: true },
  scheduledAt: { type: String, required: true },
  status: { type: String, enum: ['scheduled', 'sending', 'sent', 'failed', 'cancelled'], default: 'scheduled' },
  createdAt: { type: String, required: true },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
}, { collection: 'scheduled_broadcasts' });

const BlockedContactSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  phone: { type: String, required: true, index: true },
  name: { type: String, default: '' },
  reason: { type: String, default: '' },
  blockedAt: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { collection: 'blocked_contacts' });

BlockedContactSchema.index({ userId: 1, phone: 1 }, { unique: true });

const UserCredentialsSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, unique: true, index: true },
  whatsappToken: { type: String },
  phoneNumberId: { type: String },
  businessAccountId: { type: String },
  webhookVerifyToken: { type: String },
  appId: { type: String },
  appSecret: { type: String },
  openaiApiKey: { type: String },
  geminiApiKey: { type: String },
  facebookAccessToken: { type: String },
  facebookPageId: { type: String },
  isVerified: { type: Boolean, default: false },
  lastVerifiedAt: { type: String },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'user_credentials' });

const ContactAnalyticsSchema = new Schema({
  id: { type: String, required: true, unique: true },
  contactId: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  contactName: { type: String, default: '' },
  interestLevel: { type: String, enum: ['highly_interested', 'interested', 'neutral', 'not_interested', 'pending'], default: 'pending' },
  interestScore: { type: Number, default: 0 },
  interestReason: { type: String, default: '' },
  totalMessages: { type: Number, default: 0 },
  inboundMessages: { type: Number, default: 0 },
  outboundMessages: { type: Number, default: 0 },
  keyTopics: { type: [String], default: [] },
  objections: { type: [String], default: [] },
  positiveSignals: { type: [String], default: [] },
  negativeSignals: { type: [String], default: [] },
  firstContactTime: { type: String },
  lastContactTime: { type: String },
  conversationDuration: { type: Number, default: 0 },
  aiAgentInteractions: [{
    agentId: String,
    agentName: String,
    messagesCount: Number,
    firstInteraction: String,
    lastInteraction: String,
    durationMinutes: Number,
  }],
  lastAnalyzedAt: { type: String },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'contact_analytics' });

const LeadAssignmentSchema = new Schema({
  id: { type: String, required: true, unique: true },
  contactId: { type: String, required: true, index: true },
  chatId: { type: String, index: true },
  phone: { type: String, required: true, index: true },
  contactName: { type: String, default: '' },
  assignedToUserId: { type: String, required: true, index: true },
  assignedToUserName: { type: String, default: '' },
  assignedByUserId: { type: String, required: true },
  assignedByUserName: { type: String, default: '' },
  status: { type: String, enum: ['assigned', 'in_progress', 'completed', 'reassigned', 'unassigned'], default: 'assigned' },
  priority: { type: String, enum: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
  notes: { type: String, default: '' },
  previousAssignments: [{
    userId: String,
    userName: String,
    assignedAt: String,
    unassignedAt: String,
    reason: String
  }],
  slaDeadline: { type: String },
  firstResponseAt: { type: String },
  resolvedAt: { type: String },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'lead_assignments' });

LeadAssignmentSchema.index({ assignedToUserId: 1, status: 1 });
LeadAssignmentSchema.index({ contactId: 1, assignedToUserId: 1 });

const TeamHierarchySchema = new Schema({
  id: { type: String, required: true, unique: true },
  managerId: { type: String, required: true, unique: true, index: true },
  managerName: { type: String, default: '' },
  teamMembers: [{
    userId: String,
    userName: String,
    addedAt: String
  }],
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'team_hierarchy' });

const ActivityLogSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  userRole: { type: String, default: '' },
  actionType: { type: String, enum: ['message_sent', 'message_received', 'lead_assigned', 'lead_reassigned', 'lead_completed', 'lead_viewed', 'login', 'logout'], required: true },
  contactId: { type: String, index: true },
  contactPhone: { type: String },
  contactName: { type: String },
  leadAssignmentId: { type: String },
  metadata: { type: Schema.Types.Mixed, default: {} },
  timestamp: { type: String, required: true },
}, { collection: 'activity_logs' });

ActivityLogSchema.index({ userId: 1, timestamp: -1 });
ActivityLogSchema.index({ actionType: 1, timestamp: -1 });

const UserActivityStatsSchema = new Schema({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  userName: { type: String, default: '' },
  date: { type: String, required: true, index: true },
  messagesSent: { type: Number, default: 0 },
  messagesReceived: { type: Number, default: 0 },
  leadsAssigned: { type: Number, default: 0 },
  leadsCompleted: { type: Number, default: 0 },
  leadsInProgress: { type: Number, default: 0 },
  avgResponseTimeMinutes: { type: Number, default: 0 },
  totalResponseTimeMinutes: { type: Number, default: 0 },
  responseCount: { type: Number, default: 0 },
  activeHours: { type: [Number], default: [] },
  createdAt: { type: String, required: true },
  updatedAt: { type: String, required: true },
}, { collection: 'user_activity_stats' });

UserActivityStatsSchema.index({ userId: 1, date: -1 });

export const Agent = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
export const Form = mongoose.models.Form || mongoose.model('Form', FormSchema);
export const Lead = mongoose.models.Lead || mongoose.model('Lead', LeadSchema);
export const Mapping = mongoose.models.Mapping || mongoose.model('Mapping', MappingSchema);
export const Qualification = mongoose.models.Qualification || mongoose.model('Qualification', QualificationSchema);
export const BroadcastList = mongoose.models.BroadcastList || mongoose.model('BroadcastList', BroadcastListSchema);
export const ScheduledMessage = mongoose.models.ScheduledMessage || mongoose.model('ScheduledMessage', ScheduledMessageSchema);
export const BroadcastLog = mongoose.models.BroadcastLog || mongoose.model('BroadcastLog', BroadcastLogSchema);
export const ImportedContact = mongoose.models.ImportedContact || mongoose.model('ImportedContact', ImportedContactSchema);
export const ContactAgent = mongoose.models.ContactAgent || mongoose.model('ContactAgent', ContactAgentSchema);
export const Contact = mongoose.models.Contact || mongoose.model('Contact', ContactSchema);
export const InterestClassificationLog = mongoose.models.InterestClassificationLog || mongoose.model('InterestClassificationLog', InterestClassificationLogSchema);
export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);
export const Chat = mongoose.models.Chat || mongoose.model('Chat', ChatSchema);
export const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', CampaignSchema);
export const Template = mongoose.models.Template || mongoose.model('Template', TemplateSchema);
export const Automation = mongoose.models.Automation || mongoose.model('Automation', AutomationSchema);
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const TeamMember = mongoose.models.TeamMember || mongoose.model('TeamMember', TeamMemberSchema);
export const WhatsappSettings = mongoose.models.WhatsappSettings || mongoose.model('WhatsappSettings', WhatsappSettingsSchema);
export const Billing = mongoose.models.Billing || mongoose.model('Billing', BillingSchema);
export const PrefilledTextMapping = mongoose.models.PrefilledTextMapping || mongoose.model('PrefilledTextMapping', PrefilledTextMappingSchema);
export const ScheduledBroadcast = mongoose.models.ScheduledBroadcast || mongoose.model('ScheduledBroadcast', ScheduledBroadcastSchema);
export const BlockedContact = mongoose.models.BlockedContact || mongoose.model('BlockedContact', BlockedContactSchema);
export const UserCredentials = mongoose.models.UserCredentials || mongoose.model('UserCredentials', UserCredentialsSchema);
export const ContactAnalytics = mongoose.models.ContactAnalytics || mongoose.model('ContactAnalytics', ContactAnalyticsSchema);
export const LeadAssignment = mongoose.models.LeadAssignment || mongoose.model('LeadAssignment', LeadAssignmentSchema);
export const TeamHierarchy = mongoose.models.TeamHierarchy || mongoose.model('TeamHierarchy', TeamHierarchySchema);
export const ActivityLog = mongoose.models.ActivityLog || mongoose.model('ActivityLog', ActivityLogSchema);
export const UserActivityStats = mongoose.models.UserActivityStats || mongoose.model('UserActivityStats', UserActivityStatsSchema);

const modelMap: Record<string, Model<any>> = {
  agents: Agent,
  forms: Form,
  leads: Lead,
  mapping: Mapping,
  ai_qualifications: Qualification,
  broadcast_lists: BroadcastList,
  scheduled_messages: ScheduledMessage,
  broadcast_logs: BroadcastLog,
  imported_contacts: ImportedContact,
  contact_agents: ContactAgent,
  contacts: Contact,
  interest_classification_logs: InterestClassificationLog,
  messages: Message,
  chats: Chat,
  campaigns: Campaign,
  templates: Template,
  automations: Automation,
  users: User,
  team_members: TeamMember,
  whatsapp_settings: WhatsappSettings,
  billing: Billing,
  prefilled_text_mappings: PrefilledTextMapping,
  scheduled_broadcasts: ScheduledBroadcast,
  blocked_contacts: BlockedContact,
  user_credentials: UserCredentials,
  contact_analytics: ContactAnalytics,
  lead_assignments: LeadAssignment,
  team_hierarchy: TeamHierarchy,
  activity_logs: ActivityLog,
  user_activity_stats: UserActivityStats,
};

export async function readCollection<T>(collectionName: string): Promise<T[]> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return [];
  }
  try {
    const docs = await model.find({}).lean();
    return docs as T[];
  } catch (error) {
    console.error(`[MongoDB] Error reading ${collectionName}:`, error);
    return [];
  }
}

export async function writeCollection<T>(collectionName: string, data: T[]): Promise<void> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return;
  }
  try {
    await model.deleteMany({});
    if (data.length > 0) {
      await model.insertMany(data);
    }
  } catch (error) {
    console.error(`[MongoDB] Error writing ${collectionName}:`, error);
  }
}

export async function findOne<T>(collectionName: string, query: Record<string, any>): Promise<T | null> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return null;
  }
  try {
    const doc = await model.findOne(query).lean();
    return doc as T | null;
  } catch (error) {
    console.error(`[MongoDB] Error finding in ${collectionName}:`, error);
    return null;
  }
}

export async function findMany<T>(collectionName: string, query: Record<string, any>): Promise<T[]> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return [];
  }
  try {
    const docs = await model.find(query).lean();
    return docs as T[];
  } catch (error) {
    console.error(`[MongoDB] Error finding in ${collectionName}:`, error);
    return [];
  }
}

export async function insertOne<T extends Record<string, any>>(collectionName: string, data: T): Promise<T | null> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return null;
  }
  try {
    const doc = await model.create(data);
    return doc.toObject() as T;
  } catch (error) {
    console.error(`[MongoDB] Error inserting into ${collectionName}:`, error);
    return null;
  }
}

export async function updateOne<T>(collectionName: string, query: Record<string, any>, update: Partial<T>): Promise<T | null> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return null;
  }
  try {
    const doc = await model.findOneAndUpdate(query, { $set: update }, { new: true }).lean();
    return doc as T | null;
  } catch (error) {
    console.error(`[MongoDB] Error updating in ${collectionName}:`, error);
    return null;
  }
}

export async function deleteOne(collectionName: string, query: Record<string, any>): Promise<boolean> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return false;
  }
  try {
    const result = await model.deleteOne(query);
    return result.deletedCount > 0;
  } catch (error) {
    console.error(`[MongoDB] Error deleting from ${collectionName}:`, error);
    return false;
  }
}

export async function countDocuments(collectionName: string, query: Record<string, any> = {}): Promise<number> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return 0;
  }
  try {
    return await model.countDocuments(query);
  } catch (error) {
    console.error(`[MongoDB] Error counting in ${collectionName}:`, error);
    return 0;
  }
}

export async function insertMany<T extends Record<string, any>>(collectionName: string, data: T[]): Promise<T[]> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return [];
  }
  try {
    const docs = await model.insertMany(data, { ordered: false });
    return docs.map(doc => doc.toObject()) as T[];
  } catch (error) {
    console.error(`[MongoDB] Error bulk inserting into ${collectionName}:`, error);
    return [];
  }
}

export async function updateMany(collectionName: string, query: Record<string, any>, update: Record<string, any>): Promise<number> {
  await connectToMongoDB();
  const model = modelMap[collectionName];
  if (!model) {
    console.error(`[MongoDB] Unknown collection: ${collectionName}`);
    return 0;
  }
  try {
    const result = await model.updateMany(query, { $set: update });
    console.log(`[MongoDB] Updated ${result.modifiedCount} documents in ${collectionName}`);
    return result.modifiedCount;
  } catch (error) {
    console.error(`[MongoDB] Error updating many in ${collectionName}:`, error);
    return 0;
  }
}
