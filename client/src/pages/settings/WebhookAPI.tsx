import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function IntegrationsForm() {
  const [form, setForm] = useState({
    OPENAI_API_KEY: "",
    GEMINI_API_KEY: "",
    FB_PAGE_ID: "",
    PHONE_NUMBER_ID: "",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "",
    WABA_ID: "",
    SYSTEM_USER_TOKEN_META: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const userDataString = localStorage.getItem("whatsapp_auth_user");
    if (!userDataString) {
      alert("User not logged in");
      return;
    }

    const userData = JSON.parse(userDataString);

    // Extract only the 'id' field
    const userId = userData.id;

    console.log("Submitting form for user ID:", userId);

    if (!userId) {
      alert("User not logged in");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/integrations/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId, ...form }),
      });

      if (res.ok) {
        alert("Keys saved securely!");
        setForm({
          OPENAI_API_KEY: "",
          GEMINI_API_KEY: "",
          FB_PAGE_ID: "",
          PHONE_NUMBER_ID: "",
          WHATSAPP_WEBHOOK_VERIFY_TOKEN: "",
          WABA_ID: "",
          SYSTEM_USER_TOKEN_META: "",
        });
      } else {
        const error = await res.text();
        console.error("Save failed:", error);
        alert("Failed to save keys. Please try again.");
      }
    } catch (err) {
      console.error("Network error:", err);
      alert("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  // Field metadata for labels and helper text
  const fieldInfo: Record<
    keyof typeof form,
    { label: string; helper: string }
  > = {
    OPENAI_API_KEY: {
      label: "OpenAI API Key",
      helper:
        "Used for AI-powered responses. Get it from your OpenAI dashboard.",
    },
    GEMINI_API_KEY: {
      label: "Gemini API Key",
      helper: "Alternative AI provider. Obtain from Google AI Studio.",
    },
    FB_PAGE_ID: {
      label: "Facebook Page ID",
      helper: "ID of your Facebook Page linked to WhatsApp Business.",
    },
    PHONE_NUMBER_ID: {
      label: "WhatsApp Phone Number ID",
      helper: "Unique ID for your WhatsApp Business number in Meta.",
    },
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: {
      label: "Webhook Verify Token",
      helper:
        "Token to verify webhook requests from WhatsApp. Must match your server.",
    },
    WABA_ID: {
      label: "WhatsApp Business Account ID (WABA ID)",
      helper: "Found in Meta Business Suite under WhatsApp accounts.",
    },
    SYSTEM_USER_TOKEN_META: {
      label: "Meta System User Token",
      helper:
        "Permanent access token for your Meta app. Generate in Business Settings.",
    },
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
            Integration Keys
          </h1>
          <p className="mt-2 text-gray-600">
            Securely connect your AI and WhatsApp Business accounts.
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5 sm:p-6">
          <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <h2 className="font-semibold text-blue-800 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-2"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              Security Notice
            </h2>
            <p className="mt-1 text-sm text-blue-700">
              All keys are encrypted and stored securely. We never log or expose
              your credentials.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(form).map(([key]) => {
                const info = fieldInfo[key as keyof typeof form];
                return (
                  <div key={key} className="flex flex-col">
                    <label
                      htmlFor={key}
                      className="block text-sm font-medium text-gray-700 mb-1"
                    >
                      {info.label}
                    </label>
                    <input
                      id={key}
                      name={key}
                      type="password"
                      value={form[key as keyof typeof form]}
                      onChange={handleChange}
                      disabled={loading}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      placeholder={`Enter your ${info.label}`}
                    />
                    <p className="mt-1 text-xs text-gray-500">{info.helper}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-center">
              <button
                type="submit"
                disabled={loading}
                className={`px-6 py-3 rounded-lg font-medium text-white ${
                  loading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                } transition duration-200 ease-in-out`}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Save Integration Keys"
                )}
              </button>
            </div>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Need help? Refer to our setup guide or contact support.</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
