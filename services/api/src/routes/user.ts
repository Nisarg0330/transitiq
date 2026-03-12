/**
 * TransitIQ — User Routes
 * =========================
 * Phase 6 | File 8 of 8
 *
 * Handles saved routes for authenticated users.
 * Auth is handled by Clerk — no passwords stored here.
 *
 * Endpoints:
 *   GET    /api/user/routes         — get user's saved routes
 *   POST   /api/user/routes         — save a new route
 *   DELETE /api/user/routes/:id     — remove a saved route
 *   GET    /api/user/profile        — get user profile
 */

import { Router, Request, Response } from "express";
import { requireAuth, getAuth } from "@clerk/express";
import { db } from "../db";
import { logger } from "../logger";

export const userRouter = Router();


// =============================================================
// GET /api/user/profile
// Returns the current user's profile
// Requires Clerk authentication
// =============================================================

userRouter.get("/profile", requireAuth(), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    // Check if user exists in our DB
    const result = await db.query(
      "SELECT * FROM users WHERE clerk_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      // First time user — create their record
      await db.query(`
        INSERT INTO users (clerk_id, created_at)
        VALUES ($1, NOW())
        ON CONFLICT (clerk_id) DO NOTHING
      `, [userId]);

      res.json({ clerk_id: userId, saved_routes: 0, is_new: true });
      return;
    }

    res.json({ ...result.rows[0], is_new: false });

  } catch (err) {
    logger.error(`GET /profile error: ${err}`);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});


// =============================================================
// GET /api/user/routes
// Returns all saved routes for the authenticated user
// =============================================================

userRouter.get("/routes", requireAuth(), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);

    const result = await db.query(`
      SELECT
        ur.id,
        ur.route_id,
        ur.agency,
        ur.nickname,
        ur.direction,
        ur.created_at
      FROM user_routes ur
      JOIN users u ON u.id = ur.user_id
      WHERE u.clerk_id = $1
      ORDER BY ur.created_at DESC
    `, [userId]);

    res.json({
      routes: result.rows,
      count:  result.rows.length,
    });

  } catch (err) {
    logger.error(`GET /user/routes error: ${err}`);
    res.status(500).json({ error: "Failed to fetch saved routes" });
  }
});


// =============================================================
// POST /api/user/routes
// Saves a new route for the authenticated user
// =============================================================

userRouter.post("/routes", requireAuth(), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const { route_id, agency = "TTC", nickname, direction = 0 } = req.body;

    if (!route_id) {
      res.status(400).json({ error: "route_id is required" });
      return;
    }

    // Get or create user record
    const userResult = await db.query(`
      INSERT INTO users (clerk_id, created_at)
      VALUES ($1, NOW())
      ON CONFLICT (clerk_id) DO UPDATE SET clerk_id = EXCLUDED.clerk_id
      RETURNING id
    `, [userId]);

    const dbUserId = userResult.rows[0].id;

    // Check if already saved
    const existing = await db.query(`
      SELECT id FROM user_routes
      WHERE user_id = $1 AND route_id = $2 AND agency = $3
    `, [dbUserId, route_id, agency]);

    if (existing.rows.length > 0) {
      res.status(409).json({ error: "Route already saved" });
      return;
    }

    // Save the route
    const result = await db.query(`
      INSERT INTO user_routes (user_id, route_id, agency, nickname, direction, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `, [dbUserId, route_id, agency, nickname || `Route ${route_id}`, direction]);

    logger.info(`User ${userId} saved route ${agency} ${route_id}`);
    res.status(201).json(result.rows[0]);

  } catch (err) {
    logger.error(`POST /user/routes error: ${err}`);
    res.status(500).json({ error: "Failed to save route" });
  }
});


// =============================================================
// DELETE /api/user/routes/:id
// Removes a saved route for the authenticated user
// =============================================================

userRouter.delete("/routes/:id", requireAuth(), async (req: Request, res: Response) => {
  try {
    const { userId } = getAuth(req);
    const { id } = req.params;

    // Make sure the route belongs to this user
    const result = await db.query(`
      DELETE FROM user_routes
      WHERE id = $1
        AND user_id = (SELECT id FROM users WHERE clerk_id = $2)
      RETURNING id
    `, [id, userId]);

    if (result.rows.length === 0) {
      res.status(404).json({ error: "Route not found" });
      return;
    }

    logger.info(`User ${userId} removed route ${id}`);
    res.json({ message: "Route removed successfully" });

  } catch (err) {
    logger.error(`DELETE /user/routes error: ${err}`);
    res.status(500).json({ error: "Failed to remove route" });
  }
});
