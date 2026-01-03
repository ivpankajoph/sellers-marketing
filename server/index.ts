import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import {
  Campaign,
  CampaignLog,
  connectToMongoDB,
  FormAutomation,
} from "./modules/storage/mongodb.adapter";
import { ensureDefaultAdmin } from "./modules/auth/auth.service";
import cron from "node-cron";
import { parallelLimit, retry, syncLeadsForFormMain } from "./worker";
import { sendTemplateMessage } from "./modules/broadcast/broadcast.service";

const app = express();
const httpServer = createServer(app);

/* -------------------- EXPRESS SETUP -------------------- */

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.use(express.urlencoded({ extended: false }));

/* -------------------- BOOTSTRAP -------------------- */

(async () => {
  await connectToMongoDB();
  await ensureDefaultAdmin();
  await registerRoutes(httpServer, app);

  /* =====================================================
     FORM AUTOMATION CRON (NO REDIS)
     ===================================================== */

  let formSyncRunning = false;

  cron.schedule("*/40 * * * * *", async () => {
    if (formSyncRunning) {
      console.log("⏭ Skipping form sync — already running");
      return;
    }

    formSyncRunning = true;

    try {
      console.log("🔄 Running form automation sync");

      const automations = await FormAutomation.find({
        automation_active: true,
      });

      for (const automation of automations) {
        await syncLeadsForFormMain(automation);
      }

      console.log(`✅ Synced ${automations.length} forms`);
    } catch (err) {
      console.error("❌ Form sync error:", err);
    } finally {
      formSyncRunning = false;
    }
  });

  /* =====================================================
     DRIP CAMPAIGN CRON — NO REDIS, DB LOCKED
     ===================================================== */

  const STUCK_TIMEOUT_MIN = 10;

  // cron.schedule(
  //    "*/12 * * * * *",
  //   async () => {
  //     const now = new Date();

  //     try {
  //       console.log(
  //         "\n[CRON] 🕒 Drip job @",
  //         now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  //       );

  //       /* ---------- RELEASE STUCK LOCKS ---------- */
  //       await Campaign.updateMany(
  //         {
  //           isProcessing: true,
  //           processingStartedAt: {
  //             $lte: new Date(Date.now() - STUCK_TIMEOUT_MIN * 60 * 1000),
  //           },
  //         },
  //         { $set: { isProcessing: false } }
  //       );

  //       /* ---------- FETCH ELIGIBLE IDS ---------- */
  //       const campaignIds = await Campaign.find(
  //         {
  //           status: "running",
  //           isProcessing: false,
  //           // nextRunAt: { $lte: now },
  //         },
  //         { _id: 1 }
  //       );

  //       if (!campaignIds.length) {
  //         console.log("[CRON] ℹ️ No campaigns to process");
  //         return;
  //       }

  //       console.log(`[CRON] 📦 Found ${campaignIds.length} campaigns`);

  //       /* ---------- PROCESS EACH CAMPAIGN ---------- */
  //       for (const { _id } of campaignIds) {
  //         const campaign = await Campaign.findOneAndUpdate(
  //           { _id, isProcessing: false },
  //           {
  //             $set: {
  //               isProcessing: true,
  //               processingStartedAt: new Date(),
  //             },
  //           },
  //           { new: true }
  //         );

  //         if (!campaign) continue; // locked by another instance

  //         const campaignStart = Date.now();

  //         try {
  //           console.log(`[CAMPAIGN] ▶ ${campaign._id}`);

  //           const step = campaign.steps[campaign.currentStep];

  //           if (!step) {
  //             campaign.status = "completed";
  //             await campaign.save();
  //             continue;
  //           }

  //           /* ---------- SEND MESSAGES ---------- */
  //           await parallelLimit(campaign.contacts, 5, async (contact: any) => {
  //             try {
  //               const exists = await CampaignLog.findOne({
  //                 campaignId: campaign._id,
  //                 stepIndex: campaign.currentStep,
  //                 contact,
  //               });

  //               if (exists) return;

  //               await retry(() =>
  //                 sendTemplateMessage(step.template_name!, contact)
  //               );

  //               await CampaignLog.create({
  //                 campaignId: campaign._id,
  //                 stepIndex: campaign.currentStep,
  //                 contact,
  //                 sentAt: new Date(),
  //               });

  //               console.log(`[SEND] ✅ ${contact}`);
  //             } catch (err) {
  //               console.error(`[SEND ERROR] ❌`, contact, err);
  //             }
  //           });

  //           /* ---------- NEXT STEP ---------- */
  //           campaign.currentStep++;

  //           const nextStep = campaign.steps[campaign.currentStep];

  //           if (!nextStep) {
  //             campaign.status = "completed";
  //           } else if (nextStep.scheduleType === "specific") {
  //             campaign.nextRunAt = new Date(
  //               `${nextStep.specificDate}T${nextStep.specificTime}:00+05:30`
  //             );
  //           } else {
  //             const delayMs =
  //               (nextStep.delayDays * 24 + nextStep.delayHours) *
  //               60 *
  //               60 *
  //               1000;

  //             campaign.nextRunAt = new Date(
  //               campaign.nextRunAt.getTime() + delayMs
  //             );
  //           }
  //         } catch (err) {
  //           console.error(
  //             `[CAMPAIGN ERROR] ❌ ${campaign._id}`,
  //             err
  //           );
  //         } finally {
  //           campaign.isProcessing = false;
  //           await campaign.save();

  //           console.log(
  //             `[CAMPAIGN] ⏱ Done ${campaign._id} in ${
  //               Date.now() - campaignStart
  //             }ms`
  //           );
  //         }
  //       }
  //     } catch (err) {
  //       console.error("[CRON] ❌ Fatal drip error:", err);
  //     }
  //   },
  //   { timezone: "Asia/Kolkata" }
  // );

  /* =====================================================
     ERROR HANDLER
     ===================================================== */

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || "Server Error" });
  });

  /* =====================================================
     STATIC / VITE
     ===================================================== */

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  /* =====================================================
     START SERVER
     ===================================================== */

  const port = parseInt(process.env.PORT || "8080", 10);
  httpServer.listen({ port, host: "0.0.0.0" }, () => {
    console.log(`📡 Server running on port ${port}`);
  });
})();
