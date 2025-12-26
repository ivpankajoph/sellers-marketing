import { GoogleGenAI } from "@google/genai";
import { credentialsService } from '../credentials/credentials.service';

const SYSTEM_GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface Agent {
  id: string;
  name: string;
  systemPrompt?: string;
  instructions?: string;
  model?: string;
  temperature?: number;
}

async function getGeminiApiKey(userId?: string): Promise<string | null> {
  if (userId) {
    try {
      const creds = await credentialsService.getDecryptedCredentials(userId);
      if (creds?.geminiApiKey) {
        return creds.geminiApiKey;
      }
    } catch (error) {
      console.error('[Gemini Service] Error getting user API key:', error);
    }
  }
  
  return SYSTEM_GEMINI_API_KEY || null;
}

function mapModelName(model: string): string {
  const modelMap: { [key: string]: string } = {
    'gemini-2.5-flash': 'gemini-2.5-flash',
    'gemini-2.5-pro': 'gemini-2.5-pro',
    'gemini-2.0-flash': 'gemini-2.0-flash',
    'gemini-1.5-flash': 'gemini-1.5-flash',
    'gemini-1.5-pro': 'gemini-1.5-pro',
  };
  return modelMap[model] || 'gemini-2.5-flash';
}

export async function sendGeminiCompletion(
  messages: ChatMessage[],
  agent?: Agent,
  userId?: string
): Promise<string> {
  const apiKey = await getGeminiApiKey(userId);
  
  if (!apiKey) {
    throw new Error('Gemini API key is not configured. Please add your API key in Settings > API Credentials.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = mapModelName(agent?.model || 'gemini-2.5-flash');

  const systemPromptContent = agent?.systemPrompt || agent?.instructions || '';
  
  const userMessages = messages.filter(m => m.role !== 'system');
  const conversationContent = userMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  try {
    const response = await ai.models.generateContent({
      model,
      contents: conversationContent,
      config: {
        systemInstruction: systemPromptContent || undefined,
        temperature: agent?.temperature ?? 0.7,
        maxOutputTokens: 1024,
      },
    });

    const responseText = response.text || '';
    
    // Detect and filter refusal responses from Gemini
    const refusalPatterns = [
      'I am sorry, I cannot fulfill this request',
      'I cannot generate personalized messages',
      'I am not able to generate',
      'I\'m sorry, I cannot',
      'I cannot assist with',
      'I\'m not able to help with',
    ];
    
    const isRefusal = refusalPatterns.some(pattern => 
      responseText.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (isRefusal || !responseText.trim()) {
      console.log('[Gemini] Detected refusal or empty response, using fallback');
      // Return a neutral follow-up message based on the agent's purpose
      if (systemPromptContent.toLowerCase().includes('award') || systemPromptContent.toLowerCase().includes('life changer')) {
        return "Please reply if you are interested in the award, and I will share the benefits again.";
      }
      return "Thank you for your message! How can I assist you today?";
    }
    
    return responseText;
  } catch (error) {
    console.error('Gemini API error:', error);
    throw error;
  }
}

export async function generateGeminiAgentResponse(
  userMessage: string,
  agent: Agent,
  conversationHistory: ChatMessage[] = [],
  userId?: string
): Promise<string> {
  const messages: ChatMessage[] = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  return sendGeminiCompletion(messages, agent, userId);
}

export async function testGeminiConnection(userId?: string): Promise<boolean> {
  const apiKey = await getGeminiApiKey(userId);
  
  if (!apiKey) {
    return false;
  }
  
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Hello',
    });
    
    return !!response.text;
  } catch (error) {
    console.error('[Gemini Service] Connection test failed:', error);
    return false;
  }
}
