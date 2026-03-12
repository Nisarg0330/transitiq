"""
TransitIQ — TTC GTFS-Realtime Poller
======================================
Phase 3 | File 2 of 4

What this file does:
    1. Every 60 seconds, fetches live TTC data from the
       public GTFS-Realtime feed (no API key needed)
    2. Parses the binary protobuf format into Python dicts
    3. Pushes each event onto a Redis Stream for the
       processor to consume and save to the database

Two feeds we poll:
    - Vehicle Positions  → where every TTC vehicle is RIGHT NOW
    - Trip Updates       → delay data for every trip/stop

Why Redis Streams and not direct DB writes?
    If the database is slow or temporarily down, events
    safely queue up in Redis instead of being lost forever.
    The processor reads from the stream independently.

How to run:
    cd services/collector
    pip install -r requirements.txt
    python ttc_poller.py
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
# Looks for .env two levels up from this file (project root)
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

# ── Logging Setup ─────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("ttc_poller")

# ── Configuration ─────────────────────────────────────────────
# NEW — updated TTC URLs
TTC_VEHICLE_POSITIONS_URL = os.getenv(
    "TTC_VEHICLE_POSITIONS_URL",
    "https://gtfsrt.ttc.ca/vehicles/position?format=binary",
)
TTC_TRIP_UPDATES_URL = os.getenv(
    "TTC_TRIP_UPDATES_URL",
    "https://gtfsrt.ttc.ca/trips/update?format=binary",
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
STREAM_NAME = os.getenv("REDIS_STREAM_NAME", "transit:events")
POLL_INTERVAL = int(os.getenv("GTFS_POLL_INTERVAL_SECONDS", "60"))

# ── Redis Client ──────────────────────────────────────────────
redis_client = redis.from_url(REDIS_URL, decode_responses=True)


# =============================================================
# SECTION 1: FETCH FEEDS
# =============================================================

def fetch_gtfs_feed(url: str):
    """
    Fetches a GTFS-Realtime feed from a URL and parses
    the binary protobuf response into a FeedMessage object.

    Returns the parsed feed or None if something goes wrong.
    """
    try:
        log.debug(f"Fetching: {url}")

        # TTC requires a User-Agent header — returns 403 without it
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/octet-stream, */*",
        }

        response = requests.get(url, timeout=15, headers=headers)
        response.raise_for_status()

        # Parse binary protobuf format
        feed = gtfs_realtime_pb2.FeedMessage()
        feed.ParseFromString(response.content)

        log.debug(f"Feed fetched — {len(feed.entity)} entities")
        return feed

    except requests.exceptions.Timeout:
        log.error(f"Timeout fetching feed: {url}")
        return None
    except requests.exceptions.RequestException as e:
        log.error(f"HTTP error fetching feed: {e}")
        return None
    except Exception as e:
        log.error(f"Failed to parse GTFS feed: {e}")
        return None

# =============================================================
# SECTION 2: PARSE FEEDS
# =============================================================

def parse_vehicle_positions(feed) -> list:
    """
    Extracts vehicle position data from a GTFS-RT feed.

    Each entity = one TTC vehicle on the road right now.
    We extract: route, vehicle ID, GPS position, current stop.

    Returns a list of event dicts ready for Redis.
    """
    events = []

    for entity in feed.entity:
        # Skip if this entity has no vehicle data
        if not entity.HasField("vehicle"):
            continue

        vehicle = entity.vehicle
        trip    = vehicle.trip
        pos     = vehicle.position

        event = {
            # What kind of event this is
            "agency":         "TTC",
            "event_type":     "vehicle_position",

            # Route and trip info
            "route_id":       trip.route_id   if trip.route_id   else "unknown",
            "trip_id":        trip.trip_id    if trip.trip_id    else "",
            "direction":      str(trip.direction_id),

            # Vehicle info
            "vehicle_id":     vehicle.vehicle.id if vehicle.vehicle.id else entity.id,

            # GPS location
            "lat":            str(pos.latitude)  if pos.latitude  else "",
            "lon":            str(pos.longitude) if pos.longitude else "",

            # Stop status (INCOMING_AT, STOPPED_AT, IN_TRANSIT_TO)
            "stop_id":        vehicle.stop_id if vehicle.stop_id else "",
            "current_status": str(vehicle.current_status),

            # Timestamps
            "vehicle_timestamp": str(vehicle.timestamp) if vehicle.timestamp else "",
            "ingested_at":    datetime.now(timezone.utc).isoformat(),
        }

        events.append(event)

    return events


def parse_trip_updates(feed) -> list:
    events = []

    for entity in feed.entity:
        if not entity.HasField("trip_update"):
            continue

        trip_update = entity.trip_update
        trip        = trip_update.trip

        for stop_update in trip_update.stop_time_update:

            # ── Read delay directly from protobuf ─────────────
            delay_seconds  = 0
            scheduled_time = ""
            actual_time    = ""

            if stop_update.HasField("arrival"):
                arrival       = stop_update.arrival
                delay_seconds = arrival.delay  # ← actual delay in seconds

                if arrival.time and arrival.time > 0:
                    actual_dt      = datetime.fromtimestamp(arrival.time, tz=timezone.utc)
                    scheduled_dt   = datetime.fromtimestamp(
                        arrival.time - delay_seconds, tz=timezone.utc
                    )
                    actual_time    = actual_dt.isoformat()
                    scheduled_time = scheduled_dt.isoformat()

            elif stop_update.HasField("departure"):
                departure     = stop_update.departure
                delay_seconds = departure.delay  # ← fallback to departure delay

                if departure.time and departure.time > 0:
                    actual_dt      = datetime.fromtimestamp(departure.time, tz=timezone.utc)
                    scheduled_dt   = datetime.fromtimestamp(
                        departure.time - delay_seconds, tz=timezone.utc
                    )
                    actual_time    = actual_dt.isoformat()
                    scheduled_time = scheduled_dt.isoformat()

            event = {
                "agency":         "TTC",
                "event_type":     "trip_update",
                "route_id":       trip.route_id   if trip.route_id   else "unknown",
                "trip_id":        trip.trip_id     if trip.trip_id    else "",
                "direction":      str(trip.direction_id),
                "vehicle_id":     trip_update.vehicle.label if trip_update.vehicle.label else "",
                "stop_id":        str(stop_update.stop_id)  if stop_update.stop_id else "",
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
    """
    Pushes a list of events to the Redis Stream.

    Redis Streams work like an append-only log.
    XADD adds a new entry with an auto-generated ID.
    maxlen=50000 keeps the stream from growing forever.

    Returns the number of events successfully pushed.
    """
    if not events:
        return 0

    pushed = 0

    # Use a pipeline to batch all writes in one round trip
    # Much faster than individual XADD calls
    pipeline = redis_client.pipeline()

    for event in events:
        pipeline.xadd(
            STREAM_NAME,
            event,
            maxlen=50000,   # automatically trim stream if it exceeds 50k messages
        )
        pushed += 1

    pipeline.execute()
    return pushed


# =============================================================
# SECTION 4: MAIN POLL JOB
# =============================================================

def poll_ttc():
    """
    Main polling function — runs every 60 seconds.

    Fetches vehicle positions and trip updates from TTC,
    parses them, and pushes all events to Redis Stream.
    """
    log.info("━" * 50)
    log.info("Starting TTC poll...")
    total_pushed = 0

    # ── Poll 1: Vehicle Positions ─────────────────────────────
    log.info("Fetching vehicle positions...")
    vp_feed = fetch_gtfs_feed(TTC_VEHICLE_POSITIONS_URL)

    if vp_feed:
        vp_events = parse_vehicle_positions(vp_feed)
        pushed    = push_to_redis_stream(vp_events)
        total_pushed += pushed
        log.info(f"  ✓ Vehicle positions: {len(vp_events)} parsed → {pushed} pushed to Redis")
    else:
        log.warning("  ✗ Vehicle positions feed unavailable — skipping")

    # ── Poll 2: Trip Updates (Delays) ─────────────────────────
    log.info("Fetching trip updates (delay data)...")
    tu_feed = fetch_gtfs_feed(TTC_TRIP_UPDATES_URL)

    if tu_feed:
        tu_events = parse_trip_updates(tu_feed)
        pushed    = push_to_redis_stream(tu_events)
        total_pushed += pushed
        log.info(f"  ✓ Trip updates: {len(tu_events)} parsed → {pushed} pushed to Redis")
    else:
        log.warning("  ✗ Trip updates feed unavailable — skipping")

    log.info(f"Poll complete — {total_pushed} total events pushed to Redis")
    log.info("━" * 50)


# =============================================================
# SECTION 5: STARTUP & SCHEDULER
# =============================================================

if __name__ == "__main__":

    log.info("=" * 50)
    log.info("  TransitIQ — TTC Poller")
    log.info(f"  Poll interval : every {POLL_INTERVAL} seconds")
    log.info(f"  Redis stream  : {STREAM_NAME}")
    log.info("=" * 50)

    # ── Verify Redis is reachable ─────────────────────────────
    try:
        redis_client.ping()
        log.info("Redis connection: ✓ OK")
    except redis.ConnectionError:
        log.critical("Cannot connect to Redis!")
        log.critical("Make sure Docker is running: docker compose up -d")
        raise SystemExit(1)

    # ── Run once immediately on startup ──────────────────────
    log.info("Running first poll now...")
    poll_ttc()

    # ── Schedule to run every 60 seconds ─────────────────────
    scheduler = BlockingScheduler()
    scheduler.add_job(
        poll_ttc,
        trigger="interval",
        seconds=POLL_INTERVAL,
        id="ttc_poll",
        name="TTC GTFS-RT Poller",
        misfire_grace_time=30,
    )

    log.info(f"Scheduler running. Next poll in {POLL_INTERVAL}s.")
    log.info("Press Ctrl+C to stop.")

    try:
        scheduler.start()
    except KeyboardInterrupt:
        log.info("Poller stopped by user.")
