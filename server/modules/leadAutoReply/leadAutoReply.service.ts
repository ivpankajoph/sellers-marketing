import * as openaiService from '../openai/openai.service';
import * as mappingService from '../mapping/mapping.service';
import * as agentService from '../aiAgents/agent.service';
import * as mongodb from '../storage/mongodb.adapter';
import * as templateService from './templateMessages.service';

export interface Lead {
  id: string;
  formId: string;
  formName?: string;
  fullName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  phone?: string;
  fieldData: Record<string, string>;
  createdTime: string;
  adName?: string;
  campaignName?: string;
  autoReplySent?: boolean;
  autoReplyMessage?: string;
  autoReplySentAt?: string;
}

function getLeadPhone(lead: Lead): string | undefined {
  return lead.phoneNumber || lead.phone;
}

function getLeadName(lead: Lead): string | undefined {
  return lead.fullName || lead.name;
}

function getWhatsAppCredentials(): { token: string; phoneNumberId: string } | null {
  const token = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  
  if (!token || !phoneNumberId) {
    return null;
  }
  
  return { token, phoneNumberId };
}

async function sendWhatsAppMessage(to: string, message: string): Promise<{ success: boolean; error?: string; messageId?: string }> {
  const credentials = getWhatsAppCredentials();
  
  if (!credentials) {
    console.error('[AutoReply] WhatsApp credentials not configured (WHATSAPP_TOKEN or PHONE_NUMBER_ID missing)');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

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
          to: to,
          type: 'text',
          text: { body: message }
        }),
      }
    );

    const data = await response.json();
    
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    } else {
      return { success: false, error: data.error?.message || 'Failed to send message' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function processNewLead(lead: Lead): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log(`[AutoReply] Processing lead: ${lead.id} from form: ${lead.formId}`);

    const phoneNumber = getLeadPhone(lead);
    if (!phoneNumber) {
      console.log(`[AutoReply] No phone number for lead ${lead.id}, skipping`);
      return { success: false, error: 'No phone number available' };
    }

    if (lead.autoReplySent) {
      console.log(`[AutoReply] Already sent reply to lead ${lead.id}, skipping`);
      return { success: false, error: 'Auto-reply already sent' };
    }

    const mapping = await mappingService.getMappingByFormId(lead.formId);
    if (!mapping || !mapping.isActive) {
      console.log(`[AutoReply] No active mapping for form ${lead.formId}`);
      return { success: false, error: 'No active agent mapping for this form' };
    }

    const agent = await agentService.getAgentById(mapping.agentId);
    if (!agent || !agent.isActive) {
      console.log(`[AutoReply] Agent ${mapping.agentId} not found or inactive`);
      return { success: false, error: 'Agent not found or inactive' };
    }

    const leadContext = buildLeadContext(lead);
    const welcomePrompt = `A new lead just submitted a form. Here's their information:\n${leadContext}\n\nGenerate a friendly, professional welcome message to send them via WhatsApp. Keep it concise (under 200 characters). Don't include any placeholders - write the actual message ready to send.`;

    const formattedPhone = formatPhoneNumber(phoneNumber);
    console.log(`[AutoReply] Sending WhatsApp template to: ${formattedPhone}`);
    
    const sendResult = await templateService.sendHelloWorldTemplate(formattedPhone);

    if (sendResult.success) {
      const templateMessage = 'Welcome message sent via WhatsApp template';
      lead.autoReplySent = true;
      lead.autoReplyMessage = templateMessage;
      lead.autoReplySentAt = new Date().toISOString();
      await updateLead(lead);

      console.log(`[AutoReply] Successfully sent template to ${formattedPhone}`);
      return { success: true, message: templateMessage };
    } else {
      console.error(`[AutoReply] Failed to send template: ${sendResult.error}`);
      return { success: false, error: sendResult.error };
    }

  } catch (error) {
    console.error('[AutoReply] Error processing lead:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function processAllPendingLeads(): Promise<{ processed: number; successful: number; failed: number }> {
  const leads = await mongodb.readCollection<Lead>('leads');
  const pendingLeads = leads.filter((l: Lead) => !l.autoReplySent && getLeadPhone(l));

  let successful = 0;
  let failed = 0;

  for (const lead of pendingLeads) {
    const result = await processNewLead(lead);
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { processed: pendingLeads.length, successful, failed };
}

export async function sendManualReply(leadId: string, message: string): Promise<{ success: boolean; error?: string }> {
  const lead = await mongodb.findOne<Lead>('leads', { id: leadId });

  if (!lead) {
    return { success: false, error: 'Lead not found' };
  }

  const phoneNumber = getLeadPhone(lead);
  if (!phoneNumber) {
    return { success: false, error: 'No phone number for this lead' };
  }

  const formattedPhone = formatPhoneNumber(phoneNumber);
  const result = await templateService.sendHelloWorldTemplate(formattedPhone);

  if (result.success) {
    await mongodb.updateOne('leads', { id: leadId }, {
      autoReplySent: true,
      autoReplyMessage: 'Welcome message sent via WhatsApp template',
      autoReplySentAt: new Date().toISOString(),
    });
  }

  return result;
}

function buildLeadContext(lead: Lead): string {
  const lines: string[] = [];
  
  const name = getLeadName(lead);
  if (name) lines.push(`Name: ${name}`);
  if (lead.email) lines.push(`Email: ${lead.email}`);
  if (lead.formName) lines.push(`Form: ${lead.formName}`);
  if (lead.adName) lines.push(`Ad: ${lead.adName}`);
  if (lead.campaignName) lines.push(`Campaign: ${lead.campaignName}`);

  if (lead.fieldData) {
    Object.entries(lead.fieldData).forEach(([key, value]) => {
      if (!['full_name', 'email', 'phone_number'].includes(key.toLowerCase())) {
        lines.push(`${key}: ${value}`);
      }
    });
  }

  return lines.join('\n');
}

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  
  if (phone.trim().startsWith('+')) {
    return cleaned;
  }
  
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
    return cleaned;
  }
  
  const commonCountryCodes = ['1', '44', '91', '92', '93', '94', '971', '966', '965', '974', '20', '27', '61', '64', '81', '86'];
  for (const code of commonCountryCodes) {
    if (cleaned.startsWith(code) && cleaned.length >= 10) {
      return cleaned;
    }
  }
  
  if (cleaned.startsWith('0')) {
    cleaned = '92' + cleaned.substring(1);
  }

  return cleaned;
}

async function updateLead(lead: Lead): Promise<void> {
  await mongodb.updateOne('leads', { id: lead.id }, lead);
}
