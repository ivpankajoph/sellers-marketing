import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import {
  connectToMongoDB,
  FormAutomation,
} from "./modules/storage/mongodb.adapter";
import { ensureDefaultAdmin } from "./modules/auth/auth.service";
import cron from "node-cron";
import { migrateExistingLeads, retryFailedTemplates, syncLeadsForFormMain } from "./worker";

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

  cron.schedule("*/40 * * * * *", async () => {
    console.log("🔄 Running scheduled sync for all active automations...");

    try {
      const activeAutomations = await FormAutomation.find({
        automation_active: true,
      });

      for (const automation of activeAutomations) {
        await syncLeadsForFormMain(automation);
      }

      console.log(`✅ Completed sync for ${activeAutomations.length} forms`);
    } catch (error) {
      console.error("❌ Error in scheduled sync:", error);
    }
  });

  // cron.schedule("*/20 * * * * *", async () => {
  //   console.log("🔁 Running retry for failed template sends...");
  //   // await retryFailedTemplates();
  // });


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
