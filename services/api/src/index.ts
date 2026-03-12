/**
 * TransitIQ — Express API Server
 * ================================
 * Phase 6 | File 3 of 8
 *
 * Main entry point for the Node.js REST API.
 *
 * Architecture:
 *   React Frontend → this API → ML Predictor (FastAPI)
 *                             → TimescaleDB
 *
 * Port: 3001 (frontend runs on 3000, predictor on 8001)
 *
 * How to run:
 *   cd services/api
 *   npm run dev
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { clerkMiddleware } from "@clerk/express";

import { healthRouter }  from "./routes/health";
import { predictRouter } from "./routes/predict";
import { userRouter }    from "./routes/user";
import { logger }        from "./logger";

// ── Load environment variables ────────────────────────────────
dotenv.config({ path: "../../.env" });

const app  = express();
const PORT = process.env.API_PORT || 3001;

// =============================================================
// SECTION 1: SECURITY MIDDLEWARE
// =============================================================

// Helmet — sets secure HTTP headers
app.use(helmet());

// CORS — allow requests from React frontend
app.use(cors({
  origin: [
    "http://localhost:3000",    // React dev server
    "http://localhost:5173",    // Vite dev server
    process.env.FRONTEND_URL || "http://localhost:3000",
  ],
  credentials: true,
}));

// Rate limiting — prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max:      100,              // 100 requests per window
  message:  { error: "Too many requests — please try again later" },
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use("/api/", limiter);

// =============================================================
// SECTION 2: BODY PARSING
// =============================================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================================
// SECTION 3: CLERK AUTH MIDDLEWARE
// =============================================================

// Clerk middleware — attaches auth state to every request
// Protected routes check auth using requireAuth()
app.use(clerkMiddleware());

// =============================================================
// SECTION 4: REQUEST LOGGING
// =============================================================

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// =============================================================
// SECTION 5: ROUTES
// =============================================================

app.use("/api/health",  healthRouter);
app.use("/api/predict", predictRouter);
app.use("/api/user",    userRouter);

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
// SECTION 6: START SERVER
// =============================================================

app.listen(PORT, () => {
  logger.info("=".repeat(50));
  logger.info("  TransitIQ — REST API");
  logger.info(`  http://localhost:${PORT}`);
  logger.info(`  ML Predictor: ${process.env.ML_PREDICTOR_URL || "http://localhost:8001"}`);
  logger.info("=".repeat(50));
});

export default app;
