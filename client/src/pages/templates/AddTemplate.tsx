import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  ExternalLink,
  Upload,
  Plus,
  Trash2,
  FileText,
  Image as ImageIcon,
  Video,
  Megaphone,
  Bell,
  KeyRound,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Info, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PhonePreview } from "@/components/ui/phone-preview";
import Swal from "sweetalert2";
import { getAuthHeaders } from "@/contexts/AuthContext";

type ButtonType = {
  id: string;
  type: "quick_reply" | "url" | "phone_number";
  text: string;
  url?: string;
  phone_number?: string;
};

type HeaderType = "none" | "text" | "image" | "video" | "document";
type CategoryValue = "marketing" | "utility" | "authentication";

type TemplateTypeOption = {
  value: string;
  label: string;
  description: string;
  goodFor: string;
};

type CategoryOption = {
  value: CategoryValue;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  hint?: string;
};

type RequestError = Error & {
  hint?: string;
  isUserSide?: boolean;
};

const USER_SIDE_ERROR_MARKERS = [
  "missing meta credentials",
  "meta app id",
  "access token",
  "configure credentials in settings",
  "waba id",
  "phone number id",
  "whatsapp token",
];

function buildRequestError(details: {
  message: string;
  hint?: string;
  isUserSide: boolean;
}) {
  const error = new Error(details.message) as RequestError;
  error.hint = details.hint;
  error.isUserSide = details.isUserSide;
  return error;
}

function resolveApiError(
  status: number,
  payload: unknown,
  fallbackMessage: string
) {
  const data =
    payload && typeof payload === "object"
      ? (payload as ApiErrorPayload)
      : ({} as ApiErrorPayload);
  const message = data.error || data.message || fallbackMessage;
  const hint = data.hint;
  const combined = `${message} ${hint || ""}`.toLowerCase();
  const hasUserMarker = USER_SIDE_ERROR_MARKERS.some((marker) =>
    combined.includes(marker)
  );

  return {
    message,
    hint,
    isUserSide: (status >= 400 && status < 500) || hasUserMarker || Boolean(hint),
  };
}

function getRequestErrorDetails(error: unknown) {
  const requestError = error as Partial<RequestError>;
  return {
    message:
      error instanceof Error ? error.message : "Something went wrong. Please try again.",
    hint: typeof requestError?.hint === "string" ? requestError.hint : undefined,
    isUserSide: requestError?.isUserSide === true,
  };
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    value: "marketing",
    label: "Marketing",
    description: "Promotions, offers, and campaign messaging.",
    icon: Megaphone,
  },
  {
    value: "utility",
    label: "Utility",
    description: "Service updates, reminders, and transaction alerts.",
    icon: Bell,
  },
  {
    value: "authentication",
    label: "Authentication",
    description: "Verification and one-time passcode notifications.",
    icon: KeyRound,
  },
];

const HEADER_OPTIONS: Array<{
  value: HeaderType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: "none", label: "None", icon: FileText },
  { value: "text", label: "Text", icon: FileText },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
  { value: "document", label: "Document", icon: FileText },
];

const LANGUAGE_OPTIONS = [
  { value: "en_US", label: "English (US)" },
  { value: "en_GB", label: "English (UK)" },
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es_ES", label: "Spanish" },
  { value: "pt_BR", label: "Portuguese (Brazil)" },
];

const TEMPLATE_TYPE_OPTIONS: Record<CategoryValue, TemplateTypeOption[]> = {
  marketing: [
    {
      value: "default",
      label: "Default",
      description:
        "Send messages with media and customized buttons to engage customers.",
      goodFor: "Welcome messages, promotions, coupons, and re-engagement.",
    },
    {
      value: "catalogue",
      label: "Catalogue",
      description: "Drive purchases by linking products from your catalogue.",
      goodFor: "Product discovery and quick buy journeys.",
    },
    {
      value: "flows",
      label: "Flows",
      description:
        "Capture preferences or lead data using guided flow experiences.",
      goodFor: "Lead forms, surveys, and appointment requests.",
    },
  ],
  utility: [
    {
      value: "default",
      label: "Default",
      description: "Share service updates and transactional notifications.",
      goodFor: "Order updates, reminders, and account notices.",
    },
    {
      value: "order_details",
      label: "Order Details",
      description:
        "Share structured order, payment, and fulfillment information.",
      goodFor: "Checkout confirmations and payment details.",
    },
    {
      value: "calling_permission",
      label: "Calling Permissions Request",
      description: "Ask customers for permission to receive a WhatsApp call.",
      goodFor: "Support callbacks and appointment confirmations.",
    },
  ],
  authentication: [
    {
      value: "one_time_password",
      label: "One-time Password",
      description: "Deliver verification codes for secure login and actions.",
      goodFor: "Login verification and account recovery.",
    },
  ],
};

function sanitizeTemplateName(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}

function sanitizeTemplateNameInput(input: string) {
  return input
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_+/g, "");
}

function getMediaValidationConfig(headerType: HeaderType) {
  if (headerType === "image") {
    return {
      maxSizeMb: 5,
      validMimes: ["image/jpeg", "image/png", "image/jpg"],
      validExtensions: [".png", ".jpg", ".jpeg"],
      accept: ".png,.jpg,.jpeg,image/png,image/jpeg",
      helper: "PNG/JPG up to 5MB",
    };
  }

  if (headerType === "video") {
    return {
      maxSizeMb: 16,
      validMimes: ["video/mp4", "video/quicktime", "video/3gpp"],
      validExtensions: [".mp4", ".mov", ".3gp"],
      accept: ".mp4,.mov,.3gp,video/mp4,video/quicktime,video/3gpp",
      helper: "MP4/MOV/3GP up to 16MB",
    };
  }

  if (headerType === "document") {
    return {
      maxSizeMb: 100,
      validMimes: [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain",
      ],
      validExtensions: [".pdf", ".doc", ".docx", ".txt"],
      accept:
        ".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
      helper: "PDF/DOC/DOCX/TXT up to 100MB",
    };
  }

  return null;
}

export default function AddTemplate() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryValue | "">("");
  const [templateType, setTemplateType] = useState("");
  const [language, setLanguage] = useState("en_US");
  const [headerType, setHeaderType] = useState<HeaderType>("none");
  const [headerText, setHeaderText] = useState("");
  const [headerMediaPreview, setHeaderMediaPreview] = useState("");
  const [headerMediaName, setHeaderMediaName] = useState("");
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [body, setBody] = useState("");
  const [footer, setFooter] = useState("");
  const [buttons, setButtons] = useState<ButtonType[]>([]);
  const [autoSubmitAfterCreate, setAutoSubmitAfterCreate] = useState(true);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const [headerMediaHandle, setHeaderMediaHandle] = useState<string | null>(
    null
  );
  const mediaConfig = getMediaValidationConfig(headerType);
  const currentTypeOptions = category
    ? TEMPLATE_TYPE_OPTIONS[category as CategoryValue]
    : [];
  const selectedTypeOption = currentTypeOptions.find(
    (option) => option.value === templateType
  );
  const isAuthTemplate = templateType === "one_time_password";
  const detectedVariables = useMemo(
    () => Array.from(new Set(body.match(/\{\{[^}]+\}\}/g) || [])),
    [body]
  );

  const showUserSideErrorPopup = (message: string, hint?: string) => {
    const popupText = hint ? `${message}\n\n${hint}` : message;
    void Swal.fire({
      icon: "error",
      title: "Action Required",
      text: popupText,
      confirmButtonText: "OK",
    });
  };

  const revokeObjectUrlIfNeeded = (url?: string | null) => {
    if (url && url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  };

  const clearMedia = () => {
    setHeaderMediaHandle(null);
    setHeaderMediaPreview((previous) => {
      revokeObjectUrlIfNeeded(previous);
      return "";
    });
    setHeaderMediaName("");
    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }
  };

  useEffect(() => {
    return () => {
      revokeObjectUrlIfNeeded(headerMediaPreview);
    };
  }, [headerMediaPreview]);

  useEffect(() => {
    if (!isAuthTemplate) {
      return;
    }

    if (headerType === "image" || headerType === "video" || headerType === "document") {
      setHeaderType("none");
      clearMedia();
    }

    if (buttons.length > 0) {
      setButtons([]);
    }
  }, [isAuthTemplate, headerType, buttons.length]);

  const uploadMedia = async (file: File) => {
    if (!mediaConfig) return;

    if (file.size > mediaConfig.maxSizeMb * 1024 * 1024) {
      toast.error(`File must be under ${mediaConfig.maxSizeMb}MB`);
      return;
    }

    const lowerName = file.name.toLowerCase();
    const hasValidExtension = mediaConfig.validExtensions.some((ext) =>
      lowerName.endsWith(ext)
    );
    const hasValidMime =
      !file.type || mediaConfig.validMimes.includes(file.type.toLowerCase());

    if (!hasValidExtension && !hasValidMime) {
      toast.error("Invalid file type for selected header media.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setIsUploadingMedia(true);
      let res = await fetch("/api/upload/template-media", {
        method: "POST",
        headers: getAuthHeaders(),
        body: formData,
      });

      // Backward compatibility for older backend route.
      if (res.status === 404) {
        res = await fetch("/api/upload/template-header", {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const details = resolveApiError(res.status, data, "Media upload failed");
        throw buildRequestError(details);
      }

      const shouldUseVisualPreview =
        headerType === "image" || headerType === "video";
      const fallbackPreviewUrl = shouldUseVisualPreview
        ? URL.createObjectURL(file)
        : "";
      const resolvedPreviewUrl = data.previewUrl || fallbackPreviewUrl || "";

      setHeaderMediaPreview((previous) => {
        if (previous !== resolvedPreviewUrl) {
          revokeObjectUrlIfNeeded(previous);
        }
        return resolvedPreviewUrl;
      });
      setHeaderMediaHandle(data.handle || null);
      setHeaderMediaName(file.name);
      toast.success("Media uploaded successfully");
    } catch (error: unknown) {
      const { message, hint, isUserSide } = getRequestErrorDetails(error);
      console.error("[Template Media Upload Failed]", error);
      if (isUserSide) {
        showUserSideErrorPopup(message, hint);
        return;
      }
      toast.error(message || "Media upload failed");
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const addNewButton = () => {
    if (isAuthTemplate) {
      toast.error("Buttons are not available for authentication templates");
      return;
    }
    if (buttons.length >= 3) {
      toast.error("You can add up to 3 buttons only");
      return;
    }
    setButtons([
      ...buttons,
      { id: Date.now().toString(), type: "quick_reply", text: "" },
    ]);
  };

  const updateButton = (id: string, field: keyof ButtonType, value: string) => {
    setButtons(
      buttons.map((btn) => (btn.id === id ? { ...btn, [field]: value } : btn))
    );
  };

  const removeButton = (id: string) => {
    setButtons(buttons.filter((btn) => btn.id !== id));
  };

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        const details = resolveApiError(
          res.status,
          error,
          "Failed to create template"
        );
        throw buildRequestError(details);
      }
      return res.json();
    },
    onSuccess: async (template) => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });

      if (autoSubmitAfterCreate && template?.id) {
        try {
          const submitRes = await fetch(
            `/api/templates/${template.id}/submit-approval`,
            {
              method: "POST",
              headers: getAuthHeaders(),
            }
          );
          const submitData = await submitRes.json().catch(() => ({}));
          if (!submitRes.ok) {
            throw new Error(
              submitData.error || "Template created but submit failed"
            );
          }
          toast.success("Template created and submitted to Meta for review!");
        } catch (error: any) {
          toast.warning(
            error.message ||
              "Template created but failed to auto-submit for approval."
          );
        }
      } else {
        toast.success("Template created successfully!");
      }
      setLocation("/templates/manage");
    },
    onError: (error: unknown) => {
      const { message, hint, isUserSide } = getRequestErrorDetails(error);
      if (isUserSide) {
        showUserSideErrorPopup(message, hint);
        return;
      }
      toast.error(message);
    },
  });

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error("Please enter a template name");
      return;
    }
    if (!category) {
      toast.error("Please select a category");
      return;
    }
    if (!templateType) {
      toast.error("Please select a template type");
      return;
    }
    if (!body.trim()) {
      toast.error("Please enter body text");
      return;
    }
    if (body.length > 1000) {
      toast.error("Body text must be 1000 characters or fewer");
      return;
    }

    if (headerType === "text" && !headerText.trim()) {
      toast.error("Please enter header text");
      return;
    }

    if (
      (headerType === "image" ||
        headerType === "video" ||
        headerType === "document") &&
      !headerMediaHandle
    ) {
      toast.error("Please upload header media");
      return;
    }

    const templateName = sanitizeTemplateName(name);

    // Validate and prepare buttons
    const validButtons = buttons
      .filter((btn) => btn.text.trim())
      .map((btn) => ({
        type: btn.type,
        text: btn.text.trim(),
        ...(btn.type === "url" && {
          url: btn.url?.trim() || "",
        }),
        ...(btn.type === "phone_number" && {
          phone_number: btn.phone_number?.trim() || "",
        }),
      }));

    const invalidUrlButton = validButtons.find(
      (button: any) =>
        button.type === "url" &&
        (!button.url || !/^https?:\/\//i.test(button.url))
    );
    if (invalidUrlButton) {
      toast.error("URL buttons must start with http:// or https://");
      return;
    }

    if (isAuthTemplate && validButtons.length > 0) {
      toast.error("Authentication templates cannot include custom buttons");
      return;
    }

    const persistentPreviewUrl =
      headerMediaPreview && /^https?:\/\//i.test(headerMediaPreview)
        ? headerMediaPreview
        : null;

    createTemplateMutation.mutate({
      name: templateName,
      category,
      templateType,
      language,
      headerType: headerType === "none" ? null : headerType,
      headerText: headerType === "text" ? headerText.trim() : null,
      headerMedia:
        headerType === "image" ||
        headerType === "video" ||
        headerType === "document"
          ? headerMediaHandle
          : null,
      headerImage:
        headerType === "image" ||
        headerType === "video" ||
        headerType === "document"
          ? headerMediaHandle
          : null,
      previewUrl:
        headerType === "image" ||
        headerType === "video" ||
        headerType === "document"
          ? persistentPreviewUrl
          : null,

      content: body,
      footer: footer || null,
      buttons: validButtons.length > 0 ? validButtons : undefined,
      status: "pending",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="rounded-xl border bg-gradient-to-r from-slate-50 to-white p-5">
          <h2 className="text-2xl font-bold tracking-tight">Create Template</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Use the same flow as Meta template manager: setup, compose, and submit
            for approval.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Step 1
              </p>
              <p className="text-sm font-medium text-slate-900">Set up template</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Step 2
              </p>
              <p className="text-sm font-medium text-slate-900">Edit template</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Step 3
              </p>
              <p className="text-sm font-medium text-slate-900">Submit for review</p>
            </div>
          </div>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Meta Template Guidelines</AlertTitle>
          <AlertDescription>
            Keep content relevant to selected category, avoid spam, and use
            placeholders clearly.
            <a
              href="https://developers.facebook.com/docs/whatsapp/message-templates/guidelines"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 ml-2 text-blue-600 hover:underline"
            >
              View Full Guidelines <ExternalLink className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>

        <div>
          <p className="text-muted-foreground">
            Create a WhatsApp message template for approval
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Template Details</CardTitle>
                <CardDescription>
                  Fill in the details for your new template
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Template Name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., welcome_message_v2"
                    value={name}
                    onChange={(e) =>
                      setName(sanitizeTemplateNameInput(e.target.value))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Use lowercase letters, numbers, and underscores only
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Category *</Label>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {CATEGORY_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const selected = category === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setCategory(option.value);
                            const defaultType =
                              TEMPLATE_TYPE_OPTIONS[option.value][0]?.value || "";
                            setTemplateType(defaultType);
                          }}
                          className={`rounded-md border p-3 text-left transition ${
                            selected
                              ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                              : "border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-slate-700" />
                            <p className="font-medium text-slate-900">{option.label}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            {option.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Template Type *</Label>
                  {!category && (
                    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
                      Select a category first to see available template types.
                    </div>
                  )}
                  {category && (
                    <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2">
                      {currentTypeOptions.map((option) => {
                        const selected = templateType === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setTemplateType(option.value)}
                            className={`w-full rounded-md border px-3 py-2 text-left transition ${
                              selected
                                ? "border-blue-500 bg-blue-50"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-slate-900">{option.label}</p>
                              {selected && (
                                <CheckCircle2 className="h-4 w-4 text-blue-600" />
                              )}
                            </div>
                            <p className="mt-1 text-xs text-slate-600">
                              {option.description}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {selectedTypeOption && (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-slate-700">Good for:</span>{" "}
                      {selectedTypeOption.goodFor}
                    </p>
                  )}
                  {isAuthTemplate && (
                    <p className="text-xs text-amber-700">
                      Authentication templates use strict Meta rules. Media headers
                      and custom buttons are disabled in this mode.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Language</Label>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {LANGUAGE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Header (Optional)</Label>
                  <div className="grid gap-2 sm:grid-cols-5">
                    {HEADER_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      const selected = headerType === option.value;
                      const isDisabled =
                        isAuthTemplate &&
                        (option.value === "image" ||
                          option.value === "video" ||
                          option.value === "document");
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            if (isDisabled) {
                              return;
                            }
                            setHeaderType(option.value);
                            if (option.value === "none" || option.value === "text") {
                              clearMedia();
                            }
                          }}
                          disabled={isDisabled}
                          className={`rounded-md border px-3 py-2 text-sm transition ${
                            selected
                              ? "border-blue-500 bg-blue-50 text-blue-700"
                              : "border-slate-200 text-slate-700 hover:bg-slate-50"
                          } ${isDisabled ? "cursor-not-allowed opacity-50" : ""}
                          `}
                        >
                          <span className="inline-flex items-center gap-1.5">
                            <Icon className="h-4 w-4" />
                            {option.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {headerType === "text" && (
                  <div className="grid gap-2">
                    <Label>Header Text</Label>
                    <Input
                      placeholder="Enter header text"
                      value={headerText}
                      onChange={(e) => setHeaderText(e.target.value)}
                    />
                  </div>
                )}

                {(headerType === "image" ||
                  headerType === "video" ||
                  headerType === "document") &&
                  mediaConfig && (
                  <div className="grid gap-2">
                    <div className="flex items-center justify-between">
                      <Label>Header Media</Label>
                      <span className="text-xs text-muted-foreground">
                        {mediaConfig.helper}
                      </span>
                    </div>
                    <input
                      id="template-header-media-input"
                      type="file"
                      ref={mediaInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          void uploadMedia(file);
                        }
                        // Allow selecting same file again after validation/upload errors.
                        e.currentTarget.value = "";
                      }}
                      accept={mediaConfig.accept}
                      className="hidden"
                    />
                    {headerMediaHandle ? (
                      <div className="space-y-2">
                        {headerType === "image" && headerMediaPreview ? (
                          <img
                            src={headerMediaPreview}
                            alt="Header preview"
                            className="w-full h-40 object-cover rounded-lg border"
                          />
                        ) : null}
                        {headerType === "video" && headerMediaPreview ? (
                          <video
                            src={headerMediaPreview}
                            controls
                            className="w-full h-48 rounded-lg border bg-black object-contain"
                          />
                        ) : null}
                        {headerType === "document" ? (
                          <div className="rounded-lg border bg-slate-50 p-4">
                            <p className="text-sm font-medium text-slate-900">
                              {headerMediaName || "Document uploaded"}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              Document is linked to template header for Meta review.
                            </p>
                          </div>
                        ) : null}
                        {(headerType === "image" || headerType === "video") &&
                        !headerMediaPreview ? (
                          <div className="rounded-lg border bg-slate-50 p-4">
                            <p className="text-sm font-medium text-slate-900">
                              {headerType === "image" ? "Image" : "Video"} uploaded
                            </p>
                            <p className="mt-1 text-xs text-slate-600">
                              Preview is unavailable, but media is attached for Meta
                              review.
                            </p>
                            {headerMediaName ? (
                              <p className="mt-2 text-xs text-slate-500">
                                File: {headerMediaName}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              if (mediaInputRef.current) {
                                mediaInputRef.current.value = "";
                                mediaInputRef.current.click();
                              }
                            }}
                          >
                            Change Media
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={clearMedia}
                          >
                            Remove Media
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label
                        htmlFor="template-header-media-input"
                        onClick={() => {
                          if (mediaInputRef.current) {
                            mediaInputRef.current.value = "";
                          }
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const file = e.dataTransfer.files?.[0];
                          if (file) void uploadMedia(file);
                        }}
                        className="block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
                      >
                        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm font-medium text-muted-foreground">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {mediaConfig.helper}
                        </p>
                      </label>
                    )}
                    {isUploadingMedia && (
                      <div className="inline-flex items-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading media...
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="body">Body Text *</Label>
                    <span
                      className={`text-xs ${body.length >= 1000
                        ? "text-red-600 font-medium"
                        : "text-muted-foreground"
                        }`}
                    >
                      {body.length}/1000
                    </span>
                  </div>
                  <Textarea
                    id="body"
                    placeholder="Enter your message here. Use {{1}}, {{2}} for variables."
                    className="min-h-[120px]"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    maxLength={1000}
                  />
                  {body.length >= 1000 && (
                    <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Maximum 1000 characters reached
                    </p>
                  )}
                  {detectedVariables.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {detectedVariables.map((token) => (
                        <span
                          key={token}
                          className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                        >
                          {token}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Use {"{{1}}"}, {"{{2}}"} etc. for dynamic variables. Keep
                    under 1000 characters.
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label>Footer (Optional)</Label>
                  <Input
                    placeholder="e.g., Reply STOP to unsubscribe"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                  />
                </div>

                {/* Buttons Section */}
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label>Buttons (Max 3)</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addNewButton}
                      disabled={buttons.length >= 3 || isAuthTemplate}
                    >
                      <Plus className="h-4 w-4 mr-1" /> Add Button
                    </Button>
                  </div>

                  {buttons.map((btn, idx) => (
                    <div
                      key={btn.id}
                      className="grid grid-cols-12 gap-2 items-end"
                    >
                      <div className="col-span-4">
                        <Select
                          value={btn.type}
                          onValueChange={(val) =>
                            updateButton(btn.id, "type", val as any)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="quick_reply">
                              Quick Reply
                            </SelectItem>
                            <SelectItem value="url">URL</SelectItem>
                            <SelectItem value="phone_number">
                              Phone Number
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-6">
                        <Input
                          placeholder="Button text (max 30 chars)"
                          value={btn.text}
                          onChange={(e) =>
                            updateButton(btn.id, "text", e.target.value)
                          }
                          maxLength={30}
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeButton(btn.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>

                      {btn.type === "url" && (
                        <div className="col-span-12 mt-1">
                          <Input
                            placeholder="URL (use {{1}} for variable)"
                            value={btn.url || ""}
                            onChange={(e) =>
                              updateButton(btn.id, "url", e.target.value)
                            }
                          />
                        </div>
                      )}
                      {btn.type === "phone_number" && (
                        <div className="col-span-12 mt-1">
                          <Input
                            placeholder="Phone number (e.g., +911234567890)"
                            value={btn.phone_number || ""}
                            onChange={(e) =>
                              updateButton(
                                btn.id,
                                "phone_number",
                                e.target.value
                              )
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {buttons.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      {isAuthTemplate
                        ? "Authentication templates currently use body content only in this builder."
                        : "Add up to 3 buttons (Quick Reply, URL, or Phone Number)"}
                    </p>
                  )}
                </div>

                <div className="rounded-md border bg-slate-50 p-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={autoSubmitAfterCreate}
                      onChange={(e) => setAutoSubmitAfterCreate(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    Automatically submit to Meta for review after creating
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setLocation("/templates/manage")}
                    disabled={createTemplateMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="w-full"
                    onClick={handleSubmit}
                    disabled={createTemplateMutation.isPending || isUploadingMedia}
                  >
                    {createTemplateMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Template"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phone Preview</CardTitle>
                <CardDescription>
                  See how your template will look on WhatsApp
                </CardDescription>
                {selectedTypeOption && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-slate-700">Template type:</span>{" "}
                    {selectedTypeOption.label}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <PhonePreview
                  headerType={headerType === "none" ? undefined : headerType}
                  headerText={headerText}
                  headerImage={headerMediaPreview}
                  headerMediaName={headerMediaName}
                  body={body}
                  footer={footer}
                  buttons={buttons.filter((btn) => btn.text.trim())}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

