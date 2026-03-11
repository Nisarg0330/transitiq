"""
TransitIQ — GO Transit GTFS-Realtime Poller
=============================================
Phase 4B | GO Transit Integration

STATUS: Waiting for GO Transit API key approval
        (submitted request — up to 10 business days)

What this file will do:
    1. Every 60 seconds fetch GO Transit trip updates
    2. Parse delay data for GO trains and buses
    3. Push events to same Redis Stream as TTC poller
    4. Processor automatically saves them to TimescaleDB

How to activate:
    1. Get your API key from api.openmetrolinx.com
    2. Add to .env: GO_TRANSIT_API_KEY=your_real_key
    3. Run: python go_poller.py

Routes covered:
    - Lakeshore West / East
    - Kitchener
    - Barrie
    - Stouffville
    - Richmond Hill
    - Milton
    - GO Bus routes
"""

import os
import logging
import time
from datetime import datetime, timezone

import requests
import redis
from google.transit import gtfs_realtime_pb2
from dotenv import load_dotenv
from apscheduler.schedulers.blocking import BlockingScheduler

# ── Load .env file ────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

# ── Logging Setup ─────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("go_poller")

# ── Configuration ─────────────────────────────────────────────
GO_API_KEY = os.getenv("GO_TRANSIT_API_KEY", "")
GO_TRIP_UPDATES_URL = os.getenv(
    "GO_TRIP_UPDATES_URL",
    "https://api.openmetrolinx.com/OpenDataAPI/api/V1/GTFSRealTime/TripUpdate"
)
GO_VEHICLE_POSITIONS_URL = (
    "https://api.openmetrolinx.com/OpenDataAPI/api/V1/GTFSRealTime/VehiclePosition"
)
REDIS_URL    = os.getenv("REDIS_URL", "redis://localhost:6379")
STREAM_NAME  = os.getenv("REDIS_STREAM_NAME", "transit:events")
POLL_INTERVAL = int(os.getenv("GTFS_POLL_INTERVAL_SECONDS", "60"))

# ── Redis Client ──────────────────────────────────────────────
redis_client = redis.from_url(REDIS_URL, decode_responses=True)


# =============================================================
# SECTION 1: FETCH GO TRANSIT FEED
# =============================================================

def fetch_go_feed(url: str):
    """
    Fetches a GO Transit GTFS-RT feed.
    GO Transit requires API key as a header.
    """
    if not GO_API_KEY:
        log.error("GO_TRANSIT_API_KEY not set in .env!")
        log.error("Register at: https://api.openmetrolinx.com")
        return None

    try:
        headers = {
            "User-Agent":    "TransitIQ/1.0",
            "Content-Type":  "application/x-protobuf",
            "Accept":        "application/x-protobuf",
            "x-api-key":     GO_API_KEY,
        }

        response = requests.get(url, timeout=15, headers=headers)
        response.raise_for_status()

        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(response.content)
        return feed

    except requests.exceptions.RequestException as e:
        log.error(f"HTTP error fetching GO feed: {e}")
        return None
    except Exception as e:
        log.error(f"Failed to parse GO feed: {e}")
        return None


# =============================================================
# SECTION 2: PARSE GO TRANSIT TRIP UPDATES
# =============================================================

def parse_go_trip_updates(feed) -> list:
    """
    Parses GO Transit trip updates into normalized events.
    Same structure as TTC parser but with agency = "GO".
    """
    events = []

    for entity in feed.entity:
        if not entity.HasField("trip_update"):
            continue

        trip_update = entity.trip_update
        trip        = trip_update.trip

        for stop_update in trip_update.stop_time_update:
            delay_seconds  = 0
            scheduled_time = ""
            actual_time    = ""

            if stop_update.HasField("arrival"):
                arrival       = stop_update.arrival
                delay_seconds = arrival.delay

                if arrival.time:
                    actual_dt    = datetime.fromtimestamp(arrival.time, tz=timezone.utc)
                    scheduled_dt = datetime.fromtimestamp(
                        arrival.time - delay_seconds, tz=timezone.utc
                    )
                    actual_time    = actual_dt.isoformat()
                    scheduled_time = scheduled_dt.isoformat()

            event = {
                "agency":         "GO",
                "event_type":     "trip_update",
                "route_id":       trip.route_id  if trip.route_id  else "unknown",
                "trip_id":        trip.trip_id   if trip.trip_id   else "",
                "direction":      str(trip.direction_id),
                "vehicle_id":     trip_update.vehicle.id if trip_update.vehicle.id else "",
                "stop_id":        stop_update.stop_id if stop_update.stop_id else "",
                "delay_seconds":  str(delay_seconds),
                "scheduled_time": scheduled_time,
                "actual_time":    actual_time,
                "ingested_at":    datetime.now(timezone.utc).isoformat(),
            }

            events.append(event)

    return events


# =============================================================
# SECTION 3: PUSH TO REDIS
# =============================================================

def push_to_redis_stream(events: list) -> int:
    """Pushes events to Redis Stream."""
    if not events:
        return 0

    pipeline = redis_client.pipeline()
    for event in events:
        pipeline.xadd(STREAM_NAME, event, maxlen=50000)
    pipeline.execute()
    return len(events)


# =============================================================
# SECTION 4: MAIN POLL JOB
# =============================================================

def poll_go_transit():
    """
    Main GO Transit polling function — runs every 60 seconds.
    """
    log.info("━" * 50)
    log.info("Starting GO Transit poll...")
    total_pushed = 0

    # ── Trip Updates ──────────────────────────────────────────
    log.info("Fetching GO Transit trip updates...")
    tu_feed = fetch_go_feed(GO_TRIP_UPDATES_URL)

    if tu_feed:
        tu_events = parse_go_trip_updates(tu_feed)
        pushed    = push_to_redis_stream(tu_events)
        total_pushed += pushed
        log.info(f"  ✓ Trip updates: {len(tu_events)} parsed → {pushed} pushed")
    else:
        log.warning("  ✗ GO Transit feed unavailable")

    log.info(f"GO Transit poll complete — {total_pushed} events pushed")
    log.info("━" * 50)


# =============================================================
# SECTION 5: STARTUP
# =============================================================

if __name__ == "__main__":

    log.info("=" * 50)
    log.info("  TransitIQ — GO Transit Poller")
    log.info(f"  Poll interval: every {POLL_INTERVAL} seconds")
    log.info("=" * 50)

    # ── Check API key ─────────────────────────────────────────
    if not GO_API_KEY:
        log.critical("GO_TRANSIT_API_KEY is not set!")
        log.critical("Steps to fix:")
        log.critical("  1. Register at: https://api.openmetrolinx.com")
        log.critical("  2. Add key to your .env file")
        log.critical("  3. Run this script again")
        raise SystemExit(1)

    # ── Verify Redis ──────────────────────────────────────────
    try:
        redis_client.ping()
        log.info("Redis connection: ✓ OK")
    except redis.ConnectionError:
        log.critical("Cannot connect to Redis!")
        log.critical("Run: docker compose up -d")
        raise SystemExit(1)

    # ── Run once immediately ──────────────────────────────────
    log.info("Running first GO Transit poll now...")
    poll_go_transit()

    # ── Schedule ─────────────────────────────────────────────
    scheduler = BlockingScheduler()
    scheduler.add_job(
        poll_go_transit,
        trigger="interval",
        seconds=POLL_INTERVAL,
        id="go_poll",
        name="GO Transit GTFS-RT Poller",
        misfire_grace_time=30,
    )

    log.info(f"Scheduler running. Next poll in {POLL_INTERVAL}s.")
    log.info("Press Ctrl+C to stop.")

    try:
        scheduler.start()
    except KeyboardInterrupt:
        log.info("GO Transit poller stopped.")
