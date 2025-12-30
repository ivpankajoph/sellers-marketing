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

// export function log(message: string, source = "express") {
//   const formattedTime = new Date().toLocaleTimeString("en-US", {
//     hour: "numeric",
//     minute: "2-digit",
//     second: "2-digit",
//     hour12: true,
//   });

//   console.log(`${formattedTime} [${source}] ${message}`);
// }

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

  cron.schedule("*/40 * * * * *", async () => {
    if (isRunning) {
      console.log("⏭ Skipping cron — previous run still in progress");
      return;
    }

    isRunning = true;

    try {
      console.log("🔄 Running scheduled sync...");
      const activeAutomations = await FormAutomation.find({
        automation_active: true,
      });

      for (const automation of activeAutomations) {
        await syncLeadsForFormMain(automation);
      }

      console.log(`✅ Completed sync for ${activeAutomations.length} forms`);
    } catch (err) {
      console.error("❌ Cron error:", err);
    } finally {
      isRunning = false;
    }
  });

  // cron.schedule("*/20 * * * * *", async () => {
  //   console.log("🔁 Running retry for failed template sends...");
  //   // await retryFailedTemplates();
  // });

  cron.schedule(
    "*/10 * * * * *",
    async () => {
      const now = new Date();
      console.log("\n[CRON] Tick:", now.toISOString());

      const campaigns = await Campaign.find({
        status: "running",
        isProcessing: false,
        nextRunAt: { $lte: new Date() },
      });

      for (const campaign of campaigns) {
        campaign.isProcessing = true;
        await campaign.save();

        try {
          const step = campaign.steps[campaign.currentStep];
          if (!step) {
            campaign.status = "completed";
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
            campaign.nextRunAt =
              nextStep.scheduleType === "specific"
                ? new Date(`${nextStep.specificDate} ${nextStep.specificTime}`)
                : new Date(
                    Date.now() +
                      (nextStep.delayDays * 24 + nextStep.delayHours) *
                        60 *
                        60 *
                        1000
                  );
          }
        } catch (err) {
          console.error("[CRON ERROR]", err);
        } finally {
          campaign.isProcessing = false;
          await campaign.save();
        }
      }
    },
    {
      timezone: "Asia/Kolkata",
    }
  );

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "8080", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      console.log(`serving on port ${port}`);
    }
  );
})();
