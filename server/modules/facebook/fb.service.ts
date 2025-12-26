import { readCollection, writeCollection, findById, findByField } from '../storage';
import * as leadAutoReply from '../leadAutoReply/leadAutoReply.service';
import * as integrationService from '../integrations/integration.service';
import { autoEnrollContact } from '../automation/drips/drip.service';
import { Contact } from '../storage/mongodb.adapter';

// Facebook tokens - we can use either a Page Access Token directly
// or derive it from a User Access Token + Page ID
const FB_USER_OR_PAGE_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN || process.env.FB_ACCESS_TOKEN;
const FB_PAGE_ID = process.env.FB_PAGE_ID;

// Cache for the actual Page Access Token
let cachedPageAccessToken: string | null = null;
let cachedPageId: string | null = null;

// Function to get Facebook credentials from Connected Apps or environment
async function getFacebookCredentials(userId: string = 'system'): Promise<{ token: string; pageId: string } | null> {
  const integrationCreds = await integrationService.getDecryptedCredentials(userId, 'facebook');
  if (integrationCreds?.accessToken && integrationCreds?.pageId) {
    console.log('[FB] Using credentials from Connected Apps');
    return {
      token: integrationCreds.accessToken,
      pageId: integrationCreds.pageId
    };
  }
  
  if (FB_USER_OR_PAGE_TOKEN && FB_PAGE_ID) {
    return {
      token: FB_USER_OR_PAGE_TOKEN,
      pageId: FB_PAGE_ID
    };
  }
  
  return null;
}

// Function to get the actual Page Access Token
// If user provides a User Access Token, we fetch the Page Access Token from /me/accounts
async function getPageAccessToken(userId: string = 'system'): Promise<string> {
  const creds = await getFacebookCredentials(userId);
  
  if (!creds) {
    throw new Error('Facebook credentials not configured. Please connect Facebook in Settings > Connected Apps.');
  }
  
  if (cachedPageAccessToken && cachedPageId === creds.pageId) {
    return cachedPageAccessToken;
  }
  
  const { token, pageId } = creds;
  
  // First, check if this is already a Page Access Token by trying to get page info
  try {
    const meResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${token}`);
    const meData = await meResponse.json();
    
    // If this returns a page (has category field), it's a Page Access Token
    if (meData.category || meData.category_list) {
      console.log('[FB] Token is already a Page Access Token');
      cachedPageAccessToken = token;
      cachedPageId = pageId;
      return cachedPageAccessToken;
    }
    
    // If it's a user token, try to get the page token from /me/accounts
    console.log('[FB] Token is a User Access Token, fetching Page Access Token...');
    const accountsResponse = await fetch(`https://graph.facebook.com/v18.0/me/accounts?access_token=${token}`);
    const accountsData = await accountsResponse.json();
    
    if (accountsData.data && accountsData.data.length > 0) {
      // Find the matching page by ID, or use the first one
      const targetPage = pageId 
        ? accountsData.data.find((p: any) => p.id === pageId)
        : accountsData.data[0];
        
      if (targetPage && targetPage.access_token) {
        console.log(`[FB] Found Page Access Token for page: ${targetPage.name} (${targetPage.id})`);
        cachedPageAccessToken = targetPage.access_token;
        cachedPageId = pageId;
        return targetPage.access_token;
      }
    }
    
    // If we couldn't get a page token, use the original token
    console.log('[FB] Could not find Page Access Token, using original token');
    cachedPageAccessToken = token;
    cachedPageId = pageId;
    return cachedPageAccessToken;
  } catch (error) {
    console.error('[FB] Error determining token type:', error);
    cachedPageAccessToken = token;
    cachedPageId = pageId;
    return cachedPageAccessToken;
  }
}

export interface LeadForm {
  id: string;
  fbFormId: string;
  name: string;
  status: string;
  pageId: string;
  createdTime: string;
  syncedAt: string;
}

export interface Lead {
  id: string;
  fbLeadId: string;
  formId: string;
  formName: string;
  fieldData: Record<string, string>;
  createdTime: string;
  syncedAt: string;
  phone?: string;
  email?: string;
  name?: string;
  autoReplySent?: boolean;
  autoReplyMessage?: string;
  autoReplySentAt?: string;
}

const FORMS_COLLECTION = 'forms';
const LEADS_COLLECTION = 'leads';

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function syncLeadForms(userId: string = 'system'): Promise<LeadForm[]> {
  const creds = await getFacebookCredentials(userId);
  if (!creds) {
    throw new Error('Facebook credentials not configured. Please connect Facebook in Settings > Connected Apps.');
  }

  try {
    const pageToken = await getPageAccessToken(userId);
    const url = `https://graph.facebook.com/v18.0/${creds.pageId}/leadgen_forms?access_token=${pageToken}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook API error: ${error}`);
    }

    const data = await response.json();
    const forms: LeadForm[] = [];
    const now = new Date().toISOString();

    for (const fbForm of data.data || []) {
      const existingForm = await findByField<LeadForm>(FORMS_COLLECTION, 'fbFormId', fbForm.id);
      
      const form: LeadForm = {
        id: existingForm?.id || generateId('form'),
        fbFormId: fbForm.id,
        name: fbForm.name || 'Unnamed Form',
        status: fbForm.status || 'ACTIVE',
        pageId: creds.pageId,
        createdTime: fbForm.created_time || now,
        syncedAt: now,
      };

      forms.push(form);
    }

    await writeCollection(FORMS_COLLECTION, forms);
    return forms;
  } catch (error) {
    console.error('Error syncing lead forms:', error);
    throw error;
  }
}

export async function getAllForms(): Promise<LeadForm[]> {
  return readCollection<LeadForm>(FORMS_COLLECTION);
}

export async function getFormById(id: string): Promise<LeadForm | null> {
  return findById<LeadForm>(FORMS_COLLECTION, id);
}

export async function getFormByFbId(fbFormId: string): Promise<LeadForm | null> {
  return findByField<LeadForm>(FORMS_COLLECTION, 'fbFormId', fbFormId);
}

export async function syncLeadsForForm(formId: string): Promise<Lead[]> {
  if (!FB_USER_OR_PAGE_TOKEN) {
    throw new Error('Facebook credentials not configured. Please set FB_PAGE_ACCESS_TOKEN.');
  }

  console.log(`[FB Service] Looking for form with id: ${formId}`);
  
  let form = await findById<LeadForm>(FORMS_COLLECTION, formId);
  
  if (!form) {
    console.log(`[FB Service] Form not found by id, checking by fbFormId...`);
    form = await findByField<LeadForm>(FORMS_COLLECTION, 'fbFormId', formId);
    
    if (!form) {
      console.log(`[FB Service] Form not found by fbFormId either, checking all forms...`);
      const allForms = await readCollection<LeadForm>(FORMS_COLLECTION);
      console.log(`[FB Service] Total forms in database: ${allForms.length}`);
      if (allForms.length > 0) {
        allForms.forEach(f => console.log(`[FB Service] Form: id=${f.id}, fbFormId=${f.fbFormId}, name=${f.name}`));
      }
      
      const foundForm = allForms.find(f => f.id === formId || f.fbFormId === formId);
      if (!foundForm) {
        console.log(`[FB Service] Form still not found after checking all forms`);
        throw new Error('Form not found');
      }
      form = foundForm;
    }
  }
  
  console.log(`[FB Service] Found form: ${form.name} (fbFormId: ${form.fbFormId})`);
  
  if (!form.fbFormId) {
    throw new Error('Form is missing Facebook Form ID. Please re-sync forms from Facebook.');
  }

  try {
    const pageToken = await getPageAccessToken();
    const url = `https://graph.facebook.com/v18.0/${form.fbFormId}/leads?access_token=${pageToken}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Facebook API error: ${error}`);
    }

    const data = await response.json();
    const existingLeads = await readCollection<Lead>(LEADS_COLLECTION);
    const now = new Date().toISOString();
    const newLeads: Lead[] = [];

    for (const fbLead of data.data || []) {
      const existingLead = existingLeads.find(l => l.fbLeadId === fbLead.id);
      if (existingLead) continue;

      const fieldData: Record<string, string> = {};
      let phone = '';
      let email = '';
      let name = '';

      for (const field of fbLead.field_data || []) {
        fieldData[field.name] = field.values?.[0] || '';
        if (field.name.toLowerCase().includes('phone')) phone = field.values?.[0] || '';
        if (field.name.toLowerCase().includes('email')) email = field.values?.[0] || '';
        if (field.name.toLowerCase().includes('name')) name = field.values?.[0] || '';
      }

      const lead: Lead = {
        id: generateId('lead'),
        fbLeadId: fbLead.id,
        formId: form.id,
        formName: form.name,
        fieldData,
        createdTime: fbLead.created_time || now,
        syncedAt: now,
        phone,
        email,
        name,
      };

      newLeads.push(lead);
    }

    const allLeads = [...existingLeads, ...newLeads];
    await writeCollection(LEADS_COLLECTION, allLeads);
    
    for (const lead of newLeads) {
      if (lead.phone && !lead.autoReplySent) {
        console.log(`[FB Service] Triggering auto-reply for new lead: ${lead.id}`);
        const autoReplyLead: leadAutoReply.Lead = {
          id: lead.id,
          formId: lead.formId,
          formName: lead.formName,
          fullName: lead.name,
          email: lead.email,
          phoneNumber: lead.phone,
          fieldData: lead.fieldData,
          createdTime: lead.createdTime,
          autoReplySent: lead.autoReplySent,
        };
        leadAutoReply.processNewLead(autoReplyLead).then(async result => {
          if (result.success) {
            const currentLeads = await readCollection<Lead>(LEADS_COLLECTION);
            const idx = currentLeads.findIndex(l => l.id === lead.id);
            if (idx !== -1) {
              currentLeads[idx].autoReplySent = true;
              currentLeads[idx].autoReplyMessage = result.message;
              currentLeads[idx].autoReplySentAt = new Date().toISOString();
              await writeCollection(LEADS_COLLECTION, currentLeads);
              console.log(`[FB Service] Auto-reply status saved for lead ${lead.id}`);
            }
          }
        }).catch(err => {
          console.error(`[FB Service] Auto-reply failed for lead ${lead.id}:`, err);
        });

        triggerDripCampaignsForLead(lead).catch(err => {
          console.error(`[FB Service] Drip campaign trigger failed for lead ${lead.id}:`, err);
        });
      }
    }
    
    return newLeads;
  } catch (error) {
    console.error('Error syncing leads:', error);
    throw error;
  }
}

export async function getAllLeads(): Promise<Lead[]> {
  return readCollection<Lead>(LEADS_COLLECTION);
}

export async function getLeadsByFormId(formId: string): Promise<Lead[]> {
  const leads = await readCollection<Lead>(LEADS_COLLECTION);
  return leads.filter(lead => lead.formId === formId);
}

export async function getLeadById(id: string): Promise<Lead | null> {
  return findById<Lead>(LEADS_COLLECTION, id);
}

async function triggerDripCampaignsForLead(lead: Lead): Promise<void> {
  if (!lead.phone) {
    console.log(`[FB Service] Lead ${lead.id} has no phone number, skipping drip campaigns`);
    return;
  }

  try {
    let contact = await Contact.findOne({ phone: lead.phone });
    
    if (!contact) {
      contact = await Contact.create({
        id: `contact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: lead.name || 'Facebook Lead',
        phone: lead.phone,
        email: lead.email || '',
        source: 'facebook_lead',
        tags: ['facebook-lead', lead.formName || 'unknown-form'],
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        metadata: {
          fbLeadId: lead.fbLeadId,
          formId: lead.formId,
          formName: lead.formName,
          fieldData: lead.fieldData
        }
      });
      console.log(`[FB Service] Created new contact for Facebook lead: ${contact.phone}`);
    }

    const result = await autoEnrollContact(
      'system',
      contact.id,
      contact.phone,
      'facebook_new_lead',
      {
        contactName: contact.name,
        source: 'facebook_lead',
        formName: lead.formName,
        leadId: lead.id
      }
    );

    if (result.enrolled.length > 0) {
      console.log(`[FB Service] Enrolled lead ${lead.id} in drip campaigns: ${result.enrolled.join(', ')}`);
    }
    if (result.skipped.length > 0) {
      console.log(`[FB Service] Skipped campaigns for lead ${lead.id}: ${result.skipped.join(', ')}`);
    }
  } catch (error) {
    console.error(`[FB Service] Error triggering drip campaigns for lead ${lead.id}:`, error);
    throw error;
  }
}
