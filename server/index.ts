import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import {
  Campaign,
  CampaignLog,
  connectToMongoDB,
  FormAutomation,
  Template,
} from "./modules/storage/mongodb.adapter";
import { ensureDefaultAdmin } from "./modules/auth/auth.service";
import cron from "node-cron";
import { parallelLimit, retry, syncLeadsForFormMain } from "./worker";
import {
  sendTemplateMessage,
  startScheduler as startBroadcastScheduler,
} from "./modules/broadcast/broadcast.service";

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

/* -------------------- BACKGROUND JOBS -------------------- */

let cronJobsStarted = false;

function startMongoCronJobs(): void {
  if (cronJobsStarted) {
    return;
  }

  cronJobsStarted = true;
  let formSyncRunning = false;

  cron.schedule("*/40 * * * * *", async () => {
    if (formSyncRunning) {
      console.log("[FormSync] Skipping run: previous sync is still in progress");
      return;
    }

    formSyncRunning = true;

    try {
      console.log("[FormSync] Running form automation sync");

      const automations = await FormAutomation.find({
        automation_active: true,
      });

      for (const automation of automations) {
        await syncLeadsForFormMain(automation);
      }

      console.log(`[FormSync] Synced ${automations.length} forms`);
    } catch (err) {
      console.error("[FormSync] Error:", err);
    } finally {
      formSyncRunning = false;
    }
  });

  const STUCK_TIMEOUT_MIN = 10;

  cron.schedule(
    "*/12 * * * * *",
    async () => {
      const now = new Date();

      try {
        console.log(
          "\n[CRON] Drip job @",
          now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
        );

        await Campaign.updateMany(
          {
            isProcessing: true,
            processingStartedAt: {
              $lte: new Date(Date.now() - STUCK_TIMEOUT_MIN * 60 * 1000),
            },
          },
          { $set: { isProcessing: false } }
        );

        const campaignIds = await Campaign.find(
          {
            status: "running",
            isProcessing: false,
          },
          { _id: 1 }
        );

        if (!campaignIds.length) {
          console.log("[CRON] No campaigns to process");
          return;
        }

        console.log(`[CRON] Found ${campaignIds.length} campaigns`);

        for (const { _id } of campaignIds) {
          const campaign = await Campaign.findOneAndUpdate(
            { _id, isProcessing: false },
            {
              $set: {
                isProcessing: true,
                processingStartedAt: new Date(),
              },
            },
            { new: true }
          );

          if (!campaign) continue;

          const campaignStart = Date.now();

          try {
            console.log(`[CAMPAIGN] Processing ${campaign._id}`);

            const step = campaign.steps[campaign.currentStep];

            if (!step) {
              campaign.status = "completed";
              await campaign.save();
              continue;
            }

            await parallelLimit(campaign.contacts, 5, async (contact: any) => {
              try {
                const exists = await CampaignLog.findOne({
                  campaignId: campaign._id,
                  stepIndex: campaign.currentStep,
                  contact,
                });

                if (exists) return;
                console.log("contact is", contact, step.template_name);

                const templatedetail = await Template.findOne({
                  id: step.templateId,
                });
                if (!templatedetail) {
                  throw new Error("Template not found");
                }

                const template_name = templatedetail.name;
                await retry(() => sendTemplateMessage(contact, template_name));

                await CampaignLog.create({
                  campaignId: campaign._id,
                  stepIndex: campaign.currentStep,
                  contact,
                  sentAt: new Date(),
                });

                console.log(`[SEND] Sent to ${contact}`);
              } catch (err) {
                console.error(`[SEND ERROR]`, contact, err);
              }
            });

            campaign.currentStep++;

            const nextStep = campaign.steps[campaign.currentStep];

            if (!nextStep) {
              campaign.status = "completed";
            } else if (nextStep.scheduleType === "specific") {
              campaign.nextRunAt = new Date(
                `${nextStep.specificDate}T${nextStep.specificTime}:00+05:30`
              );
            } else {
              const delayMs =
                (nextStep.delayDays * 24 + nextStep.delayHours) *
                60 *
                60 *
                1000;

              campaign.nextRunAt = new Date(
                campaign.nextRunAt.getTime() + delayMs
              );
            }
          } catch (err) {
            console.error(`[CAMPAIGN ERROR] ${campaign._id}`, err);
          } finally {
            campaign.isProcessing = false;
            await campaign.save();

            console.log(
              `[CAMPAIGN] Done ${campaign._id} in ${
                Date.now() - campaignStart
              }ms`
            );
          }
        }
      } catch (err) {
        console.error("[CRON] Fatal drip error:", err);
      }
    },
    { timezone: "Asia/Kolkata" }
  );

  console.log("[Cron] Background cron jobs started");
}

let postListenStartupStarted = false;

async function runPostListenStartupTasks(): Promise<void> {
  if (postListenStartupStarted) {
    return;
  }

  postListenStartupStarted = true;
  const mongoConfigured = Boolean(process.env.MONGODB_URL);

  if (!mongoConfigured) {
    console.warn("[Startup] Skipping DB init: MONGODB_URL is not configured");
    return;
  }

  try {
    console.log("[Startup] Initializing database and background jobs...");
    await connectToMongoDB();
    await ensureDefaultAdmin();
    startBroadcastScheduler();
    startMongoCronJobs();
    console.log("[Startup] Database and background jobs ready");
  } catch (err) {
    console.error("[Startup] Post-listen initialization failed:", err);
  }
}

/* -------------------- BOOTSTRAP -------------------- */

(async () => {
  await registerRoutes(httpServer, app);

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

  const defaultPort = 8080;
  const requestedPort = parseInt(process.env.PORT || `${defaultPort}`, 10);
  const hasExplicitPort = Boolean(process.env.PORT);
  const bindHost = "0.0.0.0";

  const startServer = (port: number, retries = 0): void => {
    const onListening = () => {
      httpServer.off("error", onError);
      httpServer.off("listening", onListening);
      console.log(`[Startup] Server running on http://localhost:${port}`);
      console.log(`[Startup] Bound host ${bindHost}:${port}`);
      void runPostListenStartupTasks();
    };

    const onError = (err: NodeJS.ErrnoException) => {
      httpServer.off("error", onError);
      httpServer.off("listening", onListening);

      if (!hasExplicitPort && err.code === "EADDRINUSE" && retries < 10) {
        const nextPort = port + 1;
        console.warn(`[Server] Port ${port} is in use, trying ${nextPort}`);
        startServer(nextPort, retries + 1);
        return;
      }

      console.error(`[Server] Failed to start on port ${port}:`, err);
      process.exit(1);
    };

    httpServer.once("error", onError);
    httpServer.once("listening", onListening);
    httpServer.listen({ port, host: bindHost });
  };

  startServer(requestedPort);
})();

