import { useCallback, useEffect, useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getAuthHeaders } from "@/contexts/AuthContext";

type IntegrationStatus = {
  hasWhatsApp: boolean;
  hasOpenAI: boolean;
  hasGemini: boolean;
  hasFacebook: boolean;
  isVerified: boolean;
};

const DEFAULT_STATUS: IntegrationStatus = {
  hasWhatsApp: false,
  hasOpenAI: false,
  hasGemini: false,
  hasFacebook: false,
  isVerified: false,
};

export default function IntegrationsForm() {
  const [form, setForm] = useState({
    OPENAI_API_KEY: "",
    GEMINI_API_KEY: "",
    FB_PAGE_ID: "",
    FB_PAGE_ACCESS_TOKEN: "",
    META_APP_ID: "",
    PHONE_NUMBER_ID: "",
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: "",
    WABA_ID: "",
    SYSTEM_USER_TOKEN_META: "",
  });

  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(
    Object.keys(form).reduce((acc, key) => ({ ...acc, [key]: false }), {})
  );

  const [status, setStatus] = useState<IntegrationStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);

    try {
      const res = await fetch("/api/credentials", {
        headers: getAuthHeaders(),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `Failed to load status (${res.status})`);
      }

      const data = await res.json();
      setStatus({ ...DEFAULT_STATUS, ...(data?.status || {}) });
    } catch (err) {
      console.error("Failed to fetch status:", err);
      setStatus(DEFAULT_STATUS);
      setStatusError("Failed to load integration status.");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleVisibility = (field: string) => {
    setVisibleFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setSubmitMessage(null);
    setSubmitError(null);

    const payload = {
      openaiApiKey: form.OPENAI_API_KEY.trim() || undefined,
      geminiApiKey: form.GEMINI_API_KEY.trim() || undefined,
      facebookPageId: form.FB_PAGE_ID.trim() || undefined,
      facebookAccessToken: form.FB_PAGE_ACCESS_TOKEN.trim() || undefined,
      appId: form.META_APP_ID.trim() || undefined,
      phoneNumberId: form.PHONE_NUMBER_ID.trim() || undefined,
      webhookVerifyToken: form.WHATSAPP_WEBHOOK_VERIFY_TOKEN.trim() || undefined,
      businessAccountId: form.WABA_ID.trim() || undefined,
      whatsappToken: form.SYSTEM_USER_TOKEN_META.trim() || undefined,
    };

    const hasAtLeastOneField = Object.values(payload).some(Boolean);
    if (!hasAtLeastOneField) {
      setSubmitError("Please enter at least one key before saving.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/credentials", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSubmitMessage("Keys saved securely.");
        setForm({
          OPENAI_API_KEY: "",
          GEMINI_API_KEY: "",
          FB_PAGE_ID: "",
          FB_PAGE_ACCESS_TOKEN: "",
          META_APP_ID: "",
          PHONE_NUMBER_ID: "",
          WHATSAPP_WEBHOOK_VERIFY_TOKEN: "",
          WABA_ID: "",
          SYSTEM_USER_TOKEN_META: "",
        });
        await loadStatus();
      } else {
        const errorText = await res.text();
        console.error("Save failed:", errorText);
        setSubmitError("Failed to save keys. Please try again.");
      }
    } catch (err) {
      console.error("Network error:", err);
      setSubmitError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const fieldInfo: Record<
    keyof typeof form,
    { label: string; helper: string; group: "AI" | "WHATSAPP" }
  > = {
    OPENAI_API_KEY: {
      label: "OpenAI API Key",
      helper:
        "Used for AI-powered responses. Get it from your OpenAI dashboard.",
      group: "AI",
    },
    GEMINI_API_KEY: {
      label: "Gemini API Key",
      helper: "Alternative AI provider. Obtain from Google AI Studio.",
      group: "AI",
    },
    FB_PAGE_ID: {
      label: "Facebook Page ID",
      helper: "ID of your Facebook Page linked to WhatsApp Business.",
      group: "WHATSAPP",
    },
    FB_PAGE_ACCESS_TOKEN: {
      label: "Facebook Page Access Token",
      helper:
        "Permanent access token for your Facebook Page. Generate in Business Settings.",
      group: "WHATSAPP",
    },
    META_APP_ID: {
      label: "Meta App ID",
      helper:
        "Required for media upload to WhatsApp templates. Find it in Meta App Dashboard.",
      group: "WHATSAPP",
    },
    PHONE_NUMBER_ID: {
      label: "WhatsApp Phone Number ID",
      helper: "Unique ID for your WhatsApp Business number in Meta.",
      group: "WHATSAPP",
    },
    WHATSAPP_WEBHOOK_VERIFY_TOKEN: {
      label: "Webhook Verify Token",
      helper:
        "Token to verify webhook requests from WhatsApp. Must match your server.",
      group: "WHATSAPP",
    },
    WABA_ID: {
      label: "WhatsApp Business Account ID (WABA ID)",
      helper: "Found in Meta Business Suite under WhatsApp accounts.",
      group: "WHATSAPP",
    },
    SYSTEM_USER_TOKEN_META: {
      label: "Meta System User Token",
      helper:
        "Permanent access token for your Meta app. Generate in Business Settings.",
      group: "WHATSAPP",
    },
  };

  const renderField = (key: keyof typeof form) => {
    const info = fieldInfo[key];
    const isVisible = visibleFields[key];
    return (
      <div key={key} className="flex flex-col">
        <label
          htmlFor={key}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {info.label}
        </label>
        <div className="relative">
          <input
            id={key}
            name={key}
            type={isVisible ? "text" : "password"}
            value={form[key]}
            onChange={handleChange}
            disabled={loading}
            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition"
            placeholder={`Enter your ${info.label}`}
          />
          <button
            type="button"
            onClick={() => toggleVisibility(key)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
            aria-label={isVisible ? "Hide" : "Show"}
          >
            {isVisible ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 14.122l4.242-4.242m0 0L12 12m0 0l2.121-2.121M12 12l-2.121 2.121"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">{info.helper}</p>
      </div>
    );
  };

  const aiFields = Object.keys(form).filter(
    (key) => fieldInfo[key as keyof typeof fieldInfo].group === "AI"
  );
  const whatsappFields = Object.keys(form).filter(
    (key) => fieldInfo[key as keyof typeof fieldInfo].group === "WHATSAPP"
  );
  const statusItems = [
    { key: "hasOpenAI", label: "OpenAI API Key", value: status.hasOpenAI },
    { key: "hasGemini", label: "Gemini API Key", value: status.hasGemini },
    {
      key: "hasFacebook",
      label: "Facebook Integration",
      value: status.hasFacebook,
    },
    {
      key: "hasWhatsApp",
      label: "WhatsApp Integration",
      value: status.hasWhatsApp,
    },
    {
      key: "isVerified",
      label: "Connection Verified",
      value: status.isVerified,
    },
  ];

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

        {/* Status Section */}
        <div className="mb-8 bg-gray-50 rounded-xl p-5 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Integration Status
          </h2>
          {statusLoading ? (
            <p className="text-gray-500">Loading status...</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {statusItems.map(({ key, label, value }) => (
                <div key={key} className="flex items-center text-sm">
                  <span
                    className={`mr-2 h-2 w-2 rounded-full ${
                      value ? "bg-green-500" : "bg-red-500"
                    }`}
                  ></span>
                  <span className="text-gray-700">
                    {label}:{" "}
                    <span
                      className={
                        value
                          ? "text-green-600 font-medium"
                          : "text-red-600 font-medium"
                      }
                    >
                      {value ? "Configured" : "Missing"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {statusError && (
            <p className="mt-3 text-sm text-red-600">{statusError}</p>
          )}
        </div>

        {/* Security Notice */}
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

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
          <form onSubmit={handleSubmit}>
            {submitMessage && (
              <div className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                {submitMessage}
              </div>
            )}
            {submitError && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {submitError}
              </div>
            )}

            {/* AI Section */}
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-800 mb-4 pb-2 border-b border-gray-200">
                AI Providers
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {aiFields.map((key) => renderField(key as keyof typeof form))}
              </div>
            </div>

            {/* WhatsApp Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4 pb-2 border-b border-gray-200">
                WhatsApp Business
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {whatsappFields.map((key) =>
                  renderField(key as keyof typeof form)
                )}
              </div>
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
