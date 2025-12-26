import * as mongodb from '../storage/mongodb.adapter';
import * as templateService from '../leadAutoReply/templateMessages.service';
import * as openaiService from '../openai/openai.service';
import * as aiService from '../ai/ai.service';
import * as agentService from '../aiAgents/agent.service';

export interface BroadcastList {
  id: string;
  name: string;
  contacts: BroadcastContact[];
  createdAt: string;
  updatedAt: string;
}

export interface BroadcastContact {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
}

export interface ScheduledMessage {
  id: string;
  name: string;
  messageType: 'template' | 'custom' | 'ai_agent';
  templateName?: string;
  customMessage?: string;
  agentId?: string;
  contactIds?: string[];
  listId?: string;
  scheduledAt: string;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface ScheduledBroadcast {
  id: string;
  contacts: BroadcastContact[];
  messageType: 'template' | 'custom' | 'ai_agent';
  templateName?: string;
  customMessage?: string;
  agentId?: string;
  campaignName: string;
  scheduledAt: string;
  status: 'scheduled' | 'sending' | 'sent' | 'failed' | 'cancelled';
  createdAt: string;
  sentCount?: number;
  failedCount?: number;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

function getWhatsAppCredentials(): { token: string; phoneNumberId: string } | null {
  const token = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;
  
  if (!token || !phoneNumberId) {
    return null;
  }
  
  return { token, phoneNumberId };
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

export async function getBroadcastLists(): Promise<BroadcastList[]> {
  return mongodb.readCollection<BroadcastList>('broadcast_lists');
}

export async function getBroadcastListById(id: string): Promise<BroadcastList | undefined> {
  const result = await mongodb.findOne<BroadcastList>('broadcast_lists', { id });
  return result || undefined;
}

export async function createBroadcastList(name: string, contacts: BroadcastContact[]): Promise<BroadcastList> {
  const newList: BroadcastList = {
    id: `list-${Date.now()}`,
    name,
    contacts,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await mongodb.insertOne('broadcast_lists', newList);
  return newList;
}

export async function updateBroadcastList(id: string, name: string, contacts: BroadcastContact[]): Promise<BroadcastList | null> {
  const existing = await getBroadcastListById(id);
  if (!existing) return null;
  
  const updated: BroadcastList = {
    ...existing,
    name,
    contacts,
    updatedAt: new Date().toISOString(),
  };
  await mongodb.updateOne('broadcast_lists', { id }, updated);
  return updated;
}

export async function deleteBroadcastList(id: string): Promise<boolean> {
  return mongodb.deleteOne('broadcast_lists', { id });
}

export async function getScheduledMessages(): Promise<ScheduledMessage[]> {
  return mongodb.readCollection<ScheduledMessage>('scheduled_messages');
}

export async function createScheduledMessage(data: Omit<ScheduledMessage, 'id' | 'createdAt' | 'sentCount' | 'failedCount'>): Promise<ScheduledMessage> {
  const newMessage: ScheduledMessage = {
    ...data,
    id: `schedule-${Date.now()}`,
    createdAt: new Date().toISOString(),
    sentCount: 0,
    failedCount: 0,
  };
  await mongodb.insertOne('scheduled_messages', newMessage);
  return newMessage;
}

export async function updateScheduledMessage(id: string, updates: Partial<ScheduledMessage>): Promise<ScheduledMessage | null> {
  const existing = await mongodb.findOne<ScheduledMessage>('scheduled_messages', { id });
  if (!existing) return null;
  
  const updated = { ...existing, ...updates };
  await mongodb.updateOne('scheduled_messages', { id }, updated);
  return updated;
}

export async function deleteScheduledMessage(id: string): Promise<boolean> {
  return mongodb.deleteOne('scheduled_messages', { id });
}

export async function sendTemplateMessage(phone: string, templateName: string, contactName?: string): Promise<SendMessageResult> {
  const components: templateService.TemplateComponent[] = [];
  
  if (templateName.includes('awards') || templateName.includes('marketing')) {
    components.push({
      type: 'body',
      parameters: [
        {
          type: 'text',
          text: contactName || 'Valued Customer',
          parameter_name: 'name',
        }
      ]
    });
  }
  
  const result = await templateService.sendTemplateMessage(formatPhoneNumber(phone), {
    name: templateName,
    languageCode: 'en',
    components: components.length > 0 ? components : undefined,
  });
  return result;
}

export async function sendCustomMessage(phone: string, message: string): Promise<SendMessageResult> {
  const credentials = getWhatsAppCredentials();
  
  if (!credentials) {
    console.error('[CustomMessage] WhatsApp credentials not configured');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  const formattedPhone = formatPhoneNumber(phone);
  console.log(`[CustomMessage] Sending to ${formattedPhone}: "${message.substring(0, 50)}..."`);

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
      console.log(`[CustomMessage] Successfully sent to ${formattedPhone}`);
      return { success: true, messageId: data.messages[0].id };
    } else {
      const errorMsg = data.error?.message || 'Failed to send message';
      const errorCode = data.error?.code;
      console.error(`[CustomMessage] Failed (code: ${errorCode}): ${errorMsg}`);
      
      if (errorCode === 131047 || errorMsg.includes('24 hour') || errorMsg.includes('Re-engagement')) {
        return { 
          success: false, 
          error: 'Cannot send custom message - outside 24-hour window. Customer must message you first, or use a template message.' 
        };
      }
      
      return { success: false, error: errorMsg };
    }
  } catch (error) {
    console.error('[CustomMessage] Error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function sendAIAgentMessage(phone: string, agentId: string, context?: string): Promise<SendMessageResult> {
  const agent = await agentService.getAgentById(agentId);
  if (!agent) {
    console.error(`[AIAgent] Agent not found: ${agentId}`);
    return { success: false, error: 'Agent not found' };
  }

  console.log(`[AIAgent] Generating message with agent "${agent.name}" (model: ${agent.model || 'default'}) for ${phone}`);
  
  const prompt = context || 'Generate a friendly welcome message for a new contact. Keep it under 160 characters.';
  const aiMessage = await aiService.generateAgentResponse(prompt, agent, []);
  
  if (!aiMessage) {
    console.error('[AIAgent] Failed to generate AI message');
    return { success: false, error: 'Failed to generate AI message. Check if API key is configured for the agent model.' };
  }

  console.log(`[AIAgent] AI generated: "${aiMessage.substring(0, 100)}..."`);

  const customResult = await sendCustomMessage(phone, aiMessage);
  
  if (!customResult.success && (customResult.error?.includes('24') || customResult.error?.includes('window'))) {
    console.log('[AIAgent] Custom message failed (outside 24-hour window), falling back to hello_world template');
    return await templateService.sendHelloWorldTemplate(formatPhoneNumber(phone));
  }
  
  return customResult;
}

export interface BroadcastLog {
  id: string;
  campaignName: string;
  contactName: string;
  contactPhone: string;
  messageType: 'template' | 'custom' | 'ai_agent';
  templateName?: string;
  message?: string;
  status: 'sent' | 'delivered' | 'failed' | 'pending';
  messageId?: string;
  error?: string;
  timestamp: string;
  replied?: boolean;
  repliedAt?: string;
}

export async function logBroadcastMessage(log: Omit<BroadcastLog, 'id'>): Promise<BroadcastLog> {
  const newLog: BroadcastLog = {
    ...log,
    id: `broadcast-log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  };
  try {
    const result = await mongodb.insertOne('broadcast_logs', newLog);
    console.log(`[BroadcastLog] Saved log for ${log.contactPhone}: ${log.status}`);
    return result || newLog;
  } catch (error) {
    console.error('[BroadcastLog] Failed to save log:', error);
    return newLog;
  }
}

export async function markBroadcastLogAsReplied(phone: string): Promise<number> {
  try {
    const normalizedPhone = phone.replace(/\D/g, '');
    console.log(`[BroadcastLog] Looking for broadcast logs to mark as replied for phone: ${normalizedPhone}`);
    
    const logs = await mongodb.readCollection<BroadcastLog>('broadcast_logs');
    console.log(`[BroadcastLog] Found ${logs.length} total broadcast logs`);
    
    let updatedCount = 0;
    const now = new Date().toISOString();
    
    for (const log of logs) {
      const logPhone = log.contactPhone.replace(/\D/g, '');
      const last10Digits = normalizedPhone.slice(-10);
      const logLast10Digits = logPhone.slice(-10);
      
      // Match if phones share the same last 10 digits (ignoring country code)
      const phoneMatches = last10Digits === logLast10Digits || 
                          logPhone.includes(normalizedPhone) || 
                          normalizedPhone.includes(logPhone);
      
      if (phoneMatches && !log.replied) {
        console.log(`[BroadcastLog] Phone match found! Log phone: ${logPhone}, Incoming: ${normalizedPhone}`);
        
        const updateResult = await mongodb.updateOne('broadcast_logs', { id: log.id }, { 
          replied: true, 
          repliedAt: now 
        });
        
        if (updateResult) {
          updatedCount++;
          console.log(`[BroadcastLog] Successfully marked as replied: ${log.id} (${log.contactPhone})`);
        } else {
          console.log(`[BroadcastLog] Failed to update log: ${log.id}`);
        }
      }
    }
    
    console.log(`[BroadcastLog] Total logs marked as replied: ${updatedCount}`);
    return updatedCount;
  } catch (error) {
    console.error('[BroadcastLog] Error marking as replied:', error);
    return 0;
  }
}

export async function getBroadcastLogs(filters?: { 
  campaignName?: string; 
  status?: string; 
  phone?: string;
  limit?: number;
  offset?: number;
}): Promise<BroadcastLog[]> {
  try {
    let logs = await mongodb.readCollection<BroadcastLog>('broadcast_logs');
    console.log(`[BroadcastLogs] Fetched ${logs.length} logs from MongoDB`);
    
    if (filters) {
      if (filters.campaignName) {
        logs = logs.filter(l => l.campaignName.toLowerCase().includes(filters.campaignName!.toLowerCase()));
      }
      if (filters.status) {
        logs = logs.filter(l => l.status === filters.status);
      }
      if (filters.phone) {
        logs = logs.filter(l => l.contactPhone.includes(filters.phone!));
      }
    }
    
    logs = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const offset = filters?.offset || 0;
    const limit = filters?.limit || 100;
    return logs.slice(offset, offset + limit);
  } catch (error) {
    console.error('[BroadcastLogs] Failed to fetch logs:', error);
    return [];
  }
}

export async function sendBroadcast(
  contacts: BroadcastContact[],
  messageType: 'template' | 'custom' | 'ai_agent',
  options: {
    templateName?: string;
    customMessage?: string;
    agentId?: string;
    campaignName?: string;
    isScheduled?: boolean;
    scheduledTime?: string;
  }
): Promise<{ total: number; successful: number; failed: number; results: Array<{ phone: string; success: boolean; error?: string }>; credentialError?: string; scheduled?: boolean; scheduledAt?: string }> {
  const campaignName = options.campaignName || `Broadcast ${new Date().toISOString()}`;

  // Handle scheduled broadcasts
  if (options.isScheduled && options.scheduledTime) {
    const scheduledDate = new Date(options.scheduledTime);
    console.log(`[Broadcast] Scheduling broadcast for ${scheduledDate.toISOString()}`);
    console.log(`[Broadcast] Contacts: ${contacts.length}, MessageType: ${messageType}, CampaignName: ${campaignName}`);
    
    // Store the scheduled broadcast
    const scheduleData: ScheduledBroadcast = {
      id: `scheduled-${Date.now()}`,
      contacts,
      messageType,
      templateName: options.templateName,
      customMessage: options.customMessage,
      agentId: options.agentId,
      campaignName,
      scheduledAt: scheduledDate.toISOString(),
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };
    
    console.log(`[Broadcast] Saving scheduled broadcast:`, JSON.stringify(scheduleData, null, 2));
    await mongodb.insertOne('scheduled_broadcasts', scheduleData);
    console.log(`[Broadcast] Scheduled broadcast saved successfully with ID: ${scheduleData.id}`);
    
    return {
      total: contacts.length,
      successful: 0,
      failed: 0,
      results: [],
      scheduled: true,
      scheduledAt: scheduledDate.toISOString(),
    };
  }

  const results: Array<{ phone: string; success: boolean; error?: string }> = [];
  let successful = 0;
  let failed = 0;

  console.log(`[Broadcast] Starting broadcast to ${contacts.length} contacts`);
  console.log(`[Broadcast] Campaign: ${campaignName}, Type: ${messageType}`);
  
  // Check WhatsApp credentials before starting
  const credentials = getWhatsAppCredentials();
  if (!credentials) {
    console.error('[Broadcast] WhatsApp credentials not configured');
    return {
      total: contacts.length,
      successful: 0,
      failed: contacts.length,
      results: contacts.map(c => ({ phone: c.phone, success: false, error: 'WhatsApp credentials not configured' })),
      credentialError: 'WhatsApp API credentials (WHATSAPP_TOKEN and PHONE_NUMBER_ID) are not configured. Please add them in Settings > WhatsApp API.',
    };
  }

  for (const contact of contacts) {
    let result: SendMessageResult;
    let messageContent = '';

    switch (messageType) {
      case 'template':
        result = await sendTemplateMessage(contact.phone, options.templateName || 'hello_world', contact.name);
        messageContent = `[Template: ${options.templateName || 'hello_world'}]`;
        break;
      case 'custom':
        result = await sendCustomMessage(contact.phone, options.customMessage || '');
        messageContent = options.customMessage || '';
        break;
      case 'ai_agent':
        result = await sendAIAgentMessage(contact.phone, options.agentId || '', `Contact name: ${contact.name}`);
        messageContent = '[AI Generated Message]';
        break;
      default:
        result = { success: false, error: 'Invalid message type' };
        messageContent = '';
    }

    await logBroadcastMessage({
      campaignName,
      contactName: contact.name,
      contactPhone: contact.phone,
      messageType,
      templateName: options.templateName,
      message: messageContent,
      status: result.success ? 'sent' : 'failed',
      messageId: result.messageId,
      error: result.error,
      timestamp: new Date().toISOString(),
    });

    results.push({
      phone: contact.phone,
      success: result.success,
      error: result.error,
    });

    if (result.success) {
      successful++;
      console.log(`[Broadcast] Sent to ${contact.phone} (${contact.name})`);
    } else {
      failed++;
      console.log(`[Broadcast] Failed for ${contact.phone}: ${result.error}`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log(`[Broadcast] Complete: ${successful} successful, ${failed} failed`);

  return {
    total: contacts.length,
    successful,
    failed,
    results,
  };
}

export async function sendSingleMessage(
  phone: string,
  name: string,
  messageType: 'template' | 'custom' | 'ai_agent',
  options: {
    templateName?: string;
    customMessage?: string;
    agentId?: string;
  }
): Promise<SendMessageResult> {
  switch (messageType) {
    case 'template':
      return await sendTemplateMessage(phone, options.templateName || 'hello_world', name);
    case 'custom':
      return await sendCustomMessage(phone, options.customMessage || '');
    case 'ai_agent':
      return await sendAIAgentMessage(phone, options.agentId || '', `Contact name: ${name}`);
    default:
      return { success: false, error: 'Invalid message type' };
  }
}

export interface ParseResult {
  contacts: BroadcastContact[];
  totalRows: number;
  validContacts: number;
  errors: string[];
}

export function parseExcelContacts(data: unknown[]): ParseResult {
  const contacts: BroadcastContact[] = [];
  const errors: string[] = [];
  let rowNum = 1;
  
  for (const row of data) {
    rowNum++;
    if (typeof row !== 'object' || row === null) continue;
    
    const record = row as Record<string, unknown>;
    const keys = Object.keys(record);
    
    // Log column names for first row
    if (rowNum === 2) {
      console.log(`[ParseExcel] Detected columns: ${keys.join(', ')}`);
    }
    
    // Check all possible name column variations (case insensitive)
    let name = '';
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey === 'name' || lowerKey === 'full_name' || lowerKey === 'fullname' || 
          lowerKey === 'contact_name' || lowerKey === 'customer_name' || lowerKey === 'customer') {
        name = String(record[key] || '').trim();
        break;
      }
    }
    
    // Check all possible phone column variations (case insensitive)
    let phone = '';
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey === 'phone' || lowerKey === 'mobile' || lowerKey === 'phone_number' || 
          lowerKey === 'mobile_number' || lowerKey === 'phonenumber' || lowerKey === 'mobilenumber' ||
          lowerKey === 'contact' || lowerKey === 'whatsapp' || lowerKey === 'cell' || lowerKey === 'telephone') {
        phone = String(record[key] || '').trim();
        break;
      }
    }
    
    // Check for email column
    let email = '';
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim();
      if (lowerKey === 'email' || lowerKey === 'email_address' || lowerKey === 'emailaddress') {
        email = String(record[key] || '').trim();
        break;
      }
    }
    
    // Handle scientific notation from Excel (9.2E+11 format)
    if (phone) {
      // If it looks like scientific notation, convert it
      if (phone.includes('E') || phone.includes('e')) {
        try {
          const numValue = parseFloat(phone);
          if (!isNaN(numValue)) {
            phone = Math.round(numValue).toString();
          }
        } catch (e) {
          // Keep original if parsing fails
        }
      }
      
      // Remove any non-digit characters except leading +
      phone = phone.replace(/[^\d+]/g, '');
      
      // Clean up: remove + if not at start
      if (phone.includes('+') && !phone.startsWith('+')) {
        phone = phone.replace(/\+/g, '');
      }
    }
    
    // Validation with specific error messages
    if (!phone) {
      errors.push(`Row ${rowNum}: Missing phone number`);
      continue;
    }
    
    if (phone.length < 8) {
      errors.push(`Row ${rowNum}: Phone number too short (${phone})`);
      continue;
    }
    
    // If name is missing, use phone as name
    if (!name) {
      name = `Contact ${phone.slice(-4)}`;
    }
    
    contacts.push({
      name,
      phone,
      email: email || undefined,
    });
  }
  
  console.log(`[ParseExcel] Parsed ${contacts.length} valid contacts from ${data.length} rows`);
  if (errors.length > 0) {
    console.log(`[ParseExcel] Errors: ${errors.slice(0, 5).join('; ')}${errors.length > 5 ? '...' : ''}`);
  }
  
  return {
    contacts,
    totalRows: data.length,
    validContacts: contacts.length,
    errors: errors.slice(0, 10), // Return first 10 errors
  };
}

export function exportContactsToJSON(contacts: BroadcastContact[]): object[] {
  return contacts.map(c => ({
    name: c.name,
    phone: c.phone,
    email: c.email || '',
    tags: c.tags?.join(', ') || '',
  }));
}

export interface ImportedContact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  source: string;
  createdAt: string;
  updatedAt: string;
}

export async function saveImportedContacts(contacts: BroadcastContact[], source: string = 'import'): Promise<{ saved: number; duplicates: number; errors: string[] }> {
  const errors: string[] = [];
  let saved = 0;
  let duplicates = 0;
  const now = new Date().toISOString();

  try {
    const existingContacts = await mongodb.readCollection<ImportedContact>('imported_contacts');
    const existingPhones = new Set(existingContacts.map(c => c.phone.replace(/\D/g, '')));
    
    const uniqueContacts: ImportedContact[] = [];
    const seenPhones = new Set<string>();
    
    for (const contact of contacts) {
      const normalizedPhone = contact.phone.replace(/\D/g, '');
      
      if (existingPhones.has(normalizedPhone) || seenPhones.has(normalizedPhone)) {
        duplicates++;
        continue;
      }
      
      seenPhones.add(normalizedPhone);
      
      uniqueContacts.push({
        id: `contact-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        name: contact.name,
        phone: contact.phone,
        email: contact.email || '',
        tags: contact.tags || [],
        source,
        createdAt: now,
        updatedAt: now,
      });
    }
    
    if (uniqueContacts.length > 0) {
      const BATCH_SIZE = 100;
      for (let i = 0; i < uniqueContacts.length; i += BATCH_SIZE) {
        const batch = uniqueContacts.slice(i, i + BATCH_SIZE);
        await mongodb.insertMany('imported_contacts', batch);
        saved += batch.length;
      }
    }
    
    console.log(`[ImportContacts] Saved ${saved} new contacts, ${duplicates} duplicates skipped (batch mode)`);
  } catch (error) {
    console.error('[ImportContacts] Bulk import failed:', error);
    errors.push(`Bulk import failed: ${error}`);
  }

  return { saved, duplicates, errors };
}

export async function getImportedContacts(): Promise<ImportedContact[]> {
  try {
    const contacts = await mongodb.readCollection<ImportedContact>('imported_contacts');
    return contacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.error('[ImportContacts] Failed to get contacts:', error);
    return [];
  }
}

export async function deleteImportedContact(id: string): Promise<boolean> {
  try {
    await mongodb.deleteOne('imported_contacts', { id });
    return true;
  } catch (error) {
    console.error('[ImportContacts] Failed to delete contact:', error);
    return false;
  }
}

// Scheduled Broadcasts Functions
export async function getScheduledBroadcasts(): Promise<ScheduledBroadcast[]> {
  try {
    return await mongodb.readCollection<ScheduledBroadcast>('scheduled_broadcasts');
  } catch (error) {
    console.error('[ScheduledBroadcasts] Failed to get scheduled broadcasts:', error);
    return [];
  }
}

export async function processScheduledBroadcasts(): Promise<void> {
  const now = new Date();
  console.log(`[Scheduler] Checking for due broadcasts at ${now.toISOString()}`);
  
  try {
    const scheduled = await mongodb.readCollection<ScheduledBroadcast>('scheduled_broadcasts');
    const duebroadcasts = scheduled.filter(s => 
      s.status === 'scheduled' && new Date(s.scheduledAt) <= now
    );
    
    if (duebroadcasts.length === 0) {
      return;
    }
    
    console.log(`[Scheduler] Found ${duebroadcasts.length} due broadcasts`);
    
    for (const broadcast of duebroadcasts) {
      console.log(`[Scheduler] Processing broadcast: ${broadcast.id} - ${broadcast.campaignName}`);
      
      // Update status to sending
      await mongodb.updateOne('scheduled_broadcasts', { id: broadcast.id }, { 
        ...broadcast, 
        status: 'sending' 
      });
      
      let successful = 0;
      let failed = 0;
      
      const credentials = getWhatsAppCredentials();
      if (!credentials) {
        console.error(`[Scheduler] WhatsApp credentials not configured for broadcast ${broadcast.id}`);
        await mongodb.updateOne('scheduled_broadcasts', { id: broadcast.id }, {
          ...broadcast,
          status: 'failed',
          sentCount: 0,
          failedCount: broadcast.contacts.length,
        });
        continue;
      }
      
      for (const contact of broadcast.contacts) {
        let result: SendMessageResult;
        let messageContent = '';
        
        switch (broadcast.messageType) {
          case 'template':
            result = await sendTemplateMessage(contact.phone, broadcast.templateName || 'hello_world', contact.name);
            messageContent = `[Template: ${broadcast.templateName || 'hello_world'}]`;
            break;
          case 'custom':
            result = await sendCustomMessage(contact.phone, broadcast.customMessage || '');
            messageContent = broadcast.customMessage || '';
            break;
          case 'ai_agent':
            result = await sendAIAgentMessage(contact.phone, broadcast.agentId || '', `Contact name: ${contact.name}`);
            messageContent = '[AI Generated Message]';
            break;
          default:
            result = { success: false, error: 'Invalid message type' };
        }
        
        await logBroadcastMessage({
          campaignName: broadcast.campaignName,
          contactName: contact.name,
          contactPhone: contact.phone,
          messageType: broadcast.messageType,
          templateName: broadcast.templateName,
          message: messageContent,
          status: result.success ? 'sent' : 'failed',
          messageId: result.messageId,
          error: result.error,
          timestamp: new Date().toISOString(),
        });
        
        if (result.success) {
          successful++;
        } else {
          failed++;
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Update broadcast status
      await mongodb.updateOne('scheduled_broadcasts', { id: broadcast.id }, {
        ...broadcast,
        status: 'sent',
        sentCount: successful,
        failedCount: failed,
      });
      
      console.log(`[Scheduler] Broadcast ${broadcast.id} complete: ${successful} sent, ${failed} failed`);
    }
  } catch (error) {
    console.error('[Scheduler] Error processing scheduled broadcasts:', error);
  }
}

// Start the scheduler
let schedulerInterval: NodeJS.Timeout | null = null;

export function startScheduler(): void {
  if (schedulerInterval) {
    return;
  }
  console.log('[Scheduler] Starting broadcast scheduler (checking every 30 seconds)');
  schedulerInterval = setInterval(processScheduledBroadcasts, 30000);
  // Run immediately on start
  processScheduledBroadcasts();
}

export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log('[Scheduler] Broadcast scheduler stopped');
  }
}

export async function cancelScheduledBroadcast(id: string): Promise<boolean> {
  try {
    const broadcast = await mongodb.findOne<ScheduledBroadcast>('scheduled_broadcasts', { id });
    if (!broadcast) {
      console.error(`[ScheduledBroadcast] Broadcast not found: ${id}`);
      return false;
    }
    
    if (broadcast.status !== 'scheduled') {
      console.error(`[ScheduledBroadcast] Cannot cancel broadcast with status: ${broadcast.status}`);
      return false;
    }
    
    await mongodb.updateOne('scheduled_broadcasts', { id }, {
      ...broadcast,
      status: 'cancelled',
    });
    
    console.log(`[ScheduledBroadcast] Cancelled broadcast: ${id}`);
    return true;
  } catch (error) {
    console.error('[ScheduledBroadcast] Failed to cancel broadcast:', error);
    return false;
  }
}

export async function deleteScheduledBroadcast(id: string): Promise<boolean> {
  try {
    const broadcast = await mongodb.findOne<ScheduledBroadcast>('scheduled_broadcasts', { id });
    if (!broadcast) {
      console.error(`[ScheduledBroadcast] Broadcast not found for deletion: ${id}`);
      return false;
    }
    
    await mongodb.deleteOne('scheduled_broadcasts', { id });
    console.log(`[ScheduledBroadcast] Deleted broadcast: ${id}`);
    return true;
  } catch (error) {
    console.error('[ScheduledBroadcast] Failed to delete broadcast:', error);
    return false;
  }
}
