import fs from "fs";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

// Fix __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WABA_ID = process.env.WABA_ID;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "848441401690739"; // From your output
const TOKEN = process.env.SYSTEM_USER_TOKEN_META;
const API_VERSION = "v21.0"; // or v22.0

// Step 1: Upload public key to WABA
export async function uploadPublicKeyToWABA() {
  console.log("🔐 Step 1: Upload Public Key to WABA\n");
  
  try {
    const publicKey = fs.readFileSync(
      path.join(__dirname, "keys", "public.pem"),
      "utf-8"
    );

    console.log("📤 Uploading to WABA:", WABA_ID);
    
    const res = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${WABA_ID}/whatsapp_business_encryption`,
      {
        business_public_key: publicKey,
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Public Key Uploaded to WABA:", res.data);
    return res.data;
  } catch (err: any) {
    console.error("❌ WABA Upload Error:", {
      status: err.response?.status,
      message: err.response?.data?.error?.message,
      type: err.response?.data?.error?.type,
      code: err.response?.data?.error?.code,
    });
    throw err;
  }
}

// Step 2: Sign public key for Phone Number (REQUIRED for Flows)
export async function signPublicKeyForPhoneNumber() {
  console.log("\n🔐 Step 2: Sign Public Key for Phone Number\n");
  
  try {
    const publicKey = fs.readFileSync(
      path.join(__dirname, "keys", "public.pem"),
      "utf-8"
    );

    console.log("📤 Signing for Phone Number ID:", PHONE_NUMBER_ID);
    
    // Upload the public key to the phone number
    const res = await axios.post(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/whatsapp_business_encryption`,
      {
        business_public_key: publicKey, // Public key is required!
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Public Key Signed for Phone Number:", res.data);
    return res.data;
  } catch (err: any) {
    console.error("❌ Phone Number Signing Error:", {
      status: err.response?.status,
      message: err.response?.data?.error?.message,
      type: err.response?.data?.error?.type,
      code: err.response?.data?.error?.code,
    });
    throw err;
  }
}

// Step 3: Verify encryption is set up correctly
export async function verifyEncryption() {
  console.log("\n🔍 Step 3: Verify Encryption Setup\n");
  
  try {
    // Check Phone Number level (WABA level doesn't exist for Cloud API)
    const phoneRes = await axios.get(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/whatsapp_business_encryption`,
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
        },
      }
    );

    console.log("✅ Phone Number Encryption Status:");
    console.log("   Phone Number ID:", PHONE_NUMBER_ID);
    console.log("   Signature Status:", phoneRes.data.business_public_key_signature_status);
    console.log("   Key Preview:", phoneRes.data.business_public_key?.substring(0, 60) + "...");
    
    return phoneRes.data;
  } catch (err: any) {
    console.error("❌ Verification Error:", {
      status: err.response?.status,
      message: err.response?.data?.error?.message,
    });
    throw err;
  }
}

// Run complete setup
(async () => {
  console.log("=" .repeat(60));
  console.log("🚀 WhatsApp Flows Encryption Setup");
  console.log("=".repeat(60));
  console.log(`WABA ID: ${WABA_ID}`);
  console.log(`Phone Number ID: ${PHONE_NUMBER_ID}`);
  console.log("=".repeat(60) + "\n");

  try {
    // Skip Step 1 - WABA endpoint doesn't work, go directly to phone number
    console.log("ℹ️  Note: Uploading directly to Phone Number (WABA endpoint not supported)\n");

    // Step 2: Upload public key for phone number (this is the working method!)
    await signPublicKeyForPhoneNumber();

    // Wait a bit
    console.log("\n⏳ Waiting 2 seconds...\n");
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Verify everything
    await verifyEncryption();

    console.log("\n" + "=".repeat(60));
    console.log("✅ SUCCESS! Encryption is set up for WhatsApp Flows");
    console.log("=".repeat(60));
    console.log("\n📝 Next Steps:");
    console.log("1. Create your Flow JSON in WhatsApp Manager");
    console.log("2. Set up your endpoint to handle encrypted requests");
    console.log("3. Test your Flow with the Flow Builder");
    console.log("\n📚 Resources:");
    console.log("- Flow Builder: https://business.facebook.com/wa/manage/flows/");
    console.log("- Endpoint Example: https://github.com/WhatsApp/WhatsApp-Flows-Tools");
    
  } catch (error: any) {
    console.error("\n❌ Setup Failed:", error.message);
    process.exit(1);
  }
})();