import { credentialsService } from '../credentials/credentials.service';
import * as integrationService from '../integrations/integration.service';

export interface WhatsAppCredentials {
  token: string;
  phoneNumberId: string;
  businessAccountId?: string;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface TemplateComponent {
  type: string;
  parameters?: Array<{
    type: string;
    text?: string;
    parameter_name?: string;
  }>;
}

export async function getUserWhatsAppCredentials(userId: string): Promise<WhatsAppCredentials | null> {
  try {
    const integrationCreds = await integrationService.getDecryptedCredentials(userId, 'whatsapp');
    if (integrationCreds?.accessToken && integrationCreds?.phoneNumberId) {
      console.log('[WhatsApp Service] Using credentials from Connected Apps');
      return {
        token: integrationCreds.accessToken,
        phoneNumberId: integrationCreds.phoneNumberId,
        businessAccountId: integrationCreds.businessAccountId,
      };
    }
    
    const creds = await credentialsService.getDecryptedCredentials(userId);
    
    if (creds?.whatsappToken && creds?.phoneNumberId) {
      return {
        token: creds.whatsappToken,
        phoneNumberId: creds.phoneNumberId,
        businessAccountId: creds.businessAccountId,
      };
    }
    
    return null;
  } catch (error) {
    console.error('[WhatsApp Service] Error getting user credentials:', error);
    return null;
  }
}

export async function getWhatsAppCredentialsForUser(userId?: string): Promise<WhatsAppCredentials | null> {
  if (userId) {
    const userCreds = await getUserWhatsAppCredentials(userId);
    if (userCreds) {
      return userCreds;
    }
  }
  
  // Fall back to system credentials from environment variables
  const systemToken = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
  const systemPhoneNumberId = process.env.PHONE_NUMBER_ID;
  
  if (systemToken && systemPhoneNumberId) {
    console.log('[WhatsApp Service] Using system credentials from environment');
    return {
      token: systemToken,
      phoneNumberId: systemPhoneNumberId,
      businessAccountId: process.env.BUSINESS_ACCOUNT_ID,
    };
  }
  
  return null;
}

export async function getWhatsAppCredentialsStrict(userId?: string): Promise<WhatsAppCredentials | null> {
  if (!userId) {
    return null;
  }
  
  const userCreds = await getUserWhatsAppCredentials(userId);
  if (userCreds) {
    return userCreds;
  }
  
  return null;
}

export async function sendTextMessage(
  to: string,
  message: string,
  userId?: string
): Promise<SendMessageResult> {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  
  if (!credentials) {
    console.error('[WhatsApp Service] Credentials not configured');
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
          to,
          type: 'text',
          text: { body: message },
        }),
      }
    );
    
    const data = await response.json();
    
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    
    return { 
      success: false, 
      error: data.error?.message || 'Failed to send message' 
    };
  } catch (error) {
    console.error('[WhatsApp Service] Error sending message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = 'en',
  components: TemplateComponent[] = [],
  userId?: string
): Promise<SendMessageResult> {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  
  if (!credentials) {
    console.error('[WhatsApp Service] Credentials not configured');
    return { success: false, error: 'WhatsApp credentials not configured' };
  }
  
  const metaTemplateName = templateName.toLowerCase().replace(/\s+/g, '_');
  console.log(`[WhatsApp Service] Sending template: "${metaTemplateName}" to ${to}`);
  
  const languageCodesToTry = [languageCode, 'en', 'en_US', 'en_GB'];
  const uniqueLanguages = Array.from(new Set(languageCodesToTry));
  
  for (const langCode of uniqueLanguages) {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: metaTemplateName,
        language: { code: langCode },
      },
    };
    
    if (components.length > 0) {
      (payload.template as Record<string, unknown>).components = components;
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
          body: JSON.stringify(payload),
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.messages?.[0]?.id) {
        console.log(`[WhatsApp Service] Template sent successfully with lang: ${langCode}`);
        return { success: true, messageId: data.messages[0].id };
      }
      
      const errorCode = data.error?.code;
      const errorMsg = data.error?.message || '';
      
      if (errorCode === 132001 || errorMsg.includes('does not exist')) {
        console.log(`[WhatsApp Service] Template not found with lang "${langCode}", trying next...`);
        continue;
      }
      
      return { 
        success: false, 
        error: data.error?.message || 'Failed to send template' 
      };
    } catch (error) {
      console.error('[WhatsApp Service] Error sending template:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
  
  return { 
    success: false, 
    error: `Template "${templateName}" not found in any supported language` 
  };
}

export async function sendImageMessage(
  to: string,
  imageUrl: string,
  caption?: string,
  userId?: string
): Promise<SendMessageResult> {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  
  if (!credentials) {
    return { success: false, error: 'WhatsApp credentials not configured' };
  }
  
  try {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'image',
      image: { link: imageUrl },
    };
    
    if (caption) {
      (payload.image as Record<string, unknown>).caption = caption;
    }
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    
    const data = await response.json();
    
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    
    return { 
      success: false, 
      error: data.error?.message || 'Failed to send image' 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function sendDocumentMessage(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string,
  userId?: string
): Promise<SendMessageResult> {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  
  if (!credentials) {
    return { success: false, error: 'WhatsApp credentials not configured' };
  }
  
  try {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'document',
      document: { 
        link: documentUrl,
        filename,
      },
    };
    
    if (caption) {
      (payload.document as Record<string, unknown>).caption = caption;
    }
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    
    const data = await response.json();
    
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    
    return { 
      success: false, 
      error: data.error?.message || 'Failed to send document' 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function sendVideoMessage(
  to: string,
  videoUrl: string,
  caption?: string,
  userId?: string
): Promise<SendMessageResult> {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  
  if (!credentials) {
    return { success: false, error: 'WhatsApp credentials not configured' };
  }
  
  try {
    const payload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'video',
      video: { link: videoUrl },
    };
    
    if (caption) {
      (payload.video as Record<string, unknown>).caption = caption;
    }
    
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    
    const data = await response.json();
    
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    
    return { 
      success: false, 
      error: data.error?.message || 'Failed to send video' 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function sendReplyMessage(
  to: string,
  message: string,
  replyToMessageId: string,
  userId?: string
): Promise<SendMessageResult> {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  
  if (!credentials) {
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
          to,
          context: { message_id: replyToMessageId },
          type: 'text',
          text: { body: message },
        }),
      }
    );
    
    const data = await response.json();
    
    if (response.ok && data.messages?.[0]?.id) {
      return { success: true, messageId: data.messages[0].id };
    }
    
    return { 
      success: false, 
      error: data.error?.message || 'Failed to send reply' 
    };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

export async function markMessageAsRead(
  messageId: string,
  userId?: string
): Promise<boolean> {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  
  if (!credentials) {
    return false;
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
          status: 'read',
          message_id: messageId,
        }),
      }
    );
    
    return response.ok;
  } catch (error) {
    console.error('[WhatsApp Service] Error marking message as read:', error);
    return false;
  }
}

export async function getUserByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  try {
    const userId = await credentialsService.findUserByPhoneNumberId(phoneNumberId);
    return userId;
  } catch (error) {
    console.error('[WhatsApp Service] Error finding user by phone number ID:', error);
    return null;
  }
}

export interface SendFlowOptions {
  to: string;
  flowId: string;
  flowName: string;
  entryPointId?: string;
  headerText?: string;
  bodyText?: string;
  footerText?: string;
  ctaText?: string;
  flowToken?: string;
  flowActionPayload?: Record<string, any>;
}

export async function sendFlowMessage(
  userId: string,
  options: SendFlowOptions
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const credentials = await getWhatsAppCredentialsForUser(userId);
  
  if (!credentials) {
    return { success: false, error: 'WhatsApp credentials not configured' };
  }

  try {
    const payload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: options.to,
      type: 'interactive',
      interactive: {
        type: 'flow',
        header: options.headerText ? {
          type: 'text',
          text: options.headerText
        } : undefined,
        body: {
          text: options.bodyText || `Please complete the ${options.flowName} flow`
        },
        footer: options.footerText ? {
          text: options.footerText
        } : undefined,
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: options.flowToken || `flow_${Date.now()}`,
            flow_id: options.flowId,
            flow_cta: options.ctaText || 'Start',
            flow_action: 'navigate',
            flow_action_payload: options.flowActionPayload ? {
              screen: options.entryPointId || '0',
              data: options.flowActionPayload
            } : {
              screen: options.entryPointId || '0'
            }
          }
        }
      }
    };

    if (!payload.interactive.header) {
      delete payload.interactive.header;
    }
    if (!payload.interactive.footer) {
      delete payload.interactive.footer;
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${credentials.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${credentials.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );
    
    const data = await response.json();
    
    if (response.ok && data.messages?.[0]?.id) {
      console.log(`[WhatsApp Service] Flow message sent to ${options.to}, messageId: ${data.messages[0].id}`);
      return { success: true, messageId: data.messages[0].id };
    }
    
    console.error('[WhatsApp Service] Flow send failed:', data.error);
    return { 
      success: false, 
      error: data.error?.message || 'Failed to send flow message' 
    };
  } catch (error) {
    console.error('[WhatsApp Service] Error sending flow message:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
