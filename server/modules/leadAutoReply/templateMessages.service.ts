export interface TemplateConfig {
  name: string;
  languageCode: string;
  components?: TemplateComponent[];
}

export interface TemplateComponent {
  type: "header" | "body" | "button";
  parameters?: TemplateParameter[];
  sub_type?: string;
  index?: string;
}

export interface TemplateParameter {
  type: "text" | "currency" | "date_time" | "image" | "video" | "document";
  text?: string;
  parameter_name?: string; // For named parameters like {{name}}
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  video?: { link: string };
  document?: { link: string; filename: string };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidTemplateParameter(
  param: TemplateParameter | null | undefined
): boolean {
  if (!param || typeof param !== "object") return false;

  const type = String(param.type || "").toLowerCase();

  if (!type) {
    // Backward compatibility for legacy payloads that omitted type.
    return isNonEmptyString(param.text);
  }

  switch (type) {
    case "text":
      return isNonEmptyString(param.text);
    case "image":
      return isNonEmptyString(param.image?.link);
    case "video":
      return isNonEmptyString(param.video?.link);
    case "document":
      return isNonEmptyString(param.document?.link);
    case "currency": {
      const amount = param.currency?.amount_1000;
      return (
        isNonEmptyString(param.currency?.fallback_value) &&
        isNonEmptyString(param.currency?.code) &&
        typeof amount === "number" &&
        Number.isFinite(amount)
      );
    }
    case "date_time":
      return isNonEmptyString(param.date_time?.fallback_value);
    default:
      // Unknown types should be validated by Meta API, not blocked locally.
      return true;
  }
}

function getWhatsAppCredentials(): {
  token: string;
  phoneNumberId: string;
} | null {
  const token = process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    return null;
  }

  return { token, phoneNumberId };
}

// export async function sendTemplateMessage(
//   to: string,
//   template: TemplateConfig
// ): Promise<{ success: boolean; error?: string; messageId?: string }> {
//   console.log("[TemplateMessage] ===== START =====");
//   console.log("[TemplateMessage] To:", to);
//   console.log(
//     "[TemplateMessage] Raw template config:",
//     JSON.stringify(template, null, 2)
//   );

//   const credentials = getWhatsAppCredentials();

//   if (!credentials) {
//     console.error("[TemplateMessage] WhatsApp credentials not configured");
//     return { success: false, error: "WhatsApp credentials not configured" };
//   }

//   console.log(
//     "[TemplateMessage] Using phoneNumberId:",
//     credentials.phoneNumberId
//   );
//   console.log("[TemplateMessage] Token present:", Boolean(credentials.token));

//   // Meta requires lowercase + underscores
//   const metaTemplateName = template.name.toLowerCase().replace(/\s+/g, "_");

//   console.log(
//     `[TemplateMessage] Normalized template name: "${metaTemplateName}"`
//   );

//   const languageCodesToTry = [
//     template.languageCode,
//     "en",
//     "en_US",
//     "en_GB",
//   ].filter(Boolean);

//   const uniqueLanguages = Array.from(new Set(languageCodesToTry));

//   console.log("[TemplateMessage] Language fallback order:", uniqueLanguages);

//   for (const langCode of uniqueLanguages) {
//     console.log("--------------------------------------------");
//     console.log(`[TemplateMessage] Attempting language: ${langCode}`);

//     const messagePayload: any = {
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to,
//       type: "template",
//       template: {
//         name: metaTemplateName,
//         language: {
//           code: langCode,
//         },
//       },
//     };

//     if (template.components?.length) {
//       messagePayload.template.components = template.components;
//     }

//     console.log(
//       "[TemplateMessage] Payload:",
//       JSON.stringify(messagePayload, null, 2)
//     );

//     try {
//       const response = await fetch(
//         `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
//         {
//           method: "POST",
//           headers: {
//             Authorization: `Bearer ${credentials.token}`,
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(messagePayload),
//         }
//       );

//       const responseText = await response.text();
//       let data: any;

//       try {
//         data = JSON.parse(responseText);
//       } catch {
//         data = responseText;
//       }

//       console.log("[TemplateMessage] HTTP Status:", response.status);
//       console.log("[TemplateMessage] Response Headers:", {
//         "x-fb-request-id": response.headers.get("x-fb-request-id"),
//         "x-fb-trace-id": response.headers.get("x-fb-trace-id"),
//       });

//       console.log(
//         "[TemplateMessage] Response Body:",
//         JSON.stringify(data, null, 2)
//       );

//       if (response.ok && data?.messages?.[0]?.id) {
//         console.log(
//           `[TemplateMessage] ✅ Success | Message ID: ${data.messages[0].id}`
//         );
//         console.log("[TemplateMessage] ===== END =====");
//         return {
//           success: true,
//           messageId: data.messages[0].id,
//         };
//       }

//       const errorMsg = data?.error?.message || "Unknown Meta error";
//       const errorCode = data?.error?.code;
//       const errorSubcode = data?.error?.error_subcode;

//       console.error("[TemplateMessage] ❌ Meta Error");
//       console.error("Message:", errorMsg);
//       console.error("Code:", errorCode);
//       console.error("Subcode:", errorSubcode);
//       console.error(
//         "FB Request ID:",
//         data?.error?.fbtrace_id || response.headers.get("x-fb-request-id")
//       );

//       // Retryable: template not found / language mismatch
//       if (
//         errorCode === 132001 ||
//         errorMsg.toLowerCase().includes("does not exist") ||
//         errorMsg.toLowerCase().includes("language")
//       ) {
//         console.log(
//           `[TemplateMessage] Retrying with next language (failed: ${langCode})`
//         );
//         continue;
//       }

//       // Non-retryable error
//       console.log("[TemplateMessage] ===== END =====");
//       return { success: false, error: errorMsg };
//     } catch (error) {
//       console.error("[TemplateMessage] ❌ Fetch Exception:", error);
//       console.log("[TemplateMessage] ===== END =====");
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : "Unknown error",
//       };
//     }
//   }

//   console.error(
//     `[TemplateMessage] ❌ Template "${metaTemplateName}" not found in any language`
//   );
//   console.log("[TemplateMessage] ===== END =====");

//   return {
//     success: false,
//     error: `Template "${metaTemplateName}" not found in Meta. Sync templates and verify name + language.`,
//   };
// }

// export async function sendTemplateMessage(
//   to: string,
//   template: TemplateConfig
// ): Promise<{ success: boolean; error?: string; messageId?: string }> {
//   console.log("[TemplateMessage] ===== START =====");
//   console.log("[TemplateMessage] To:", to);
//   console.log(
//     "[TemplateMessage] Raw template config:",
//     JSON.stringify(template, null, 2)
//   );

//   const credentials = getWhatsAppCredentials();

//   if (!credentials) {
//     console.error("[TemplateMessage] WhatsApp credentials not configured");
//     return { success: false, error: "WhatsApp credentials not configured" };
//   }

//   // Meta requires lowercase + underscores
//   const metaTemplateName = template.name.toLowerCase().replace(/\s+/g, "_");

//   const languageCodesToTry = Array.from(
//     new Set([template.languageCode, "en", "en_US", "en_GB"].filter(Boolean))
//   );

//   console.log("[TemplateMessage] Normalized template name:", metaTemplateName);
//   console.log("[TemplateMessage] Language fallback order:", languageCodesToTry);

//   for (const langCode of languageCodesToTry) {
//     console.log("--------------------------------------------");
//     console.log(`[TemplateMessage] Attempting language: ${langCode}`);

//     /** ✅ ENSURE BODY PARAMETERS EXIST */
//     const components = template.components?.length
//       ? template.components
//       : [
//           {
//             type: "body",
//             parameters: [
//               {
//                 type: "text",
//                 text: "there", // default fallback for {{1}}
//               },
//             ],
//           },
//         ];

//     /** ❌ BLOCK UNDEFINED / EMPTY PARAMS */
//     for (const component of components) {
//       if (component.parameters) {
//         for (const param of component.parameters) {
//           if (
//             !param ||
//             param.text === undefined ||
//             param.text === null ||
//             param.text === ""
//           ) {
//             console.error(
//               "[TemplateMessage] ❌ Invalid template parameter detected:",
//               param
//             );
//             return {
//               success: false,
//               error: "Invalid WhatsApp template parameters",
//             };
//           }
//         }
//       }
//     }

//     const messagePayload = {
//       messaging_product: "whatsapp",
//       recipient_type: "individual",
//       to,
//       type: "template",
//       template: {
//         name: metaTemplateName,
//         language: { code: langCode },
//         components,
//       },
//     };

//     console.log(
//       "[TemplateMessage] Payload:",
//       JSON.stringify(messagePayload, null, 2)
//     );

//     try {
//       const response = await fetch(
//         `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
//         {
//           method: "POST",
//           headers: {
//             Authorization: `Bearer ${credentials.token}`,
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(messagePayload),
//         }
//       );

//       const responseText = await response.text();
//       const data = responseText ? JSON.parse(responseText) : {};

//       console.log("[TemplateMessage] HTTP Status:", response.status);
//       console.log("[TemplateMessage] Response:", JSON.stringify(data, null, 2));

//       if (response.ok && data?.messages?.[0]?.id) {
//         console.log(
//           `[TemplateMessage] ✅ Success | Message ID: ${data.messages[0].id}`
//         );
//         console.log("[TemplateMessage] ===== END =====");
//         return { success: true, messageId: data.messages[0].id };
//       }

//       const errorMsg = data?.error?.message || "Unknown Meta error";
//       const errorCode = data?.error?.code;

//       console.error("[TemplateMessage] ❌ Meta Error:", errorMsg, errorCode);

//       /** 🔁 Retry only for template/language mismatch */
//       if (
//         errorCode === 132001 ||
//         errorMsg.toLowerCase().includes("language") ||
//         errorMsg.toLowerCase().includes("does not exist")
//       ) {
//         console.log(`[TemplateMessage] Retrying with next language...`);
//         continue;
//       }

//       console.log("[TemplateMessage] ===== END =====");
//       return { success: false, error: errorMsg };
//     } catch (error) {
//       console.error("[TemplateMessage] ❌ Fetch Exception:", error);
//       return {
//         success: false,
//         error: error instanceof Error ? error.message : "Unknown error",
//       };
//     }
//   }

//   console.error(
//     `[TemplateMessage] ❌ Template "${metaTemplateName}" not found in any language`
//   );
//   console.log("[TemplateMessage] ===== END =====");

//   return {
//     success: false,
//     error: `Template "${metaTemplateName}" not found in Meta`,
//   };
// }

export async function sendTemplateMessage(
  to: string,
  template: TemplateConfig,
  options?: { allowLanguageFallback?: boolean }
): Promise<{
  success: boolean;
  error?: string;
  messageId?: string;
  messageStatus?: string;
}> {
  console.log("[TemplateMessage] ===== START =====");
  console.log("[TemplateMessage] To:", to);
  console.log(
    "[TemplateMessage] Raw template config:",
    JSON.stringify(template, null, 2)
  );

  const credentials = getWhatsAppCredentials();

  if (!credentials) {
    console.error("[TemplateMessage] WhatsApp credentials not configured");
    return { success: false, error: "WhatsApp credentials not configured" };
  }

  // Meta requires lowercase + underscores
  const metaTemplateName = template.name.toLowerCase().replace(/\s+/g, "_");

  const primaryLanguage = template.languageCode || "en_US";
  const allowLanguageFallback = options?.allowLanguageFallback !== false;
  const languageCodesToTry = allowLanguageFallback
    ? Array.from(new Set([primaryLanguage, "en_US", "en", "en_GB"]))
    : [primaryLanguage];

  console.log("[TemplateMessage] Normalized template name:", metaTemplateName);
  console.log(
    "[TemplateMessage] Language attempt order:",
    languageCodesToTry
  );

  for (const langCode of languageCodesToTry) {
    console.log("--------------------------------------------");
    console.log(`[TemplateMessage] Attempting language: ${langCode}`);

    /**
     * 🎯 CRITICAL FIX: Handle both cases properly
     * - If components exist and have parameters → send them
     * - If components exist but are empty → send empty array (template has variables but none provided)
     * - If no components at all → don't include components field (template has no variables)
     */
    let components: any[] | undefined = undefined;
    
    if (template.components) {
      // Components field exists - check if it has actual parameters
      const hasValidParams = template.components.some(
        (comp) => comp.parameters && comp.parameters.length > 0
      );

      if (hasValidParams) {
        // ✅ Validate parameters
        for (const component of template.components) {
          if (component.parameters) {
            for (const param of component.parameters) {
              if (!isValidTemplateParameter(param)) {
                console.error(
                  "[TemplateMessage] ❌ Invalid template parameter:",
                  param
                );
                return {
                  success: false,
                  error: "Invalid WhatsApp template parameters",
                };
              }
            }
          }
        }
        components = template.components;
      } else {
        // Components array exists but is empty/has no params
        // This means template expects variables but none were provided
        components = template.components;
      }
    }
    // If template.components is undefined/null, components stays undefined
    // This means the template has no variables at all

    const messagePayload: any = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: metaTemplateName,
        language: { code: langCode },
        ...(components !== undefined ? { components } : {}),
      },
    };

    console.log(
      "[TemplateMessage] Payload:",
      JSON.stringify(messagePayload, null, 2)
    );

    try {
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${credentials.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(messagePayload),
        }
      );

      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      console.log("[TemplateMessage] HTTP Status:", response.status);
      console.log("[TemplateMessage] Response:", JSON.stringify(data, null, 2));

      if (response.ok && data?.messages?.[0]?.id) {
        console.log(
          `[TemplateMessage] ✅ Success | Message ID: ${data.messages[0].id}`
        );
        console.log("[TemplateMessage] ===== END =====");
        return {
          success: true,
          messageId: data.messages[0].id,
          messageStatus: data.messages?.[0]?.message_status,
        };
      }

      const errorMsg = data?.error?.message || "Unknown Meta error";
      const errorCode = data?.error?.code;

      console.error("[TemplateMessage] ❌ Meta Error:", errorMsg, errorCode);

      /**
       * 🔁 Handle different error cases
       */
      // Language/template not found - try next language
      if (
        errorCode === 132001 ||
        errorMsg.toLowerCase().includes("does not exist")
      ) {
        console.log("[TemplateMessage] Template not found, trying next language...");
        continue;
      }

      // Parameter mismatch - this is a real error, don't retry
      if (
        errorCode === 132000 ||
        errorCode === 132012 ||
        errorMsg.toLowerCase().includes("parameters does not match") ||
        errorMsg.toLowerCase().includes("parameter format does not match")
      ) {
        console.error("[TemplateMessage] ❌ Parameter mismatch - check template variables");
        return { 
          success: false, 
          error: `${errorMsg}. Template requires variables but none/incorrect were provided.` 
        };
      }

      // Other errors - don't retry
      console.log("[TemplateMessage] ===== END =====");
      return { success: false, error: errorMsg };
    } catch (error) {
      console.error("[TemplateMessage] ❌ Fetch Exception:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  console.error(
    `[TemplateMessage] ❌ Template "${metaTemplateName}" not found in any language`
  );
  console.log("[TemplateMessage] ===== END =====");

  return {
    success: false,
    error: `Template "${metaTemplateName}" not found in Meta`,
  };
}

export async function sendHelloWorldTemplate(
  to: string
): Promise<{ success: boolean; error?: string; messageId?: string }> {
  return sendTemplateMessage(to, {
    name: "hello_world",
    languageCode: "en_US",
  });
}

export async function getAvailableTemplates(): Promise<{
  templates: unknown[];
  error?: string;
}> {
  const credentials = getWhatsAppCredentials();

  if (!credentials) {
    return { templates: [], error: "WhatsApp credentials not configured" };
  }

  try {
    const phoneInfoResponse = await fetch(
      `https://graph.facebook.com/v21.0/${credentials.phoneNumberId}?fields=account_mode`,
      {
        headers: {
          Authorization: `Bearer ${credentials.token}`,
        },
      }
    );

    const phoneInfo = await phoneInfoResponse.json();
    console.log("[TemplateMessage] Phone info:", phoneInfo);

    return { templates: [], error: "Template listing requires WABA ID" };
  } catch (error) {
    return {
      templates: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

