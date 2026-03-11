"""
TransitIQ — Event Processor (Redis → TimescaleDB)
===================================================
Phase 3 | File 4 of 4

What this file does:
    1. Continuously reads events from the Redis Stream
    2. Normalizes raw data into our unified DB schema
    3. Batch inserts events into TimescaleDB
    4. Acknowledges processed messages so they are
       never processed twice

How to run (in a NEW terminal tab):
    cd services/processor
    pip install -r requirements.txt
    python processor.py

Keep ttc_poller.py running in the other terminal tab.
"""

import os
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import redis
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

# ── Load .env file ────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

# ── Logging Setup ─────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("processor")

# ── Configuration ─────────────────────────────────────────────
REDIS_URL      = os.getenv("REDIS_URL", "redis://localhost:6379")
STREAM_NAME    = os.getenv("REDIS_STREAM_NAME", "transit:events")
DATABASE_URL   = os.getenv(
    "DATABASE_URL",
    "postgresql://transitiq:localdev123@localhost:5432/transitiq"
)

CONSUMER_GROUP  = "transitiq_processors"
CONSUMER_NAME   = "processor_1"
BATCH_SIZE      = 100     # read 100 messages at a time from Redis
DB_BATCH_SIZE   = 50      # insert 50 rows per DB transaction
BLOCK_MS        = 5000    # wait up to 5 seconds for new messages

# ── Connections ───────────────────────────────────────────────
redis_client = redis.from_url(REDIS_URL, decode_responses=True)
db_conn      = psycopg2.connect(DATABASE_URL)
db_conn.autocommit = False


# =============================================================
# SECTION 1: HELPER FUNCTIONS
# =============================================================

def parse_timestamp(value: Optional[str]) -> Optional[datetime]:
    """Safely converts an ISO string to a datetime object."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except (ValueError, TypeError):
        return None


def parse_float(value: Optional[str]) -> Optional[float]:
    """Safely converts a string to a float."""
    if not value:
        return None
    try:
        result = float(value)
        return result if result != 0.0 else None
    except (ValueError, TypeError):
        return None


def parse_int(value: Optional[str], default: int = 0) -> int:
    """Safely converts a string to an int."""
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


# =============================================================
# SECTION 2: NORMALIZE EVENTS
# =============================================================

def normalize_event(raw: dict) -> Optional[dict]:
    """
    Converts a raw Redis stream message into a clean dict
    that matches our transit_events table schema.

    We only store trip_update events here — these contain
    the actual delay data we care about.

    Vehicle positions are stored separately in Phase 4.

    Returns None if the event should be skipped.
    """
    # Only process trip update events
    event_type = raw.get("event_type", "")
    if event_type != "trip_update":
        return None

    # Parse delay seconds safely
    delay_seconds = parse_int(raw.get("delay_seconds", "0"))

    # Parse timestamps
    scheduled_time = parse_timestamp(raw.get("scheduled_time"))
    actual_time    = parse_timestamp(raw.get("actual_time"))

    # Skip events with no scheduled time
    # We cannot store a transit event without knowing when it was scheduled
    if scheduled_time is None:
        return None

    return {
        "agency":          raw.get("agency", "UNKNOWN"),
        "route_id":        raw.get("route_id", "unknown"),
        "vehicle_id":      raw.get("vehicle_id") or None,
        "stop_id":         raw.get("stop_id")    or None,
        "trip_id":         raw.get("trip_id")    or None,
        "direction":       parse_int(raw.get("direction"), default=0),
        "scheduled_time":  scheduled_time,
        "actual_time":     actual_time,
        "delay_seconds":   delay_seconds,
        "lat":             parse_float(raw.get("lat")),
        "lon":             parse_float(raw.get("lon")),
        # Weather and event data added in Phase 4
        "weather_temp":    None,
        "weather_precip":  None,
        "is_event_day":    False,
        "raw_payload":     None,
    }


# =============================================================
# SECTION 3: DATABASE WRITES
# =============================================================

INSERT_SQL = """
    INSERT INTO transit_events (
        agency, route_id, vehicle_id, stop_id, trip_id,
        direction, scheduled_time, actual_time, delay_seconds,
        lat, lon, weather_temp, weather_precip,
        is_event_day, raw_payload
    ) VALUES (
        %(agency)s, %(route_id)s, %(vehicle_id)s, %(stop_id)s, %(trip_id)s,
        %(direction)s, %(scheduled_time)s, %(actual_time)s, %(delay_seconds)s,
        %(lat)s, %(lon)s, %(weather_temp)s, %(weather_precip)s,
        %(is_event_day)s, %(raw_payload)s
    )
    ON CONFLICT DO NOTHING
"""


def batch_insert(rows: list) -> int:
    """
    Bulk inserts a list of normalized event dicts into TimescaleDB.

    Uses a single transaction for efficiency —
    all rows inserted together or none at all.

    Returns number of rows inserted.
    """
    if not rows:
        return 0

    try:
        with db_conn.cursor() as cur:
            psycopg2.extras.execute_batch(
                cur,
                INSERT_SQL,
                rows,
                page_size=DB_BATCH_SIZE
            )
        db_conn.commit()
        return len(rows)

    except Exception as e:
        db_conn.rollback()
        log.error(f"DB insert failed: {e}")
        return 0


# =============================================================
# SECTION 4: CONSUMER GROUP SETUP
# =============================================================

def setup_consumer_group():
    """
    Creates the Redis consumer group if it does not exist.

    Consumer groups ensure each message is processed
    exactly once — even if multiple processors are running.
    """
    try:
        redis_client.xgroup_create(
            STREAM_NAME,
            CONSUMER_GROUP,
            id="0",         # start from the very beginning
            mkstream=True   # create stream if it does not exist
        )
        log.info(f"Consumer group '{CONSUMER_GROUP}' created")

    except redis.exceptions.ResponseError as e:
        if "BUSYGROUP" in str(e):
            log.info(f"Consumer group '{CONSUMER_GROUP}' already exists — OK")
        else:
            raise


# =============================================================
# SECTION 5: MAIN PROCESSING LOOP
# =============================================================

def process_loop():
    """
    Main loop — runs continuously until stopped.

    Each iteration:
        1. Reads up to 100 new messages from Redis Stream
        2. Normalizes each message
        3. Batch inserts to TimescaleDB
        4. Acknowledges messages so they are not re-processed
    """
    log.info("Processing loop started — waiting for events...")
    total_processed = 0

    while True:
        try:
            # Read new messages from Redis Stream
            # ">" means give me messages not yet delivered to any consumer
            messages = redis_client.xreadgroup(
                groupname=CONSUMER_GROUP,
                consumername=CONSUMER_NAME,
                streams={STREAM_NAME: ">"},
                count=BATCH_SIZE,
                block=BLOCK_MS,
            )

            # No new messages — loop back and wait
            if not messages:
                continue

            # messages = [(stream_name, [(msg_id, {data}), ...])]
            stream_messages = messages[0][1]
            msg_ids        = []
            rows_to_insert = []

            for msg_id, raw_data in stream_messages:
                normalized = normalize_event(raw_data)
                if normalized:
                    rows_to_insert.append(normalized)
                msg_ids.append(msg_id)

            # Insert to database
            if rows_to_insert:
                inserted       = batch_insert(rows_to_insert)
                total_processed += inserted
                log.info(
                    f"Inserted {inserted}/{len(rows_to_insert)} events "
                    f"| Total saved: {total_processed}"
                )

            # Acknowledge ALL messages (even skipped ones)
            if msg_ids:
                redis_client.xack(STREAM_NAME, CONSUMER_GROUP, *msg_ids)

        except redis.ConnectionError as e:
            log.error(f"Redis connection lost: {e} — retrying in 5s")
            time.sleep(5)

        except psycopg2.OperationalError as e:
            log.error(f"DB connection lost: {e} — retrying in 5s")
            time.sleep(5)
            try:
                db_conn.reset()
            except Exception:
                pass

        except KeyboardInterrupt:
            log.info(f"Processor stopped — Total events saved: {total_processed}")
            break

        except Exception as e:
            log.error(f"Unexpected error: {e}", exc_info=True)
            time.sleep(2)


# =============================================================
# SECTION 6: STARTUP
# =============================================================

if __name__ == "__main__":

    log.info("=" * 50)
    log.info("  TransitIQ — Event Processor")
    log.info(f"  Redis stream   : {STREAM_NAME}")
    log.info(f"  Consumer group : {CONSUMER_GROUP}")
    log.info("=" * 50)

    # ── Verify Redis connection ───────────────────────────────
    try:
        redis_client.ping()
        log.info("Redis connection: ✓ OK")
    except redis.ConnectionError:
        log.critical("Cannot connect to Redis!")
        log.critical("Make sure Docker is running: docker compose up -d")
        raise SystemExit(1)

    # ── Verify Database connection ────────────────────────────
    try:
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM transit_events")
            count = cur.fetchone()[0]
        log.info(f"Database connection: ✓ OK (transit_events has {count} rows)")
    except Exception as e:
        log.critical(f"Cannot connect to database: {e}")
        log.critical("Make sure Docker is running: docker compose up -d")
        raise SystemExit(1)

    # ── Setup consumer group and start ───────────────────────
    setup_consumer_group()
    process_loop()
