import {

  FormAutomation,
  Lead,
  LeadDripStatus,
  Leadfb,
  SystemConfig,
  Template,
  Trigger,
} from "./modules/storage/mongodb.adapter";
import axios, { AxiosError } from "axios";
import cron from "node-cron";
import { Types } from "mongoose";
import { sendTemplateMessage } from "./modules/broadcast/broadcast.service";

const FB_API_VERSION = "v17.0";
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;
const SYSTEM_USER_TOKEN_META = process.env.SYSTEM_USER_TOKEN_META;

// WhatsApp Cloud API Configuration
const WHATSAPP_API_VERSION = "v22.0";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WABA_ID;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;

// One-time migration: Mark all existing leads as template_sent = true
export async function migrateExistingLeads() {
  try {
    const result = await Leadfb.updateMany(
      { template_sent: { $ne: true } }, // Find leads where template_sent is not true
      { $set: { template_sent: true } }
    );
    console.log(`Migrated ${result.modifiedCount} existing leads to template_sent: true`);
  } catch (error: any) {
    console.error("Error migrating existing leads:", error.message);
  }
}



async function fetchAllLeadsFromFacebook(formId: any) {
  let allLeads: any = [];
  let url = `https://graph.facebook.com/${FB_API_VERSION}/${formId}/leads?access_token=${FB_ACCESS_TOKEN}&limit=100`;

  while (url) {
    try {
      const response = await axios.get(url);
      const data = response.data;

      allLeads = allLeads.concat(data.data || []);

      // Check for next page
      url = data.paging?.cursors?.after
        ? `https://graph.facebook.com/${FB_API_VERSION}/${formId}/leads?access_token=${FB_ACCESS_TOKEN}&limit=100&after=${data.paging.cursors.after}`
        : "";
    } catch (error: any) {
      console.error(`Error fetching leads for form ${formId}:`, error.message);
      break;
    }
  }

  return allLeads;
}

function normalizeLead(
  fbLead: { id: any; created_time: string | number | Date; field_data: any[] },
  formId: any,
  formName: any,
  templateId: any,
  templateName: any
) {
  const normalized: any = {
    lead_id: fbLead.id,
    form_id: formId,
    form_name: formName,
    created_time: new Date(fbLead.created_time),
    template_sent: false, // Always start as false for new leads
    automation_active: true,
    template_id: templateId,
    template_name: templateName,
    raw_field_data: fbLead.field_data,
  };

  // Parse field_data
  fbLead.field_data?.forEach((field) => {
    const key = field.name;
    const value = field.values?.[0] || "";

    if (key === "full_name" || key === "FULL_NAME") {
      normalized.full_name = value;
    } else if (key === "email" || key === "EMAIL") {
      normalized.email = value;
    } else if (key === "phone_number" || key === "PHONE") {
      normalized.phone = value;
    } else if (key === "date_of_birth" || key === "DOB") {
      normalized.dob = value;
    } else if (key === "0") {
      normalized.category = value;
    } else if (key === "1") {
      normalized.opt_in = value;
    }
  });

  return normalized;
}

// Fetch template details from WhatsApp Business API
async function getTemplateDetails(templateId: string) {
  try {
    console.log("🔍 Fetching template from DB:", templateId);

    const template = await Template.findOne({
      $or: [
        { id: templateId },     // Meta template ID
        { name: templateId },   // template name
      ],
    }).lean();

    if (!template) {
      console.error("❌ Template not found in DB:", templateId);
      return null;
    }

    // Validation checks (important)
    if (
      template.metaStatus !== "APPROVED" &&
      template.status !== "approved"
    ) {
      console.warn(
        `⚠️ Template found but not approved: ${template.name}`,
        {
          status: template.status,
          metaStatus: template.metaStatus,
        }
      );
      return null;
    }

    console.log("✅ Template loaded from DB:", {
      name: template.name,
      language: template.language,
      category: template.category,
    });

    return {
      id: template.id,
      name: template.name,
      language: template.language,
      status: template.metaStatus || template.status,
      components: [
        {
          type: "BODY",
          text: template.content,
        },
      ],
      raw: template, // keep full DB object if needed
    };
  } catch (error: any) {
    console.error("🔥 Error fetching template from DB:", error.message);
    return null;
  }
}


// Build template parameters dynamically based on template structure
function buildTemplateParameters(template: any, lead: any) {
  const components: any[] = [];

  // Process each component in the template
  template.components?.forEach((component: any) => {
    if (component.type === "HEADER" && component.format === "TEXT") {
      // Check if header has variables
      const headerText = component.text || "";
      const variableCount = (headerText.match(/\{\{(\d+)\}\}/g) || []).length;
      
      if (variableCount > 0) {
        const parameters = [];
        for (let i = 1; i <= variableCount; i++) {
          parameters.push({
            type: "text",
            text: lead.full_name || "Customer"
          });
        }
        components.push({
          type: "header",
          parameters: parameters
        });
      }
    }

    if (component.type === "BODY") {
      // Extract variables from body text
      const bodyText = component.text || "";
      const variableCount = (bodyText.match(/\{\{(\d+)\}\}/g) || []).length;
      
      if (variableCount > 0) {
        const parameters = [];
        
        // Map variables to lead data
        for (let i = 1; i <= variableCount; i++) {
          let value = "Customer";
          
          // You can customize this mapping based on your template structure
          switch (i) {
            case 1:
              value = lead.full_name || "Customer";
              break;
            case 2:
              value = lead.category || lead.email || "";
              break;
            case 3:
              value = lead.phone || "";
              break;
            case 4:
              value = lead.dob || "";
              break;
            default:
              value = "";
          }
          
          parameters.push({
            type: "text",
            text: value
          });
        }
        
        components.push({
          type: "body",
          parameters: parameters
        });
      }
    }

    // Handle BUTTONS component if needed (for dynamic URLs)
    if (component.type === "BUTTONS") {
      component.buttons?.forEach((button: any, index: number) => {
        if (button.type === "URL" && button.url?.includes("{{")) {
          components.push({
            type: "button",
            sub_type: "url",
            index: index.toString(),
            parameters: [
              {
                type: "text",
                text: lead.lead_id || "" // or any dynamic value
              }
            ]
          });
        }
      });
    }
  });

  return components;
}

// Send WhatsApp Template Message using form's assigned template
async function sendWhatsAppTemplate(lead: any, templateId: string) {
  try {
    // Validate phone number
    if (!lead.phone) {
      console.error(`No phone number for lead ${lead.lead_id}`);
      return { success: false, error: "No phone number" };
    }

    // Clean phone number (remove spaces, dashes, etc.)
    let phoneNumber = lead.phone.replace(/[\s\-\(\)]/g, "");
    
    // Add country code if not present (assuming India +91, modify as needed)
    if (!phoneNumber.startsWith("+")) {
      phoneNumber = "+91" + phoneNumber;
    }

    // Fetch template details from WhatsApp API
    console.log(`Fetching template details for: ${templateId}`);
    const template = await getTemplateDetails(templateId);
    
    if (!template) {
      return { success: false, error: `Template not found: ${templateId}` };
    }

    console.log(`Using template: ${template.name} (${template.language})`);

    // Build dynamic parameters based on template structure
    const components = buildTemplateParameters(template, lead);

    // Prepare template message payload
    const payload: any = {
      messaging_product: "whatsapp",
      to: phoneNumber,
      type: "template",
      template: {
        name: template.name,
        language: {
          code: template.language || "en"
        }
      }
    };

    // Add components only if there are parameters
    if (components.length > 0) {
      payload.template.components = components;
    }

    console.log(`Sending WhatsApp template "${template.name}" to ${phoneNumber}`);
    console.log("Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          "Authorization": `Bearer ${SYSTEM_USER_TOKEN_META}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log(`✅ WhatsApp message sent successfully to ${lead.full_name || phoneNumber}`);
    console.log(`Message ID: ${response.data.messages?.[0]?.id}`);

    return {
      success: true,
      message_id: response.data.messages?.[0]?.id,
      phone_number: phoneNumber,
      template_name: template.name
    };

  } catch (error: any) {
    console.error(`❌ Error sending WhatsApp to ${lead.phone}:`, error.response?.data || error.message);
    
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      error_code: error.response?.data?.error?.code
    };
  }
}

export async function syncLeadsForFormMain(formAutomation: any) {
  try {
    console.log(
      `Syncing leads for form: ${formAutomation.form_name} (${formAutomation.form_id})`
    );

    // Fetch leads from Facebook
    const fbLeads = await fetchAllLeadsFromFacebook(formAutomation.form_id);
    console.log(`Fetched ${fbLeads.length} leads from Facebook`);

    let newLeadsCount = 0;
    let updatedLeadsCount = 0;
    let templatesSentCount = 0;
    let templatesFailedCount = 0;

    // Process each lead
    for (const fbLead of fbLeads) {
      const normalizedLead = normalizeLead(
        fbLead,
        formAutomation.form_id,
        formAutomation.form_name,
        formAutomation.template_id,
        formAutomation.template_name
      );

      // Check if lead already exists
      const existingLead = await Leadfb.findOne({ lead_id: normalizedLead.lead_id });

      if (!existingLead) {
        // NEW LEAD - Save with template_sent: false
        console.log(`🆕 New lead found: ${normalizedLead.full_name || normalizedLead.email}`);
        
        const newLead: any = await Leadfb.create({
          ...normalizedLead,
          template_sent: false,
          synced_at: new Date(),
        });

        newLeadsCount++;

        // Send WhatsApp template if phone number exists
        if (newLead.phone && formAutomation.template_id) {
          console.log(`📱 Sending WhatsApp template (${formAutomation.template_name}) to new lead...`);
          
          // Send the template that is assigned to THIS FORM
          const result = await sendTemplateMessage(
            newLead.phone,
            formAutomation.template_name // Using template_id from the form's automation
          );
          

          if (result.success) {
            // Update lead with template_sent: true and message details
            await Leadfb.findByIdAndUpdate(newLead._id, {
              template_sent: true,
              template_sent_at: new Date(),
              whatsapp_message_id: result.messageId,
              whatsapp_phone_number: result.phone_number,
              template_used: result.template_name
            });
            console.log(`📨 WhatsApp message sent: Message ID ${result}`);
            templatesSentCount++;
            console.log(`✅ Template "${result.template_name}" sent successfully and lead updated: template_sent = true`);
          } else {
            // Log the failure but keep template_sent as false
            await Leadfb.findByIdAndUpdate(newLead._id, {
              template_sent_error: result.error,
              template_sent_error_code: result.error_code,
              last_template_attempt: new Date()

            });
            
            templatesFailedCount++;
            console.log(`❌ Template send failed: ${result.error}`);
          }
        } else {
          console.log(`⚠️ No phone number or template configured for form, skipping WhatsApp send`);
        }

      } else {
        // EXISTING LEAD - Just update sync time, don't resend template
        await Leadfb.findOneAndUpdate(
          { lead_id: normalizedLead.lead_id },
          {
            synced_at: new Date(),
            // Preserve existing template_sent status
          }
        );
        updatedLeadsCount++;
      }
    }

    // Update last sync time
    formAutomation.last_sync = new Date();
    formAutomation.last_sync_stats = {
      new_leads: newLeadsCount,
      updated_leads: updatedLeadsCount,
      templates_sent: templatesSentCount,
      templates_failed: templatesFailedCount,
      total_leads: fbLeads.length
    };
    await formAutomation.save();

    console.log(
      `✨ Sync complete: ${newLeadsCount} new, ${updatedLeadsCount} updated, ${templatesSentCount} templates sent, ${templatesFailedCount} failed`
    );
    
    return {
      newLeadsCount,
      updatedLeadsCount,
      templatesSentCount,
      templatesFailedCount,
      totalLeads: fbLeads.length
    };
  } catch (error: any) {
    console.error(
      `Error syncing form ${formAutomation.form_id}:`,
      error.message
    );
    throw error;
  }
}

// Retry failed template sends (optional - run separately or on a schedule)
export async function retryFailedTemplates() {
  try {
    console.log("🔁 Retrying failed template sends...");
    const startTime = Date.now();

    const failedLeads = await Leadfb.find({
      template_sent: false,
      phone: { $exists: true, $ne: "" },
    }).limit(5);

    console.log(
      `📌 Found ${failedLeads.length} failed leads`,
      failedLeads.map(l => ({
        id: l._id,
        phone: l.phone,
        form_id: l.form_id,
        error: l.template_sent_error,
      }))
    );

    let retrySuccessCount = 0;
    let retryFailCount = 0;

    for (const lead of failedLeads) {
      console.log(`➡️ Processing lead ${lead._id} | phone=${lead.phone}`);

      const automation = await FormAutomation.findOne({
        form_id: lead.form_id,
      });

      if (!automation) {
        console.warn(
          `⚠️ No automation found for form_id=${lead.form_id} (lead=${lead._id})`
        );
        retryFailCount++;
        continue;
      }

      if (!automation.template_id) {
        console.warn(
          `⚠️ No template_id in automation for form_id=${lead.form_id} (lead=${lead._id})`
        );
        retryFailCount++;
        continue;
      }

      console.log(
        `📤 Sending WhatsApp template`,
        {
          leadId: lead._id,
          templateId: automation.template_id,
          phone: lead.phone,
        }
      );

      const result = await sendTemplateMessage(
        lead.phone,
        automation.template_name
      );

      console.log(
        `📨 WhatsApp response for lead ${lead._id}:`,
        result
      );

      if (result.success) {
        await Leadfb.findByIdAndUpdate(lead._id, {
          template_sent: true,
          template_sent_at: new Date(),
          whatsapp_message_id: result.messageId,
          whatsapp_phone_number: result.phone_number,
          template_used: result.template_name,
          $unset: {
            template_sent_error: "",
            template_sent_error_code: "",
          },
        });

        console.log(
          `✅ Template sent successfully for lead ${lead._id}`,
          {
            message_id: result.messageId,
            template: result.template_name,
          }
        );

        retrySuccessCount++;
      } else {
        await Leadfb.findByIdAndUpdate(lead._id, {
          template_sent_error: result.error,
          template_sent_error_code: result.error_code,
          last_template_attempt: new Date(),
        });

        console.error(
          `❌ Template send failed for lead ${lead._id}`,
          {
            error: result.error,
            error_code: result.error_code,
          }
        );

        retryFailCount++;
      }
    }

    console.log(
      `🏁 Retry complete`,
      {
        success: retrySuccessCount,
        failed: retryFailCount,
        duration_ms: Date.now() - startTime,
      }
    );

    return { retrySuccessCount, retryFailCount };
  } catch (error: any) {
    console.error(
      "🔥 Fatal error in retryFailedTemplates",
      {
        message: error.message,
        stack: error.stack,
      }
    );
    throw error;
  }
}


function calculateNextSendTime(step: any, currentTime: Date = new Date()): Date {
  const nextTime = new Date(currentTime);

  // Add delay
  if (step.delay_unit === 'minutes') {
    nextTime.setMinutes(nextTime.getMinutes() + step.delay_value);
  } else if (step.delay_unit === 'hours') {
    nextTime.setHours(nextTime.getHours() + step.delay_value);
  } else if (step.delay_unit === 'days') {
    nextTime.setDate(nextTime.getDate() + step.delay_value);
  }

  // If specific time is set, adjust to that time
  if (step.send_at_time) {
    const [hours, minutes] = step.send_at_time.split(':').map(Number);
    nextTime.setHours(hours, minutes, 0, 0);
    
    // If calculated time is in the past, add a day
    if (nextTime < new Date()) {
      nextTime.setDate(nextTime.getDate() + 1);
    }
  }

  return nextTime;
}




export async function processDripCampaigns() {
  try {
    console.log('🔄 Processing drip campaign messages...');

    const now = new Date();

    // Find all leads that need their next message sent
    const pendingLeads = await LeadDripStatus.find({
      status: 'active',
      next_send_time: { $lte: now }
    }).populate('campaign_id');

    console.log(`Found ${pendingLeads.length} leads ready for next message`);

    for (const leadStatus of pendingLeads) {
      try {
        const campaign: any = leadStatus.campaign_id;
        
        if (!campaign || !campaign.is_active) {
          console.log(`Campaign inactive for lead ${leadStatus.lead_id}, skipping...`);
          continue;
        }

        const nextStepIndex = leadStatus.current_step + 1;
        
        if (nextStepIndex >= campaign.steps.length) {
          // Campaign completed
          leadStatus.status = 'completed';
          leadStatus.completed_at = new Date();
          leadStatus.next_send_time = null;
          await leadStatus.save();
          console.log(`✅ Campaign completed for lead ${leadStatus.lead_id}`);
          continue;
        }

        const nextStep = campaign.steps[nextStepIndex];

        // Get lead details
        const lead = await Leadfb.findOne({ lead_id: leadStatus.lead_id });
        
        if (!lead) {
          console.log(`Lead ${leadStatus.lead_id} not found, marking as failed`);
          leadStatus.status = 'failed';
          await leadStatus.save();
          continue;
        }

        // Send WhatsApp message
        console.log(`📱 Sending step ${nextStepIndex + 1} to ${lead.full_name || lead.phone}`);
        const result = await sendWhatsAppTemplate(lead, nextStep.template_id);

        // Update lead status
        leadStatus.steps_completed.push({
          step_order: nextStepIndex,
          template_id: nextStep.template_id,
          sent_at: new Date(),
          message_id: result.message_id,
          success: result.success,
          error: result.error
        });

        if (result.success) {
          leadStatus.current_step = nextStepIndex;
          
          // Calculate next send time if there are more steps
          if (nextStepIndex + 1 < campaign.steps.length) {
            leadStatus.next_send_time = calculateNextSendTime(campaign.steps[nextStepIndex + 1]);
            console.log(`✅ Message sent. Next message scheduled for ${leadStatus.next_send_time}`);
          } else {
            // This was the last step
            leadStatus.status = 'completed';
            leadStatus.completed_at = new Date();
            leadStatus.next_send_time = null;
            console.log(`✅ Final message sent. Campaign completed for ${lead.full_name}`);
          }
        } else {
          leadStatus.status = 'failed';
          console.log(`❌ Failed to send message: ${result.error}`);
        }

        leadStatus.last_updated = new Date();
        await leadStatus.save();

      } catch (error: any) {
        console.error(`Error processing lead ${leadStatus.lead_id}:`, error.message);
      }
    }

    console.log('✨ Drip campaign processing complete');
  } catch (error: any) {
    console.error('Error in processDripCampaigns:', error.message);
  }
}

async function getCampaignStats(campaignId: string) {
  const total = await LeadDripStatus.countDocuments({ campaign_id: campaignId });
  const active = await LeadDripStatus.countDocuments({ campaign_id: campaignId, status: 'active' });
  const completed = await LeadDripStatus.countDocuments({ campaign_id: campaignId, status: 'completed' });
  const failed = await LeadDripStatus.countDocuments({ campaign_id: campaignId, status: 'failed' });

  return { total, active, completed, failed };
}

// ===== API Routes =====

// Get all drip campaigns


// Create new drip campaign


// Update drip campaign

export async function retrySend(fn: () => any, retries = 3, delayMs = 1000) {
  let attempt = 0;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      console.warn(`[RETRY] Attempt ${attempt} failed`);

      if (attempt >= retries) throw err;

      await new Promise((res) =>
        setTimeout(res, delayMs * attempt)
      );
    }
  }
}


export async function sendWithLimit(items: any, limit: number, handler: (arg0: any) => Promise<any>) {
  const executing: Promise<any>[] = [];

  for (const item of items) {
    const p = handler(item).finally(() => {
      executing.splice(executing.indexOf(p), 1);
    });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}


export async function parallelLimit<T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
) {
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const p = handler(item).finally(() => {
      executing.splice(executing.indexOf(p), 1);
    });

    executing.push(p);

    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
}


export async function retry(fn: () => Promise<any>, retries = 3) {
  let attempt = 0;

  while (attempt < retries) {
    try {
      return await fn();
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }
}