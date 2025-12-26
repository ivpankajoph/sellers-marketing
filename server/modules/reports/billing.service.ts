import { Message, ContactAgent } from '../storage/mongodb.adapter';
import * as mongodb from '../storage/mongodb.adapter';

export interface BillingFilter {
  period: 'day' | 'week' | 'month' | 'custom';
  startDate?: string;
  endDate?: string;
}

export interface AgentBilling {
  agentId: string;
  agentName: string;
  conversationCount: number;
  messageCount: number;
  cost: number;
}

export interface UserBillingSummary {
  userId: string;
  userName: string;
  period: {
    start: string;
    end: string;
  };
  metrics: {
    totalMessages: number;
    userMessages: number;
    aiMessages: number;
    totalConversations: number;
    totalCost: number;
    costPerMessage: number;
  };
  agentBreakdown: AgentBilling[];
  dailyBreakdown: {
    date: string;
    userMessages: number;
    aiMessages: number;
    totalMessages: number;
    cost: number;
  }[];
}

export interface ConversationBilling {
  contactId: string;
  contactName: string;
  contactPhone: string;
  userMessages: number;
  aiMessages: number;
  totalMessages: number;
  cost: number;
  agentName: string | null;
  lastMessageAt: string;
}

function getDateRange(filter: BillingFilter): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  if (filter.period === 'custom' && filter.startDate && filter.endDate) {
    start = new Date(filter.startDate);
    end = new Date(filter.endDate);
    end.setHours(23, 59, 59, 999);
  } else {
    switch (filter.period) {
      case 'day':
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case 'week':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'month':
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
    }
  }

  return { start, end };
}

export async function getBillingSummary(userId: string, filter: BillingFilter): Promise<UserBillingSummary> {
  const { start, end } = getDateRange(filter);
  const COST_PER_MESSAGE = 1;

  const messages = await Message.find({
    timestamp: {
      $gte: start.toISOString(),
      $lte: end.toISOString()
    }
  }).lean();

  const userMessages = messages.filter(m => m.direction === 'inbound');
  const aiMessages = messages.filter(m => m.direction === 'outbound' && m.agentId);

  const contactAgents = await ContactAgent.find({}).lean();
  const contactAgentMap = new Map<string, { agentId: string; agentName: string }>();
  for (const ca of contactAgents) {
    if (ca.contactId && ca.agentId) {
      contactAgentMap.set(ca.contactId, { agentId: ca.agentId, agentName: ca.agentName || 'Unknown Agent' });
    }
  }

  const agents = await mongodb.readCollection<any>('agents');
  const agentMap = new Map<string, string>();
  for (const agent of agents) {
    agentMap.set(agent.id, agent.name);
  }

  const agentStats: Record<string, { agentId: string; agentName: string; conversations: Set<string>; messages: number }> = {};

  for (const msg of aiMessages) {
    const agentId = msg.agentId || 'unknown';
    let agentName = agentMap.get(agentId) || 'Unknown Agent';

    if (!agentStats[agentId]) {
      agentStats[agentId] = {
        agentId,
        agentName,
        conversations: new Set(),
        messages: 0
      };
    }
    agentStats[agentId].conversations.add(msg.contactId);
    agentStats[agentId].messages++;
  }

  const agentBreakdown: AgentBilling[] = Object.values(agentStats).map(stat => ({
    agentId: stat.agentId,
    agentName: stat.agentName,
    conversationCount: stat.conversations.size,
    messageCount: stat.messages,
    cost: stat.messages * COST_PER_MESSAGE
  })).sort((a, b) => b.messageCount - a.messageCount);

  const dailyMap: Record<string, { userMessages: number; aiMessages: number }> = {};

  for (const msg of messages) {
    const date = new Date(msg.timestamp).toISOString().split('T')[0];
    if (!dailyMap[date]) {
      dailyMap[date] = { userMessages: 0, aiMessages: 0 };
    }
    if (msg.direction === 'inbound') {
      dailyMap[date].userMessages++;
    } else if (msg.direction === 'outbound' && msg.agentId) {
      dailyMap[date].aiMessages++;
    }
  }

  const dailyBreakdown = Object.entries(dailyMap)
    .map(([date, stats]) => ({
      date,
      userMessages: stats.userMessages,
      aiMessages: stats.aiMessages,
      totalMessages: stats.userMessages + stats.aiMessages,
      cost: (stats.userMessages + stats.aiMessages) * COST_PER_MESSAGE
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const uniqueContacts = new Set<string>();
  for (const msg of messages) {
    uniqueContacts.add(msg.contactId);
  }

  const totalBillableMessages = userMessages.length + aiMessages.length;

  return {
    userId,
    userName: 'User',
    period: {
      start: start.toISOString(),
      end: end.toISOString()
    },
    metrics: {
      totalMessages: totalBillableMessages,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      totalConversations: uniqueContacts.size,
      totalCost: totalBillableMessages * COST_PER_MESSAGE,
      costPerMessage: COST_PER_MESSAGE
    },
    agentBreakdown,
    dailyBreakdown
  };
}

export async function getConversationsBilling(
  userId: string,
  filter: BillingFilter,
  pagination: { limit: number; offset: number }
): Promise<{ conversations: ConversationBilling[]; total: number }> {
  const { start, end } = getDateRange(filter);
  const COST_PER_MESSAGE = 1;

  const messages = await Message.find({
    timestamp: {
      $gte: start.toISOString(),
      $lte: end.toISOString()
    }
  }).lean();

  const contacts = await mongodb.readCollection<any>('contacts');
  const contactMap = new Map<string, { name: string; phone: string }>();
  for (const contact of contacts) {
    contactMap.set(contact.id, { name: contact.name, phone: contact.phone });
  }

  const agents = await mongodb.readCollection<any>('agents');
  const agentMap = new Map<string, string>();
  for (const agent of agents) {
    agentMap.set(agent.id, agent.name);
  }

  const conversationStats: Record<string, {
    contactId: string;
    userMessages: number;
    aiMessages: number;
    agentId: string | null;
    lastMessageAt: string;
  }> = {};

  for (const msg of messages) {
    if (!conversationStats[msg.contactId]) {
      conversationStats[msg.contactId] = {
        contactId: msg.contactId,
        userMessages: 0,
        aiMessages: 0,
        agentId: null,
        lastMessageAt: msg.timestamp
      };
    }

    const stat = conversationStats[msg.contactId];
    if (msg.direction === 'inbound') {
      stat.userMessages++;
    } else if (msg.direction === 'outbound' && msg.agentId) {
      stat.aiMessages++;
      stat.agentId = msg.agentId;
    }

    if (new Date(msg.timestamp) > new Date(stat.lastMessageAt)) {
      stat.lastMessageAt = msg.timestamp;
    }
  }

  const allConversations: ConversationBilling[] = Object.values(conversationStats)
    .map(stat => {
      const contact = contactMap.get(stat.contactId) || { name: 'Unknown', phone: 'Unknown' };
      const totalMessages = stat.userMessages + stat.aiMessages;
      return {
        contactId: stat.contactId,
        contactName: contact.name,
        contactPhone: contact.phone,
        userMessages: stat.userMessages,
        aiMessages: stat.aiMessages,
        totalMessages,
        cost: totalMessages * COST_PER_MESSAGE,
        agentName: stat.agentId ? (agentMap.get(stat.agentId) || 'Unknown Agent') : null,
        lastMessageAt: stat.lastMessageAt
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const total = allConversations.length;
  const paginated = allConversations.slice(pagination.offset, pagination.offset + pagination.limit);

  return {
    conversations: paginated,
    total
  };
}

export async function getAllUsersBillingSummary(filter: BillingFilter): Promise<{
  users: Array<{
    userId: string;
    userName: string;
    totalMessages: number;
    userMessages: number;
    aiMessages: number;
    totalConversations: number;
    totalCost: number;
  }>;
  grandTotal: {
    totalMessages: number;
    userMessages: number;
    aiMessages: number;
    totalConversations: number;
    totalCost: number;
  };
}> {
  const { start, end } = getDateRange(filter);
  const COST_PER_MESSAGE = 1;

  const messages = await Message.find({
    timestamp: {
      $gte: start.toISOString(),
      $lte: end.toISOString()
    }
  }).lean();

  const userMessages = messages.filter(m => m.direction === 'inbound');
  const aiMessages = messages.filter(m => m.direction === 'outbound' && m.agentId);
  const totalBillable = userMessages.length + aiMessages.length;

  const uniqueContacts = new Set<string>();
  for (const msg of messages) {
    uniqueContacts.add(msg.contactId);
  }

  return {
    users: [{
      userId: 'all',
      userName: 'All Users',
      totalMessages: totalBillable,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      totalConversations: uniqueContacts.size,
      totalCost: totalBillable * COST_PER_MESSAGE
    }],
    grandTotal: {
      totalMessages: totalBillable,
      userMessages: userMessages.length,
      aiMessages: aiMessages.length,
      totalConversations: uniqueContacts.size,
      totalCost: totalBillable * COST_PER_MESSAGE
    }
  };
}

export const billingService = {
  getBillingSummary,
  getConversationsBilling,
  getAllUsersBillingSummary
};
