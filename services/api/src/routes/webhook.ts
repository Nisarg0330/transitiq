/**
 * TransitIQ — Clerk Webhook Route (Simplified)
 */

import { Router, Request, Response } from "express";
import { db }     from "../db";
import { logger } from "../logger";

export const webhookRouter = Router();

webhookRouter.post("/clerk", async (req: Request, res: Response) => {
  try {
    logger.info("Webhook received!");

    // Parse body whether it comes in as Buffer or object
    let payload: any;
    if (Buffer.isBuffer(req.body)) {
      payload = JSON.parse(req.body.toString());
    } else if (typeof req.body === "string") {
      payload = JSON.parse(req.body);
    } else {
      payload = req.body;
    }

    logger.info(`Event type: ${payload?.type}`);

    const eventType = payload?.type;
    const data      = payload?.data;

    if (!eventType || !data) {
      res.status(400).json({ error: "Invalid payload" });
      return;
    }

    switch (eventType) {

      case "user.created": {
        const clerk_id   = data.id;
        const email      = data.email_addresses?.[0]?.email_address || "";
        const first_name = data.first_name  || "";
        const last_name  = data.last_name   || "";
        const full_name  = `${first_name} ${last_name}`.trim();
        const avatar_url = data.image_url   || "";

        logger.info(`Creating user: ${email} (${clerk_id})`);

        await db.query(`
          INSERT INTO users (clerk_id, email, full_name, avatar_url, created_at)
          VALUES ($1, $2, $3, $4, NOW())
          ON CONFLICT (clerk_id) DO UPDATE SET
            email      = EXCLUDED.email,
            full_name  = EXCLUDED.full_name,
            avatar_url = EXCLUDED.avatar_url,
            updated_at = NOW()
        `, [clerk_id, email, full_name, avatar_url]);

        logger.info(`✓ User saved to DB: ${email}`);
        break;
      }

      case "user.updated": {
        const clerk_id   = data.id;
        const email      = data.email_addresses?.[0]?.email_address || "";
        const first_name = data.first_name || "";
        const last_name  = data.last_name  || "";
        const full_name  = `${first_name} ${last_name}`.trim();
        const avatar_url = data.image_url  || "";

        await db.query(`
          UPDATE users SET
            email      = $2,
            full_name  = $3,
            avatar_url = $4,
            updated_at = NOW()
          WHERE clerk_id = $1
        `, [clerk_id, email, full_name, avatar_url]);

        logger.info(`✓ User updated in DB: ${email}`);
        break;
      }

      case "user.deleted": {
        const clerk_id = data.id;
        await db.query(`
          DELETE FROM user_routes
          WHERE user_id = (SELECT id FROM users WHERE clerk_id = $1)
        `, [clerk_id]);
        await db.query(`DELETE FROM users WHERE clerk_id = $1`, [clerk_id]);
        logger.info(`✓ User deleted: ${clerk_id}`);
        break;
      }

      default:
        logger.info(`Unhandled event: ${eventType}`);
    }

    res.status(200).json({ received: true });

  } catch (err) {
    logger.error(`Webhook error: ${err}`);
    res.status(500).json({ error: String(err) });
  }
});