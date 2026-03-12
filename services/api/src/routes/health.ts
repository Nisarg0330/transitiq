/**
 * TransitIQ — Health Check Route
 * ================================
 * GET /api/health
 *
 * Used by Railway deployment and monitoring
 * to verify the API is running correctly.
 */

import { Router } from "express";
import axios from "axios";
import { db } from "../db";
import { logger } from "../logger";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  const health: Record<string, any> = {
    status:    "healthy",
    timestamp: new Date().toISOString(),
    services:  {},
  };

  // ── Check Database ────────────────────────────────────────
  try {
    const result = await db.query("SELECT COUNT(*) FROM transit_events");
    health.services.database = {
      status: "healthy",
      transit_events: parseInt(result.rows[0].count),
    };
  } catch (err) {
    health.services.database = { status: "unhealthy" };
    health.status = "degraded";
    logger.error(`Health check — DB error: ${err}`);
  }

  // ── Check ML Predictor ────────────────────────────────────
  try {
    const mlUrl = process.env.ML_PREDICTOR_URL || "http://localhost:8001";
    const response = await axios.get(`${mlUrl}/health`, { timeout: 3000 });
    health.services.ml_predictor = {
      status:        "healthy",
      model_version: response.data.model_version,
      roc_auc:       response.data.roc_auc,
    };
  } catch (err) {
    health.services.ml_predictor = { status: "unhealthy" };
    health.status = "degraded";
    logger.error(`Health check — ML predictor error: ${err}`);
  }

  const statusCode = health.status === "healthy" ? 200 : 207;
  res.status(statusCode).json(health);
});
