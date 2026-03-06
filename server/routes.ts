import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertContactSchema,
  insertMessageSchema,
  insertCampaignSchema,
  insertTemplateSchema,
  insertAutomationSchema,
  insertTeamMemberSchema,
} from "@shared/schema";

import agentRoutes from "./modules/aiAgents/agent.routes";
import fbRoutes from "./modules/facebook/fb.routes";
import mappingRoutes from "./modules/mapping/mapping.routes";
import whatsappRoutes from "./modules/whatsapp/whatsapp.routes";
import leadAutoReplyRoutes from "./modules/leadAutoReply/leadAutoReply.routes";
import broadcastRoutes from "./modules/broadcast/broadcast.routes";
import aiAnalyticsRoutes from "./modules/aiAnalytics/aiAnalytics.routes";
import prefilledTextRoutes from "./modules/prefilledText/prefilledText.routes";
import authRoutes from "./modules/auth/auth.routes";
import credentialsRoutes from "./modules/credentials/credentials.routes";
import contactsRoutes from "./modules/contacts/contacts.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import usersRoutes from "./modules/users/users.routes";
import contactAnalyticsRoutes from "./modules/contactAnalytics/contactAnalytics.controller";
import leadManagementRoutes from "./modules/leadManagement/leadManagement.routes";
import integrationRoutes from "./modules/integrations/integration.routes";
import automationRoutes from "./modules/automation/automation.routes";
import * as agentService from "./modules/aiAgents/agent.service";
import * as openaiService from "./modules/openai/openai.service";
import * as aiService from "./modules/ai/ai.service";
import * as templateService from "./modules/leadAutoReply/templateMessages.service";
import * as mongodb from "./modules/storage/mongodb.adapter";
import * as broadcastService from "./modules/broadcast/broadcast.service";
import * as contactAgentService from "./modules/contactAgent/contactAgent.service";
import * as leadManagementService from "./modules/leadManagement/leadManagement.service";
import flowHandler from "./modules/facebook/fb.routes.ts";
import axios from "axios";
import {
  buildMetaTemplate,
  syncLeadsForFormMain,
  uploadHeaderImage,
  validateMetaTemplate,
} from "./worker.ts";
import mongoose, { Types } from "mongoose";
import multer from "multer";
import cloudinary from "./cloudinary.ts";

const upload = multer({ storage: multer.memoryStorage() });

async function submitMetaTemplate(templatePayload: any) {
  try {
    const accessToken = process.env.SYSTEM_USER_TOKEN_META;
    const phoneNumberId = process.env.WABA_ID;

    if (!accessToken || !phoneNumberId)
      throw new Error("Missing WhatsApp API credentials");

    const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/message_templates`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(templatePayload),
    });

    const data = await response.json();

    if (data.error) {
      return { success: false, error: data.error.message };
    }

    return { success: true, newMetaTemplateId: data.id };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

import { v2 as cloudinaryV2 } from "cloudinary";

const cloudinaryConfig = {
  cloud_name:
    process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD || "",
  api_key: process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_KEY || "",
  api_secret:
    process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET || "",
};

const hasCloudinaryConfig = Boolean(
  cloudinaryConfig.cloud_name &&
    cloudinaryConfig.api_key &&
    cloudinaryConfig.api_secret
);

if (hasCloudinaryConfig) {
  cloudinaryV2.config(cloudinaryConfig);
} else {
  console.warn(
    "[TemplateMediaUpload] Cloudinary env is missing. Media preview URL will not be generated."
  );
}

async function resolveTemplateMediaUploadCredentials(req: Request) {
  let accessToken =
    process.env.FB_PAGE_ACCESS_TOKEN ||
    process.env.SYSTEM_USER_TOKEN_META ||
    process.env.FB_ACCESS_TOKEN ||
    "";
  let appId =
    process.env.META_APP_ID ||
    process.env.FACEBOOK_APP_ID ||
    process.env.APP_ID ||
    "";

  const headerUserIdRaw = req.headers["x-user-id"];
  const headerUserId =
    typeof headerUserIdRaw === "string"
      ? headerUserIdRaw
      : Array.isArray(headerUserIdRaw)
        ? headerUserIdRaw[0]
        : undefined;
  const queryUserId =
    typeof req.query?.userId === "string" ? req.query.userId : undefined;
  const bodyUserId =
    req.body && typeof req.body.userId === "string"
      ? req.body.userId
      : undefined;
  const sessionUserId =
    (req as any)?.session?.userId || (req as any)?.session?.user?.id;
  const userId = headerUserId || sessionUserId || queryUserId || bodyUserId;

  if (userId) {
    try {
      const credentials = await mongodb.UserCredentials.findOne({
        userId,
      }).lean();

      if (!accessToken && credentials?.whatsappToken) {
        accessToken = String(credentials.whatsappToken);
      }

      if (!appId && credentials?.appId) {
        appId = String(credentials.appId);
      }
    } catch (error) {
      console.warn(
        "[TemplateMediaUpload] Could not resolve user credentials:",
        error
      );
    }
  }

  return {
    accessToken: accessToken.trim(),
    appId: appId.trim(),
    userId,
  };
}

export const uploadTemplateHeader = async (req: Request, res: Response) => {
  console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥ uploadTemplateHeader() called");

  try {
    const file = req.file;

    console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Incoming file info:", {
      exists: !!file,
      originalname: file?.originalname,
      mimetype: file?.mimetype,
      size: file?.size,
    });

        if (!file) {
      console.error("No file uploaded");
      return res.status(400).json({ error: "No file uploaded" });
    }

    const getMediaType = (mimeType: string) => {
      if (mimeType.startsWith("image/")) return "image";
      if (mimeType.startsWith("video/")) return "video";
      if (
        [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ].includes(mimeType)
      ) {
        return "document";
      }
      return null;
    };

    const mediaType = getMediaType(file.mimetype);
    if (!mediaType) {
      return res.status(400).json({
        error:
          "Unsupported file type. Allowed: image, video, PDF, DOC, DOCX, TXT.",
      });
    }

    const {
      accessToken,
      appId,
      userId,
    } = await resolveTemplateMediaUploadCredentials(req);

    console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â Environment values:", {
      appId,
      hasAccessToken: !!accessToken,
    });

    if (!accessToken || !appId) {
      const missing: string[] = [];
      if (!accessToken) missing.push("access token");
      if (!appId) missing.push("Meta App ID");

      console.error("[TemplateMediaUpload] Missing Meta credentials", {
        missing,
        userId: userId || null,
      });
      return res.status(500).json({
        error: `Missing Meta credentials: ${missing.join(", ")}`,
        hint: "Configure credentials in Settings (WhatsApp token + App ID) or set FB_PAGE_ACCESS_TOKEN/SYSTEM_USER_TOKEN_META and META_APP_ID/FACEBOOK_APP_ID.",
      });
    }

    const fileName = file.originalname;
    const fileLength = file.size;
    const fileType = file.mimetype;

    // === Step A: Upload to Cloudinary for preview ===
    let previewUrl: string | null = null;
    if (hasCloudinaryConfig) {
      try {
        console.log("Uploading to Cloudinary for preview...");
        const cloudinaryResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinaryV2.uploader.upload_stream(
            {
              folder: "whatsapp/template-media",
              public_id: `${Date.now()}_${fileName.replace(/\.[^/.]+$/, "")}`,
              resource_type:
                mediaType === "image"
                  ? "image"
                  : mediaType === "video"
                    ? "video"
                    : "raw",
              overwrite: false,
            },
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          uploadStream.end(file.buffer);
        });

        previewUrl = (cloudinaryResult as any).secure_url || null;
      } catch (cloudinaryErr) {
        console.warn("Cloudinary preview upload failed:", cloudinaryErr);
      }
    }

    if (!previewUrl) {
      return res.status(500).json({
        error: "Header media uploaded but preview URL could not be generated.",
        hint: "Configure Cloudinary keys (CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET) and re-upload media.",
      });
    }

    // === Step B: Upload to Meta (as before) ===
    console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ Step 1: Creating Meta upload sessionÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦");

    const sessionRes = await axios.post(
      `https://graph.facebook.com/v24.0/${appId}/uploads`,
      {},
      {
        params: {
          file_name: fileName,
          file_length: fileLength,
          file_type: fileType,
          access_token: accessToken,
        },
      }
    );

    console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Meta upload session response:", sessionRes.data);

    const uploadId = sessionRes.data.id;
    console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ Meta uploadId:", uploadId);

    console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³ Step 2: Uploading binary to MetaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦");

    const uploadRes = await axios.post(
      `https://graph.facebook.com/v24.0/${uploadId}`,
      file.buffer,
      {
        headers: {
          Authorization: `OAuth ${accessToken}`,
          "Content-Type": fileType,
          file_offset: 0,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¦ Meta binary upload response:", uploadRes.data);

    const handle = uploadRes.data.h;
    console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â½ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¯ Final Meta media handle:", handle);

    console.log("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ Upload complete, responding to client");

    return res.json({
      success: true,
      handle,
      previewUrl,
      mediaType,
    });
  } catch (err: any) {
    console.error("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â‚¬Å¾Ã‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¥ Upload failed");

    if (err?.response) {
      console.error("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¨ Axios response error:", {
        status: err.response.status,
        data: err.response.data,
        headers: err.response.headers,
      });
    } else if (err?.request) {
      console.error("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â°ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã¢â‚¬Å“ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­ Axios request error (no response):", err.request);
    } else {
      console.error("ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¯ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¸ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â General error message:", err.message);
    }

    return res.status(500).json({
      error: "Upload Failed",
      details: err?.response?.data || err.message,
    });
  }
};


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  const FB_API_VERSION = "v17.0";
  const FB_PAGE_ID = process.env.FB_PAGE_ID;
  const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

  app.post(
    "/api/upload/template-header",
    upload.single("file"),
    async (req, res) => {
      try {
        await uploadTemplateHeader(req, res);
      } catch (err) {
        console.error("[Route Error]", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );

  app.post(
    "/api/upload/template-media",
    upload.single("file"),
    async (req, res) => {
      try {
        await uploadTemplateHeader(req, res);
      } catch (err) {
        console.error("[Route Error]", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    }
  );


  app.get("/api/fb-automation/stats", async (req, res) => {
    const [totalLeads, sent, unsent, failed, activeAutomations] =
      await Promise.all([
        mongodb.Leadfb.countDocuments(),
        mongodb.Leadfb.countDocuments({ template_sent: true }),
        mongodb.Leadfb.countDocuments({
          template_sent: false,
          last_error: { $exists: false },
        }),
        mongodb.Leadfb.countDocuments({ last_error: { $exists: true } }),
        mongodb.FormAutomation.countDocuments({ automation_active: true }),
      ]);

    res.json({
      totalLeads,
      sent,
      unsent,
      failed,
      activeAutomations,
    });
  });

  app.get("/api/fb-automation/leads", async (req, res) => {
    const { search = "", status = "all", formId } = req.query as any;

    const filter: any = {};

    // Search
    if (search) {
      filter.$or = [
        { full_name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status === "sent") {
      filter.template_sent = true;
    } else if (status === "unsent") {
      filter.template_sent = false;
      filter.last_error = { $exists: false };
    } else if (status === "failed") {
      filter.last_error = { $exists: true };
    }

    // Form filter
    if (formId && formId !== "all") {
      filter.form_id = formId;
    }

    const rows = await mongodb.Leadfb.find(filter)
      .sort({ created_time: -1 })
      .limit(200);

    res.json({
      rows,
      total: rows.length,
    });
  });

  app.post("/api/fb-automation/retry", async (req, res) => {
    const { ids } = req.body as { ids: string[] };

    if (!ids?.length) {
      return res.status(400).json({ message: "No lead IDs provided" });
    }

    const objectIds = ids.map((id) => new Types.ObjectId(id));

    const leads = await mongodb.Leadfb.find({
      _id: { $in: objectIds },
      $or: [{ template_sent: false }, { last_error: { $exists: true } }],
    });

    for (const lead of leads) {
      console.log(`Enqueuing retry for lead ${lead._id}`);
      // await enqueueAutomationRetry(lead);
    }

    res.json({
      success: true,
      retried: leads.length,
    });
  });

  const normalizeCampaignStep = (step: any, index: number) => {
    const templateId = step?.templateId || step?.template_id;
    if (!templateId) return null;

    const scheduleType: "delay" | "specific" =
      step?.scheduleType === "specific" ? "specific" : "delay";

    let delayDays = Number(step?.delayDays ?? 0);
    let delayHours = Number(step?.delayHours ?? 0);

    if (!Number.isFinite(delayDays)) delayDays = 0;
    if (!Number.isFinite(delayHours)) delayHours = 0;

    if (step?.delay_unit && step?.delay_value !== undefined) {
      const delayValue = Number(step.delay_value) || 0;
      if (step.delay_unit === "minutes") {
        delayHours += delayValue / 60;
      } else if (step.delay_unit === "hours") {
        delayHours += delayValue;
      } else if (step.delay_unit === "days") {
        delayDays += delayValue;
      }
    }

    return {
      templateId,
      template_name: step?.template_name || "",
      scheduleType,
      delayDays,
      delayHours,
      specificDate: step?.specificDate || undefined,
      specificTime: step?.specificTime || step?.send_at_time || undefined,
      order: index,
    };
  };

  const getCampaignStepDelayMs = (step: any): number => {
    const delayDays = Number(step?.delayDays ?? 0);
    const delayHours = Number(step?.delayHours ?? 0);
    const delayMinutes = Number(step?.delayMinutes ?? 0);
    const delayValue = Number(step?.delay_value ?? 0);
    const delayUnit = step?.delay_unit;

    let totalMinutes =
      (Number.isFinite(delayDays) ? delayDays : 0) * 24 * 60 +
      (Number.isFinite(delayHours) ? delayHours : 0) * 60 +
      (Number.isFinite(delayMinutes) ? delayMinutes : 0);

    if (Number.isFinite(delayValue) && delayValue > 0) {
      if (delayUnit === "minutes") {
        totalMinutes += delayValue;
      } else if (delayUnit === "hours") {
        totalMinutes += delayValue * 60;
      } else if (delayUnit === "days") {
        totalMinutes += delayValue * 24 * 60;
      }
    }

    return Math.max(0, totalMinutes * 60 * 1000);
  };

  const calculateCampaignNextRunAt = (
    step: any,
    baseDate: Date = new Date()
  ): Date => {
    if (step?.scheduleType === "specific" && step?.specificDate && step?.specificTime) {
      const specific = new Date(`${step.specificDate}T${step.specificTime}:00`);
      if (!Number.isNaN(specific.getTime())) {
        return specific;
      }
    }

    const nextRunAt = new Date(baseDate.getTime() + getCampaignStepDelayMs(step));
    const preferredTime = step?.specificTime || step?.send_at_time;

    if (preferredTime) {
      const [hours, minutes] = String(preferredTime).split(":").map(Number);
      if (Number.isFinite(hours) && Number.isFinite(minutes)) {
        nextRunAt.setHours(hours, minutes, 0, 0);
        if (nextRunAt < baseDate) {
          nextRunAt.setDate(nextRunAt.getDate() + 1);
        }
      }
    }

    return nextRunAt;
  };

  const normalizeCampaignContact = (contact: any): string | null => {
    if (typeof contact === "string") {
      const digits = contact.replace(/\D/g, "");
      if (!digits) return null;
      return digits.length === 10 ? `91${digits}` : digits;
    }

    if (typeof contact === "object" && contact) {
      const raw = String(
        contact.phone || contact.Phone || contact.mobile || contact.whatsapp || ""
      );
      const digits = raw.replace(/\D/g, "");
      if (!digits) return null;
      return digits.length === 10 ? `91${digits}` : digits;
    }

    return null;
  };

  app.post("/api/drip-campaigns", async (req, res) => {
    try {
      const {
        name,
        campaign_name,
        contacts = [],
        steps = [],
        form_id,
        form_name,
      } = req.body || {};

      const campaignName = campaign_name || name;

      if (!campaignName || typeof campaignName !== "string") {
        return res.status(400).json({ error: "Campaign name is required" });
      }

      const normalizedSteps = (Array.isArray(steps) ? steps : [])
        .map((s: any, i: number) => normalizeCampaignStep(s, i))
        .filter(Boolean);

      if (normalizedSteps.length === 0) {
        return res.status(400).json({
          error: "At least one valid campaign step is required",
        });
      }

      const templateIds = Array.from(
        new Set(
          normalizedSteps
            .map((step: any) => String(step?.templateId || "").trim())
            .filter(Boolean)
        )
      );
      const templateDocs = templateIds.length
        ? await mongodb.Template.find(
            { id: { $in: templateIds } },
            { id: 1, name: 1 }
          ).lean()
        : [];
      const templateNameById = new Map<string, string>(
        (templateDocs as any[]).map((tpl) => [
          String(tpl.id || ""),
          String(tpl.name || ""),
        ])
      );
      const resolvedSteps = normalizedSteps.map((step: any) => ({
        ...step,
        template_name:
          String(step?.template_name || "").trim() ||
          templateNameById.get(String(step.templateId || "")) ||
          "",
      }));

      const now = new Date();
      for (let i = 0; i < resolvedSteps.length; i++) {
        const step = resolvedSteps[i];
        if (
          step?.scheduleType === "specific" &&
          step?.specificDate &&
          step?.specificTime
        ) {
          const specificAt = new Date(
            `${step.specificDate}T${step.specificTime}:00`
          );
          if (Number.isNaN(specificAt.getTime())) {
            return res.status(400).json({
              error: `Invalid specific date/time for step ${i + 1}`,
            });
          }
          if (specificAt <= now) {
            return res.status(400).json({
              error: `Step ${i + 1} specific date/time is in the past. Please select a future time.`,
            });
          }
        }
      }

      const initialContacts = (Array.isArray(contacts) ? contacts : [])
        .map(normalizeCampaignContact)
        .filter(Boolean) as string[];

      let normalizedContacts = Array.from(new Set(initialContacts));

      if (normalizedContacts.length === 0 && form_id) {
        const leads = await mongodb.Leadfb.find({
          form_id,
          phone: { $exists: true, $ne: "" },
        }).lean();

        normalizedContacts = Array.from(
          new Set(
            leads
              .map((lead: any) => normalizeCampaignContact(lead.phone))
              .filter(Boolean) as string[]
          )
        );
      }

      if (normalizedContacts.length === 0) {
        return res.status(400).json({
          error: "No valid contacts found",
        });
      }

      const firstStep = resolvedSteps[0];
      const firstRunAt = firstStep
        ? calculateCampaignNextRunAt(firstStep, new Date())
        : new Date();

      const campaign = await mongodb.Campaign.create({
        id: uuidv4(),
        name: campaignName,
        campaign_name: campaignName,
        form_id: form_id || undefined,
        form_name: form_name || undefined,
        is_active: true,
        status: "running",
        currentStep: 0,
        nextRunAt: firstRunAt,
        contacts: normalizedContacts,
        steps: resolvedSteps,
      });

      res.json(campaign);
    } catch (error) {
      console.error("Error creating drip campaign:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to create campaign";
      res.status(500).json({ error: message });
    }
  });
  // GET /api/reports/drip-campaigns
  app.get("/api/reports/drip-campaigns", async (req, res) => {
    const {
      search = "",
      status,
      fromDate,
      toDate,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    const filter: any = {};

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { id: { $regex: search, $options: "i" } },
      ];
    }

    if (status) filter.status = status;

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate) filter.createdAt.$gte = new Date(fromDate as string);
      if (toDate) {
        const endDate = new Date(toDate as string);
        endDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDate;
      }
    }

    const campaigns = await mongodb.Campaign.find(filter)
      .sort({ [sortBy as string]: sortOrder === "asc" ? 1 : -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .lean();

    const total = await mongodb.Campaign.countDocuments(filter);

    const campaignIds = campaigns
      .map((campaign: any) => campaign?._id)
      .filter(Boolean);

    const metricsByCampaign = new Map<string, any>();
    if (campaignIds.length > 0) {
      const metrics = await mongodb.CampaignLog.aggregate([
        {
          $match: {
            campaignId: { $in: campaignIds },
          },
        },
        {
          $group: {
            _id: "$campaignId",
            attempted: { $sum: 1 },
            accepted: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["accepted", "sent", "delivered", "read"]] },
                  1,
                  0,
                ],
              },
            },
            delivered: {
              $sum: {
                $cond: [{ $in: ["$status", ["delivered", "read"]] }, 1, 0],
              },
            },
            read: {
              $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] },
            },
            failed: {
              $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
            },
            pending: {
              $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
            },
            metaAccepted: {
              $sum: { $cond: [{ $eq: ["$metaAccepted", true] }, 1, 0] },
            },
            lastAttemptAt: { $max: "$sendAttemptedAt" },
            lastWebhookAt: { $max: "$updatedAt" },
          },
        },
      ]);

      for (const metric of metrics) {
        metricsByCampaign.set(String(metric._id), metric);
      }
    }

    const data = campaigns.map((campaign: any) => {
      const metric = metricsByCampaign.get(String(campaign?._id)) || {};
      const contactsCount = Array.isArray(campaign?.contacts)
        ? campaign.contacts.length
        : 0;
      const stepsCount = Array.isArray(campaign?.steps) ? campaign.steps.length : 0;
      const expectedMessages = contactsCount * stepsCount;
      return {
        ...campaign,
        reportMetrics: {
          expectedMessages,
          attempted: Number(metric.attempted || 0),
          accepted: Number(metric.accepted || 0),
          delivered: Number(metric.delivered || 0),
          read: Number(metric.read || 0),
          failed: Number(metric.failed || 0),
          pending: Number(metric.pending || 0),
          notAttempted: Math.max(
            0,
            expectedMessages - Number(metric.attempted || 0)
          ),
          metaAccepted: Number(metric.metaAccepted || 0),
          lastAttemptAt: metric.lastAttemptAt || null,
          lastWebhookAt: metric.lastWebhookAt || null,
        },
      };
    });

    res.json({
      data,
      meta: {
        total,
        page: +page,
        limit: +limit,
      },
    });
  });
  // GET /api/reports/drip-campaigns/:campaignId/summary
  app.get("/api/reports/drip-campaigns/:id/summary", async (req, res) => {
    const campaignId = req.params.id;
    const campaignIdFilter = mongoose.Types.ObjectId.isValid(campaignId)
      ? { $in: [new mongoose.Types.ObjectId(campaignId), campaignId] }
      : campaignId;

    const steps = await mongodb.CampaignLog.aggregate([
      { $match: { campaignId: campaignIdFilter } },
      {
        $group: {
          _id: "$stepIndex",
          sent: {
            $sum: {
              $cond: [
                { $in: ["$status", ["accepted", "sent", "delivered", "read"]] },
                1,
                0,
              ],
            },
          },
          failed: {
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ steps });
  });

  // GET /api/reports/drip-campaigns/:campaignId/logs
  app.get("/api/reports/drip-campaigns/:id/logs", async (req, res) => {
    const { stepIndex, status, contact, page = 1, limit = 20 } = req.query;

    const campaignId = req.params.id;
    const filter: any = {
      campaignId: mongoose.Types.ObjectId.isValid(campaignId)
        ? { $in: [new mongoose.Types.ObjectId(campaignId), campaignId] }
        : campaignId,
    };

    if (stepIndex !== undefined) filter.stepIndex = +stepIndex;
    if (status) filter.status = status;
    if (contact) filter.contact = { $regex: contact, $options: "i" };

    const logs = await mongodb.CampaignLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((+page - 1) * +limit)
      .limit(+limit);

    const total = await mongodb.CampaignLog.countDocuments(filter);

    res.json({ data: logs, total });
  });

  // GET /api/reports/drip-campaigns/:campaignId/details
  app.get("/api/reports/drip-campaigns/:id/details", async (req, res) => {
    try {
      const campaignId = String(req.params.id || "").trim();
      const objectId = mongoose.Types.ObjectId.isValid(campaignId)
        ? new mongoose.Types.ObjectId(campaignId)
        : null;

      const campaignQuery = objectId
        ? { $or: [{ _id: objectId }, { id: campaignId }] }
        : { id: campaignId };

      const campaign = await mongodb.Campaign.findOne(campaignQuery).lean();
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const campaignIdFilter = objectId
        ? { $in: [objectId, campaignId] }
        : campaignId;

      const logs = await mongodb.CampaignLog.find({ campaignId: campaignIdFilter })
        .sort({ stepIndex: 1, contact: 1, createdAt: 1 })
        .lean();

      const messageIds = Array.from(
        new Set(
          logs
            .map((log: any) => String(log?.messageId || "").trim())
            .filter(Boolean)
        )
      );

      const webhookEvents = messageIds.length
        ? await mongodb.WebhookStatusEvent.find({ messageId: { $in: messageIds } })
            .sort({ statusTimestamp: 1, createdAt: 1 })
            .lean()
        : [];

      const eventsByMessageId = new Map<string, any[]>();
      for (const event of webhookEvents) {
        const messageId = String(event?.messageId || "").trim();
        if (!messageId) continue;
        const existing = eventsByMessageId.get(messageId) || [];
        existing.push(event);
        eventsByMessageId.set(messageId, existing);
      }

      const normalizedContacts = Array.from(
        new Set(
          (Array.isArray((campaign as any).contacts) ? (campaign as any).contacts : [])
            .map((contact: any) => String(contact || "").trim())
            .filter(Boolean)
        )
      );

      const logsByStepContact = new Map<string, any>();
      for (const log of logs) {
        const key = `${Number(log?.stepIndex || 0)}::${String(log?.contact || "").trim()}`;
        logsByStepContact.set(key, log);
      }

      const steps = (Array.isArray((campaign as any).steps) ? (campaign as any).steps : []).map(
        (step: any, stepIndex: number) => {
          const contacts = normalizedContacts.map((contact) => {
            const key = `${stepIndex}::${contact}`;
            const log = logsByStepContact.get(key);
            const messageId = String(log?.messageId || "").trim();
            const timeline = messageId ? eventsByMessageId.get(messageId) || [] : [];
            const latestEvent = timeline.length > 0 ? timeline[timeline.length - 1] : null;

            const baseStatus = String(log?.status || "not_attempted").toLowerCase();
            const providerStatus = String(log?.providerStatus || "").toLowerCase();
            const webhookStatus = String(latestEvent?.status || "").toLowerCase();

            const finalMetaStatus =
              webhookStatus ||
              providerStatus ||
              (baseStatus === "accepted" ? "sent" : baseStatus);

            return {
              contact,
              status: baseStatus,
              providerStatus: providerStatus || null,
              finalMetaStatus: finalMetaStatus || "not_attempted",
              attemptCount: Number(log?.attemptCount || 0),
              templateName: log?.templateName || step?.template_name || null,
              templateId: step?.templateId || null,
              messageId: messageId || null,
              sentAt: log?.sentAt || null,
              deliveredAt: log?.deliveredAt || null,
              readAt: log?.readAt || null,
              failedAt: log?.failedAt || null,
              sendAttemptedAt: log?.sendAttemptedAt || null,
              attemptedLanguage: log?.attemptedLanguage || null,
              providerHttpStatus:
                typeof log?.providerHttpStatus === "number"
                  ? log.providerHttpStatus
                  : null,
              providerErrorCode: log?.providerErrorCode || null,
              error: log?.error || null,
              metaAccepted: Boolean(log?.metaAccepted),
              metaAcceptedAt: log?.metaAcceptedAt || null,
              requestPayload: log?.requestPayload || null,
              providerResponse: log?.providerResponse || null,
              webhookTimeline: timeline.map((event: any) => ({
                id: event?.id || null,
                status: event?.status || null,
                statusTimestamp: event?.statusTimestamp || null,
                webhookReceivedAt: event?.webhookReceivedAt || null,
                errorCode: event?.errorCode || null,
                errorTitle: event?.errorTitle || null,
                errorMessage: event?.errorMessage || null,
                errorDetails: event?.errorDetails || null,
                rawStatus: event?.rawStatus || null,
              })),
            };
          });

          const attempted = contacts.filter((item) => item.status !== "not_attempted").length;
          const failed = contacts.filter(
            (item) => item.status === "failed" || item.finalMetaStatus === "failed"
          ).length;
          const read = contacts.filter(
            (item) => item.status === "read" || item.finalMetaStatus === "read"
          ).length;
          const delivered = contacts.filter(
            (item) =>
              item.status === "delivered" ||
              item.status === "read" ||
              item.finalMetaStatus === "delivered" ||
              item.finalMetaStatus === "read"
          ).length;
          const accepted = contacts.filter((item) =>
            ["accepted", "sent", "delivered", "read"].includes(item.status) ||
            ["accepted", "sent", "delivered", "read"].includes(item.finalMetaStatus)
          ).length;
          const pending = contacts.filter(
            (item) =>
              item.status === "pending" ||
              item.finalMetaStatus === "pending" ||
              item.finalMetaStatus === "accepted" ||
              item.finalMetaStatus === "sent"
          ).length;
          const notAttempted = contacts.length - attempted;

          return {
            stepIndex,
            stepOrder: stepIndex + 1,
            templateName: step?.template_name || null,
            templateId: step?.templateId || null,
            scheduleType: step?.scheduleType || null,
            delayDays: Number(step?.delayDays || 0),
            delayHours: Number(step?.delayHours || 0),
            specificDate: step?.specificDate || null,
            specificTime: step?.specificTime || null,
            totals: {
              contacts: contacts.length,
              attempted,
              accepted,
              delivered,
              read,
              failed,
              pending,
              notAttempted,
            },
            contacts,
          };
        }
      );

      const stepTotals = steps.reduce(
        (acc: any, step: any) => {
          acc.expectedMessages += Number(step?.totals?.contacts || 0);
          acc.attempted += Number(step?.totals?.attempted || 0);
          acc.accepted += Number(step?.totals?.accepted || 0);
          acc.delivered += Number(step?.totals?.delivered || 0);
          acc.read += Number(step?.totals?.read || 0);
          acc.failed += Number(step?.totals?.failed || 0);
          acc.pending += Number(step?.totals?.pending || 0);
          acc.notAttempted += Number(step?.totals?.notAttempted || 0);
          return acc;
        },
        {
          expectedMessages: 0,
          attempted: 0,
          accepted: 0,
          delivered: 0,
          read: 0,
          failed: 0,
          pending: 0,
          notAttempted: 0,
        }
      );

      const webhookSummary = webhookEvents.reduce((acc: Record<string, number>, event: any) => {
        const key = String(event?.status || "unknown").toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      return res.json({
        campaign: {
          ...campaign,
          contactsCount: normalizedContacts.length,
          stepsCount: Array.isArray((campaign as any).steps)
            ? (campaign as any).steps.length
            : 0,
        },
        totals: {
          ...stepTotals,
          totalContacts: normalizedContacts.length,
          totalSteps: steps.length,
          metaAccepted: logs.filter((log: any) => Boolean(log?.metaAccepted)).length,
          webhookEvents: webhookEvents.length,
        },
        webhookSummary,
        steps,
      });
    } catch (error) {
      console.error("[DripReport] Failed to fetch campaign details:", error);
      return res.status(500).json({ error: "Failed to fetch campaign details" });
    }
  });


  app.get("/api/drip-campaigns", async (req, res) => {
    try {
      const { search = "", status = "all", form_id, is_active } = req.query as any;
      const filter: any = {};

      if (search && String(search).trim()) {
        const searchRegex = { $regex: String(search).trim(), $options: "i" };
        filter.$or = [
          { name: searchRegex },
          { campaign_name: searchRegex },
          { id: searchRegex },
          { form_name: searchRegex },
          { form_id: searchRegex },
        ];
      }

      if (status && status !== "all") {
        filter.status = status;
      }

      if (form_id) {
        filter.form_id = form_id;
      }

      if (typeof is_active === "string") {
        if (is_active === "true") filter.is_active = true;
        if (is_active === "false") filter.is_active = false;
      }

      const campaigns = await mongodb.Campaign.find(filter)
        .sort({ createdAt: -1 })
        .lean();

      res.json(
        campaigns.map((campaign: any) => ({
          ...campaign,
          campaign_name: campaign.campaign_name || campaign.name,
          is_active:
            typeof campaign.is_active === "boolean"
              ? campaign.is_active
              : campaign.status === "running",
        }))
      );
    } catch (error) {
      console.error("Error fetching drip campaigns:", error);
      res.status(500).json({ error: "Failed to fetch drip campaigns" });
    }
  });

  app.post("/api/drip-campaigns/:id/toggle", async (req, res) => {
    try {
      const { id } = req.params;
      const isActive = req.body?.is_active === true || req.body?.is_active === "true";

      const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id };
      const campaign: any = await mongodb.Campaign.findOne(query);

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const wasCompleted = campaign.status === "completed";
      campaign.is_active = isActive;
      campaign.status = isActive ? "running" : "paused";

      if (isActive) {
        if (wasCompleted || campaign.currentStep >= campaign.steps.length) {
          campaign.currentStep = 0;
        }

        const now = new Date();
        const currentStep = campaign.steps[campaign.currentStep];
        if (!currentStep) {
          campaign.status = "completed";
          campaign.is_active = false;
          campaign.nextRunAt = null;
        } else if (
          campaign.nextRunAt instanceof Date &&
          !Number.isNaN(campaign.nextRunAt.getTime()) &&
          campaign.nextRunAt > now
        ) {
          // Keep existing future schedule when resuming.
        } else {
          campaign.nextRunAt = calculateCampaignNextRunAt(currentStep, now);
        }
      } else {
        campaign.isProcessing = false;
      }

      await campaign.save();
      return res.json(campaign);
    } catch (error) {
      console.error("Error toggling campaign:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.patch("/api/drip-campaigns/:id/start", async (req, res) => {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id };
    const campaign = await mongodb.Campaign.findOne(query);

    if (!campaign) return res.status(404).send();

    const wasCompleted =
      campaign.status === "completed" ||
      !Array.isArray(campaign.steps) ||
      campaign.currentStep >= campaign.steps.length;

    if (wasCompleted) {
      campaign.currentStep = 0;
    }

    campaign.status = "running";
    campaign.is_active = true;

    const now = new Date();
    const currentStep = campaign.steps?.[campaign.currentStep];
    if (currentStep) {
      if (
        campaign.nextRunAt instanceof Date &&
        !Number.isNaN(campaign.nextRunAt.getTime()) &&
        campaign.nextRunAt > now
      ) {
        // Keep precomputed future schedule when resuming.
      } else {
        campaign.nextRunAt = calculateCampaignNextRunAt(currentStep, now);
      }
    } else {
      campaign.nextRunAt = null;
      campaign.status = "completed";
      campaign.is_active = false;
    }

    await campaign.save();
    res.json(campaign);
  });

  // PATCH /campaign/:id/pause
  app.patch("/api/drip-campaigns/:id/pause", async (req, res) => {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({ error: "Campaign id is required" });
      }

      const campaign = await mongodb.Campaign.findById(id);

      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      campaign.status = "paused";
      campaign.is_active = false;
      campaign.isProcessing = false;

      await campaign.save();

      return res.json({ success: true });
    } catch (error) {
      console.error("Error pausing campaign:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  app.delete("/api/drip-campaigns/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id };

      const deleted = await mongodb.Campaign.findOneAndDelete(query);

      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, message: "Campaign not found" });
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  });

  app.get("/api/forms", async (req, res) => {
    try {
      // Fetch forms from Facebook
      const fbResponse = await axios.get(
        `https://graph.facebook.com/${FB_API_VERSION}/${FB_PAGE_ID}/leadgen_forms?access_token=${FB_ACCESS_TOKEN}`
      );

      const fbForms = fbResponse.data.data || [];

      // Get automation status from database
      const automations = await mongodb.FormAutomation.find();
      const automationMap: Record<string, any> = {};

      automations.forEach((auto) => {
        automationMap[auto.form_id] = auto;
      });

      // Merge data
      const forms = fbForms.map(
        (form: { id: string | number; name: any; status: any }) => ({
          id: form.id,
          name: form.name,
          status: form.status,
          assigned_template: automationMap[form.id]?.template_id || null,
          automation_active: automationMap[form.id]?.automation_active || false,
          last_sync: automationMap[form.id]?.last_sync || null,
        })
      );

      res.json(forms);
    } catch (error: any) {
      console.error("Error fetching forms:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/set-trigger", async (req, res) => {
    try {
      const { form_id, form_name, template_id, template_name } = req.body;

      await mongodb.FormAutomation.findOneAndUpdate(
        { form_id },
        {
          form_id,
          form_name,
          template_id,
          template_name,
          updated_at: new Date(),
        },
        { upsert: true, new: true }
      );

      res.json({ success: true, message: "Template assigned successfully" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/toggle-form-automation", async (req, res) => {
    try {
      const { form_id, is_active } = req.body;

      const automation = await mongodb.FormAutomation.findOne({ form_id });

      if (!automation) {
        return res.status(404).json({
          error: "Form automation not found. Please assign a template first.",
        });
      }

      automation.automation_active = is_active;
      automation.updated_at = new Date();

      // If starting automation, run initial sync immediately
      if (is_active) {
        automation.last_sync = new Date();
        await automation.save();

        // Run sync in background
        syncLeadsForFormMain(automation).catch((err) => {
          console.error("Error in initial sync:", err);
        });

        res.json({
          success: true,
          message: "Automation started. Initial sync in progress...",
          automation_active: true,
        });
      } else {
        await automation.save();
        res.json({
          success: true,
          message: "Automation stopped",
          automation_active: false,
        });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/status", async (req, res) => {
    try {
      const activeCount = await mongodb.FormAutomation.countDocuments({
        automation_active: true,
      });
      res.json({
        is_running: activeCount > 0,
        active_automations: activeCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 4. Control (Stop/Start Sync)
  app.post("/api/control", async (req, res) => {
    try {
      const { run } = req.body;

      // Update all automations
      await mongodb.FormAutomation.updateMany(
        {},
        { automation_active: run, updated_at: new Date() }
      );

      res.json({ success: true, is_running: run });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/sync-form/:formId", async (req, res) => {
    try {
      const automation = await mongodb.FormAutomation.findOne({
        form_id: req.params.formId,
      });

      if (!automation) {
        return res.status(404).json({ error: "Form automation not found" });
      }

      const result = await syncLeadsForFormMain(automation);
      res.json({ success: true, ...result });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // // 5. Get System Status
  // app.get("/api/status", async (req, res) => {
  //   const config = await mongodb.SystemConfig.findOne({
  //     key: "scheduler_config",
  //   });
  //   res.json({ is_running: config ? config.is_running : true });
  // });

  app.get("/api/users/all", async (req, res) => {
    try {
      const users = await mongodb.User.find(
        {},
        {
          id: 1,
          name: 1,
          email: 1,
          role: 1,
        }
      ).lean();

      res.json(users);
    } catch (error) {
      console.error("Fetch users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  const TEMPLATE_PRICE = 0.85;

  app.get("/templates", async (req: Request, res: Response) => {
    try {
      const { contactPhone, startDate, endDate, groupBy = "day" } = req.query;

      if (!contactPhone) {
        return res.status(400).json({
          success: false,
          message: "contactPhone is required",
        });
      }

      const start = startDate
        ? new Date(startDate as string)
        : new Date("1970-01-01");

      const end = endDate ? new Date(endDate as string) : new Date();

      let dateFormat = "%Y-%m-%d";
      if (groupBy === "week") dateFormat = "%Y-%U";
      if (groupBy === "month") dateFormat = "%Y-%m";

      const pipeline = [
        {
          $match: {
            messageType: "template",
            status: "sent",
            contactPhone,
            timestamp: { $gte: start, $lte: end },
          },
        },
        {
          $addFields: {
            date: {
              $dateToString: {
                format: dateFormat,
                date: { $toDate: "$timestamp" },
              },
            },
          },
        },
        {
          $group: {
            _id: {
              date: "$date",
              templateName: "$templateName",
            },
            sentCount: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            templates: {
              $push: {
                templateName: "$_id.templateName",
                count: "$sentCount",
                cost: { $multiply: ["$sentCount", TEMPLATE_PRICE] },
              },
            },
            totalSent: { $sum: "$sentCount" },
          },
        },
        {
          $addFields: {
            totalCost: {
              $round: [{ $multiply: ["$totalSent", TEMPLATE_PRICE] }, 2],
            },
          },
        },
        {
          $sort: { _id: 1 as const },
        },
      ];

      const breakdown = await mongodb.BroadcastLog.aggregate(pipeline as any);

      const summary = breakdown.reduce(
        (acc, item) => {
          acc.totalTemplatesSent += item.totalSent;
          acc.totalCost += item.totalCost;
          return acc;
        },
        { totalTemplatesSent: 0, totalCost: 0 }
      );

      res.json({
        success: true,
        filters: {
          contactPhone,
          startDate,
          endDate,
          groupBy,
        },
        summary: {
          ...summary,
          totalCost: `ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¹${summary.totalCost.toFixed(2)}`,
        },
        breakdown,
      });
    } catch (error) {
      console.error("Template report error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to generate template report",
      });
    }
  });

  app.get("/api/broadcast/template-report", async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const COST_PER_TEMPLATE = 0.85;

      /* ---------- DATE FILTER ---------- */
      let dateMatch: any = {};

      if (startDate && endDate) {
        dateMatch.timestamp = {
          $gte: new Date(`${startDate}T00:00:00.000Z`),
          $lte: new Date(`${endDate}T23:59:59.999Z`),
        };
      }

      /* ---------- AGGREGATION ---------- */
      const report = await mongodb.BroadcastLog.aggregate([
        {
          $match: {
            messageType: "template",
            status: "sent",
            ...dateMatch,
          },
        },
        {
          $addFields: {
            sentDate: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: {
                  $cond: [
                    { $eq: [{ $type: "$timestamp" }, "string"] },
                    { $toDate: "$timestamp" },
                    "$timestamp",
                  ],
                },
              },
            },
          },
        },
        {
          $group: {
            _id: {
              date: "$sentDate",
              templateName: "$templateName",
            },
            sentCount: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: "$_id.date",
            templates: {
              $push: {
                templateName: "$_id.templateName",
                sentCount: "$sentCount",
                cost: {
                  $multiply: ["$sentCount", COST_PER_TEMPLATE],
                },
              },
            },
            totalSent: { $sum: "$sentCount" },
          },
        },
        {
          $project: {
            _id: 0,
            date: "$_id",
            templates: 1,
            totalSent: 1,
            totalCost: {
              $multiply: ["$totalSent", COST_PER_TEMPLATE],
            },
          },
        },
        { $sort: { date: 1 } },
      ]);

      /* ---------- GRAND TOTAL ---------- */
      const grandTotalSent = report.reduce((sum, d) => sum + d.totalSent, 0);
      const grandTotalCost = grandTotalSent * COST_PER_TEMPLATE;

      res.json({
        currency: "INR",
        costPerTemplate: COST_PER_TEMPLATE,
        grandTotalSent,
        grandTotalCost,
        data: report,
      });
    } catch (error) {
      console.error("Template report error:", error);
      res.status(500).json({ message: "Failed to fetch template report" });
    }
  });

  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get dashboard stats" });
    }
  });

  app.get("/api/reports/campaign", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const messages = await storage.getMessages();
      const campaigns = await storage.getCampaigns();
      const templates = await storage.getTemplates();
      const broadcastLogs = await broadcastService.getBroadcastLogs({
        limit: 10000,
      });

      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const periodMessages = messages.filter(
        (m) => new Date(m.timestamp) >= startDate
      );
      const outbound = periodMessages.filter((m) => m.direction === "outbound");
      const inbound = periodMessages.filter((m) => m.direction === "inbound");

      const totalSent = outbound.length;
      const delivered = outbound.filter(
        (m) => m.status === "delivered" || m.status === "read"
      ).length;
      const read = outbound.filter((m) => m.status === "read").length;
      const replied = inbound.length;
      const failed = outbound.filter((m) => m.status === "failed").length;

      const deliveryRate =
        totalSent > 0 ? Math.round((delivered / totalSent) * 100 * 10) / 10 : 0;
      const readRate =
        delivered > 0 ? Math.round((read / delivered) * 100 * 10) / 10 : 0;
      const replyRate =
        read > 0 ? Math.round((replied / read) * 100 * 10) / 10 : 0;

      const deliveryData = [
        { name: "Delivered", value: delivered, color: "#22c55e" },
        { name: "Read", value: read, color: "#3b82f6" },
        { name: "Replied", value: replied, color: "#8b5cf6" },
        { name: "Failed", value: failed, color: "#ef4444" },
      ];

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyStats = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayMsgs = periodMessages.filter((m) => {
          const msgDate = new Date(m.timestamp);
          return msgDate.toDateString() === date.toDateString();
        });
        const dayOutbound = dayMsgs.filter((m) => m.direction === "outbound");
        const dayInbound = dayMsgs.filter((m) => m.direction === "inbound");
        dailyStats.push({
          name: dayNames[date.getDay()],
          date: date.toISOString().split("T")[0],
          sent: dayOutbound.length,
          read: dayOutbound.filter((m) => m.status === "read").length,
          replied: dayInbound.length,
        });
      }

      const campaignStats = campaigns
        .map((c) => ({
          name: c.name,
          type: "Marketing",
          sent: c.sentCount || 0,
          delivered: c.deliveredCount || 0,
          read: c.readCount || 0,
          replied: c.repliedCount || 0,
          cost: (c.sentCount || 0) * 0.01,
          date: c.scheduledAt || c.createdAt,
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);

      const templateUsage: Record<
        string,
        { sent: number; delivered: number; read: number; replied: number }
      > = {};
      for (const log of broadcastLogs) {
        if (log.templateName) {
          if (!templateUsage[log.templateName]) {
            templateUsage[log.templateName] = {
              sent: 0,
              delivered: 0,
              read: 0,
              replied: 0,
            };
          }
          templateUsage[log.templateName].sent++;
          if (log.status === "delivered" || log.status === "sent") {
            templateUsage[log.templateName].delivered++;
          }
          if (log.replied) {
            templateUsage[log.templateName].replied++;
          }
        }
      }

      for (const msg of periodMessages) {
        if (msg.content && msg.content.startsWith("[Template:")) {
          const match = msg.content.match(/\[Template:\s*([^\]]+)\]/);
          if (match) {
            const templateName = match[1];
            if (!templateUsage[templateName]) {
              templateUsage[templateName] = {
                sent: 0,
                delivered: 0,
                read: 0,
                replied: 0,
              };
            }
            if (msg.direction === "outbound") {
              templateUsage[templateName].sent++;
              if (msg.status === "delivered" || msg.status === "read") {
                templateUsage[templateName].delivered++;
              }
              if (msg.status === "read") {
                templateUsage[templateName].read++;
              }
            }
          }
        }
      }

      const templatePerformance = Object.entries(templateUsage)
        .map(([name, stats]) => ({
          name,
          sent: stats.sent,
          delivered: stats.delivered,
          read: stats.read,
          replied: stats.replied,
          readRate:
            stats.delivered > 0
              ? Math.round((stats.read / stats.delivered) * 100)
              : 0,
          replyRate:
            stats.read > 0 ? Math.round((stats.replied / stats.read) * 100) : 0,
          cost: stats.sent * 0.01,
        }))
        .sort((a, b) => b.sent - a.sent)
        .slice(0, 10);

      const totalCost = totalSent * 0.01;
      const costTrend = dailyStats.map((d) => ({
        date: d.date,
        cost: d.sent * 0.01,
        messages: d.sent,
      }));

      res.json({
        totalSent,
        totalDelivered: delivered,
        totalRead: read,
        totalReplied: replied,
        totalFailed: failed,
        totalCost,
        deliveryRate,
        readRate,
        replyRate,
        deliveryData,
        dailyStats,
        campaignStats,
        templatePerformance,
        costTrend,
      });
    } catch (error) {
      console.error("Failed to get campaign report:", error);
      res.status(500).json({ message: "Failed to get campaign report" });
    }
  });

  app.get("/api/reports/delivery", async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const messages = await storage.getMessages();
      const broadcastLogs = await broadcastService.getBroadcastLogs({
        limit: 10000,
      });

      const now = new Date();
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

      const periodMessages = messages.filter(
        (m) => new Date(m.timestamp) >= startDate
      );
      const outbound = periodMessages.filter((m) => m.direction === "outbound");

      const totalSent = outbound.length;
      const delivered = outbound.filter(
        (m) => m.status === "delivered" || m.status === "read"
      ).length;
      const read = outbound.filter((m) => m.status === "read").length;
      const failed = outbound.filter((m) => m.status === "failed").length;
      const pending = outbound.filter((m) => m.status === "sent").length;

      const deliveryRate =
        totalSent > 0 ? Math.round((delivered / totalSent) * 100 * 10) / 10 : 0;
      const readRate =
        delivered > 0 ? Math.round((read / delivered) * 100 * 10) / 10 : 0;
      const failureRate =
        totalSent > 0 ? Math.round((failed / totalSent) * 100 * 10) / 10 : 0;

      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dailyData = [];
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayMsgs = periodMessages.filter((m) => {
          const msgDate = new Date(m.timestamp);
          return msgDate.toDateString() === date.toDateString();
        });
        const dayOutbound = dayMsgs.filter((m) => m.direction === "outbound");
        dailyData.push({
          date: dayNames[date.getDay()],
          fullDate: date.toISOString().split("T")[0],
          sent: dayOutbound.length,
          delivered: dayOutbound.filter(
            (m) => m.status === "delivered" || m.status === "read"
          ).length,
          read: dayOutbound.filter((m) => m.status === "read").length,
          failed: dayOutbound.filter((m) => m.status === "failed").length,
        });
      }

      const hourlyData = [];
      for (let hour = 0; hour < 24; hour++) {
        const hourMsgs = outbound.filter((m) => {
          const msgDate = new Date(m.timestamp);
          return msgDate.getHours() === hour;
        });
        hourlyData.push({
          hour: `${hour.toString().padStart(2, "0")}:00`,
          sent: hourMsgs.length,
          delivered: hourMsgs.filter(
            (m) => m.status === "delivered" || m.status === "read"
          ).length,
        });
      }

      res.json({
        totalSent,
        delivered,
        read,
        failed,
        pending,
        deliveryRate,
        readRate,
        failureRate,
        dailyData,
        hourlyData,
      });
    } catch (error) {
      console.error("Failed to get delivery report:", error);
      res.status(500).json({ message: "Failed to get delivery report" });
    }
  });

  // Mount contacts module routes FIRST (includes /block, /unblock, /blocked)
  app.use("/api/contacts", contactsRoutes);

  app.get("/api/contacts", async (req, res) => {
    try {
      // Get contacts from both in-memory storage and MongoDB imported_contacts
      const memContacts = await storage.getContacts();
      const importedContacts = await mongodb.readCollection<{
        id: string;
        name: string;
        phone: string;
        email?: string;
        tags?: string[];
      }>("imported_contacts");

      // Combine and deduplicate by phone number
      const phoneSet = new Set<string>();
      const allContacts: typeof memContacts = [];

      // Add imported contacts first (they have user-provided names)
      for (const contact of importedContacts) {
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        if (!phoneSet.has(normalizedPhone)) {
          phoneSet.add(normalizedPhone);
          allContacts.push({
            id: contact.id,
            name: contact.name,
            phone: contact.phone,
            email: contact.email || "",
            tags: contact.tags || [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // Add memory contacts that don't overlap
      for (const contact of memContacts) {
        const normalizedPhone = contact.phone.replace(/\D/g, "");
        if (!phoneSet.has(normalizedPhone)) {
          phoneSet.add(normalizedPhone);
          allContacts.push(contact);
        }
      }

      res.json(allContacts);
    } catch (error) {
      console.error("Error fetching contacts:", error);
      res.status(500).json({ message: "Failed to get contacts" });
    }
  });

  app.get("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.getContact(req.params.id);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to get contact" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const parsed = insertContactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid contact data",
          errors: parsed.error.errors,
        });
      }
      const contact = await storage.createContact(parsed.data);
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.put("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const success = await storage.deleteContact(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  app.post("/api/contacts/import", async (req, res) => {
    try {
      const { contacts } = req.body;
      if (!Array.isArray(contacts)) {
        return res.status(400).json({ message: "Invalid data format" });
      }
      const imported = [];
      for (const contact of contacts) {
        const parsed = insertContactSchema.safeParse(contact);
        if (parsed.success) {
          const newContact = await storage.createContact(parsed.data);
          imported.push(newContact);
        }
      }
      res.json({ imported: imported.length, contacts: imported });
    } catch (error) {
      res.status(500).json({ message: "Failed to import contacts" });
    }
  });

  app.get("/api/messages", async (req, res) => {
    try {
      const { contactId } = req.query;
      const messages = await storage.getMessages(
        contactId as string | undefined
      );
      res.json(messages);
    } catch (error) {
      res.status(500).json({ message: "Failed to get messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const parsed = insertMessageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid message data",
          errors: parsed.error.errors,
        });
      }
      const message = await storage.createMessage(parsed.data);
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/debug/user/:email", async (req, res) => {
    try {
      const { SystemUser } = await import("./modules/users/user.model");
      const { User } = await import("./modules/storage/mongodb.adapter");
      const email = req.params.email;

      const systemUser = await SystemUser.findOne({ email });
      const regularUser = await User.findOne({
        $or: [{ email }, { username: email }],
      });

      res.json({
        systemUser: systemUser
          ? {
            id: systemUser.id,
            email: systemUser.email,
            name: systemUser.name,
            role: systemUser.role,
            isActive: systemUser.isActive,
          }
          : null,
        regularUser: regularUser
          ? {
            id: regularUser.id,
            email: regularUser.email,
            name: regularUser.name,
            role: regularUser.role,
          }
          : null,
      });
    } catch (error) {
      console.error("Debug error:", error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/chats", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = (req.headers["x-user-role"] as string) || "super_admin";
      const userName = req.headers["x-user-name"] as string;

      // console.log(
      //   `[Inbox Filter] User: ${userName}, Role: ${userRole}, ID: ${userId}`
      // );
      // console.log(`[Inbox Filter] All headers:`, JSON.stringify(req.headers));

      let chats = await storage.getChats();

      if (userId && userRole !== "super_admin" && userRole !== "sub_admin") {
        const permittedContactIds =
          await leadManagementService.getFilteredChatsForUser({
            userId,
            role: userRole as any,
            name: userName,
          });

        if (permittedContactIds.length > 0) {
          chats = chats.filter((chat) =>
            permittedContactIds.includes(chat.contact.id)
          );
        } else if (userRole === "user") {
          chats = [];
        }
      }

      const assignments = await leadManagementService.getAllLeadAssignments({
        status: ["assigned", "in_progress"],
      });
      const assignmentMap = new Map(
        assignments.map((a: any) => [a.contactId, a])
      );

      const chatsWithAssignment = chats.map((chat) => ({
        ...chat,
        assignment: assignmentMap.get(chat.contact.id) || null,
      }));

      res.json(chatsWithAssignment);
    } catch (error) {
      console.error("Error getting chats:", error);
      res.status(500).json({ message: "Failed to get chats" });
    }
  });


  app.get("/api/chats/window", async (req, res) => {
    try {
      const userId = req.headers["x-user-id"] as string;
      const userRole = (req.headers["x-user-role"] as string) || "super_admin";
      const userName = req.headers["x-user-name"] as string;

      let chats = await storage.getChats();

      if (userId && userRole !== "super_admin" && userRole !== "sub_admin") {
        const permittedContactIds =
          await leadManagementService.getFilteredChatsForUser({
            userId,
            role: userRole as any,
            name: userName,
          });

        if (permittedContactIds.length > 0) {
          chats = chats.filter((chat) =>
            permittedContactIds.includes(chat.contact.id)
          );
        } else if (userRole === "user") {
          chats = [];
        }
      }

      const now = new Date();
      const windowChats = chats.filter((chat) => {
        if (chat.lastInboundMessageTime) {
          const lastInbound = new Date(chat.lastInboundMessageTime);
          const hoursDiff =
            (now.getTime() - lastInbound.getTime()) / (1000 * 60 * 60);
          return hoursDiff <= 24;
        }
        return false;
      });
      res.json(windowChats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get window chats" });
    }
  });

  app.get("/api/chats/:id", async (req, res) => {
    try {
      const chat = await storage.getChat(req.params.id);
      if (!chat) {
        return res.status(404).json({ message: "Chat not found" });
      }
      res.json(chat);
    } catch (error) {
      res.status(500).json({ message: "Failed to get chat" });
    }
  });

  app.post("/api/chats/:contactId/mark-read", async (req, res) => {
    try {
      await storage.markMessagesAsRead(req.params.contactId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark messages as read" });
    }
  });

  app.post("/api/chats/:contactId/mark-unread", async (req, res) => {
    try {
      await storage.markMessagesAsUnread(req.params.contactId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to mark messages as unread" });
    }
  });

  app.post("/api/inbox/send", async (req, res) => {
    try {
      const {
        contactId,
        phone,
        name,
        messageType,
        templateName,
        customMessage,
        agentId,
      } = req.body;

      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      if (!messageType) {
        return res.status(400).json({ error: "Message type is required" });
      }

      // console.log(`[InboxSend] Sending ${messageType} message to ${phone}`);

      let result: {
        success: boolean;
        messageId?: string;
        error?: string;
        aiMessage?: string;
      } = { success: false };
      let messageContent = "";

      switch (messageType) {
        case "template": {
          if (!templateName) {
            return res.status(400).json({
              error: "Template name is required for template messages",
            });
          }
          result = await broadcastService.sendTemplateMessage(
            phone,
            templateName,
            name
          );
          messageContent = `[Template: ${templateName}]`;
          break;
        }

        case "custom": {
          if (!customMessage) {
            return res.status(400).json({
              error: "Message content is required for custom messages",
            });
          }
          result = await broadcastService.sendCustomMessage(
            phone,
            customMessage
          );
          messageContent = customMessage;
          break;
        }

        case "ai": {
          if (!agentId) {
            return res
              .status(400)
              .json({ error: "Agent ID is required for AI messages" });
          }

          const agent = await agentService.getAgentById(agentId);
          if (!agent) {
            return res.status(404).json({ error: "AI Agent not found" });
          }

          // console.log(
          //   `[InboxSend] Generating AI response with agent: ${agent.name}`
          // );

          // Assign this agent to the contact for future messages and enable auto-reply
          await contactAgentService.assignAgentToContact(
            contactId,
            phone,
            agentId,
            agent.name
          );
          await contactAgentService.enableAutoReply(phone);
          // console.log(
          //   `[InboxSend] Assigned agent ${agent.name} to contact ${phone} (auto-reply enabled)`
          // );

          // Get conversation history from MongoDB (stored per contact-agent assignment)
          let conversationHistory =
            await contactAgentService.getConversationHistory(phone);

          // If no stored history, fetch from messages
          if (conversationHistory.length === 0 && contactId) {
            try {
              const recentMessages = await storage.getMessages(contactId);
              const lastMessages = recentMessages.slice(-10);
              conversationHistory = lastMessages.map((m: any) => ({
                role:
                  m.direction === "inbound"
                    ? ("user" as const)
                    : ("assistant" as const),
                content: m.content,
              }));
            } catch (e) {
              console.log("[InboxSend] Could not fetch conversation context");
            }
          }

          // console.log(
          //   `[InboxSend] Using ${
          //     conversationHistory.length
          //   } messages for context, agent model: ${agent.model || "default"}`
          // );

          // Get the last inbound message to respond to, or use a greeting prompt
          const lastInboundMessage = conversationHistory
            .filter((m) => m.role === "user")
            .pop();
          const promptMessage =
            lastInboundMessage?.content ||
            `Greet ${name || "the customer"
            } warmly and introduce yourself as per your instructions.`;

          const aiMessage = await aiService.generateAgentResponse(
            promptMessage,
            agent,
            conversationHistory.slice(0, -1) // Exclude the last message since we're using it as the prompt
          );

          if (!aiMessage) {
            return res.status(500).json({
              error:
                "Failed to generate AI response. Check if API key is configured for the agent model.",
            });
          }

          // console.log(
          //   `[InboxSend] AI generated: "${aiMessage.substring(0, 100)}..."`
          // );

          // Store the AI response in conversation history
          await contactAgentService.addMessageToHistory(
            phone,
            "assistant",
            aiMessage
          );

          result = await broadcastService.sendCustomMessage(phone, aiMessage);
          result.aiMessage = aiMessage;
          messageContent = aiMessage;

          if (!result.success && result.error?.includes("24")) {
            // console.log(
            //   "[InboxSend] Outside 24-hour window, trying template fallback"
            // );
            result = await templateService.sendHelloWorldTemplate(phone);
            messageContent = "[Template: hello_world] (AI fallback)";
          }
          break;
        }

        default:
          return res.status(400).json({
            error: "Invalid message type. Use: template, custom, or ai",
          });
      }

      if (result.success && contactId) {
        try {
          await storage.createMessage({
            contactId,
            content: messageContent,
            type: "text" as const,
            direction: "outbound",
            status: "sent" as const,
          });
          // console.log(
          //   `[InboxSend] Saved message to conversation for contact ${contactId}`
          // );
        } catch (saveError) {
          console.error(
            "[InboxSend] Failed to save message to conversation:",
            saveError
          );
        }
      }

      if (result.success) {
        res.json({
          success: true,
          messageId: result.messageId,
          message: messageContent,
          sent: true,
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error || "Failed to send message",
        });
      }
    } catch (error: any) {
      console.error("[InboxSend] Error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to send message" });
    }
  });

  app.post("/api/inbox/send-ai-response", async (req, res) => {
    try {
      const { contactId, phone, name, agentId, userMessage } = req.body;

      if (!phone || !agentId) {
        return res
          .status(400)
          .json({ error: "Phone and agentId are required" });
      }

      const agent = await agentService.getAgentById(agentId);
      if (!agent) {
        return res.status(404).json({ error: "AI Agent not found" });
      }

      // console.log(
      //   `[InboxSendAI] Generating contextual AI response with agent: ${
      //     agent.name
      //   } (model: ${agent.model || "default"})`
      // );

      // Use the user message directly as the prompt, or a simple greeting request
      const promptMessage = userMessage || "Hello";

      const aiMessage = await aiService.generateAgentResponse(
        promptMessage,
        agent,
        []
      );

      if (!aiMessage) {
        return res.status(500).json({
          error:
            "Failed to generate AI response. Check if API key is configured for the agent model.",
        });
      }

      const result = await broadcastService.sendCustomMessage(phone, aiMessage);

      if (result.success && contactId) {
        await storage.createMessage({
          contactId,
          content: aiMessage,
          type: "text" as const,
          direction: "outbound",
          status: "sent" as const,
        });
      }

      res.json({
        success: result.success,
        message: aiMessage,
        error: result.error,
      });
    } catch (error: any) {
      console.error("[InboxSendAI] Error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to send AI response" });
    }
  });

  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaigns" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const parsed = insertCampaignSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid campaign data",
          errors: parsed.error.errors,
        });
      }
      const campaign = await storage.createCampaign(parsed.data);
      res.status(201).json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to create campaign" });
    }
  });

  app.put("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.updateCampaign(req.params.id, req.body);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const success = await storage.deleteCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  app.post("/api/campaigns/:id/send", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      const sentCount = campaign.contactIds.length;
      const deliveredCount = Math.floor(sentCount * 0.95);
      const readCount = Math.floor(deliveredCount * 0.7);
      const repliedCount = Math.floor(readCount * 0.2);

      const updatedCampaign = await storage.updateCampaign(req.params.id, {
        status: "completed",
        sentCount,
        deliveredCount,
        readCount,
        repliedCount,
      });
      res.json(updatedCampaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to send campaign" });
    }
  });

  app.get("/api/templates", async (req, res) => {
    try {
      const metaOnly = req.query.metaOnly === "true";
      const templates = await storage.getTemplates();
      const filteredTemplates = metaOnly
        ? templates.filter((template: any) => Boolean(template?.metaTemplateId))
        : templates;
      res.json(filteredTemplates);
    } catch (error) {
      res.status(500).json({ message: "Failed to get templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ message: "Failed to get template" });
    }
  });

  function shortSuffix(length = 4) {
    return Math.random()
      .toString(36)
      .substring(2, 2 + length);
  }

  app.post("/api/templates", async (req, res) => {
    try {
      // For image headers, headerImage is the Meta media ID ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â store it as-is
      const mediaHeaderTypes = ["image", "video", "document"];
      const isMediaHeader = mediaHeaderTypes.includes(req.body.headerType);
      const headerImageUrl = isMediaHeader
        ? req.body.headerMedia ||
          req.body.headerImage ||
          req.body.headerImageUrl ||
          null
        : null;
      const previewUrl = isMediaHeader ? req.body.previewUrl || null : null;

      console.log("[TemplateCreate] creating template:", req.body.name);

      const template = await mongodb.Template.create({
        id: uuidv4(),
        name: req.body.name,
        category: req.body.category,
        templateType: req.body.templateType || "default",
        language: req.body.language,
        headerType: req.body.headerType,
        content: req.body.content,
        headerText: req.body.headerText,
        headerImageUrl,
        previewUrl,
        body: req.body.body,
        footer: req.body.footer,
        buttons: req.body.buttons,
        status: req.body.status,
      });

      // Optional: Now submit this template to Meta via WhatsApp API
      // (if you haven't done so already in a separate step)

      res.status(201).json(template);
    } catch (err: any) {
      console.error("[Template Creation Error]", err);
      res.status(500).json({ error: err.message });
    }
  });


  const updateMetaTemplate = async (
    metaTemplateId: string,
    payload: any
  ) => {
    try {
      const response = await axios.post(
        `https://graph.facebook.com/v24.0/${metaTemplateId}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.FB_PAGE_ACCESS_TOKEN}`,
          },
        }
      );

      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data || error.message,
      };
    }
  };

  const resolveTemplateDeleteCredentials = async (req: Request) => {
    const { credentialsService } = await import(
      "./modules/credentials/credentials.service"
    );

    const sessionUserId = (req as any).session?.user?.id as string | undefined;
    const queryUserId =
      typeof req.query.userId === "string" ? req.query.userId : undefined;
    const bodyUserId =
      req.body && typeof req.body.userId === "string"
        ? req.body.userId
        : undefined;
    const userId = sessionUserId || queryUserId || bodyUserId;

    let token: string | undefined;
    let wabaId: string | undefined;

    if (userId) {
      const credentials = await credentialsService.getDecryptedCredentials(
        userId
      );
      if (credentials?.whatsappToken) {
        token = credentials.whatsappToken;
      }
      if (credentials?.businessAccountId) {
        wabaId = credentials.businessAccountId;
      }
    }

    if (!token) {
      token =
        process.env.WHATSAPP_TOKEN_NEW ||
        process.env.WHATSAPP_TOKEN ||
        process.env.FB_ACCESS_TOKEN ||
        process.env.SYSTEM_USER_TOKEN_META;
    }
    if (!wabaId) {
      wabaId = process.env.WABA_ID;
    }

    return { token, wabaId };
  };

  const deleteMetaTemplate = async (
    wabaId: string,
    token: string,
    options: { metaTemplateId?: string; name?: string; language?: string }
  ) => {
    const baseUrl = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;
    const META_DELETE_TIMEOUT_MS = 20000;
    const META_DELETE_MAX_RETRIES = 2;
    const RETRY_BASE_DELAY_MS = 700;

    const executeDelete = async (params: URLSearchParams) => {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        META_DELETE_TIMEOUT_MS
      );
      const response = await fetch(`${baseUrl}?${params.toString()}`, {
        method: "DELETE",
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
      const data = await response.json().catch(() => ({}));
      return { response, data };
    };

    const sleep = async (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    const isRetryableFailure = (input: {
      status?: number;
      data?: any;
      error?: any;
    }) => {
      if (input.error?.name === "AbortError") return true;
      if (typeof input.status === "number") {
        if (input.status === 429 || input.status >= 500) return true;
      }

      const metaError = input.data?.error;
      const code = Number(metaError?.code);
      if ([4, 17, 32, 613].includes(code)) return true; // rate-limit/transient Meta codes

      return false;
    };

    const runDeleteWithRetry = async (params: URLSearchParams) => {
      let lastResult: any = null;
      let lastError: any = null;

      for (let attempt = 0; attempt <= META_DELETE_MAX_RETRIES; attempt++) {
        try {
          const result = await executeDelete(params);
          const failed = !result.response.ok || (result.data as any)?.error;
          if (!failed) {
            return { success: true, result };
          }

          lastResult = result;
          const retryable = isRetryableFailure({
            status: result.response.status,
            data: result.data,
          });

          if (!retryable || attempt === META_DELETE_MAX_RETRIES) {
            return { success: false, result: lastResult };
          }
        } catch (error: any) {
          lastError = error;
          const retryable = isRetryableFailure({ error });

          if (!retryable || attempt === META_DELETE_MAX_RETRIES) {
            return { success: false, error: lastError };
          }
        }

        await sleep(RETRY_BASE_DELAY_MS * (attempt + 1));
      }

      return { success: false, result: lastResult, error: lastError };
    };

    const normalizeLang = (language?: string) =>
      language ? language.replace("-", "_") : undefined;
    const language = normalizeLang(options.language);

    const createParams = (input: {
      id?: string;
      name?: string;
      language?: string;
    }) => {
      const params = new URLSearchParams({ access_token: token });
      if (input.id) params.set("hsm_id", input.id);
      if (input.name) params.set("name", input.name);
      if (input.language) params.set("language", input.language);
      return params;
    };

    const parameterCandidates: URLSearchParams[] = [];
    if (options.metaTemplateId && options.name && language) {
      parameterCandidates.push(
        createParams({
          id: options.metaTemplateId,
          name: options.name,
          language,
        })
      );
    }
    if (options.metaTemplateId && options.name) {
      parameterCandidates.push(
        createParams({ id: options.metaTemplateId, name: options.name })
      );
    }
    if (options.name && language) {
      parameterCandidates.push(createParams({ name: options.name, language }));
    }
    if (options.name) {
      parameterCandidates.push(createParams({ name: options.name }));
    }
    if (options.metaTemplateId) {
      parameterCandidates.push(createParams({ id: options.metaTemplateId }));
    }

    const seen = new Set<string>();
    const deleteAttempts = parameterCandidates.filter((params) => {
      const key = params.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    let lastTry: any = null;
    for (const params of deleteAttempts) {
      const attempt = await runDeleteWithRetry(params);
      if (attempt.success) {
        return { success: true, data: attempt.result.data };
      }
      lastTry = attempt;
    }

    // Fallback: if template is already absent on Meta, treat as success and continue local delete.
    if (options.name) {
      try {
        const lookupUrl = `${baseUrl}?fields=id,name,language,status&limit=200&access_token=${encodeURIComponent(token)}`;
        const lookupResponse = await fetch(lookupUrl, { method: "GET" });
        const lookupData = await lookupResponse.json().catch(() => ({}));

        if (lookupResponse.ok && Array.isArray((lookupData as any).data)) {
          const matches = (lookupData as any).data.filter((item: any) => {
            if (item?.name !== options.name) return false;
            if (!language) return true;
            return normalizeLang(item?.language) === language;
          });

          if (matches.length === 0) {
            return {
              success: true,
              alreadyMissing: true,
              data: { message: "Template not present on Meta dashboard." },
            };
          }

          for (const match of matches) {
            const retryByLookup = await runDeleteWithRetry(
              createParams({
                id: String(match.id || ""),
                name: String(match.name || options.name),
                language: normalizeLang(match.language),
              })
            );

            if (retryByLookup.success) {
              return { success: true, data: retryByLookup.result.data };
            }
            lastTry = retryByLookup;
          }
        }
      } catch {
        // Keep last failure if lookup also fails
      }
    }

    if (lastTry?.error) {
      return {
        success: false,
        error:
          lastTry.error?.name === "AbortError"
            ? "Meta delete request timed out after retries"
            : lastTry.error?.message || "Meta delete request failed",
      };
    }

    const metaError = lastTry?.result?.data?.error;
    return {
      success: false,
      error:
        metaError?.message ||
        `Meta API delete failed with status ${lastTry?.result?.response?.status ?? "unknown"}`,
      details: metaError || lastTry?.result?.data,
    };
  };


  app.put("/api/templates/:id", async (req, res) => {
    try {
      const templateId = req.params.id;
      console.log("[Template Update] Request received for ID:", templateId);
      console.log(
        "[Template Update] Request body:",
        JSON.stringify(req.body, null, 2)
      );

      const mediaHeaderTypes = ["image", "video", "document"];
      const isMediaHeader = mediaHeaderTypes.includes(req.body.headerType);
      const headerImageUrl = isMediaHeader
        ? req.body.headerMedia ||
          req.body.headerImage ||
          req.body.headerImageUrl ||
          null
        : null;
      const previewUrl = isMediaHeader ? req.body.previewUrl || null : null;

      // Prepare local DB update
      const updateData = {
        name: req.body.name,
        category: req.body.category,
        templateType: req.body.templateType || "default",
        language: req.body.language,
        headerType: req.body.headerType,
        content: req.body.content,
        headerText: req.body.headerText,
        headerImageUrl,
        previewUrl,
        body: req.body.body,
        footer: req.body.footer,
        buttons: req.body.buttons,
        status: req.body.status,
      };

      // Update local MongoDB template
      const template = await mongodb.Template.findOneAndUpdate(
        { id: templateId },
        updateData,
        { new: true }
      );

      if (!template) {
        console.warn("[Template Update] Template not found:", templateId);
        return res.status(404).json({ message: "Template not found" });
      }

      console.log("[Template Update] MongoDB template updated:", template);

      // -------------------- META TEMPLATE SUBMISSION --------------------
      // -------------------- META TEMPLATE UPDATE --------------------
      if (template.metaTemplateId) {
        try {
          const metaPayload = buildMetaTemplate(template);

          // ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â DO NOT CHANGE NAME
          delete metaPayload.name;

          const result = await updateMetaTemplate(
            template.metaTemplateId,
            metaPayload
          );

          if (result.success) {
            template.metaStatus = "PENDING";
            await template.save();

            console.log(
              "[Template Update] Meta template updated:",
              template.metaTemplateId
            );
          } else {
            console.error(
              "[Template Update] Meta update failed:",
              result.error
            );
          }
        } catch (metaError) {
          console.error(
            "[Template Update] Meta update error:",
            metaError
          );
        }
      }


      res.json(template);
    } catch (error: any) {
      console.error("[Template Update Error]", error);
      res
        .status(500)
        .json({ message: "Failed to update template", error: error.message });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }

      const shouldDeleteFromMeta = req.query.deleteFromMeta !== "false";
      const metaTemplateId = (template as any).metaTemplateId as
        | string
        | undefined;

      let deletedFromMeta = false;
      let metaDeletionSkipped = false;

      if (shouldDeleteFromMeta) {
        if (metaTemplateId) {
          const { token, wabaId } = await resolveTemplateDeleteCredentials(req);
          if (!token || !wabaId) {
            return res.status(400).json({
              message:
                "Cannot delete from Meta dashboard. WhatsApp credentials are missing.",
              hint: "Configure WhatsApp Access Token and WABA ID in Settings.",
            });
          }

          const metaDelete = await deleteMetaTemplate(wabaId, token, {
            metaTemplateId,
            name: template.name,
            language: (template as any).language,
          });
          if (!metaDelete.success) {
            return res.status(502).json({
              message:
                "Failed to delete template from Meta dashboard. Local template was not deleted.",
              error: metaDelete.error,
              details: metaDelete.details,
            });
          }

          if (metaDelete.alreadyMissing) {
            metaDeletionSkipped = true;
          } else {
            deletedFromMeta = true;
          }
        } else {
          metaDeletionSkipped = true;
        }
      }

      const success = await storage.deleteTemplate(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Template not found" });
      }

      res.json({
        success: true,
        deletedFromMeta,
        metaDeletionSkipped,
        message: deletedFromMeta
          ? "Template deleted from local database and Meta dashboard."
          : metaDeletionSkipped
            ? "Template deleted locally. Meta deletion skipped because no linked Meta template ID exists."
            : "Template deleted from local database.",
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ message: "Failed to delete template", error: error.message });
    }
  });

  app.post("/api/templates/bulk-delete", async (req, res) => {
    try {
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.filter((id: unknown) => typeof id === "string")
        : [];
      const shouldDeleteFromMeta = req.query.deleteFromMeta !== "false";

      if (ids.length === 0) {
        return res
          .status(400)
          .json({ message: "Please provide at least one template id." });
      }

      let token: string | undefined;
      let wabaId: string | undefined;
      if (shouldDeleteFromMeta) {
        const creds = await resolveTemplateDeleteCredentials(req);
        token = creds.token;
        wabaId = creds.wabaId;

        if (!token || !wabaId) {
          return res.status(400).json({
            message:
              "Cannot delete from Meta dashboard. WhatsApp credentials are missing.",
            hint: "Configure WhatsApp Access Token and WABA ID in Settings.",
          });
        }
      }

      let deletedCount = 0;
      let deletedFromMetaCount = 0;
      let metaDeletionSkippedCount = 0;
      const failed: Array<{ id: string; name?: string; error: string }> = [];

      const concurrency = 2;
      const queue = ids.slice();
      const workerResults: Array<{
        id: string;
        name?: string;
        ok: boolean;
        deletedFromMeta?: boolean;
        metaSkipped?: boolean;
        error?: string;
      }> = [];

      const workers = Array.from(
        { length: Math.min(concurrency, queue.length) },
        async () => {
          while (queue.length > 0) {
            const id = queue.shift();
            if (!id) break;

            try {
              const template = await storage.getTemplate(id);
              if (!template) {
                workerResults.push({
                  id,
                  ok: false,
                  error: "Template not found",
                });
                continue;
              }

              let deletedFromMeta = false;
              let metaSkipped = false;

              if (shouldDeleteFromMeta) {
                const metaTemplateId = (template as any).metaTemplateId as
                  | string
                  | undefined;

                if (metaTemplateId) {
                  const metaDelete = await deleteMetaTemplate(wabaId!, token!, {
                    metaTemplateId,
                    name: template.name,
                    language: (template as any).language,
                  });

                  if (!metaDelete.success) {
                    workerResults.push({
                      id,
                      name: template.name,
                      ok: false,
                      error: metaDelete.error || "Meta delete failed",
                    });
                    continue;
                  }
                  if (metaDelete.alreadyMissing) {
                    metaSkipped = true;
                  } else {
                    deletedFromMeta = true;
                  }
                } else {
                  metaSkipped = true;
                }
              }

              const localDeleted = await storage.deleteTemplate(id);
              if (!localDeleted) {
                workerResults.push({
                  id,
                  name: template.name,
                  ok: false,
                  error: "Failed to delete from local database",
                });
                continue;
              }

              workerResults.push({
                id,
                name: template.name,
                ok: true,
                deletedFromMeta,
                metaSkipped,
              });
            } catch (itemError: any) {
              workerResults.push({
                id,
                ok: false,
                error: itemError?.message || "Unexpected delete error",
              });
            }
          }
        }
      );

      await Promise.all(workers);

      for (const item of workerResults) {
        if (item.ok) {
          deletedCount += 1;
          if (item.deletedFromMeta) deletedFromMetaCount += 1;
          if (item.metaSkipped) metaDeletionSkippedCount += 1;
        } else {
          failed.push({
            id: item.id,
            name: item.name,
            error: item.error || "Delete failed",
          });
        }
      }

      const responsePayload = {
        success: failed.length === 0,
        deletedCount,
        deletedFromMetaCount,
        metaDeletionSkippedCount,
        failedCount: failed.length,
        failed,
        message:
          failed.length === 0
            ? `Deleted ${deletedCount} template${deletedCount === 1 ? "" : "s"} successfully.`
            : `Deleted ${deletedCount} template${deletedCount === 1 ? "" : "s"} with ${failed.length} failure${failed.length === 1 ? "" : "s"}.`,
      };

      if (failed.length > 0) {
        return res.status(207).json(responsePayload);
      }

      return res.json(responsePayload);
    } catch (error: any) {
      return res.status(500).json({
        message: "Failed to delete selected templates",
        error: error.message,
      });
    }
  });

  // Get templates directly from Meta/Facebook (live data, not from database)
  app.get("/api/templates/meta", async (req, res) => {
    try {
      const { credentialsService } = await import(
        "./modules/credentials/credentials.service"
      );

      const userId = (req as any).session?.user?.id;
      let token: string | undefined;
      let wabaId: string | undefined;

      if (userId) {
        const credentials = await credentialsService.getDecryptedCredentials(
          userId
        );
        if (credentials?.whatsappToken) {
          token = credentials.whatsappToken;
        }
        if (credentials?.businessAccountId) {
          wabaId = credentials.businessAccountId;
        }
      }

      if (!token) {
        token =
          process.env.WHATSAPP_TOKEN_NEW ||
          process.env.WHATSAPP_TOKEN ||
          process.env.FB_ACCESS_TOKEN;
      }
      if (!wabaId) {
        wabaId = process.env.WABA_ID;
      }

      if (!token || !wabaId) {
        return res.status(400).json({
          message: "WhatsApp credentials not configured",
          hint: "Please configure your WhatsApp Access Token and Business Account ID in Settings.",
        });
      }

      // console.log(
      //   `[TemplatesMeta] Fetching templates directly from Meta for WABA: ${wabaId}`
      // );

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=id,name,status,category,language,quality_score,components,rejected_reason&limit=100&access_token=${token}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[TemplatesMeta] Meta API Error:", errorData);
        return res.status(response.status).json({
          message: "Failed to fetch templates from Meta",
          error: errorData.error?.message || "Unknown error",
        });
      }

      const data = await response.json();
      const metaTemplates = data.data || [];

      const templates = metaTemplates.map((t: any) => {
        let content = "";
        let header = "";
        let footer = "";
        let buttons: any[] = [];

        if (t.components) {
          for (const comp of t.components) {
            if (comp.type === "HEADER") {
              header = comp.text || comp.format || "";
            } else if (comp.type === "BODY") {
              content = comp.text || "";
            } else if (comp.type === "FOOTER") {
              footer = comp.text || "";
            } else if (comp.type === "BUTTONS") {
              buttons = comp.buttons || [];
            }
          }
        }

        return {
          id: t.id,
          name: t.name,
          status: t.status?.toLowerCase() || "pending",
          category: t.category?.toLowerCase() || "utility",
          language: t.language || "en",
          content,
          header,
          footer,
          buttons,
          qualityScore: t.quality_score,
          rejectedReason: t.rejected_reason,
        };
      });

      const summary = {
        total: templates.length,
        approved: templates.filter((t: any) => t.status === "approved").length,
        pending: templates.filter((t: any) => t.status === "pending").length,
        rejected: templates.filter((t: any) => t.status === "rejected").length,
      };

      res.json({ templates, summary });
    } catch (error) {
      console.error("[TemplatesMeta] Error:", error);
      res.status(500).json({ message: "Failed to fetch templates from Meta" });
    }
  });

  // Sync templates from Meta Business Suite
  app.post("/api/templates/sync-meta", async (req, res) => {
    try {
      const { credentialsService } = await import(
        "./modules/credentials/credentials.service"
      );

      // Get user credentials from session
      const userId = (req as any).session?.user?.id;
      let token: string | undefined;
      let wabaId: string | undefined;

      if (userId) {
        const credentials = await credentialsService.getDecryptedCredentials(
          userId
        );
        if (credentials?.whatsappToken) {
          token = credentials.whatsappToken;
        }
        if (credentials?.businessAccountId) {
          wabaId = credentials.businessAccountId;
        }
      }

      // Fallback to environment variables
      if (!token) {
        token =
          process.env.WHATSAPP_TOKEN_NEW ||
          process.env.WHATSAPP_TOKEN ||
          process.env.FB_ACCESS_TOKEN;
      }
      if (!wabaId) {
        wabaId = process.env.WABA_ID;
      }

      if (!token) {
        return res.status(400).json({
          message:
            "WhatsApp access token not configured. Please configure your API credentials in Settings.",
        });
      }

      if (!wabaId) {
        return res.status(400).json({
          message:
            "WhatsApp Business Account ID (WABA_ID) not configured. Please configure it in Settings.",
        });
      }

      // console.log(`[TemplateSync] Fetching templates from WABA ID: ${wabaId}`);

      // Fetch templates from Meta Graph API with more fields
      const response = await fetch(
        `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=id,name,status,category,language,components&limit=500&access_token=${token}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error("[TemplateSync] Meta API Error:", errorData);
        return res.status(response.status).json({
          message: "Failed to fetch templates from Meta",
          error: errorData.error?.message || "Unknown error",
          hint: "Make sure WABA_ID is set to your WhatsApp Business Account ID (not Phone Number ID)",
        });
      }

      const data = await response.json();
      const metaTemplates = data.data || [];
      let synced = 0;
      let updated = 0;
      let removedStaleMetaLinked = 0;
      const approvedTemplates: string[] = [];
      const existingTemplates = await storage.getTemplates();
      const metaTemplateIds = new Set<string>();
      const mediaHeaderTypes = new Set(["image", "video", "document"]);

      const isHttpUrl = (value: unknown): value is string => {
        return (
          typeof value === "string" &&
          /^https?:\/\//i.test(value.trim())
        );
      };

      const parseMetaTemplateComponents = (components: any[] | undefined) => {
        let content = "";
        let footer = "";
        let headerText = "";
        let headerType: "text" | "image" | "video" | "document" | null = null;
        let mediaPreviewUrl: string | null = null;

        const componentList = Array.isArray(components) ? components : [];

        for (const component of componentList) {
          const componentType = String(component?.type || "").toUpperCase();

          if (componentType === "HEADER") {
            const normalizedFormat = String(
              component?.format || (component?.text ? "TEXT" : "")
            ).toLowerCase();

            if (normalizedFormat === "text") {
              headerType = "text";
              headerText = String(component?.text || "");
              continue;
            }

            if (
              normalizedFormat === "image" ||
              normalizedFormat === "video" ||
              normalizedFormat === "document"
            ) {
              headerType = normalizedFormat;
              const handles = Array.isArray(component?.example?.header_handle)
                ? component.example.header_handle
                : [];
              const firstHandle = handles.find((value: unknown) =>
                isHttpUrl(value)
              );
              mediaPreviewUrl = firstHandle
                ? String(firstHandle).trim()
                : null;
              continue;
            }

            continue;
          }

          if (componentType === "BODY") {
            content = String(component?.text || "");
            continue;
          }

          if (componentType === "FOOTER") {
            footer = String(component?.text || "");
          }
        }

        const matches = content.match(/\{\{(\d+)\}\}/g);
        const variables = matches
          ? matches.map((_: string, index: number) => `var${index + 1}`)
          : [];

        return {
          content,
          variables,
          footer,
          headerType,
          headerText,
          mediaPreviewUrl,
        };
      };

      // console.log(
      //   `[TemplateSync] Found ${metaTemplates.length} templates from Meta`
      // );

      for (const metaTemplate of metaTemplates) {
        if (metaTemplate.id) {
          metaTemplateIds.add(String(metaTemplate.id));
        }

        // Log template info
        // console.log(
        //   `[TemplateSync] Template: ${metaTemplate.name}, Status: ${metaTemplate.status}, Language: ${metaTemplate.language}`
        // );

        if (metaTemplate.status === "APPROVED") {
          approvedTemplates.push(
            `${metaTemplate.name} (${metaTemplate.language})`
          );
        }

        // Check if template already exists (prefer Meta ID match, fallback by name)
        const exists = existingTemplates.find(
          (t: any) =>
            (t.metaTemplateId && t.metaTemplateId === metaTemplate.id) ||
            t.name === metaTemplate.name
        );

        const parsed = parseMetaTemplateComponents(metaTemplate.components);

        const status =
          metaTemplate.status === "APPROVED"
            ? "approved"
            : metaTemplate.status === "REJECTED"
              ? "rejected"
              : "pending";
        const now = new Date().toISOString();

        if (!exists) {
          const newTemplate = await storage.createTemplate({
            name: metaTemplate.name,
            category: (metaTemplate.category || "utility").toLowerCase() as any,
            content: parsed.content,
            variables: parsed.variables,
          });

          const isMediaHeader = mediaHeaderTypes.has(
            String(parsed.headerType || "").toLowerCase()
          );
          const mediaUrl = isMediaHeader ? parsed.mediaPreviewUrl : null;

          await storage.updateTemplate(newTemplate.id, {
            status,
            language: metaTemplate.language || "en",
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            lastSyncedAt: now,
            headerType: parsed.headerType,
            headerText: parsed.headerType === "text" ? parsed.headerText : null,
            headerImageUrl: mediaUrl,
            previewUrl: mediaUrl,
            footer: parsed.footer || null,
          } as any);
          existingTemplates.push({
            ...newTemplate,
            status,
            language: metaTemplate.language || "en",
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            headerType: parsed.headerType,
            headerText: parsed.headerType === "text" ? parsed.headerText : null,
            headerImageUrl: mediaUrl,
            previewUrl: mediaUrl,
            footer: parsed.footer || null,
          } as any);
          synced++;
        } else {
          const isMediaHeader = mediaHeaderTypes.has(
            String(parsed.headerType || "").toLowerCase()
          );
          const existingPreviewUrl = isHttpUrl((exists as any)?.previewUrl)
            ? String((exists as any).previewUrl)
            : isHttpUrl((exists as any)?.headerImageUrl)
              ? String((exists as any).headerImageUrl)
              : null;
          const mediaUrl = isMediaHeader
            ? existingPreviewUrl || parsed.mediaPreviewUrl || null
            : null;

          await storage.updateTemplate(exists.id, {
            status,
            content: parsed.content || exists.content,
            variables: parsed.variables,
            language: metaTemplate.language || "en",
            metaTemplateId: metaTemplate.id,
            metaStatus: metaTemplate.status,
            lastSyncedAt: now,
            headerType: parsed.headerType,
            headerText: parsed.headerType === "text" ? parsed.headerText : null,
            headerImageUrl: mediaUrl,
            previewUrl: mediaUrl,
            footer: parsed.footer || null,
          } as any);
          updated++;
        }
      }

      // Remove stale local templates that were previously linked to Meta but no longer exist there.
      const latestTemplates = await storage.getTemplates();
      for (const template of latestTemplates as any[]) {
        if (
          template.metaTemplateId &&
          !metaTemplateIds.has(String(template.metaTemplateId))
        ) {
          const deleted = await storage.deleteTemplate(template.id);
          if (deleted) removedStaleMetaLinked++;
        }
      }

      // console.log(
      //   `[TemplateSync] Approved templates: ${approvedTemplates.join(", ")}`
      // );

      res.json({
        success: true,
        synced,
        updated,
        removedStaleMetaLinked,
        total: metaTemplates.length,
        approvedTemplates,
        message: `Synced ${synced} new templates, updated ${updated} existing templates from Meta, removed ${removedStaleMetaLinked} stale local templates. ${approvedTemplates.length} are approved.`,
      });
    } catch (error) {
      console.error("[TemplateSync] Error:", error);
      res.status(500).json({ message: "Failed to sync templates from Meta" });
    }
  });

  // metaTemplate.builder.ts

  // Submit template for Meta approval
  app.post("/api/templates/:id/submit-approval", async (req, res) => {
    const requestId = crypto.randomUUID();
    console.log(`\n[SubmitApproval][${requestId}] ===== START =====`);
    console.log(`[SubmitApproval][${requestId}] Template ID:`, req.params.id);

    try {
      /* ---------------- FETCH TEMPLATE ---------------- */
      const template = await storage.getTemplate(req.params.id);

      if (!template) {
        console.error(`[SubmitApproval][${requestId}] Template not found`);
        return res.status(404).json({ message: "Template not found" });
      }

      console.log(
        `[SubmitApproval][${requestId}] Template loaded`,
        JSON.stringify(
          {
            id: template.id,
            name: template.name,
            category: template.category,
            language: (template as any).language,
            headerType: (template as any).headerType,
          },
          null,
          2
        )
      );

      /* ---------------- BUILD META TEMPLATE ---------------- */
      const metaTemplate = buildMetaTemplate(template);

      console.log(
        `[SubmitApproval][${requestId}] Meta payload`,
        JSON.stringify(metaTemplate, null, 2)
      );

      /* ---------------- LOAD CREDENTIALS ---------------- */
      const { credentialsService } = await import(
        "./modules/credentials/credentials.service"
      );

      const userId = (req as any).session?.user?.id;
      console.log(`[SubmitApproval][${requestId}] User ID:`, userId);

      let token: string | undefined;
      let wabaId: string | undefined;

      if (userId) {
        const credentials = await credentialsService.getDecryptedCredentials(
          userId
        );

        console.log(
          `[SubmitApproval][${requestId}] Credentials found:`,
          !!credentials
        );

        token = credentials?.whatsappToken;
        wabaId = credentials?.businessAccountId;
      }

      /* ---------------- FALLBACK ENV ---------------- */
      token =
        token ||
        process.env.WHATSAPP_TOKEN_NEW ||
        process.env.WHATSAPP_TOKEN ||
        process.env.FB_ACCESS_TOKEN;

      wabaId = wabaId || process.env.WABA_ID;

      console.log(`[SubmitApproval][${requestId}] WABA ID:`, wabaId);
      console.log(`[SubmitApproval][${requestId}] Token present:`, !!token);

      if (!token) {
        console.error(`[SubmitApproval][${requestId}] Token missing`);
        return res.status(400).json({
          message:
            "WhatsApp access token not configured. Please configure your API credentials in Settings.",
        });
      }

      if (!wabaId) {
        console.error(`[SubmitApproval][${requestId}] WABA_ID missing`);
        return res.status(400).json({
          message: "WABA_ID not configured. Please configure it in Settings.",
        });
      }

      /* ---------------- META API CALL ---------------- */
      const url = `https://graph.facebook.com/v21.0/${wabaId}/message_templates`;

      console.log(`[SubmitApproval][${requestId}] POST ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(metaTemplate),
      });

      const data = await response.json();

      console.log(
        `[SubmitApproval][${requestId}] Meta response status:`,
        response.status
      );
      console.log(
        `[SubmitApproval][${requestId}] Meta response body:`,
        JSON.stringify(data, null, 2)
      );

      /* ---------------- ERROR HANDLING ---------------- */
      if (!response.ok) {
        console.error(`[SubmitApproval][${requestId}] Meta submission failed`, {
          message: data?.error?.message,
          code: data?.error?.code,
          subcode: data?.error?.error_subcode,
          fbtrace_id: data?.error?.fbtrace_id,
        });

        return res.status(400).json({
          message: "Meta submission failed",
          error: data?.error?.message,
          code: data?.error?.code,
          subcode: data?.error?.error_subcode,
          fbtrace_id: data?.error?.fbtrace_id,
        });
      }

      /* ---------------- UPDATE DB ---------------- */
      await storage.updateTemplate(template.id, {
        metaTemplateId: data.id,
        metaStatus: data.status,
        status: "pending",
      } as any);

      console.log(
        `[SubmitApproval][${requestId}] Template submitted successfully`,
        {
          metaTemplateId: data.id,
          status: data.status,
        }
      );

      console.log(`[SubmitApproval][${requestId}] ===== END =====\n`);

      res.json({
        success: true,
        metaTemplateId: data.id,
        status: data.status,
      });
    } catch (err: any) {
      console.error(`[SubmitApproval][${requestId}] UNHANDLED ERROR`, err);

      res.status(500).json({
        message: "Internal server error during template submission",
        error: err?.message,
        requestId,
      });
    }
  });

  app.get("/api/automations", async (req, res) => {
    try {
      const automations = await storage.getAutomations();
      res.json(automations);
    } catch (error) {
      res.status(500).json({ message: "Failed to get automations" });
    }
  });

  app.get("/api/automations/:id", async (req, res) => {
    try {
      const automation = await storage.getAutomation(req.params.id);
      if (!automation) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to get automation" });
    }
  });

  app.post("/api/automations", async (req, res) => {
    try {
      const parsed = insertAutomationSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid automation data",
          errors: parsed.error.errors,
        });
      }
      const automation = await storage.createAutomation(parsed.data);
      res.status(201).json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to create automation" });
    }
  });

  app.put("/api/automations/:id", async (req, res) => {
    try {
      const automation = await storage.updateAutomation(
        req.params.id,
        req.body
      );
      if (!automation) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.json(automation);
    } catch (error) {
      res.status(500).json({ message: "Failed to update automation" });
    }
  });

  app.delete("/api/automations/:id", async (req, res) => {
    try {
      const success = await storage.deleteAutomation(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Automation not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete automation" });
    }
  });

  app.get("/api/team-members", async (req, res) => {
    try {
      const members = await storage.getTeamMembers();
      res.json(members);
    } catch (error) {
      res.status(500).json({ message: "Failed to get team members" });
    }
  });

  app.get("/api/team-members/:id", async (req, res) => {
    try {
      const member = await storage.getTeamMember(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to get team member" });
    }
  });

  app.post("/api/team-members", async (req, res) => {
    try {
      const parsed = insertTeamMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid team member data",
          errors: parsed.error.errors,
        });
      }
      const member = await storage.createTeamMember(parsed.data);
      res.status(201).json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to create team member" });
    }
  });

  app.put("/api/team-members/:id", async (req, res) => {
    try {
      const member = await storage.updateTeamMember(req.params.id, req.body);
      if (!member) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.json(member);
    } catch (error) {
      res.status(500).json({ message: "Failed to update team member" });
    }
  });

  app.delete("/api/team-members/:id", async (req, res) => {
    try {
      const success = await storage.deleteTeamMember(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Team member not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete team member" });
    }
  });

  app.get("/api/settings/whatsapp", async (req, res) => {
    try {
      const settings = await storage.getWhatsappSettings();
      res.json(settings || {});
    } catch (error) {
      res.status(500).json({ message: "Failed to get WhatsApp settings" });
    }
  });

  app.post("/api/settings/whatsapp", async (req, res) => {
    try {
      const settings = await storage.saveWhatsappSettings(req.body);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to save WhatsApp settings" });
    }
  });

  app.post("/api/settings/whatsapp/test", async (req, res) => {
    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const isValid = req.body.accessToken && req.body.phoneNumberId;
      if (isValid) {
        res.json({ success: true, message: "Connection successful!" });
      } else {
        res.status(400).json({
          success: false,
          message: "Invalid credentials. Please check your API settings.",
        });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to test connection" });
    }
  });

  app.get("/api/billing", async (req, res) => {
    try {
      const billing = await storage.getBilling();
      res.json(billing);
    } catch (error) {
      res.status(500).json({ message: "Failed to get billing info" });
    }
  });

  app.post("/api/billing/purchase", async (req, res) => {
    try {
      const { amount } = req.body;
      if (!amount || amount <= 0) {
        return res.status(400).json({ message: "Invalid amount" });
      }
      const billing = await storage.addTransaction({
        type: "purchase",
        amount,
        description: `Purchased ${amount} credits`,
      });
      res.json(billing);
    } catch (error) {
      res.status(500).json({ message: "Failed to purchase credits" });
    }
  });

  app.get("/api/reports/delivery", async (req, res) => {
    try {
      const messages = await storage.getMessages();
      const campaigns = await storage.getCampaigns();

      const report = {
        totalSent: messages.filter((m) => m.direction === "outbound").length,
        delivered: messages.filter(
          (m) =>
            m.direction === "outbound" &&
            (m.status === "delivered" || m.status === "read")
        ).length,
        read: messages.filter(
          (m) => m.direction === "outbound" && m.status === "read"
        ).length,
        failed: messages.filter(
          (m) => m.direction === "outbound" && m.status === "failed"
        ).length,
        campaignStats: campaigns.map((c) => ({
          id: c.id,
          name: c.name,
          sent: c.sentCount,
          delivered: c.deliveredCount,
          read: c.readCount,
          replied: c.repliedCount,
        })),
      };
      res.json(report);
    } catch (error) {
      res.status(500).json({ message: "Failed to get delivery report" });
    }
  });

  app.get("/api/reports/campaign/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json({
        ...campaign,
        deliveryRate:
          campaign.sentCount > 0
            ? (campaign.deliveredCount / campaign.sentCount) * 100
            : 0,
        readRate:
          campaign.deliveredCount > 0
            ? (campaign.readCount / campaign.deliveredCount) * 100
            : 0,
        replyRate:
          campaign.readCount > 0
            ? (campaign.repliedCount / campaign.readCount) * 100
            : 0,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get campaign report" });
    }
  });

  app.get("/api/reports/agent-performance", async (req, res) => {
    try {
      const messages = await storage.getMessages();
      const teamMembers = await storage.getTeamMembers();

      const performance = teamMembers.map((member) => {
        const agentMessages = messages.filter(
          (m) => m.agentId === member.userId && m.direction === "outbound"
        );
        return {
          id: member.id,
          name: member.name,
          messagesSent: agentMessages.length,
          avgResponseTime: "2.5 min",
          satisfaction: 4.5,
        };
      });
      res.json(performance);
    } catch (error) {
      res.status(500).json({ message: "Failed to get agent performance" });
    }
  });

  app.get("/api/contact-agents/stats", async (req, res) => {
    try {
      const stats = await contactAgentService.getAutoReplyStats();
      res.json(stats);
    } catch (error) {
      console.error("[ContactAgents] Error getting stats:", error);
      res.status(500).json({ message: "Failed to get contact agent stats" });
    }
  });

  app.post("/api/contact-agents/enable-all-auto-reply", async (req, res) => {
    try {
      const result = await contactAgentService.enableAutoReplyForAll();
      // console.log(
      //   `[ContactAgents] Bulk enabled auto-reply: ${result.updated}/${result.total} contacts`
      // );
      res.json({
        message: `Re-enabled auto-reply for ${result.updated} contacts`,
        ...result,
      });
    } catch (error) {
      console.error("[ContactAgents] Error enabling all auto-reply:", error);
      res
        .status(500)
        .json({ message: "Failed to enable auto-reply for all contacts" });
    }
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/credentials", credentialsRoutes);
  app.use("/api/agents", agentRoutes);
  app.use("/api/facebook", fbRoutes);
  app.use("/api/map-agent", mappingRoutes);
  app.use("/api/webhook/whatsapp", whatsappRoutes);
  app.use("/api/leads/auto-reply", leadAutoReplyRoutes);
  app.use("/api/broadcast", broadcastRoutes);
  app.use("/api/ai-analytics", aiAnalyticsRoutes);
  app.use("/api/prefilled-text", prefilledTextRoutes);
  app.use("/api/reports", reportsRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/contact-analytics", contactAnalyticsRoutes);
  app.use("/api/lead-management", leadManagementRoutes);
  app.use("/api/integrations", integrationRoutes);
  app.use("/api/automation", automationRoutes);
  app.use("/api/flow", flowHandler);
  app.get("/api/chats/whatsapp-leads", async (req, res) => {
    try {
      const allChats = await storage.getChats();

      const memContacts = await storage.getContacts();
      const importedContacts = await mongodb.readCollection<{
        id: string;
        name: string;
        phone: string;
        email?: string;
        tags?: string[];
      }>("imported_contacts");

      const knownPhones = new Set<string>();
      for (const contact of memContacts) {
        const normalized = contact.phone.replace(/\D/g, "");
        knownPhones.add(normalized);
        if (normalized.length >= 10) {
          knownPhones.add(normalized.slice(-10));
        }
      }
      for (const contact of importedContacts) {
        const normalized = contact.phone.replace(/\D/g, "");
        knownPhones.add(normalized);
        if (normalized.length >= 10) {
          knownPhones.add(normalized.slice(-10));
        }
      }

      const leadChats = allChats.filter((chat) => {
        const chatPhone = chat.contact.phone.replace(/\D/g, "");
        const chatPhoneLast10 = chatPhone.slice(-10);
        return !knownPhones.has(chatPhone) && !knownPhones.has(chatPhoneLast10);
      });

      res.json(leadChats);
    } catch (error) {
      console.error("Error fetching WhatsApp leads:", error);
      res.status(500).json({ message: "Failed to get WhatsApp leads" });
    }
  });

  return httpServer;
}
export function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
