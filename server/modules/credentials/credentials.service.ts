import crypto from 'crypto';
import { UserCredentials } from '../storage/mongodb.adapter';

export interface CredentialInput {
  whatsappToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
  appId?: string;
  appSecret?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  facebookAccessToken?: string;
  facebookPageId?: string;
}

export interface StoredCredentials {
  id: string;
  userId: string;
  whatsappToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
  appId?: string;
  appSecret?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  facebookAccessToken?: string;
  facebookPageId?: string;
  isVerified: boolean;
  lastVerifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DecryptedCredentials {
  whatsappToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  appId: string;
  appSecret: string;
  openaiApiKey: string;
  geminiApiKey: string;
  facebookAccessToken: string;
  facebookPageId: string;
}

export async function getCredentialsByUserId(userId: string): Promise<StoredCredentials | null> {
  try {
    const creds = await UserCredentials.findOne({ userId });
    if (!creds) return null;
    return creds.toObject() as StoredCredentials;
  } catch (error) {
    console.error('[Credentials] Error getting credentials:', error);
    return null;
  }
}

export async function getDecryptedCredentials(userId: string): Promise<DecryptedCredentials | null> {
  try {
    const stored = await getCredentialsByUserId(userId);
    if (!stored) return null;
    
    return {
      whatsappToken: stored.whatsappToken || '',
      phoneNumberId: stored.phoneNumberId || '',
      businessAccountId: stored.businessAccountId || '',
      webhookVerifyToken: stored.webhookVerifyToken || '',
      appId: stored.appId || '',
      appSecret: stored.appSecret || '',
      openaiApiKey: stored.openaiApiKey || '',
      geminiApiKey: stored.geminiApiKey || '',
      facebookAccessToken: stored.facebookAccessToken || '',
      facebookPageId: stored.facebookPageId || '',
    };
  } catch (error) {
    console.error('[Credentials] Error getting credentials:', error);
    return null;
  }
}

export async function getMaskedCredentialsForUser(userId: string): Promise<Record<string, string> | null> {
  try {
    const stored = await getCredentialsByUserId(userId);
    if (!stored) return null;
    
    const mask = (val?: string) => {
      if (!val) return '';
      if (val.length <= 8) return '****';
      return val.substring(0, 4) + '****' + val.substring(val.length - 4);
    };
    
    return {
      whatsappToken: mask(stored.whatsappToken),
      phoneNumberId: mask(stored.phoneNumberId),
      businessAccountId: mask(stored.businessAccountId),
      webhookVerifyToken: mask(stored.webhookVerifyToken),
      appId: mask(stored.appId),
      appSecret: mask(stored.appSecret),
      openaiApiKey: mask(stored.openaiApiKey),
      geminiApiKey: mask(stored.geminiApiKey),
      facebookAccessToken: mask(stored.facebookAccessToken),
      facebookPageId: mask(stored.facebookPageId),
    };
  } catch (error) {
    console.error('[Credentials] Error masking credentials:', error);
    return null;
  }
}

export async function saveCredentials(userId: string, input: CredentialInput): Promise<StoredCredentials | null> {
  try {
    const now = new Date().toISOString();
    const existing = await UserCredentials.findOne({ userId });
    
    const data: Record<string, string> = {};
    if (input.whatsappToken) data.whatsappToken = input.whatsappToken;
    if (input.phoneNumberId) data.phoneNumberId = input.phoneNumberId;
    if (input.businessAccountId) data.businessAccountId = input.businessAccountId;
    if (input.webhookVerifyToken) data.webhookVerifyToken = input.webhookVerifyToken;
    if (input.appId) data.appId = input.appId;
    if (input.appSecret) data.appSecret = input.appSecret;
    if (input.openaiApiKey) data.openaiApiKey = input.openaiApiKey;
    if (input.geminiApiKey) data.geminiApiKey = input.geminiApiKey;
    if (input.facebookAccessToken) data.facebookAccessToken = input.facebookAccessToken;
    if (input.facebookPageId) data.facebookPageId = input.facebookPageId;
    
    if (existing) {
      const updateData: Record<string, any> = {
        ...data,
        updatedAt: now,
      };
      
      await UserCredentials.updateOne(
        { userId },
        { $set: updateData }
      );
      
      const updated = await UserCredentials.findOne({ userId });
      return updated ? updated.toObject() as StoredCredentials : null;
    } else {
      const newCreds = await UserCredentials.create({
        id: crypto.randomUUID(),
        userId,
        ...data,
        isVerified: false,
        createdAt: now,
        updatedAt: now,
      });
      return newCreds.toObject() as StoredCredentials;
    }
  } catch (error) {
    console.error('[Credentials] Error saving credentials:', error);
    return null;
  }
}

export async function updateVerificationStatus(userId: string, isVerified: boolean): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    await UserCredentials.updateOne(
      { userId },
      { 
        $set: { 
          isVerified,
          lastVerifiedAt: isVerified ? now : undefined,
          updatedAt: now,
        }
      }
    );
    return true;
  } catch (error) {
    console.error('[Credentials] Error updating verification status:', error);
    return false;
  }
}

export async function deleteCredentials(userId: string): Promise<boolean> {
  try {
    await UserCredentials.deleteOne({ userId });
    return true;
  } catch (error) {
    console.error('[Credentials] Error deleting credentials:', error);
    return false;
  }
}

export async function getCredentialsByPhoneNumberId(phoneNumberId: string): Promise<{ userId: string; credentials: DecryptedCredentials } | null> {
  try {
    const cred = await UserCredentials.findOne({ phoneNumberId });
    if (cred) {
      const decrypted = await getDecryptedCredentials(cred.userId);
      if (decrypted) {
        return { userId: cred.userId, credentials: decrypted };
      }
    }
    return null;
  } catch (error) {
    console.error('[Credentials] Error finding credentials by phone ID:', error);
    return null;
  }
}

export async function hasCredentials(userId: string): Promise<boolean> {
  try {
    const creds = await UserCredentials.findOne({ userId });
    return !!creds;
  } catch (error) {
    return false;
  }
}

export async function getCredentialStatus(userId: string): Promise<{
  hasWhatsApp: boolean;
  hasOpenAI: boolean;
  hasGemini: boolean;
  hasFacebook: boolean;
  isVerified: boolean;
}> {
  try {
    const creds = await getCredentialsByUserId(userId);
    if (!creds) {
      return { hasWhatsApp: false, hasOpenAI: false, hasGemini: false, hasFacebook: false, isVerified: false };
    }
    
    return {
      hasWhatsApp: !!(creds.whatsappToken && creds.phoneNumberId && creds.appId),
      hasOpenAI: !!creds.openaiApiKey,
      hasGemini: !!creds.geminiApiKey,
      hasFacebook: !!creds.facebookAccessToken,
      isVerified: creds.isVerified,
    };
  } catch (error) {
    return { hasWhatsApp: false, hasOpenAI: false, hasGemini: false, hasFacebook: false, isVerified: false };
  }
}

export async function findUserByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
  try {
    const cred = await UserCredentials.findOne({ phoneNumberId });
    return cred ? cred.userId : null;
  } catch (error) {
    console.error('[Credentials] Error finding user by phone ID:', error);
    return null;
  }
}

export const credentialsService = {
  getCredentialsByUserId,
  getDecryptedCredentials,
  getMaskedCredentialsForUser,
  saveCredentials,
  updateVerificationStatus,
  deleteCredentials,
  getCredentialsByPhoneNumberId,
  hasCredentials,
  getCredentialStatus,
  findUserByPhoneNumberId,
};
