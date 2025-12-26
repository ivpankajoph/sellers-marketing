import {
  type User,
  type Contact,
  type Message,
  type Campaign,
  type Template,
  type Automation,
  type TeamMember,
  type WhatsappSettings,
  type Billing,
  type Chat,
  type InsertUser,
  type InsertContact,
  type InsertMessage,
  type InsertCampaign,
  type InsertTemplate,
  type InsertAutomation,
  type InsertTeamMember,
} from "@shared/schema";
import { randomUUID } from "crypto";
import * as mongodb from "./modules/storage/mongodb.adapter";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  getContactByPhone(phone: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  getMessages(contactId?: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, message: Partial<Message>): Promise<Message | undefined>;
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;
  getTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, template: Partial<Template>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<boolean>;
  getAutomations(): Promise<Automation[]>;
  getAutomation(id: string): Promise<Automation | undefined>;
  createAutomation(automation: InsertAutomation): Promise<Automation>;
  updateAutomation(id: string, automation: Partial<Automation>): Promise<Automation | undefined>;
  deleteAutomation(id: string): Promise<boolean>;
  getTeamMembers(): Promise<TeamMember[]>;
  getTeamMember(id: string): Promise<TeamMember | undefined>;
  createTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  updateTeamMember(id: string, member: Partial<TeamMember>): Promise<TeamMember | undefined>;
  deleteTeamMember(id: string): Promise<boolean>;
  getWhatsappSettings(): Promise<WhatsappSettings | null>;
  saveWhatsappSettings(settings: Omit<WhatsappSettings, "id" | "createdAt" | "updatedAt">): Promise<WhatsappSettings>;
  getBilling(): Promise<Billing>;
  updateBilling(billing: Partial<Billing>): Promise<Billing>;
  addTransaction(transaction: { type: "purchase" | "usage"; amount: number; description: string }): Promise<Billing>;
  getDashboardStats(): Promise<any>;
  getChats(): Promise<Chat[]>;
  getChat(id: string): Promise<Chat | undefined>;
  getChatByContactId(contactId: string): Promise<Chat | undefined>;
  updateChat(id: string, chat: Partial<Chat>): Promise<Chat | undefined>;
  updateChatInboundTime(contactId: string): Promise<void>;
  markMessagesAsRead(contactId: string): Promise<void>;
  markMessagesAsUnread(contactId: string): Promise<void>;
  incrementUnreadCount(contactId: string): Promise<void>;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export class MongoStorage implements IStorage {
  
  async getUser(id: string): Promise<User | undefined> {
    const user = await mongodb.findOne<User>('users', { id });
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const user = await mongodb.findOne<User>('users', { username });
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = {
      ...insertUser,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await mongodb.insertOne('users', user);
    return user;
  }

  async getContacts(): Promise<Contact[]> {
    return mongodb.findMany<Contact>('contacts', {});
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const contact = await mongodb.findOne<Contact>('contacts', { id });
    return contact || undefined;
  }

  async getContactByPhone(phone: string): Promise<Contact | undefined> {
    const normalizedPhone = normalizePhone(phone);
    const contacts = await mongodb.findMany<Contact>('contacts', {});
    return contacts.find(c => normalizePhone(c.phone).endsWith(normalizedPhone.slice(-10)) || 
                              normalizedPhone.endsWith(normalizePhone(c.phone).slice(-10)));
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const now = new Date().toISOString();
    const newContact: Contact = {
      ...contact,
      id: randomUUID(),
      tags: contact.tags || [],
      createdAt: now,
      updatedAt: now,
    };
    await mongodb.insertOne('contacts', newContact);
    
    const chat: Chat = {
      id: `chat-${newContact.id}`,
      contactId: newContact.id,
      contact: newContact,
      unreadCount: 0,
      status: 'open',
      notes: [],
    };
    await mongodb.insertOne('chats', chat);
    
    return newContact;
  }

  async updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined> {
    const updated = await mongodb.updateOne<Contact>('contacts', { id }, {
      ...contact,
      updatedAt: new Date().toISOString(),
    });
    return updated || undefined;
  }

  async deleteContact(id: string): Promise<boolean> {
    await mongodb.deleteOne('messages', { contactId: id });
    await mongodb.deleteOne('chats', { contactId: id });
    return mongodb.deleteOne('contacts', { id });
  }

  async getMessages(contactId?: string): Promise<Message[]> {
    if (contactId) {
      return mongodb.findMany<Message>('messages', { contactId });
    }
    return mongodb.findMany<Message>('messages', {});
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const message = await mongodb.findOne<Message>('messages', { id });
    return message || undefined;
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const newMessage: Message = {
      ...message,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    await mongodb.insertOne('messages', newMessage);
    
    const chat = await this.getChatByContactId(message.contactId);
    if (chat) {
      const updateData: Partial<Chat> = {
        lastMessage: newMessage.content,
        lastMessageTime: newMessage.timestamp,
      };
      if (message.direction === 'inbound') {
        updateData.lastInboundMessageTime = newMessage.timestamp;
        updateData.lastInboundMessage = newMessage.content;
      }
      await mongodb.updateOne('chats', { id: chat.id }, updateData);
    }
    
    return newMessage;
  }

  async updateMessage(id: string, message: Partial<Message>): Promise<Message | undefined> {
    const updated = await mongodb.updateOne<Message>('messages', { id }, message);
    return updated || undefined;
  }

  async getCampaigns(): Promise<Campaign[]> {
    return mongodb.findMany<Campaign>('campaigns', {});
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const campaign = await mongodb.findOne<Campaign>('campaigns', { id });
    return campaign || undefined;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const now = new Date().toISOString();
    const newCampaign: Campaign = {
      ...campaign,
      id: randomUUID(),
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      repliedCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await mongodb.insertOne('campaigns', newCampaign);
    return newCampaign;
  }

  async updateCampaign(id: string, campaign: Partial<Campaign>): Promise<Campaign | undefined> {
    const updated = await mongodb.updateOne<Campaign>('campaigns', { id }, {
      ...campaign,
      updatedAt: new Date().toISOString(),
    });
    return updated || undefined;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return mongodb.deleteOne('campaigns', { id });
  }

  async getTemplates(): Promise<Template[]> {
    return mongodb.findMany<Template>('templates', {});
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const template = await mongodb.findOne<Template>('templates', { id });
    return template || undefined;
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const now = new Date().toISOString();
    const newTemplate: Template = {
      ...template,
      id: randomUUID(),
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    await mongodb.insertOne('templates', newTemplate);
    return newTemplate;
  }

  async updateTemplate(id: string, template: Partial<Template>): Promise<Template | undefined> {
    const updated = await mongodb.updateOne<Template>('templates', { id }, {
      ...template,
      updatedAt: new Date().toISOString(),
    });
    return updated || undefined;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return mongodb.deleteOne('templates', { id });
  }

  async getAutomations(): Promise<Automation[]> {
    return mongodb.findMany<Automation>('automations', {});
  }

  async getAutomation(id: string): Promise<Automation | undefined> {
    const automation = await mongodb.findOne<Automation>('automations', { id });
    return automation || undefined;
  }

  async createAutomation(automation: InsertAutomation): Promise<Automation> {
    const now = new Date().toISOString();
    const newAutomation: Automation = {
      ...automation,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await mongodb.insertOne('automations', newAutomation);
    return newAutomation;
  }

  async updateAutomation(id: string, automation: Partial<Automation>): Promise<Automation | undefined> {
    const updated = await mongodb.updateOne<Automation>('automations', { id }, {
      ...automation,
      updatedAt: new Date().toISOString(),
    });
    return updated || undefined;
  }

  async deleteAutomation(id: string): Promise<boolean> {
    return mongodb.deleteOne('automations', { id });
  }

  async getTeamMembers(): Promise<TeamMember[]> {
    return mongodb.findMany<TeamMember>('team_members', {});
  }

  async getTeamMember(id: string): Promise<TeamMember | undefined> {
    const member = await mongodb.findOne<TeamMember>('team_members', { id });
    return member || undefined;
  }

  async createTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const newMember: TeamMember = {
      ...member,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    await mongodb.insertOne('team_members', newMember);
    return newMember;
  }

  async updateTeamMember(id: string, member: Partial<TeamMember>): Promise<TeamMember | undefined> {
    const updated = await mongodb.updateOne<TeamMember>('team_members', { id }, member);
    return updated || undefined;
  }

  async deleteTeamMember(id: string): Promise<boolean> {
    return mongodb.deleteOne('team_members', { id });
  }

  async getWhatsappSettings(): Promise<WhatsappSettings | null> {
    const settings = await mongodb.findOne<WhatsappSettings>('whatsapp_settings', {});
    return settings;
  }

  async saveWhatsappSettings(settings: Omit<WhatsappSettings, "id" | "createdAt" | "updatedAt">): Promise<WhatsappSettings> {
    const now = new Date().toISOString();
    const existing = await this.getWhatsappSettings();
    
    if (existing) {
      const updated = await mongodb.updateOne<WhatsappSettings>('whatsapp_settings', { id: existing.id }, {
        ...settings,
        updatedAt: now,
      });
      return updated!;
    }
    
    const newSettings: WhatsappSettings = {
      ...settings,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    await mongodb.insertOne('whatsapp_settings', newSettings);
    return newSettings;
  }

  async getBilling(): Promise<Billing> {
    const billing = await mongodb.findOne<Billing>('billing', {});
    if (!billing) {
      const defaultBilling: Billing = {
        id: 'billing-1',
        credits: 1500,
        transactions: [],
      };
      await mongodb.insertOne('billing', defaultBilling);
      return defaultBilling;
    }
    return billing;
  }

  async updateBilling(billing: Partial<Billing>): Promise<Billing> {
    const current = await this.getBilling();
    const updated = await mongodb.updateOne<Billing>('billing', { id: current.id }, billing);
    return updated || current;
  }

  async addTransaction(transaction: { type: "purchase" | "usage"; amount: number; description: string }): Promise<Billing> {
    const billing = await this.getBilling();
    const newTransaction = {
      id: randomUUID(),
      ...transaction,
      createdAt: new Date().toISOString(),
    };
    billing.transactions.push(newTransaction);
    billing.credits += transaction.amount;
    await mongodb.updateOne('billing', { id: billing.id }, {
      credits: billing.credits,
      transactions: billing.transactions,
    });
    return billing;
  }

  async getDashboardStats(): Promise<any> {
    const messages = await this.getMessages();
    const campaigns = await this.getCampaigns();
    
    const outbound = messages.filter((m) => m.direction === "outbound");
    const delivered = outbound.filter((m) => m.status === "delivered" || m.status === "read");
    const read = outbound.filter((m) => m.status === "read");
    const inbound = messages.filter((m) => m.direction === "inbound");

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thisWeekMessages = messages.filter((m) => new Date(m.timestamp) > weekAgo);
    const lastWeekMessages = messages.filter((m) => {
      const msgDate = new Date(m.timestamp);
      return msgDate > new Date(weekAgo.getTime() - 7 * 24 * 60 * 60 * 1000) && msgDate <= weekAgo;
    });

    const thisWeekOutbound = thisWeekMessages.filter((m) => m.direction === "outbound").length;
    const lastWeekOutbound = lastWeekMessages.filter((m) => m.direction === "outbound").length || 1;

    const dailyActivity = [];
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const dayMessages = messages.filter((m) => {
        const msgDate = new Date(m.timestamp);
        return msgDate.toDateString() === date.toDateString();
      });
      dailyActivity.push({
        day: days[date.getDay() === 0 ? 6 : date.getDay() - 1],
        sent: dayMessages.filter((m) => m.direction === "outbound").length,
        delivered: dayMessages.filter((m) => m.direction === "outbound" && (m.status === "delivered" || m.status === "read")).length,
        read: dayMessages.filter((m) => m.direction === "outbound" && m.status === "read").length,
      });
    }

    const campaignPerformance = campaigns.slice(0, 5).map((c) => ({
      name: c.name,
      delivered: c.deliveredCount,
      read: c.readCount,
    }));

    return {
      totalMessages: outbound.length,
      delivered: delivered.length,
      readRate: outbound.length > 0 ? Math.round((read.length / outbound.length) * 100 * 10) / 10 : 0,
      replied: inbound.length,
      messagesChange: Math.round(((thisWeekOutbound - lastWeekOutbound) / lastWeekOutbound) * 100 * 10) / 10,
      deliveredChange: 2.1,
      readRateChange: 5.4,
      repliedChange: -1.2,
      dailyActivity,
      campaignPerformance,
    };
  }

  async getChats(): Promise<Chat[]> {
    const chats = await mongodb.findMany<Chat>('chats', {});
    const contacts = await this.getContacts();
    
    return chats.map(chat => {
      const contact = contacts.find(c => c.id === chat.contactId);
      return {
        ...chat,
        contact: contact || {
          id: chat.contactId,
          name: 'Unknown',
          phone: '',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }

  async getChat(id: string): Promise<Chat | undefined> {
    const chat = await mongodb.findOne<Chat>('chats', { id });
    if (!chat) return undefined;
    
    const contact = await this.getContact(chat.contactId);
    return {
      ...chat,
      contact: contact || {
        id: chat.contactId,
        name: 'Unknown',
        phone: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  async getChatByContactId(contactId: string): Promise<Chat | undefined> {
    const chat = await mongodb.findOne<Chat>('chats', { contactId });
    if (!chat) return undefined;
    
    const contact = await this.getContact(contactId);
    return {
      ...chat,
      contact: contact || {
        id: contactId,
        name: 'Unknown',
        phone: '',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  async updateChat(id: string, chat: Partial<Chat>): Promise<Chat | undefined> {
    const updated = await mongodb.updateOne<Chat>('chats', { id }, chat);
    return updated || undefined;
  }

  async updateChatInboundTime(contactId: string): Promise<void> {
    const now = new Date().toISOString();
    const chat = await this.getChatByContactId(contactId);
    
    if (chat) {
      await mongodb.updateOne('chats', { contactId }, {
        lastInboundMessageTime: now,
        unreadCount: (chat.unreadCount || 0) + 1,
      });
    } else {
      const contact = await this.getContact(contactId);
      if (contact) {
        const newChat: Chat = {
          id: `chat-${contactId}`,
          contactId,
          contact,
          lastInboundMessageTime: now,
          unreadCount: 1,
          status: 'open',
          notes: [],
        };
        await mongodb.insertOne('chats', newChat);
      }
    }
  }

  async markMessagesAsRead(contactId: string): Promise<void> {
    const messages = await mongodb.findMany<Message>('messages', { contactId, direction: 'inbound' });
    for (const msg of messages) {
      if (msg.status !== 'read') {
        await mongodb.updateOne('messages', { id: msg.id }, { status: 'read' });
      }
    }
    
    await mongodb.updateOne('chats', { contactId }, { unreadCount: 0 });
  }

  async markMessagesAsUnread(contactId: string): Promise<void> {
    await mongodb.updateOne('chats', { contactId }, { unreadCount: 1 });
  }

  async incrementUnreadCount(contactId: string): Promise<void> {
    const chat = await this.getChatByContactId(contactId);
    if (chat) {
      await mongodb.updateOne('chats', { contactId }, {
        unreadCount: (chat.unreadCount || 0) + 1,
      });
    }
  }
}

export const storage = new MongoStorage();
