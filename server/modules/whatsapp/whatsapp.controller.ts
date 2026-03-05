import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { getMappingByFormId } from "../mapping/mapping.service";
import { getAgentById, getAllAgents } from "../aiAgents/agent.service";
import { generateAgentResponse } from "../ai/ai.service";
import { getAllLeads } from "../facebook/fb.service";
import { storage } from "../../storage";
import * as aiAnalytics from "../aiAnalytics/aiAnalytics.service";
import * as broadcastService from "../broadcast/broadcast.service";
import * as campaignService from "../broadcast/campaign.service";
import * as contactAgentService from "../contactAgent/contactAgent.service";
import * as prefilledTextService from "../prefilledText/prefilledText.service";
import { credentialsService } from "../credentials/credentials.service";
import * as whatsappService from "./whatsapp.service";
import { CampaignLog, Message, UserCredentials, WebhookStatusEvent } from "../storage/mongodb.adapter";
import {
  isContactBlocked,
  isPhoneBlocked,
  listAllBlockedContacts,
} from "../contacts/contacts.routes";
import { getUserId } from "../auth/auth.routes";
import { contactAnalyticsService } from "../contactAnalytics/contactAnalytics.service";
import { interestClassificationService } from "../automation/interest/interest.service";

const WHATSAPP_TOKEN =
  process.env.WHATSAPP_TOKEN_NEW || process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const DEFAULT_VERIFY_TOKEN = "whatsapp_webhook_verify_token_2025";

function getEnvWebhookVerifyTokens(): string[] {
  return Array.from(
    new Set(
      [
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
        process.env.WEBHOOK_VERIFY_TOKEN,
        process.env.VERIFY_TOKEN,
      ]
        .map((token) => String(token || "").trim())
        .filter(Boolean)
    )
  );
}

async function isStoredWebhookVerifyToken(token: string): Promise<boolean> {
  try {
    const found = await UserCredentials.findOne({
      webhookVerifyToken: token,
    })
      .select({ _id: 1 })
      .lean();
    return Boolean(found);
  } catch (error) {
    console.error("[Webhook Verify] Failed to query stored verify tokens:", error);
    return false;
  }
}

function resolvePublicBaseUrl(req: Request): string {
  const envBaseUrl =
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    process.env.BACKEND_URL ||
    process.env.BASE_URL;

  if (envBaseUrl && String(envBaseUrl).trim()) {
    return String(envBaseUrl).trim().replace(/\/+$/, "");
  }

  const forwardedProtoRaw = req.headers["x-forwarded-proto"];
  const forwardedProto = Array.isArray(forwardedProtoRaw)
    ? forwardedProtoRaw[0]
    : forwardedProtoRaw;
  const proto = String(forwardedProto || req.protocol || "http")
    .split(",")[0]
    .trim();

  const forwardedHostRaw = req.headers["x-forwarded-host"];
  const forwardedHost = Array.isArray(forwardedHostRaw)
    ? forwardedHostRaw[0]
    : forwardedHostRaw;
  const host = String(forwardedHost || req.get("host") || "localhost:8081")
    .split(",")[0]
    .trim();

  return `${proto}://${host}`;
}

async function resolveUserIdFromPhoneNumberId(
  phoneNumberId: string
): Promise<string | undefined> {
  try {
    const result = await credentialsService.getCredentialsByPhoneNumberId(
      phoneNumberId
    );
    if (result) {
      console.log(
        `[Webhook] Resolved userId ${result.userId} for phone_number_id ${phoneNumberId}`
      );
      return result.userId;
    }
    console.log(
      `[Webhook] No user found for phone_number_id ${phoneNumberId}, using system credentials`
    );
    return undefined;
  } catch (error) {
    console.error("[Webhook] Error resolving userId:", error);
    return undefined;
  }
}

interface ConversationHistory {
  [phone: string]: { role: "user" | "assistant"; content: string }[];
}

const conversationHistory: ConversationHistory = {};

async function handleStatusUpdates(statuses: any[]): Promise<void> {
  await handleStatusUpdatesWithContext(statuses, {});
}

async function handleStatusUpdatesWithContext(
  statuses: any[],
  context: { phoneNumberId?: string; wabaId?: string }
): Promise<void> {
  const webhookReceivedAt = new Date();

  for (const status of statuses) {
    const messageId = status.id;
    const statusType = status.status;
    const recipientPhone = status.recipient_id;
    const timestamp = status.timestamp
      ? new Date(parseInt(status.timestamp) * 1000)
      : new Date();
    const firstError = status?.errors?.[0];
    const failureReason =
      firstError?.title ||
      firstError?.message ||
      firstError?.error_data?.details ||
      "Message delivery failed";

    console.log(
      `[Webhook Status] Message ${messageId} status: ${statusType} for ${recipientPhone}`
    );

    try {
      const nowIso = new Date().toISOString();
      const statusTimestamp = timestamp;
      const eventPayload = {
        messageId: messageId || undefined,
        recipientId: recipientPhone || undefined,
        status: statusType || "unknown",
        statusTimestamp,
        webhookReceivedAt,
        phoneNumberId: context.phoneNumberId || undefined,
        wabaId: context.wabaId || undefined,
        conversationId: status?.conversation?.id || undefined,
        pricingCategory: status?.pricing?.category || undefined,
        errorCode: firstError?.code ? String(firstError.code) : undefined,
        errorTitle: firstError?.title || undefined,
        errorMessage: firstError?.message || undefined,
        errorDetails: firstError?.error_data?.details || undefined,
        rawStatus: status,
        updatedAt: nowIso,
      };

      if (messageId) {
        await WebhookStatusEvent.findOneAndUpdate(
          {
            messageId,
            status: statusType || "unknown",
            statusTimestamp,
            recipientId: recipientPhone || null,
          },
          {
            $set: eventPayload,
            $setOnInsert: {
              id: randomUUID(),
              createdAt: nowIso,
            },
          },
          { upsert: true, new: true }
        );
      } else {
        await WebhookStatusEvent.create({
          id: randomUUID(),
          ...eventPayload,
          createdAt: nowIso,
        });
      }

      if (statusType === "delivered") {
        await campaignService.updateCampaignContactStatus(
          messageId,
          "delivered",
          timestamp
        );
      } else if (statusType === "read") {
        await campaignService.updateCampaignContactStatus(
          messageId,
          "read",
          timestamp
        );
      } else if (statusType === "failed") {
        console.error(
          `[Webhook Status] Message ${messageId} FAILED for ${recipientPhone}:`,
          {
            code: firstError?.code,
            title: firstError?.title,
            message: firstError?.message,
            details: firstError?.error_data?.details,
          }
        );

        await campaignService.updateCampaignContactStatus(
          messageId,
          "failed",
          timestamp,
          failureReason
        );
      }

      if (messageId) {
        const messageStatusMap: Record<string, "sent" | "delivered" | "read" | "failed"> = {
          sent: "sent",
          accepted: "sent",
          delivered: "delivered",
          read: "read",
          failed: "failed",
        };
        const mappedMessageStatus = messageStatusMap[String(statusType || "").toLowerCase()];
        if (mappedMessageStatus) {
          await Message.updateMany(
            { whatsappMessageId: messageId },
            { $set: { status: mappedMessageStatus } }
          );
        }

        const dripUpdate: Record<string, unknown> = {
          providerStatus: statusType,
        };

        if (statusType === "delivered") {
          dripUpdate.status = "delivered";
          dripUpdate.deliveredAt = timestamp;
        } else if (statusType === "read") {
          dripUpdate.status = "read";
          dripUpdate.readAt = timestamp;
        } else if (statusType === "failed") {
          dripUpdate.status = "failed";
          dripUpdate.failedAt = timestamp;
          dripUpdate.error = failureReason;
        } else if (statusType === "sent") {
          dripUpdate.status = "accepted";
          dripUpdate.sentAt = timestamp;
        }

        await CampaignLog.updateMany({ messageId }, { $set: dripUpdate });
      }
    } catch (error) {
      console.error(`[Webhook Status] Error updating campaign status:`, error);
    }
  }
}

export async function verifyWebhook(req: Request, res: Response) {
  const mode = req.query["hub.mode"];
  const token = String(req.query["hub.verify_token"] || "");
  const challenge = req.query["hub.challenge"];

  console.log("WhatsApp webhook verification:", { mode, token, challenge });

  const envTokens = getEnvWebhookVerifyTokens();
  const hasEnvMatch = envTokens.includes(token);
  const hasStoredMatch = token ? await isStoredWebhookVerifyToken(token) : false;
  const hasDefaultMatch = token === DEFAULT_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    Boolean(token) &&
    (hasEnvMatch || hasStoredMatch || hasDefaultMatch)
  ) {
    console.log("Webhook verified successfully");
    return res.status(200).send(challenge);
  }

  console.log("Webhook verification failed");
  return res.sendStatus(403);
}

export async function handleWebhook(req: Request, res: Response) {
  try {
    const body = req.body;
    console.log("WhatsApp webhook received:", JSON.stringify(body, null, 2));

    if (body.object !== "whatsapp_business_account") {
      return res.sendStatus(404);
    }

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const statuses = value?.statuses;

    // Handle message status updates (delivered, read, sent)
    if (statuses && statuses.length > 0) {
      await handleStatusUpdatesWithContext(statuses, {
        phoneNumberId: value?.metadata?.phone_number_id,
        wabaId: entry?.id,
      });
      return res.sendStatus(200);
    }

    if (!messages || messages.length === 0) {
      return res.sendStatus(200);
    }

    const webhookPhoneNumberId = value?.metadata?.phone_number_id;
    const resolvedUserId = webhookPhoneNumberId
      ? await resolveUserIdFromPhoneNumberId(webhookPhoneNumberId)
      : undefined;

    const message = messages[0];
    const from = message.from;
    const messageType = message.type;

    // Check if contact is blocked - works with or without resolved userId
    console.log(`[Webhook] Checking if phone ${from} is blocked...`);

    // Debug: list all blocked contacts
    const allBlocked = await listAllBlockedContacts();
    console.log(`[Webhook] Total blocked contacts in DB: ${allBlocked.length}`);

    if (resolvedUserId) {
      console.log(
        `[Webhook] Checking block for user ${resolvedUserId}, phone ${from}`
      );
      const isBlocked = await isContactBlocked(resolvedUserId, from);
      if (isBlocked) {
        console.log(
          `[Webhook] BLOCKED! Message from blocked contact ${from} for user ${resolvedUserId}, ignoring`
        );
        return res.sendStatus(200);
      }
    } else {
      console.log(
        `[Webhook] No resolved userId, checking if phone ${from} is blocked by any user`
      );
      // Check if phone is blocked by any user
      const blockResult = await isPhoneBlocked(from);
      if (blockResult.blocked) {
        console.log(
          `[Webhook] BLOCKED! Message from blocked contact ${from} (blocked by user ${blockResult.userId}), ignoring`
        );
        return res.sendStatus(200);
      }
    }

    console.log(
      `[Webhook] Phone ${from} is NOT blocked, proceeding with message`
    );

    // Extract message content based on type
    let messageText = "";
    let buttonPayload = "";
    let mediaUrl = "";
    let isMediaMessage = false;

    if (messageType === "text") {
      messageText = message.text?.body || "";
    } else if (messageType === "button") {
      // Quick reply button response
      messageText = message.button?.text || "";
      buttonPayload = message.button?.payload || "";
      console.log(
        `Button response from ${from}: text="${messageText}", payload="${buttonPayload}"`
      );
    } else if (messageType === "interactive") {
      // Interactive message response (button_reply or list_reply)
      const interactive = message.interactive;
      if (interactive?.type === "button_reply") {
        messageText = interactive.button_reply?.title || "";
        buttonPayload = interactive.button_reply?.id || "";
        console.log(
          `Interactive button reply from ${from}: title="${messageText}", id="${buttonPayload}"`
        );
      } else if (interactive?.type === "list_reply") {
        messageText = interactive.list_reply?.title || "";
        buttonPayload = interactive.list_reply?.id || "";
        console.log(
          `Interactive list reply from ${from}: title="${messageText}", id="${buttonPayload}"`
        );
      }
    } else if (messageType === "image") {
      // Image message
      isMediaMessage = true;
      mediaUrl = message.image?.id || "";
      const caption = message.image?.caption || "";
      messageText = caption ? `[Image] ${caption}` : "[Image message]";
      console.log(
        `Image message from ${from}: id=${mediaUrl}, caption="${caption}"`
      );
    } else if (messageType === "video") {
      // Video message
      isMediaMessage = true;
      mediaUrl = message.video?.id || "";
      const caption = message.video?.caption || "";
      messageText = caption ? `[Video] ${caption}` : "[Video message]";
      console.log(
        `Video message from ${from}: id=${mediaUrl}, caption="${caption}"`
      );
    } else if (messageType === "audio") {
      // Audio/voice message
      isMediaMessage = true;
      mediaUrl = message.audio?.id || "";
      messageText = "[Audio message]";
      console.log(`Audio message from ${from}: id=${mediaUrl}`);
    } else if (messageType === "document") {
      // Document message
      isMediaMessage = true;
      mediaUrl = message.document?.id || "";
      const filename = message.document?.filename || "document";
      const caption = message.document?.caption || "";
      messageText = caption
        ? `[Document: ${filename}] ${caption}`
        : `[Document: ${filename}]`;
      console.log(
        `Document message from ${from}: id=${mediaUrl}, filename="${filename}"`
      );
    } else if (messageType === "sticker") {
      // Sticker message
      isMediaMessage = true;
      mediaUrl = message.sticker?.id || "";
      messageText = "[Sticker message]";
      console.log(`Sticker message from ${from}: id=${mediaUrl}`);
    } else if (messageType === "location") {
      // Location message
      const lat = message.location?.latitude || 0;
      const lng = message.location?.longitude || 0;
      const name = message.location?.name || "";
      messageText = name
        ? `[Location: ${name}] (${lat}, ${lng})`
        : `[Location] (${lat}, ${lng})`;
      console.log(`Location message from ${from}: ${lat}, ${lng}`);
    } else if (messageType === "contacts") {
      // Contact card message
      const contacts = message.contacts || [];
      const contactNames = contacts
        .map((c: any) => c.name?.formatted_name || "Unknown")
        .join(", ");
      messageText = `[Contact shared: ${contactNames}]`;
      console.log(`Contacts message from ${from}: ${contactNames}`);
    } else if (messageType === "reaction") {
      // Reaction message
      const emoji = message.reaction?.emoji || "";
      messageText = `[Reaction: ${emoji}]`;
      console.log(`Reaction from ${from}: ${emoji}`);
    } else {
      // Unsupported message type
      messageText = `[Unsupported message type: ${messageType}]`;
      console.log(`Unsupported message type from ${from}: ${messageType}`);
    }

    console.log(`Received ${messageType} message from ${from}: ${messageText}`);

    // Get WhatsApp message ID for deduplication
    const whatsappMessageId = message.id || "";

    // Save the inbound message with actual button text and media info (with deduplication)
    const saveResult = await saveInboundMessage(
      from,
      messageText || buttonPayload,
      messageType,
      buttonPayload,
      mediaUrl,
      whatsappMessageId
    );

    // If message was a duplicate, skip AI processing
    if (saveResult.isDuplicate) {
      console.log(
        `[Webhook] Duplicate message detected (${whatsappMessageId}), skipping AI processing`
      );
      return res.sendStatus(200);
    }

    // If we couldn't create a contact at all, we can't proceed
    if (!saveResult.contact) {
      console.error(
        `[Webhook] Failed to create/find contact for ${from}, cannot proceed with AI processing`
      );
      return res.sendStatus(200);
    }

    // Log if message save failed but we have contact (AI processing will continue)
    if (saveResult.error) {
      console.warn(
        `[Webhook] Message save failed (${saveResult.error}), but continuing with AI processing for ${from}`
      );
    }

    const savedContact = saveResult.contact;
    console.log(
      `[Webhook] Processing message from ${from}, contact: ${
        savedContact.id
      }, hasMessage: ${!!saveResult.message}`
    );

    // Classify contact interest level based on message content
    if (savedContact && savedContact.id && (messageText || buttonPayload)) {
      try {
        const classificationResult =
          await interestClassificationService.classifyAndUpdateContact(
            messageText || buttonPayload,
            savedContact.id,
            from,
            resolvedUserId || "system"
          );
        console.log(
          `[Webhook] Interest classification for ${from}: ${classificationResult.classification.status} (${classificationResult.classification.confidence})`
        );
        if (classificationResult.triggeredCampaigns.length > 0) {
          console.log(
            `[Webhook] Triggered drip campaigns: ${classificationResult.triggeredCampaigns.join(
              ", "
            )}`
          );
        }
      } catch (classifyError) {
        console.error("[Webhook] Error classifying interest:", classifyError);
      }
    }

    // For media messages, we still save them but don't process with AI
    if (isMediaMessage) {
      console.log(
        `Media message saved, skipping AI processing for type: ${messageType}`
      );
      return res.sendStatus(200);
    }

    // Process message if we have content (text, button, or interactive)
    if (!messageText && !buttonPayload) {
      console.log(`No processable content for message type: ${messageType}`);
      return res.sendStatus(200);
    }

    // Use messageText or buttonPayload for AI processing
    const contentForAI = messageText || buttonPayload;

    // Check if this is a button response - log it but continue with AI processing
    const isButtonResponse =
      messageType === "button" || messageType === "interactive";

    if (isButtonResponse) {
      console.log(
        `[Webhook] Button response from ${from}: "${contentForAI}" - continuing with AI processing`
      );
    }

    // Check if auto-reply is disabled for this contact (set manually by user in inbox)
    // Note: Button clicks no longer disable auto-reply, only manual inbox actions do
    const autoReplyDisabled = await contactAgentService.isAutoReplyDisabled(
      from
    );
    if (autoReplyDisabled) {
      console.log(
        `[Webhook] Auto-reply manually disabled for ${from} - skipping AI response`
      );
      return res.sendStatus(200);
    }

    // For all messages, check if this contact has a manually assigned agent
    const contactAgentAssignment = await contactAgentService.getAgentForContact(
      from
    );
    let agentToUse = null;
    let useStoredHistory = false;

    // First try manually assigned agent
    if (contactAgentAssignment) {
      console.log(
        `[Webhook] Found assigned agent for ${from}: ${contactAgentAssignment.agentName} (${contactAgentAssignment.agentId})`
      );
      agentToUse = await getAgentById(contactAgentAssignment.agentId);

      if (agentToUse && agentToUse.isActive) {
        useStoredHistory = true;
        console.log(`[Webhook] Using assigned agent: ${agentToUse.name}`);
      } else {
        // Agent was deleted or is inactive - clear the stale assignment
        console.log(
          `[Webhook] Assigned agent not found or inactive for ${from}, clearing assignment and falling back`
        );
        await contactAgentService.removeAgentFromContact(from);
        agentToUse = null;
      }
    }

    // If no valid assigned agent, try pre-filled text mapping
    if (!agentToUse) {
      const prefilledMapping =
        await prefilledTextService.findMatchingAgentForMessage(contentForAI);
      if (prefilledMapping) {
        console.log(
          `[Webhook] Found pre-filled text mapping for "${contentForAI}" -> Agent: ${prefilledMapping.agentName}`
        );
        agentToUse = await getAgentById(prefilledMapping.agentId);

        // Auto-assign this agent to the contact for future messages
        if (agentToUse && agentToUse.isActive) {
          await contactAgentService.assignAgentToContact(
            "", // contactId - will be set later
            from,
            prefilledMapping.agentId,
            prefilledMapping.agentName
          );
          useStoredHistory = true;
          console.log(
            `[Webhook] Auto-assigned agent ${prefilledMapping.agentName} to WhatsApp lead ${from}`
          );
        } else {
          agentToUse = null;
        }
      }
    }

    // Fall back to lead-form mapping if no pre-filled text match
    if (!agentToUse) {
      const lead = await findLeadByPhone(from);
      if (lead) {
        const mapping = await getMappingByFormId(lead.formId);
        if (mapping && mapping.isActive) {
          const mappedAgent = await getAgentById(mapping.agentId);
          if (mappedAgent && mappedAgent.isActive) {
            agentToUse = mappedAgent;
          }
        }
      }
    }

    // Fall back to any active agent only if nothing else matched
    if (!agentToUse) {
      const agents = await getAllAgents();
      agentToUse = agents.find((a: any) => a.isActive);
      if (agentToUse) {
        console.log(
          `[Webhook] Using fallback active agent: ${agentToUse.name}`
        );
      }
    }

    if (!agentToUse) {
      console.log("[Webhook] No active agent found - skipping AI response");
      return res.sendStatus(200);
    }

    // Validate agent has required fields before proceeding
    if (!agentToUse.id || !agentToUse.name) {
      console.log(
        `[Webhook] Agent is missing required fields (id: ${agentToUse.id}, name: ${agentToUse.name}) - skipping AI response`
      );
      return res.sendStatus(200);
    }

    // Get conversation history - prioritize stored MongoDB history for assigned agents
    let recentHistory: { role: "user" | "assistant"; content: string }[] = [];

    if (useStoredHistory) {
      recentHistory = await contactAgentService.getConversationHistory(from);
      console.log(
        `[Webhook] Using stored history with ${recentHistory.length} messages for agent: ${agentToUse.name}`
      );
    } else {
      if (!conversationHistory[from]) {
        conversationHistory[from] = [];
      }
      recentHistory = conversationHistory[from].slice(-10);
    }

    const historyForAI = [
      ...recentHistory,
      { role: "user" as const, content: contentForAI },
    ];

    let aiResponse: string;
    try {
      aiResponse = await generateAgentResponse(
        contentForAI,
        agentToUse,
        historyForAI.slice(0, -1),
        resolvedUserId
      );
    } catch (aiError) {
      console.error(
        `[Webhook] Error generating AI response for ${from}:`,
        aiError
      );
      return res.sendStatus(200); // Return 200 to prevent retries
    }

    if (useStoredHistory) {
      await contactAgentService.addMessageToHistory(from, "user", contentForAI);
      await contactAgentService.addMessageToHistory(
        from,
        "assistant",
        aiResponse
      );
    } else {
      conversationHistory[from].push({ role: "user", content: contentForAI });
      conversationHistory[from].push({
        role: "assistant",
        content: aiResponse,
      });
    }

    await whatsappService.sendTextMessage(from, aiResponse, resolvedUserId);

    await saveOutboundMessage(from, aiResponse);

    // Track AI agent interaction for analytics (only if we have valid agent ID)
    if (agentToUse.id && agentToUse.name) {
      try {
        await contactAnalyticsService.trackAgentInteraction(
          from,
          agentToUse.id,
          agentToUse.name
        );
      } catch (trackError) {
        console.error(
          "[Webhook] Error tracking agent interaction:",
          trackError
        );
      }
    }

    // Analyze conversation for interest level (async, non-blocking)
    (async () => {
      try {
        const contacts = await storage.getContacts();
        const contact = contacts.find((c) => {
          const contactPhone = (c.phone || "").replace(/\D/g, "");
          const normalizedFrom = from.replace(/\D/g, "");
          return (
            contactPhone.includes(normalizedFrom) ||
            normalizedFrom.includes(contactPhone)
          );
        });

        if (contact) {
          const fullHistory = useStoredHistory
            ? await contactAgentService.getConversationHistory(from)
            : conversationHistory[from] || [];

          const messagesForAnalysis = fullHistory.map((m) => ({
            direction: m.role === "user" ? "inbound" : "outbound",
            content: m.content,
            timestamp: new Date().toISOString(),
          }));

          await contactAnalyticsService.analyzeAndUpdateContact(
            contact.id,
            from,
            contact.name || from,
            messagesForAnalysis,
            resolvedUserId
          );
          console.log(`[Webhook] Contact analytics updated for ${from}`);
        }
      } catch (analyticsError) {
        console.error("[Webhook] Error analyzing contact:", analyticsError);
      }
    })();

    console.log(
      `AI auto-reply sent to ${from}: ${aiResponse.substring(0, 100)}...`
    );

    return res.sendStatus(200);
  } catch (error) {
    // CRITICAL: Always return 200 to prevent Meta webhook retries
    // Returning 500 causes Meta to retry the webhook, creating duplicate messages
    console.error("Error handling webhook:", error);
    return res.sendStatus(200);
  }
}

export async function getWebhookStatusEvents(req: Request, res: Response) {
  try {
    const limitRaw = Number(req.query.limit || 100);
    const pageRaw = Number(req.query.page || 1);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(500, Math.max(1, Math.floor(limitRaw)))
      : 100;
    const page = Number.isFinite(pageRaw)
      ? Math.max(1, Math.floor(pageRaw))
      : 1;
    const skip = (page - 1) * limit;

    const messageId = String(req.query.messageId || "").trim();
    const recipientId = String(req.query.recipientId || "").trim();
    const status = String(req.query.status || "").trim();

    const filter: Record<string, unknown> = {};
    if (messageId) {
      filter.messageId = { $regex: messageId, $options: "i" };
    }
    if (recipientId) {
      filter.recipientId = { $regex: recipientId, $options: "i" };
    }
    if (status) {
      filter.status = status;
    }

    const [events, total, summaryRows] = await Promise.all([
      WebhookStatusEvent.find(filter)
        .sort({ statusTimestamp: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WebhookStatusEvent.countDocuments(filter),
      WebhookStatusEvent.aggregate([
        { $match: filter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    const summary = summaryRows.reduce(
      (acc: Record<string, number>, row: any) => {
        acc[String(row?._id || "unknown")] = Number(row?.count || 0);
        return acc;
      },
      {}
    );

    return res.json({
      events,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      summary,
    });
  } catch (error: any) {
    console.error("[Webhook Events] Failed to fetch webhook status events:", error);
    return res.status(500).json({
      error: "Failed to fetch webhook status events",
      details: error?.message || "Unknown error",
    });
  }
}

export async function getWebhookConfig(req: Request, res: Response) {
  try {
    const userId = getUserId(req) || undefined;
    const userCreds = userId
      ? await credentialsService.getDecryptedCredentials(userId)
      : null;

    const envToken =
      getEnvWebhookVerifyTokens()[0] || DEFAULT_VERIFY_TOKEN;
    const verifyToken =
      String(userCreds?.webhookVerifyToken || "").trim() || envToken;

    const baseUrl = resolvePublicBaseUrl(req);
    const callbackUrl = `${baseUrl}/api/webhook/whatsapp`;
    const isHttps = /^https:\/\//i.test(callbackUrl);
    const looksLocalhost = /localhost|127\.0\.0\.1/i.test(callbackUrl);

    return res.json({
      callbackUrl,
      verifyToken,
      hints: {
        requiresPublicHttps: !isHttps || looksLocalhost,
      },
    });
  } catch (error: any) {
    console.error("[Webhook Config] Failed to resolve webhook config:", error);
    return res.status(500).json({
      error: "Failed to resolve webhook config",
      details: error?.message || "Unknown error",
    });
  }
}

async function findLeadByPhone(phone: string) {
  const leads = await getAllLeads();
  const normalizedPhone = phone.replace(/\D/g, "");

  return leads.find((lead) => {
    const leadPhone = (lead.phone || "").replace(/\D/g, "");
    return (
      leadPhone.includes(normalizedPhone) || normalizedPhone.includes(leadPhone)
    );
  });
}

interface SaveInboundResult {
  message: any | null;
  contact: any | null;
  isDuplicate: boolean;
  error?: string;
}

async function saveInboundMessage(
  from: string,
  content: string,
  type: string,
  buttonPayload?: string,
  mediaUrl?: string,
  whatsappMessageId?: string
): Promise<SaveInboundResult> {
  const normalizedPhone = from.replace(/\D/g, "");

  // First, ensure we have a contact - this is critical for AI processing
  let contact: any = null;
  try {
    const contacts = await storage.getContacts();
    contact = contacts.find((c) => {
      const contactPhone = (c.phone || "").replace(/\D/g, "");
      return (
        contactPhone.includes(normalizedPhone) ||
        normalizedPhone.includes(contactPhone)
      );
    });

    if (!contact) {
      const formattedPhone = from.startsWith("+") ? from : `+${from}`;
      contact = await storage.createContact({
        name: formattedPhone,
        phone: from,
        email: "",
        tags: ["WhatsApp"],
        notes: "Auto-created from WhatsApp message",
      });
      console.log("[Webhook] Created new contact:", contact.id, "phone:", from);
    }
  } catch (contactError) {
    console.error("[Webhook] Error finding/creating contact:", contactError);
    return {
      message: null,
      contact: null,
      isDuplicate: false,
      error: "Failed to create contact",
    };
  }

  // Check for duplicate message using WhatsApp message ID
  if (whatsappMessageId) {
    try {
      const existingMessages = await storage.getMessages();
      const isDuplicate = existingMessages.some(
        (m) =>
          m.direction === "inbound" &&
          (m as any).whatsappMessageId === whatsappMessageId
      );
      if (isDuplicate) {
        console.log(
          `[Webhook] Skipping duplicate message: ${whatsappMessageId}`
        );
        return { message: null, contact, isDuplicate: true };
      }
    } catch (dupCheckError) {
      console.error(
        "[Webhook] Error checking duplicates, continuing anyway:",
        dupCheckError
      );
    }
  }

  // Mark broadcast logs as replied when we receive a message from this phone
  try {
    const repliedCount = await broadcastService.markBroadcastLogAsReplied(from);
    if (repliedCount > 0) {
      console.log(
        `[Webhook] Marked ${repliedCount} broadcast logs as replied for ${from}`
      );
    }
  } catch (err) {
    console.error("[Webhook] Error marking broadcast as replied:", err);
  }

  // Mark campaign contacts as replied
  try {
    await campaignService.markCampaignContactAsReplied(from, content);
  } catch (err) {
    console.error("[Webhook] Error marking campaign as replied:", err);
  }

  try {
    // Format message content based on type
    let displayContent = content;
    if (type === "button" || type === "interactive") {
      // Show button text with payload info for clarity
      displayContent = content;
      if (buttonPayload && buttonPayload !== content) {
        displayContent = `${content} [Button: ${buttonPayload}]`;
      }
    }

    const validTypes = [
      "text",
      "image",
      "video",
      "document",
      "audio",
      "sticker",
      "location",
      "contacts",
    ] as const;
    const messageType = validTypes.includes(type as any)
      ? (type as (typeof validTypes)[number])
      : "text";

    const messageData: any = {
      contactId: contact.id,
      content: displayContent || `[${type} message]`,
      type: messageType,
      direction: "inbound",
      status: "read" as const,
      mediaUrl: mediaUrl || undefined,
    };

    // Store WhatsApp message ID for deduplication
    if (whatsappMessageId) {
      messageData.whatsappMessageId = whatsappMessageId;
    }

    const message = await storage.createMessage(messageData);
    console.log(
      "Saved inbound message:",
      message.id,
      "type:",
      messageType,
      "whatsappId:",
      whatsappMessageId || "none"
    );

    await storage.updateChatInboundTime(contact.id);
    console.log("Updated chat inbound time for contact:", contact.id);

    try {
      const lead = await findLeadByPhone(from);
      let agentToUse = null;
      let source: "ai_chat" | "campaign" | "ad" | "lead_form" | "manual" =
        "ai_chat";

      if (lead) {
        source = "lead_form";
        const mapping = await getMappingByFormId(lead.formId);
        if (mapping && mapping.isActive) {
          agentToUse = await getAgentById(mapping.agentId);
        }
      }

      if (!agentToUse) {
        const agents = await getAllAgents();
        agentToUse = agents.find((a: any) => a.isActive);
      }

      const displayName =
        contact.name && !contact.name.startsWith("WhatsApp ")
          ? contact.name
          : from.startsWith("+")
          ? from
          : `+${from}`;
      await aiAnalytics.createOrUpdateQualification(
        from,
        displayName,
        content,
        source,
        {
          contactId: contact.id,
          agentId: agentToUse?.id,
          agentName: agentToUse?.name,
        }
      );
      console.log("Tracked AI qualification for:", from);
    } catch (analyticsError) {
      console.error("Error tracking AI qualification:", analyticsError);
    }

    return { message, contact, isDuplicate: false };
  } catch (error) {
    console.error("Error saving inbound message:", error);
    // Still return the contact so AI processing can continue
    return {
      message: null,
      contact,
      isDuplicate: false,
      error: "Failed to save message",
    };
  }
}

async function saveOutboundMessage(to: string, content: string) {
  try {
    const normalizedPhone = to.replace(/\D/g, "");

    const contacts = await storage.getContacts();
    const contact = contacts.find((c) => {
      const contactPhone = (c.phone || "").replace(/\D/g, "");
      return (
        contactPhone.includes(normalizedPhone) ||
        normalizedPhone.includes(contactPhone)
      );
    });

    if (!contact) {
      console.log("Contact not found for outbound message:", to);
      return;
    }

    const message = await storage.createMessage({
      contactId: contact.id,
      content: content,
      type: "text" as const,
      direction: "outbound",
      status: "sent" as const,
    });
    console.log("Saved outbound AI message:", message.id);
  } catch (error) {
    console.error("Error saving outbound message:", error);
  }
}

async function sendWhatsAppMessage(to: string, message: string) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    throw new Error("WhatsApp credentials not configured");
  }

  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: message },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("WhatsApp API error:", error);
      throw new Error(`WhatsApp API error: ${error}`);
    }

    const data = await response.json();
    console.log("Message sent successfully:", data);
    return data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    throw error;
  }
}

export async function sendMessage(req: Request, res: Response) {
  try {
    const { to, message } = req.body;

    if (!to || !message) {
      return res
        .status(400)
        .json({ error: "Recipient and message are required" });
    }

    const userId = getUserId(req) || undefined;

    console.log(
      `[SendMessage] User ${
        userId || "undefined"
      } sending message to ${to}: ${message.substring(0, 50)}...`
    );
    const credentials = await whatsappService.getWhatsAppCredentialsStrict(
      userId
    );
    if (!credentials) {
      return res.status(403).json({
        error:
          "WhatsApp credentials not configured. Please set up your API keys in Settings > API Credentials.",
      });
    }

    const result = await whatsappService.sendTextMessage(to, message, userId);

    if (!result.success) {
      return res
        .status(400)
        .json({ error: result.error || "Failed to send message" });
    }

    res.json({ success: true, messageId: result.messageId });
  } catch (error: any) {
    console.error("Error sending message:", error);
    res.status(500).json({ error: error.message || "Failed to send message" });
  }
}

export async function getMediaUrl(req: Request, res: Response) {
  try {
    const { mediaId } = req.params;

    if (!mediaId) {
      return res.status(400).json({ error: "Media ID is required" });
    }

    const userId = getUserId(req) || undefined;
    const credentials = await whatsappService.getWhatsAppCredentialsStrict(
      userId
    );

    if (!credentials) {
      return res.status(403).json({
        error:
          "WhatsApp credentials not configured. Please set up your API keys in Settings > API Credentials.",
      });
    }

    const mediaInfoUrl = `https://graph.facebook.com/v21.0/${mediaId}`;
    const mediaInfoResponse = await fetch(mediaInfoUrl, {
      headers: {
        Authorization: `Bearer ${credentials.token}`,
      },
    });

    if (!mediaInfoResponse.ok) {
      const error = await mediaInfoResponse.text();
      console.error("WhatsApp media info error:", error);
      return res.status(404).json({ error: "Media not found or expired" });
    }

    const mediaInfo = await mediaInfoResponse.json();
    const downloadUrl = mediaInfo.url;
    const mimeType = mediaInfo.mime_type;

    console.log("[Media] Fetched media info:", {
      mediaId,
      mimeType,
      hasUrl: !!downloadUrl,
    });

    const mediaResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${credentials.token}`,
      },
    });

    if (!mediaResponse.ok) {
      const error = await mediaResponse.text();
      console.error("WhatsApp media download error:", error);
      return res.status(500).json({ error: "Failed to download media" });
    }

    const buffer = await mediaResponse.arrayBuffer();

    res.set("Content-Type", mimeType || "application/octet-stream");
    res.set("Cache-Control", "public, max-age=86400");
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error("Error fetching media:", error);
    res.status(500).json({ error: error.message || "Failed to fetch media" });
  }
}

export async function getConversations(req: Request, res: Response) {
  try {
    const conversations = Object.entries(conversationHistory).map(
      ([phone, messages]) => ({
        phone,
        messageCount: messages.length,
        lastMessage: messages[messages.length - 1],
      })
    );
    res.json(conversations);
  } catch (error) {
    console.error("Error getting conversations:", error);
    res.status(500).json({ error: "Failed to get conversations" });
  }
}

export async function getConversation(req: Request, res: Response) {
  try {
    const { phone } = req.params;
    const messages = conversationHistory[phone] || [];
    res.json({ phone, messages });
  } catch (error) {
    console.error("Error getting conversation:", error);
    res.status(500).json({ error: "Failed to get conversation" });
  }
}

export async function sendTemplateMessage(
  to: string,
  templateName: string,
  languageCode: string = "en",
  components: any[] = [],
  namedParams?: { [key: string]: string }
) {
  if (!WHATSAPP_TOKEN || !PHONE_NUMBER_ID) {
    throw new Error("WhatsApp credentials not configured");
  }

  const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

  const payload: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  };

  if (namedParams && Object.keys(namedParams).length > 0) {
    payload.template.components = [
      {
        type: "body",
        parameters: Object.entries(namedParams).map(([paramName, value]) => ({
          type: "text",
          parameter_name: paramName,
          text: value,
        })),
      },
    ];
  } else if (components && components.length > 0) {
    payload.template.components = components;
  }

  console.log(
    `[WhatsApp] Sending template "${templateName}" to ${to}:`,
    JSON.stringify(payload, null, 2)
  );

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp] Template send error:", data);
      throw new Error(data.error?.message || "Failed to send template");
    }

    console.log("[WhatsApp] Template sent successfully:", data);
    return data;
  } catch (error) {
    console.error("[WhatsApp] Error sending template:", error);
    throw error;
  }
}

export async function sendTemplateMessageEndpoint(req: Request, res: Response) {
  try {
    const { to, templateName, languageCode, components, namedParams } =
      req.body;

    if (!to || !templateName) {
      return res
        .status(400)
        .json({ error: "Recipient (to) and templateName are required" });
    }

    const userId = getUserId(req) || undefined;

    const credentials = await whatsappService.getWhatsAppCredentialsStrict(
      userId
    );
    if (!credentials) {
      return res.status(403).json({
        error:
          "WhatsApp credentials not configured. Please set up your API keys in Settings > API Credentials.",
      });
    }

    const resolvedLangCode = languageCode || "en";

    const sendResult = await whatsappService.sendTemplateMessage(
      to,
      templateName,
      resolvedLangCode,
      components || [],
      userId
    );

    if (!sendResult.success) {
      throw new Error(sendResult.error || "Failed to send template");
    }

    try {
      const normalizedPhone = to.replace(/\D/g, "");
      const contacts = await storage.getContacts();
      let contact = contacts.find((c) => {
        const contactPhone = (c.phone || "").replace(/\D/g, "");
        return (
          contactPhone.includes(normalizedPhone) ||
          normalizedPhone.includes(contactPhone)
        );
      });

      if (!contact) {
        const formattedPhone = to.startsWith("+") ? to : `+${to}`;
        contact = await storage.createContact({
          name: formattedPhone,
          phone: to,
          email: "",
          tags: ["WhatsApp"],
          notes: "Auto-created from template message",
        });
      }

      await storage.createMessage({
        contactId: contact.id,
        content: `[Template: ${templateName}]`,
        type: "text" as const,
        direction: "outbound",
        status: "sent" as const,
      });
    } catch (err) {
      console.error("Error saving outbound message:", err);
    }

    res.json({ success: true, messageId: sendResult.messageId });
  } catch (error: any) {
    console.error("Error sending template:", error);
    res.status(500).json({ error: error.message || "Failed to send template" });
  }
}
