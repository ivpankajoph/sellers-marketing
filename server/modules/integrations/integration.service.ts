import crypto from 'crypto';
import { ConnectedAccount, toConnectedAccountData, IConnectedAccount } from './connectedAccount.model';
import { INTEGRATION_PROVIDERS, getProviderById } from './integration.providers';
import { 
  ConnectedAccountData, 
  ConnectIntegrationInput, 
  IntegrationProvider,
  VerifyConnectionResult 
} from './integration.types';
import { encrypt, decrypt, maskSecret } from '../encryption/encryption.service';

export async function getAllProviders(): Promise<IntegrationProvider[]> {
  return INTEGRATION_PROVIDERS;
}

export async function getProviderDetails(providerId: string): Promise<IntegrationProvider | null> {
  return getProviderById(providerId) || null;
}

export async function getUserConnections(userId: string): Promise<ConnectedAccountData[]> {
  try {
    const accounts = await ConnectedAccount.find({ userId }).sort({ createdAt: -1 });
    return accounts.map(toConnectedAccountData);
  } catch (error) {
    console.error('[Integrations] Error fetching user connections:', error);
    return [];
  }
}

export async function getConnectionByProvider(
  userId: string, 
  providerId: string
): Promise<ConnectedAccountData | null> {
  try {
    const account = await ConnectedAccount.findOne({ userId, providerId, isDefault: true });
    if (!account) {
      const anyAccount = await ConnectedAccount.findOne({ userId, providerId });
      return anyAccount ? toConnectedAccountData(anyAccount) : null;
    }
    return toConnectedAccountData(account);
  } catch (error) {
    console.error('[Integrations] Error fetching connection:', error);
    return null;
  }
}

export async function getConnectionById(
  userId: string, 
  connectionId: string
): Promise<ConnectedAccountData | null> {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    return account ? toConnectedAccountData(account) : null;
  } catch (error) {
    console.error('[Integrations] Error fetching connection by ID:', error);
    return null;
  }
}

export async function connectIntegration(
  userId: string,
  input: ConnectIntegrationInput
): Promise<{ success: boolean; connection?: ConnectedAccountData; error?: string }> {
  try {
    const provider = getProviderById(input.providerId);
    if (!provider) {
      return { success: false, error: 'Invalid provider' };
    }

    for (const field of provider.requiredFields) {
      if (!input.credentials[field.key]) {
        return { success: false, error: `Missing required field: ${field.label}` };
      }
    }

    const encryptedCredentials: Record<string, string> = {};
    for (const [key, value] of Object.entries(input.credentials)) {
      if (value) {
        encryptedCredentials[key] = encrypt(value);
      }
    }

    if (input.setAsDefault) {
      await ConnectedAccount.updateMany(
        { userId, providerId: input.providerId },
        { $set: { isDefault: false } }
      );
    }

    const existingConnection = await ConnectedAccount.findOne({ 
      userId, 
      providerId: input.providerId,
      isDefault: true 
    });

    const connectionId = crypto.randomUUID();
    const now = new Date();

    if (existingConnection) {
      existingConnection.credentials = new Map(Object.entries(encryptedCredentials));
      existingConnection.metadata = new Map(Object.entries(input.metadata || {}));
      existingConnection.status = 'pending';
      existingConnection.updatedAt = now;
      existingConnection.errorMessage = undefined;
      await existingConnection.save();

      const verifyResult = await verifyConnection(userId, existingConnection.id);
      if (verifyResult.success) {
        existingConnection.status = 'connected';
        existingConnection.lastVerifiedAt = now;
        if (verifyResult.metadata) {
          for (const [key, value] of Object.entries(verifyResult.metadata)) {
            existingConnection.metadata.set(key, value);
          }
        }
      } else {
        existingConnection.status = 'error';
        existingConnection.errorMessage = verifyResult.message;
      }
      await existingConnection.save();

      return { 
        success: verifyResult.success, 
        connection: toConnectedAccountData(existingConnection),
        error: verifyResult.success ? undefined : verifyResult.message
      };
    }

    const isFirstConnection = !(await ConnectedAccount.findOne({ userId, providerId: input.providerId }));

    const newConnection = new ConnectedAccount({
      id: connectionId,
      userId,
      providerId: input.providerId,
      providerName: provider.name,
      status: 'pending',
      credentials: new Map(Object.entries(encryptedCredentials)),
      metadata: new Map(Object.entries(input.metadata || {})),
      isDefault: input.setAsDefault || isFirstConnection,
      createdAt: now,
      updatedAt: now
    });

    await newConnection.save();

    const verifyResult = await verifyConnection(userId, connectionId);
    if (verifyResult.success) {
      newConnection.status = 'connected';
      newConnection.lastVerifiedAt = now;
      if (verifyResult.metadata) {
        for (const [key, value] of Object.entries(verifyResult.metadata)) {
          newConnection.metadata.set(key, value);
        }
      }
    } else {
      newConnection.status = 'error';
      newConnection.errorMessage = verifyResult.message;
    }
    await newConnection.save();

    return { 
      success: verifyResult.success, 
      connection: toConnectedAccountData(newConnection),
      error: verifyResult.success ? undefined : verifyResult.message
    };
  } catch (error) {
    console.error('[Integrations] Error connecting integration:', error);
    return { success: false, error: 'Failed to connect integration' };
  }
}

export async function disconnectIntegration(
  userId: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) {
      return { success: false, error: 'Connection not found' };
    }

    await ConnectedAccount.deleteOne({ id: connectionId, userId });

    if (account.isDefault) {
      const nextConnection = await ConnectedAccount.findOne({ 
        userId, 
        providerId: account.providerId 
      });
      if (nextConnection) {
        nextConnection.isDefault = true;
        await nextConnection.save();
      }
    }

    return { success: true };
  } catch (error) {
    console.error('[Integrations] Error disconnecting integration:', error);
    return { success: false, error: 'Failed to disconnect integration' };
  }
}

export async function setDefaultConnection(
  userId: string,
  connectionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) {
      return { success: false, error: 'Connection not found' };
    }

    await ConnectedAccount.updateMany(
      { userId, providerId: account.providerId },
      { $set: { isDefault: false } }
    );

    account.isDefault = true;
    await account.save();

    return { success: true };
  } catch (error) {
    console.error('[Integrations] Error setting default connection:', error);
    return { success: false, error: 'Failed to set default connection' };
  }
}

export async function verifyConnection(
  userId: string,
  connectionId: string
): Promise<VerifyConnectionResult> {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) {
      return { success: false, message: 'Connection not found' };
    }

    const decryptedCredentials: Record<string, string> = {};
    account.credentials.forEach((value: string, key: string) => {
      decryptedCredentials[key] = decrypt(value);
    });

    switch (account.providerId) {
      case 'whatsapp':
        return await verifyWhatsAppConnection(decryptedCredentials);
      case 'facebook':
        return await verifyFacebookConnection(decryptedCredentials);
      case 'gemini':
        return await verifyGeminiConnection(decryptedCredentials);
      case 'openai':
        return await verifyOpenAIConnection(decryptedCredentials);
      case 'smtp':
        return await verifySMTPConnection(decryptedCredentials);
      default:
        return { success: true, message: 'Connection saved (verification not available for this provider)' };
    }
  } catch (error) {
    console.error('[Integrations] Error verifying connection:', error);
    return { success: false, message: 'Verification failed' };
  }
}

async function verifyWhatsAppConnection(credentials: Record<string, string>): Promise<VerifyConnectionResult> {
  try {
    const { accessToken, phoneNumberId } = credentials;
    if (!accessToken || !phoneNumberId) {
      return { success: false, message: 'Missing access token or phone number ID' };
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${phoneNumberId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        message: error.error?.message || 'Invalid WhatsApp credentials'
      };
    }

    const data = await response.json();
    return { 
      success: true, 
      message: 'WhatsApp connection verified successfully',
      metadata: {
        displayPhoneNumber: data.display_phone_number,
        verifiedName: data.verified_name,
        qualityRating: data.quality_rating
      }
    };
  } catch (error) {
    console.error('[Integrations] WhatsApp verification error:', error);
    return { success: false, message: 'Failed to verify WhatsApp connection' };
  }
}

async function verifyFacebookConnection(credentials: Record<string, string>): Promise<VerifyConnectionResult> {
  try {
    const { accessToken, pageId } = credentials;
    if (!accessToken) {
      return { success: false, message: 'Missing access token' };
    }

    const response = await fetch(
      `https://graph.facebook.com/v21.0/me?access_token=${accessToken}`
    );

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        message: error.error?.message || 'Invalid Facebook credentials'
      };
    }

    const data = await response.json();
    return { 
      success: true, 
      message: 'Facebook connection verified successfully',
      metadata: {
        name: data.name,
        id: data.id
      }
    };
  } catch (error) {
    console.error('[Integrations] Facebook verification error:', error);
    return { success: false, message: 'Failed to verify Facebook connection' };
  }
}

async function verifyGeminiConnection(credentials: Record<string, string>): Promise<VerifyConnectionResult> {
  try {
    const { apiKey } = credentials;
    if (!apiKey) {
      return { success: false, message: 'Missing API key' };
    }

    const { GoogleGenAI } = await import('@google/genai');
    const genAI = new GoogleGenAI({ apiKey });
    
    const response = await genAI.models.list();
    
    return { 
      success: true, 
      message: 'Gemini AI connection verified successfully',
      metadata: {
        modelsAvailable: true
      }
    };
  } catch (error: any) {
    console.error('[Integrations] Gemini verification error:', error);
    return { 
      success: false, 
      message: error.message || 'Invalid Gemini API key'
    };
  }
}

async function verifyOpenAIConnection(credentials: Record<string, string>): Promise<VerifyConnectionResult> {
  try {
    const { apiKey } = credentials;
    if (!apiKey) {
      return { success: false, message: 'Missing API key' };
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      return { 
        success: false, 
        message: error.error?.message || 'Invalid OpenAI API key'
      };
    }

    return { 
      success: true, 
      message: 'OpenAI connection verified successfully'
    };
  } catch (error) {
    console.error('[Integrations] OpenAI verification error:', error);
    return { success: false, message: 'Failed to verify OpenAI connection' };
  }
}

async function verifySMTPConnection(credentials: Record<string, string>): Promise<VerifyConnectionResult> {
  return { 
    success: true, 
    message: 'SMTP credentials saved (send a test email to verify)'
  };
}

export async function getDecryptedCredentials(
  userId: string,
  providerId: string
): Promise<Record<string, string> | null> {
  try {
    const account = await ConnectedAccount.findOne({ 
      userId, 
      providerId, 
      isDefault: true,
      status: 'connected'
    });
    
    if (!account) {
      const anyAccount = await ConnectedAccount.findOne({ 
        userId, 
        providerId,
        status: 'connected'
      });
      if (!anyAccount) return null;
      
      const result: Record<string, string> = {};
      anyAccount.credentials.forEach((value: string, key: string) => {
        result[key] = decrypt(value);
      });
      return result;
    }

    const result: Record<string, string> = {};
    account.credentials.forEach((value: string, key: string) => {
      result[key] = decrypt(value);
    });
    return result;
  } catch (error) {
    console.error('[Integrations] Error getting decrypted credentials:', error);
    return null;
  }
}

export async function getMaskedCredentials(
  userId: string,
  connectionId: string
): Promise<Record<string, string> | null> {
  try {
    const account = await ConnectedAccount.findOne({ id: connectionId, userId });
    if (!account) return null;

    const result: Record<string, string> = {};
    account.credentials.forEach((value: string, key: string) => {
      const decrypted = decrypt(value);
      result[key] = maskSecret(decrypted);
    });
    return result;
  } catch (error) {
    console.error('[Integrations] Error getting masked credentials:', error);
    return null;
  }
}

export async function getConnectionsWithStatus(userId: string): Promise<{
  provider: IntegrationProvider;
  connection: ConnectedAccountData | null;
  isConnected: boolean;
}[]> {
  const connections = await getUserConnections(userId);
  const connectionMap = new Map(connections.map(c => [c.providerId, c]));

  return INTEGRATION_PROVIDERS.map(provider => {
    const connection = connectionMap.get(provider.id) || null;
    return {
      provider,
      connection,
      isConnected: connection?.status === 'connected'
    };
  });
}
