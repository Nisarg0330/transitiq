"""
TransitIQ — Delay Notifier
============================
Runs every morning at 7AM.
Checks ML predictions for all users' saved routes.
Sends push notifications if delay probability > 70%.

Schedule: APScheduler cron job  OR  run manually for testing
"""

import os
import json
import asyncio
import logging
import requests
import psycopg2
from datetime   import datetime
from pywebpush  import webpush, WebPushException
from dotenv     import load_dotenv
from apscheduler.schedulers.blocking import BlockingScheduler

load_dotenv(dotenv_path="../../.env")

# ── Logging ──────────────────────────────────────────────────
logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s [%(levelname)s] notifier — %(message)s",
)
log = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────
DB_URL          = os.getenv("DATABASE_URL", "postgresql://transitiq:localdev123@localhost:5432/transitiq")
ML_URL          = os.getenv("ML_PREDICTOR_URL", "http://localhost:8001")
VAPID_PRIVATE   = os.getenv("VAPID_PRIVATE_KEY", "")
VAPID_PUBLIC    = os.getenv("VAPID_PUBLIC_KEY", "")
VAPID_EMAIL     = os.getenv("VAPID_EMAIL", "admin@transitiq.ca")
DELAY_THRESHOLD = float(os.getenv("DELAY_THRESHOLD", "0.70"))  # 70%

# ── DB Connection ─────────────────────────────────────────────
def get_db():
    return psycopg2.connect(DB_URL)

# ── Fetch users with saved routes + push subscriptions ────────
def get_users_with_routes():
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("""
        SELECT
            u.clerk_id,
            u.full_name,
            u.push_subscription,
            array_agg(ur.route_id) AS routes
        FROM users u
        JOIN user_routes ur ON ur.user_id = u.id
        WHERE u.push_subscription IS NOT NULL
        GROUP BY u.clerk_id, u.full_name, u.push_subscription
    """)
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

# ── Get ML prediction for a route ─────────────────────────────
def get_prediction(route_id: str) -> dict:
    try:
        resp = requests.post(
            f"{ML_URL}/predict",
            json    = { "route_id": route_id },
            timeout = 5,
        )
        return resp.json()
    except Exception as e:
        log.error(f"ML prediction failed for route {route_id}: {e}")
        return {}

# ── Send push notification ─────────────────────────────────────
def send_push(subscription_json: dict, payload: dict):
    try:
        webpush(
            subscription_info = subscription_json,
            data              = json.dumps(payload),
            vapid_private_key = VAPID_PRIVATE,
            vapid_claims      = { "sub": f"mailto:{VAPID_EMAIL}" },
        )
        return True
    except WebPushException as e:
        log.error(f"WebPush failed: {e}")
        return False

# ── Main Notifier Logic ────────────────────────────────────────
def run_notifier():
    log.info("=" * 50)
    log.info("  TransitIQ Delay Notifier Running")
    log.info(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    log.info("=" * 50)

    users = get_users_with_routes()
    log.info(f"Found {len(users)} users with saved routes and push enabled")

    notified = 0

    for clerk_id, full_name, push_sub_raw, routes in users:
        # Parse push subscription
        if isinstance(push_sub_raw, str):
            push_sub = json.loads(push_sub_raw)
        else:
            push_sub = push_sub_raw

        log.info(f"Checking routes for {full_name or clerk_id}: {routes}")

        # Check each saved route
        delayed_routes = []
        for route_id in routes:
            pred = get_prediction(str(route_id))
            prob = pred.get("delay_probability", 0)
            risk = pred.get("risk_level", "unknown")

            log.info(f"  Route {route_id}: {prob:.0%} delay probability ({risk})")

            if prob >= DELAY_THRESHOLD:
                delayed_routes.append({
                    "route_id": route_id,
                    "probability": prob,
                    "risk": risk,
                    "estimated_delay": pred.get("estimated_delay_min", "?"),
                })

        # Send notification if any routes are delayed
        if delayed_routes:
            # Build notification message
            if len(delayed_routes) == 1:
                r    = delayed_routes[0]
                body = f"Route {r['route_id']}: {r['probability']:.0%} chance of {r['estimated_delay']}min delay"
            else:
                route_list = ", ".join([f"Route {r['route_id']}" for r in delayed_routes])
                body       = f"{len(delayed_routes)} routes likely delayed: {route_list}"

            payload = {
                "title": "🚌 TransitIQ Delay Alert",
                "body":  body,
                "icon":  "/favicon.ico",
                "url":   "/dashboard",
            }

            success = send_push(push_sub, payload)
            if success:
                log.info(f"✓ Notification sent to {full_name or clerk_id}")
                notified += 1
            else:
                log.warning(f"✗ Failed to notify {full_name or clerk_id}")

    log.info(f"Notifier complete — {notified}/{len(users)} users notified")

# ── Scheduler ─────────────────────────────────────────────────
if __name__ == "__main__":
    import sys

    # Run once immediately if --now flag passed
    if "--now" in sys.argv:
        log.info("Running notifier once (--now flag)")
        run_notifier()
    else:
        # Schedule for every morning at 7:00 AM and 8:00 AM Toronto time
        scheduler = BlockingScheduler(timezone="America/Toronto")

        scheduler.add_job(run_notifier, "cron", hour=7,  minute=0, id="morning_alert")
        scheduler.add_job(run_notifier, "cron", hour=8,  minute=0, id="rush_hour_alert")
        scheduler.add_job(run_notifier, "cron", hour=17, minute=0, id="evening_alert")

        log.info("Delay notifier scheduled — 7AM, 8AM, 5PM Toronto time")
        log.info("Run with --now to test immediately")

        try:
            scheduler.start()
        except KeyboardInterrupt:
            log.info("Notifier stopped")
