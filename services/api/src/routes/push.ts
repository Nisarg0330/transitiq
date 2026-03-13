/**
 * TransitIQ — Push Notification Routes
 * =======================================
 * POST /api/push/subscribe    → save push subscription to DB
 * DELETE /api/push/unsubscribe → remove subscription
 * POST /api/push/test          → send a test notification
 */

import { Router, Request, Response } from "express";
import { requireAuth }               from "@clerk/express";
import webpush                       from "web-push";
import { db }                        from "../db";
import { logger }                    from "../logger";

export const pushRouter = Router();

// Configure VAPID
webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL || "admin@transitiq.ca"}`,
  process.env.VAPID_PUBLIC_KEY  || "",
  process.env.VAPID_PRIVATE_KEY || "",
);

// ── POST /api/push/subscribe ─────────────────────────────────
pushRouter.post("/subscribe", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clerkId      = (req as any).auth.userId;
    const subscription = req.body; // PushSubscription object from browser

    if (!subscription?.endpoint) {
      res.status(400).json({ error: "Invalid subscription object" });
      return;
    }

    // Save subscription to users table
    await db.query(`
      UPDATE users
      SET push_subscription = $2
      WHERE clerk_id = $1
    `, [clerkId, JSON.stringify(subscription)]);

    logger.info(`Push subscription saved for ${clerkId}`);
    res.json({ success: true });

  } catch (err) {
    logger.error(`Push subscribe error: ${err}`);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// ── DELETE /api/push/unsubscribe ──────────────────────────────
pushRouter.delete("/unsubscribe", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth.userId;

    await db.query(`
      UPDATE users SET push_subscription = NULL WHERE clerk_id = $1
    `, [clerkId]);

    logger.info(`Push subscription removed for ${clerkId}`);
    res.json({ success: true });

  } catch (err) {
    logger.error(`Push unsubscribe error: ${err}`);
    res.status(500).json({ error: "Failed to remove subscription" });
  }
});

// ── POST /api/push/test ───────────────────────────────────────
pushRouter.post("/test", requireAuth(), async (req: Request, res: Response) => {
  try {
    const clerkId = (req as any).auth.userId;

    // Get user's push subscription
    const result = await db.query(`
      SELECT push_subscription FROM users WHERE clerk_id = $1
    `, [clerkId]);

    if (!result.rows[0]?.push_subscription) {
      res.status(404).json({ error: "No push subscription found" });
      return;
    }

    const subscription = result.rows[0].push_subscription;

    // Send test notification
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: "🚌 TransitIQ Test",
        body:  "Push notifications are working! You'll be notified about delays.",
        icon:  "/favicon.ico",
        url:   "/dashboard",
      })
    );

    logger.info(`Test push sent to ${clerkId}`);
    res.json({ success: true });

  } catch (err) {
    logger.error(`Push test error: ${err}`);
    res.status(500).json({ error: "Failed to send test notification" });
  }
});

// ── Utility: send notification to a user (used by notifier) ──
export async function sendPushToUser(clerkId: string, payload: object): Promise<boolean> {
  try {
    const result = await db.query(`
      SELECT push_subscription FROM users WHERE clerk_id = $1
    `, [clerkId]);

    if (!result.rows[0]?.push_subscription) return false;

    await webpush.sendNotification(
      result.rows[0].push_subscription,
      JSON.stringify(payload)
    );
    return true;
  } catch (err) {
    logger.error(`Failed to send push to ${clerkId}: ${err}`);
    return false;
  }
}
