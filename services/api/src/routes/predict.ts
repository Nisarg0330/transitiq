/**
 * TransitIQ — Prediction Routes
 * ================================
 * Phase 6 | File 7 of 8
 *
 * Endpoints:
 *   POST /api/predict              — single trip prediction
 *   POST /api/predict/batch        — multiple trips
 *   GET  /api/predict/route/:id    — 12hr forecast for a route
 *   GET  /api/predict/routes       — list all available routes
 */

import { Router, Request, Response } from "express";
import axios from "axios";
import { db } from "../db";
import { logger } from "../logger";

export const predictRouter = Router();

const ML_URL = process.env.ML_PREDICTOR_URL || "http://localhost:8001";


// =============================================================
// GET /api/predict/routes
// Returns list of all unique routes in the database
// =============================================================

predictRouter.get("/routes", async (_req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT DISTINCT
        route_id,
        agency,
        COUNT(*)          AS total_events,
        ROUND(AVG(delay_seconds)::numeric, 1) AS avg_delay
      FROM transit_events
      WHERE route_id IS NOT NULL
        AND route_id != 'unknown'
      GROUP BY route_id, agency
      ORDER BY agency, route_id
      LIMIT 200
    `);

    res.json({
      routes: result.rows,
      count:  result.rows.length,
    });

  } catch (err) {
    logger.error(`GET /routes error: ${err}`);
    res.status(500).json({ error: "Failed to fetch routes" });
  }
});


// =============================================================
// POST /api/predict
// Single trip delay prediction
// =============================================================

predictRouter.post("/", async (req: Request, res: Response) => {
  try {
    const {
      route_id,
      agency         = "TTC",
      direction      = 0,
      scheduled_time,
      weather_temp   = 5.0,
      weather_precip = 0.0,
    } = req.body;

    // Validate required fields
    if (!route_id) {
      res.status(400).json({ error: "route_id is required" });
      return;
    }

    // Forward to ML predictor
    const response = await axios.post(`${ML_URL}/predict`, {
      route_id,
      agency,
      direction,
      scheduled_time: scheduled_time || new Date().toISOString(),
      weather_temp,
      weather_precip,
    }, { timeout: 5000 });

    logger.info(`Prediction — Route ${route_id} → ${response.data.risk_level}`);
    res.json(response.data);

  } catch (err: any) {
    logger.error(`POST /predict error: ${err.message}`);
    if (err.response) {
      res.status(err.response.status).json(err.response.data);
    } else {
      res.status(503).json({ error: "ML predictor unavailable" });
    }
  }
});


// =============================================================
// POST /api/predict/batch
// Multiple trip predictions at once
// =============================================================

predictRouter.post("/batch", async (req: Request, res: Response) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      res.status(400).json({ error: "requests array is required" });
      return;
    }

    if (requests.length > 50) {
      res.status(400).json({ error: "Maximum 50 requests per batch" });
      return;
    }

    const response = await axios.post(`${ML_URL}/predict/batch`,
      { requests },
      { timeout: 10000 }
    );

    res.json(response.data);

  } catch (err: any) {
    logger.error(`POST /predict/batch error: ${err.message}`);
    res.status(503).json({ error: "ML predictor unavailable" });
  }
});


// =============================================================
// GET /api/predict/route/:routeId
// 12-hour forecast for a specific route
// =============================================================

predictRouter.get("/route/:routeId", async (req: Request, res: Response) => {
  try {
    const { routeId } = req.params;
    const {
      agency         = "TTC",
      weather_temp   = "5",
      weather_precip = "0",
    } = req.query;

    const response = await axios.get(`${ML_URL}/predict/route/${routeId}`, {
      params: {
        agency,
        weather_temp:   parseFloat(weather_temp as string),
        weather_precip: parseFloat(weather_precip as string),
      },
      timeout: 5000,
    });

    res.json(response.data);

  } catch (err: any) {
    logger.error(`GET /route/:id error: ${err.message}`);
    res.status(503).json({ error: "ML predictor unavailable" });
  }
});


// =============================================================
// GET /api/predict/stats
// Overall delay statistics from the database
// =============================================================

predictRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const result = await db.query(`
      SELECT
        agency,
        COUNT(*)                                              AS total_events,
        SUM(CASE WHEN delay_seconds > 60 THEN 1 ELSE 0 END)  AS delayed_count,
        ROUND(
          SUM(CASE WHEN delay_seconds > 60 THEN 1 ELSE 0 END)::numeric
          / COUNT(*) * 100, 1
        )                                                     AS delay_rate_pct,
        ROUND(AVG(delay_seconds)::numeric, 1)                 AS avg_delay_seconds,
        MAX(delay_seconds)                                    AS max_delay_seconds
      FROM transit_events
      GROUP BY agency
      ORDER BY agency
    `);

    res.json({ stats: result.rows });

  } catch (err) {
    logger.error(`GET /stats error: ${err}`);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});
