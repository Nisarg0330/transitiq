/**
 * TransitIQ — Express API Server
 * ================================
 * Phase 6 | Updated with Clerk Webhook
 */

import express        from "express";
import cors           from "cors";
import helmet         from "helmet";
import rateLimit      from "express-rate-limit";
import dotenv         from "dotenv";
import { clerkMiddleware } from "@clerk/express";

import { healthRouter }  from "./routes/health";
import { predictRouter } from "./routes/predict";
import { userRouter }    from "./routes/user";
import { webhookRouter } from "./routes/webhook";
import { logger }        from "./logger";
import { pushRouter } from "./routes/push";

dotenv.config({ path: "../../.env" });

const app  = express();
const PORT = process.env.API_PORT || 3001;

// =============================================================
// SECTION 1: WEBHOOK ROUTE — must come BEFORE express.json()
// Svix signature verification needs the raw request body
// =============================================================

app.use("/api/webhooks", express.json(), webhookRouter);

// =============================================================
// SECTION 2: SECURITY MIDDLEWARE
// =============================================================

app.use(helmet());

app.use(cors({
  origin: [
    "http://localhost:3000",
    "http://localhost:5173",
    process.env.FRONTEND_URL || "http://localhost:3000",
  ],
  credentials: true,
}));

const limiter = rateLimit({
  windowMs:       15 * 60 * 1000,
  max:            100,
  message:        { error: "Too many requests — please try again later" },
  standardHeaders: true,
  legacyHeaders:  false,
});
app.use("/api/", limiter);

// =============================================================
// SECTION 3: BODY PARSING
// =============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================
// SECTION 4: CLERK AUTH MIDDLEWARE
// =============================================================

app.use(clerkMiddleware());

// =============================================================
// SECTION 5: REQUEST LOGGING
// =============================================================

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// =============================================================
// SECTION 6: ROUTES
// =============================================================

app.use("/api/health",  healthRouter);
app.use("/api/predict", predictRouter);
app.use("/api/user",    userRouter);
// with the other routes:
app.use("/api/push", pushRouter);


// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`);
  res.status(500).json({ error: "Internal server error" });
});

// =============================================================
// SECTION 7: START SERVER
// =============================================================

app.listen(PORT, () => {
  logger.info("=".repeat(50));
  logger.info("  TransitIQ — REST API");
  logger.info(`  http://localhost:${PORT}`);
  logger.info(`  ML Predictor: ${process.env.ML_PREDICTOR_URL || "http://localhost:8001"}`);
  logger.info("=".repeat(50));
});



export default app;