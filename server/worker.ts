import { Lead, SystemConfig, Trigger } from "./modules/storage/mongodb.adapter";
import axios, { AxiosError } from "axios";

const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN; // Store in .env

if (!FB_ACCESS_TOKEN) {
  throw new Error("FB_ACCESS_TOKEN is required but not defined in environment variables.");
}

// Facebook API response types
interface FbPagedResponse<T> {
  data: T[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
}

// Helper to fetch all pages recursively
export async function fetchAllData<T>(url: string, accumulatedData: T[] = []): Promise<T[]> {
  try {
    const response = await axios.get<FbPagedResponse<T>>(url);
    const { data, paging } = response.data;
    const newData = [...accumulatedData, ...data];

    if (paging?.next) {
      console.log('Fetching next page...');
      // return fetchAllData(paging.next, newData);
    }
    return newData;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error("Error fetching FB data:", message);
    return accumulatedData;
  }
}

// 1. Fetch Forms
export async function getForms(pageId: string): Promise<any[]> {
  const url = `https://graph.facebook.com/v18.0/${pageId}/leadgen_forms?access_token=${FB_ACCESS_TOKEN}&limit=50`;
  return await fetchAllData(url);
}

// 2. Fetch Leads for a specific Form
async function getLeadsForForm(formId: string): Promise<any[]> {
  const url = `https://graph.facebook.com/v18.0/${formId}/leads?access_token=${FB_ACCESS_TOKEN}&limit=50`;
  return await fetchAllData(url);
}

// Optional: Define a type for lead field data if needed
interface LeadField {
  name: string;
  values: string[];
}

interface FbLead {
  id: string;
  created_time: string;
  field_data?: LeadField[];
}

// 3. Send WhatsApp Template (placeholder implementation)
async function sendWhatsAppTemplate(phone: string, templateId: string, leadData: { name?: string }): Promise<boolean> {
  // IMPLEMENT YOUR WHATSAPP API LOGIC HERE (e.g., Meta Cloud API, Twilio)
  console.log(`[WHATSAPP] Sending template ${templateId} to ${phone}`);
  // Example:
  // await axios.post('https://graph.facebook.com/v18.0/PHONE_ID/messages', { ... }, { headers: { ... } });
  return true;
}

// Main processor
export async function processLeads(): Promise<void> {
  // 1. Check if system is stopped
  const config = await SystemConfig.findOne({ key: 'scheduler_config' });
  if (config && !config.is_running) {
    console.log("Sync is manually stopped.");
    return;
  }

  console.log("Starting 10-minute Lead Check...");

  // 2. Get all Active Triggers (Forms that have a template assigned)
  const triggers = await Trigger.find({ isActive: true, template_id: { $ne: null } });

  for (const trigger of triggers) {
    console.log(`Checking leads for Form: ${trigger.form_name} (${trigger.form_id})`);

    // 3. Fetch all leads for this form from FB
    const fbLeads: FbLead[] = await getLeadsForForm(trigger.form_id);

    for (const fbLead of fbLeads) {
      // 4. Check if lead already exists in MongoDB
      const exists = await Lead.findOne({ lead_id: fbLead.id });

      if (!exists) {
        // --- NEW LEAD FOUND ---

        // Extract basic info from field_data
        const fieldData = fbLead.field_data || [];
        const getVal = (name: string): string => {
          const field = fieldData.find(f => f.name === name);
          return field?.values[0] || "";
        };

        const phone = getVal("PHONE") || getVal("phone_number");
        const name = getVal("FULL_NAME") || getVal("full_name");

        // 5. Send WhatsApp
        let sentStatus = false;
        if (phone && trigger.template_id) {
          try {
            // await sendWhatsAppTemplate(phone, trigger.template_id, { name });
            sentStatus = true;
          } catch (err) {
            console.error("Failed to send WhatsApp", err);
          }
        }

        // 6. Save to MongoDB
        await Lead.create({
          lead_id: fbLead.id,
          form_id: trigger.form_id,
          full_name: name,
          email: getVal("EMAIL") || getVal("email"),
          phone: phone,
          raw_data: fbLead,
          created_time: fbLead.created_time,
          template_sent: sentStatus,
        });

        console.log(`New Lead Saved & Msg Sent: ${name}`);
      }
    }
  }
  console.log("Lead Check Complete.");
}