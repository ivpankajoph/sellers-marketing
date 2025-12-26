import { Campaign, ICampaign, ICampaignContact } from './campaign.model';
import * as templateService from '../leadAutoReply/templateMessages.service';
import * as aiService from '../ai/ai.service';
import * as agentService from '../aiAgents/agent.service';
import { Contact } from '../storage/mongodb.adapter';

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (phone.trim().startsWith('+')) {
    return cleaned;
  }
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
    return cleaned;
  }
  const commonCountryCodes = ['1', '44', '91', '92', '93', '94', '971', '966', '965', '974', '20', '27', '61', '64', '81', '86', '62'];
  for (const code of commonCountryCodes) {
    if (cleaned.startsWith(code) && cleaned.length >= 10) {
      return cleaned;
    }
  }
  if (cleaned.startsWith('0')) {
    cleaned = '91' + cleaned.substring(1);
  }
  return cleaned;
}

export async function getAllContacts(userId: string): Promise<any[]> {
  const contacts = await Contact.find({}).lean();
  return contacts.map(c => ({
    ...c,
    id: c._id.toString(),
  }));
}

export async function getAvailableContacts(userId: string): Promise<any[]> {
  const allContacts = await Contact.find({}).lean();
  
  const activeCampaigns = await Campaign.find({ 
    userId, 
    status: { $in: ['draft', 'scheduled', 'sending', 'completed'] }
  }).lean();
  
  const usedPhones = new Set<string>();
  for (const campaign of activeCampaigns) {
    for (const contact of campaign.contacts) {
      usedPhones.add(contact.phone.replace(/\D/g, ''));
    }
  }
  
  return allContacts
    .filter(c => {
      const normalizedPhone = c.phone.replace(/\D/g, '');
      return !usedPhones.has(normalizedPhone);
    })
    .map(c => ({
      ...c,
      id: c._id.toString(),
    }));
}

export async function createCampaign(userId: string, data: {
  name: string;
  description?: string;
  messageType: 'template' | 'custom' | 'ai_agent';
  templateName?: string;
  customMessage?: string;
  agentId?: string;
  contactIds: string[];
  scheduledAt?: Date;
}): Promise<ICampaign> {
  const contacts = await Contact.find({ _id: { $in: data.contactIds } }).lean();
  
  const campaignContacts: ICampaignContact[] = contacts.map(c => ({
    contactId: c._id.toString(),
    phone: c.phone,
    name: c.name,
    status: 'pending' as const,
    replied: false,
    interestStatus: 'pending' as const
  }));

  const campaign = await Campaign.create({
    userId,
    name: data.name,
    description: data.description,
    messageType: data.messageType,
    templateName: data.templateName,
    customMessage: data.customMessage,
    agentId: data.agentId,
    contacts: campaignContacts,
    status: data.scheduledAt ? 'scheduled' : 'draft',
    scheduledAt: data.scheduledAt,
    metrics: {
      totalContacts: campaignContacts.length,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
      interested: 0,
      notInterested: 0,
      neutral: 0
    }
  });

  console.log(`[Campaign] Created campaign "${data.name}" with ${campaignContacts.length} contacts`);
  return campaign;
}

export async function getCampaigns(userId: string, filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ campaigns: ICampaign[]; total: number }> {
  const query: any = { userId };
  if (filters?.status) {
    query.status = filters.status;
  }

  const total = await Campaign.countDocuments(query);
  let campaignsQuery = Campaign.find(query).sort({ createdAt: -1 });
  
  if (filters?.offset) {
    campaignsQuery = campaignsQuery.skip(filters.offset);
  }
  if (filters?.limit) {
    campaignsQuery = campaignsQuery.limit(filters.limit);
  }

  const campaigns = await campaignsQuery.lean();
  return { campaigns: campaigns as ICampaign[], total };
}

export async function getCampaignById(userId: string, campaignId: string): Promise<ICampaign | null> {
  const campaign = await Campaign.findOne({ _id: campaignId, userId }).lean();
  return campaign as ICampaign | null;
}

export async function executeCampaign(userId: string, campaignId: string): Promise<ICampaign> {
  const campaign = await Campaign.findOne({ _id: campaignId, userId });
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    throw new Error('Campaign is not in a sendable state');
  }

  campaign.status = 'sending';
  campaign.startedAt = new Date();
  await campaign.save();

  console.log(`[Campaign] Starting execution of "${campaign.name}" to ${campaign.contacts.length} contacts`);

  const credentials = getWhatsAppCredentials();
  if (!credentials) {
    campaign.status = 'cancelled';
    await campaign.save();
    throw new Error('WhatsApp credentials not configured');
  }

  let sent = 0;
  let failed = 0;

  for (let i = 0; i < campaign.contacts.length; i++) {
    const contact = campaign.contacts[i];
    
    try {
      let result: { success: boolean; messageId?: string; error?: string };

      switch (campaign.messageType) {
        case 'template':
          result = await sendTemplateMessage(contact.phone, campaign.templateName || 'hello_world', contact.name);
          break;
        case 'custom':
          result = await sendCustomMessage(contact.phone, campaign.customMessage || '', credentials);
          break;
        case 'ai_agent':
          result = await sendAIAgentMessage(contact.phone, campaign.agentId || '', contact.name, credentials);
          break;
        default:
          result = { success: false, error: 'Invalid message type' };
      }

      if (result.success) {
        campaign.contacts[i].status = 'sent';
        campaign.contacts[i].messageId = result.messageId;
        campaign.contacts[i].sentAt = new Date();
        sent++;
      } else {
        campaign.contacts[i].status = 'failed';
        campaign.contacts[i].error = result.error;
        failed++;
      }
    } catch (error: any) {
      campaign.contacts[i].status = 'failed';
      campaign.contacts[i].error = error.message;
      failed++;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  campaign.metrics.sent = sent;
  campaign.metrics.failed = failed;
  campaign.status = 'completed';
  campaign.completedAt = new Date();
  await campaign.save();

  console.log(`[Campaign] Completed "${campaign.name}": ${sent} sent, ${failed} failed`);
  return campaign;
}

export async function updateCampaignContactStatus(
  messageId: string, 
  status: 'delivered' | 'read',
  timestamp?: Date
): Promise<boolean> {
  const updateField = status === 'delivered' ? 'deliveredAt' : 'readAt';
  const metricsField = status === 'delivered' ? 'metrics.delivered' : 'metrics.read';

  const result = await Campaign.updateOne(
    { 'contacts.messageId': messageId, [`contacts.${updateField}`]: { $exists: false } },
    { 
      $set: { 
        [`contacts.$.status`]: status,
        [`contacts.$.${updateField}`]: timestamp || new Date()
      },
      $inc: { [metricsField]: 1 }
    }
  );

  return result.modifiedCount > 0;
}

export async function markCampaignContactAsReplied(
  phone: string, 
  replyText?: string,
  interestStatus?: 'interested' | 'not_interested' | 'neutral'
): Promise<boolean> {
  const normalizedPhone = phone.replace(/\D/g, '');
  
  const campaigns = await Campaign.find({ 
    status: 'completed',
    'contacts.replied': false
  });

  let updated = false;
  for (const campaign of campaigns) {
    for (let i = 0; i < campaign.contacts.length; i++) {
      const contactPhone = campaign.contacts[i].phone.replace(/\D/g, '');
      const last10 = normalizedPhone.slice(-10);
      const contactLast10 = contactPhone.slice(-10);
      
      if (last10 === contactLast10 && !campaign.contacts[i].replied) {
        campaign.contacts[i].replied = true;
        campaign.contacts[i].repliedAt = new Date();
        campaign.contacts[i].replyText = replyText;
        
        if (interestStatus) {
          const oldInterest = campaign.contacts[i].interestStatus;
          campaign.contacts[i].interestStatus = interestStatus;
          
          if (oldInterest !== 'interested' && interestStatus === 'interested') {
            campaign.metrics.interested++;
          }
          if (oldInterest !== 'not_interested' && interestStatus === 'not_interested') {
            campaign.metrics.notInterested++;
          }
          if (oldInterest !== 'neutral' && interestStatus === 'neutral') {
            campaign.metrics.neutral++;
          }
        }
        
        campaign.metrics.replied++;
        await campaign.save();
        updated = true;
        console.log(`[Campaign] Marked contact ${phone} as replied in campaign "${campaign.name}"`);
      }
    }
  }

  return updated;
}

export async function getInterestedContacts(userId: string, campaignId: string): Promise<ICampaignContact[]> {
  const campaign = await Campaign.findOne({ _id: campaignId, userId }).lean();
  if (!campaign) return [];
  
  return campaign.contacts.filter((c: ICampaignContact) => c.interestStatus === 'interested');
}

export async function getNotInterestedContacts(userId: string, campaignId: string): Promise<ICampaignContact[]> {
  const campaign = await Campaign.findOne({ _id: campaignId, userId }).lean();
  if (!campaign) return [];
  
  return campaign.contacts.filter((c: ICampaignContact) => c.interestStatus === 'not_interested');
}

export async function sendToInterestList(
  userId: string,
  campaignId: string,
  interestType: 'interested' | 'not_interested',
  messageConfig: {
    messageType: 'template' | 'ai_agent';
    templateName?: string;
    agentId?: string;
    campaignName?: string;
  }
): Promise<ICampaign> {
  const sourceCampaign = await Campaign.findOne({ _id: campaignId, userId }).lean();
  if (!sourceCampaign) {
    throw new Error('Source campaign not found');
  }

  const targetContacts = sourceCampaign.contacts.filter((c: ICampaignContact) => c.interestStatus === interestType);
  if (targetContacts.length === 0) {
    throw new Error(`No ${interestType.replace('_', ' ')} contacts found in this campaign`);
  }

  const newCampaign = await Campaign.create({
    userId,
    name: messageConfig.campaignName || `Follow-up: ${interestType.replace('_', ' ')} from "${sourceCampaign.name}"`,
    description: `Re-targeting ${interestType.replace('_', ' ')} contacts from campaign "${sourceCampaign.name}"`,
    messageType: messageConfig.messageType,
    templateName: messageConfig.templateName,
    agentId: messageConfig.agentId,
    contacts: targetContacts.map((c: ICampaignContact) => ({
      contactId: c.contactId,
      phone: c.phone,
      name: c.name,
      status: 'pending' as const,
      replied: false,
      interestStatus: 'pending' as const
    })),
    status: 'draft',
    metrics: {
      totalContacts: targetContacts.length,
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      failed: 0,
      interested: 0,
      notInterested: 0,
      neutral: 0
    }
  });

  return executeCampaign(userId, newCampaign._id.toString());
}

export async function deleteCampaign(userId: string, campaignId: string): Promise<boolean> {
  const result = await Campaign.deleteOne({ _id: campaignId, userId });
  return result.deletedCount > 0;
}

function getWhatsAppCredentials(): { token: string; phoneNumberId: string } | null {
  const token = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  
  if (!token || !phoneNumberId) {
    return null;
  }
  
  return { token, phoneNumberId };
}

async function sendTemplateMessage(phone: string, templateName: string, contactName?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const components: any[] = [];
  
  if (templateName.includes('awards') || templateName.includes('marketing')) {
    components.push({
      type: 'body',
      parameters: [{ type: 'text', text: contactName || 'Valued Customer', parameter_name: 'name' }]
    });
  }
  
  const result = await templateService.sendTemplateMessage(formatPhoneNumber(phone), {
    name: templateName,
    languageCode: 'en',
    components: components.length > 0 ? components : undefined,
  });
  return result;
}

async function sendCustomMessage(
  phone: string, 
  message: string,
  credentials: { token: string; phoneNumberId: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const formattedPhone = formatPhoneNumber(phone);

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: { body: message }
        }),
      }
    );

    const data = await response.json();
    
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    } else {
      const errorMsg = data.error?.message || 'Failed to send message';
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function sendAIAgentMessage(
  phone: string, 
  agentId: string, 
  contactName: string,
  credentials: { token: string; phoneNumberId: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const agent = await agentService.getAgentById(agentId);
  if (!agent) {
    return { success: false, error: 'Agent not found' };
  }

  const prompt = `Contact name: ${contactName}. Generate a friendly personalized outreach message. Keep it under 160 characters.`;
  const aiMessage = await aiService.generateAgentResponse(prompt, agent, []);
  
  if (!aiMessage) {
    return { success: false, error: 'Failed to generate AI message' };
  }

  const customResult = await sendCustomMessage(phone, aiMessage, credentials);
  
  if (!customResult.success && (customResult.error?.includes('24') || customResult.error?.includes('window'))) {
    return await templateService.sendHelloWorldTemplate(formatPhoneNumber(phone));
  }
  
  return customResult;
}
