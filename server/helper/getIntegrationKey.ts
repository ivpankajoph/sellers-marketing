import { Integration } from "server/modules/storage/mongodb.adapter";


type IntegrationKey =
  | "OPENAI_API_KEY"
  | "GEMINI_API_KEY"
  | "FB_PAGE_ID"
  | "FB_PAGE_ACCESS_TOKEN"
  | "PHONE_NUMBER_ID"
  | "WHATSAPP_WEBHOOK_VERIFY_TOKEN"
  | "WABA_ID"
  | "SYSTEM_USER_TOKEN_META";

const ENCRYPTED_KEYS: IntegrationKey[] = [
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  "SYSTEM_USER_TOKEN_META",
];

export async function getIntegrationKey(
  userId: string,
  key: IntegrationKey
): Promise<string> {
  if (!userId) {
    throw new Error("userId is required");
  }

  const integration = await Integration.findOne({ userId });

  if (!integration) {
    throw new Error("Integrations not configured");
  }

  const value = (integration as any)[key];

  if (!value) {
    throw new Error(`${key} is not configured`);
  }



  return value;
}
