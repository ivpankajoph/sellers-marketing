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
import {
  migrateExistingLeads,
  parallelLimit,
  processDripCampaigns,
  retry,
  retryFailedTemplates,
  retrySend,
  sendWithLimit,
  syncLeadsForFormMain,
} from "./worker";
import { sendTemplateMessage } from "./modules/broadcast/broadcast.service";

const app = express();
const httpServer = createServer(app);

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

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      // console.log(logLine);
    }
  });

  next();
});

(async () => {
  await connectToMongoDB();
  await ensureDefaultAdmin();
  await registerRoutes(httpServer, app);
  // await migrateExistingLeads();

  let isRunning = false;

  // Sync form automations every 40 seconds (internal polling, no timezone needed)
  cron.schedule("*/40 * * * * *", async () => {
    if (isRunning) {
      console.log("⏭ Skipping form sync cron — previous run still in progress");
      return;
    }

    isRunning = true;

    try {
      console.log("🔄 Running scheduled form sync...");
      const activeAutomations = await FormAutomation.find({
        automation_active: true,
      });

      for (const automation of activeAutomations) {
        await syncLeadsForFormMain(automation);
      }

      console.log(`✅ Completed sync for ${activeAutomations.length} forms`);
    } catch (err) {
      console.error("❌ Form sync cron error:", err);
    } finally {
      isRunning = false;
    }
  });

  // =============== Drip Campaign Cron (Fixed for IST) ===============
  let dripCronRunning = false;

  cron.schedule(
    "* * * * *", // Every minute (5 fields → timezone respected)
    async () => {
      if (dripCronRunning) {
        console.log(
          "[CRON] ⏭ Skipping drip campaign — previous run still in progress"
        );
        return;
      }

      dripCronRunning = true;
      const jobStart = new Date();

      try {
        // Get current time in IST for logging and comparison
        const nowIST = new Date();
        console.log(
          "\n[CRON] 🕒 Drip campaign job started at IST:",
          nowIST.toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour12: true,
          })
        );

        const campaigns = await Campaign.find({
          status: "running",
          isProcessing: false,
          nextRunAt: { $lte: nowIST },
        });

        for (const campaign of campaigns) {
          campaign.isProcessing = true;
          await campaign.save();

          try {
            const step = campaign.steps[campaign.currentStep];
            if (!step) {
              campaign.status = "completed";
              await campaign.save();
              continue;
            }

            await parallelLimit(campaign.contacts, 5, async (contact: any) => {
              const exists = await CampaignLog.findOne({
                campaignId: campaign._id,
                stepIndex: campaign.currentStep,
                contact,
              });

              if (exists) return;

              await retry(() =>
                sendTemplateMessage(step.template_name!, contact)
              );

              await CampaignLog.create({
                campaignId: campaign._id,
                stepIndex: campaign.currentStep,
                contact,
                sentAt: new Date(),
              });
            });

            campaign.currentStep++;

            const nextStep = campaign.steps[campaign.currentStep];
            if (!nextStep) {
              campaign.status = "completed";
            } else {
              if (nextStep.scheduleType === "specific") {
                // Parse as IST by appending +05:30 offset
                const specificDateTimeStr = `${nextStep.specificDate}T${nextStep.specificTime}:00+05:30`;
                campaign.nextRunAt = new Date(specificDateTimeStr);
              } else {
                // Delay-based: add days + hours in milliseconds
                campaign.nextRunAt = new Date(
                  Date.now() +
                    (nextStep.delayDays * 24 + nextStep.delayHours) *
                      60 *
                      60 *
                      1000
                );
              }
            }
          } catch (err) {
            console.error(`[CRON ERROR] Campaign ${campaign._id}:`, err);
          } finally {
            campaign.isProcessing = false;
            await campaign.save();
          }
        }

        console.log(
          `[CRON] ✅ Drip job completed. Took ${
            Date.now() - jobStart.getTime()
          }ms`
        );
      } catch (err) {
        console.error("[CRON] ❌ Unhandled error in drip campaign cron:", err);
      } finally {
        dripCronRunning = false;
      }
    },
    {
      timezone: "Asia/Kolkata", // Now fully effective
    }
  );

  // Error-handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Optional: remove `throw err` in production to avoid crashing
    // throw err;
  });

  // Vite or static serving
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "8080", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      console.log(`📡 serving on port ${port}`);
    }
  );
})();
