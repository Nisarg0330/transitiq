"""
TransitIQ — Realistic Delay Data Generator
============================================
Phase 5 | Data Fix

Why this exists:
    TTC's public GTFS-RT feed does not reliably publish
    delay values in the arrival.delay protobuf field.
    This is a known limitation of TTC's free data feed.

    This script generates statistically realistic delay
    values based on published TTC performance reports and
    City of Toronto open data on transit reliability.

    Sources:
    - TTC CEO Report (monthly) — ttc.ca
    - City of Toronto Open Data — toronto.ca/open-data
    - TTC Ridership & Reliability Stats 2023-2024

Key statistics used:
    - Overall on-time rate: ~72% (28% delayed)
    - Rush hour on-time rate: ~55% (45% delayed)
    - Snow/ice event on-time rate: ~35% (65% delayed)
    - Average delay when delayed: 3.5 minutes (210 seconds)
    - Maximum typical delay: 15 minutes (900 seconds)

Routes known for chronic delays (TTC data):
    - Route 504 King (streetcar, downtown congestion)
    - Route 501 Queen (longest streetcar route)
    - Route 506 Carlton (mixed traffic)
    - Route 29 Dufferin (bus bunching)
    - Route 36 Finch West (high frequency issues)

How to run:
    cd services/ml-engine
    python generate_delays.py
"""

import os
import logging
import random
import numpy as np
import psycopg2
import psycopg2.extras
from datetime import datetime, timezone
from dotenv import load_dotenv

# ── Load .env ─────────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("generate_delays")

# ── Database ──────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://transitiq:localdev123@localhost:5432/transitiq"
)
db_conn = psycopg2.connect(DATABASE_URL)
db_conn.autocommit = False

# ── Random seed for reproducibility ──────────────────────────
random.seed(42)
np.random.seed(42)


# =============================================================
# SECTION 1: DELAY PROBABILITY MODELS
# =============================================================

# Routes with chronic delay issues (from TTC reports)
CHRONIC_DELAY_ROUTES = {
    "504", "501", "506", "029", "036",
    "29",  "36",  "310", "320", "352",
}

# Base delay probability by hour of day
# Based on TTC on-time performance data
HOURLY_DELAY_PROBABILITY = {
    0:  0.15,   # midnight — very low
    1:  0.12,
    2:  0.10,
    3:  0.10,
    4:  0.12,
    5:  0.18,   # early morning service starts
    6:  0.28,   # morning build-up
    7:  0.42,   # morning rush starts
    8:  0.48,   # peak morning rush
    9:  0.45,   # late morning rush
    10: 0.28,   # mid-morning
    11: 0.25,
    12: 0.27,   # lunch hour
    13: 0.26,
    14: 0.28,
    15: 0.35,   # afternoon build-up
    16: 0.45,   # evening rush starts
    17: 0.52,   # peak evening rush
    18: 0.50,   # heavy evening rush
    19: 0.38,   # post-rush
    20: 0.28,
    21: 0.22,
    22: 0.18,
    23: 0.15,   # late night
}


def calculate_delay_probability(
    hour: int,
    day_of_week: int,
    weather_temp: float,
    weather_precip: float,
    route_id: str,
) -> float:
    """
    Calculates realistic probability of a trip being delayed.

    Combines multiple factors:
        - Time of day (rush hour effect)
        - Day of week (weekday vs weekend)
        - Weather conditions (rain/snow multiplier)
        - Route (chronic delay routes)

    Returns a probability between 0.0 and 1.0
    """
    # Base probability from hour of day
    base_prob = HOURLY_DELAY_PROBABILITY.get(hour, 0.25)

    # ── Day of week adjustment ────────────────────────────────
    if day_of_week == 0:        # Monday — worst day
        base_prob *= 1.15
    elif day_of_week == 4:      # Friday — second worst
        base_prob *= 1.10
    elif day_of_week == 5:      # Saturday
        base_prob *= 0.65
    elif day_of_week == 6:      # Sunday — best day
        base_prob *= 0.55

    # ── Weather adjustment ────────────────────────────────────
    if weather_temp is not None and weather_precip is not None:

        # Freezing conditions (black ice, signal issues)
        if weather_temp <= -10:
            base_prob *= 1.45
        elif weather_temp <= 0:
            base_prob *= 1.25
        elif weather_temp <= 2:
            base_prob *= 1.15

        # Precipitation intensity
        if weather_precip > 5.0:    # heavy rain/snow
            base_prob *= 1.50
        elif weather_precip > 2.0:  # moderate
            base_prob *= 1.30
        elif weather_precip > 0.5:  # light
            base_prob *= 1.15

    # ── Chronic delay route adjustment ───────────────────────
    route_clean = str(route_id).lstrip("0") if route_id else ""
    if route_id in CHRONIC_DELAY_ROUTES or route_clean in CHRONIC_DELAY_ROUTES:
        base_prob *= 1.25

    # Cap at 90% — even on the worst days some trips are on time
    return min(base_prob, 0.90)


def generate_delay_seconds(
    is_delayed: bool,
    hour: int,
    weather_precip: float,
) -> int:
    """
    Generates a realistic delay duration in seconds.

    Uses a log-normal distribution which matches real
    transit delay distributions — most delays are short
    (1-3 min) with a long tail of severe delays (10-20 min).

    Returns delay in seconds (0 if not delayed, negative
    values mean running early which also happens).
    """
    if not is_delayed:
        # Running on time or slightly early
        # Small negative delays (running early) do happen
        if random.random() < 0.15:
            return random.randint(-120, -10)  # up to 2 min early
        return 0

    # Rush hour delays tend to be longer
    if hour in range(7, 10) or hour in range(16, 20):
        mean_delay   = 240   # 4 minutes average during rush
        std_delay    = 180   # high variance
    else:
        mean_delay   = 150   # 2.5 minutes average off-peak
        std_delay    = 120

    # Heavy weather increases delay duration
    if weather_precip and weather_precip > 3.0:
        mean_delay = int(mean_delay * 1.4)

    # Log-normal distribution (always positive, right-skewed)
    delay = int(np.random.lognormal(
        mean=np.log(mean_delay),
        sigma=0.6
    ))

    # Cap at 20 minutes — beyond that it's usually a diversion
    return min(delay, 1200)


# =============================================================
# SECTION 2: UPDATE DATABASE
# =============================================================

def load_events() -> list:
    """Loads all transit events that need delay values."""
    with db_conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT
                event_id,
                route_id,
                scheduled_time,
                weather_temp,
                weather_precip
            FROM transit_events
            ORDER BY scheduled_time
        """)
        rows = cur.fetchall()

    log.info(f"Loaded {len(rows):,} events to process")
    return rows


def update_delays(rows: list) -> int:
    """
    Updates each transit event with a realistic delay value.
    Processes in batches of 1000 for efficiency.
    """
    updates    = []
    batch_size = 1000

    for row in rows:
        scheduled_time = row["scheduled_time"]
        hour           = scheduled_time.hour        if scheduled_time else 12
        day_of_week    = scheduled_time.weekday()   if scheduled_time else 0
        weather_temp   = row["weather_temp"]   or 8.8
        weather_precip = row["weather_precip"] or 0.0
        route_id       = row["route_id"]       or "unknown"

        # Calculate delay probability
        delay_prob = calculate_delay_probability(
            hour, day_of_week, weather_temp, weather_precip, route_id
        )

        # Decide if this trip is delayed
        is_delayed = random.random() < delay_prob

        # Generate delay duration
        delay_seconds = generate_delay_seconds(is_delayed, hour, weather_precip)

        updates.append({
            "event_id":     row["event_id"],
            "delay_seconds": delay_seconds,
        })

    # Batch update database
    total_updated = 0
    with db_conn.cursor() as cur:
        for i in range(0, len(updates), batch_size):
            batch = updates[i: i + batch_size]
            psycopg2.extras.execute_batch(
                cur,
                """
                UPDATE transit_events
                SET delay_seconds = %(delay_seconds)s
                WHERE event_id = %(event_id)s
                """,
                batch,
                page_size=batch_size,
            )
            total_updated += len(batch)
            log.info(f"Updated {total_updated:,} / {len(updates):,} events...")

    db_conn.commit()
    return total_updated


# =============================================================
# SECTION 3: REPORT STATISTICS
# =============================================================

def print_stats():
    """Prints delay statistics after update to verify realism."""
    with db_conn.cursor() as cur:
        cur.execute("""
            SELECT
                COUNT(*)                                            AS total,
                SUM(CASE WHEN delay_seconds > 60  THEN 1 ELSE 0 END) AS delayed,
                SUM(CASE WHEN delay_seconds <= 0  THEN 1 ELSE 0 END) AS on_time,
                ROUND(AVG(delay_seconds)::numeric, 1)               AS avg_delay,
                MAX(delay_seconds)                                  AS max_delay,
                ROUND(AVG(CASE WHEN delay_seconds > 60
                    THEN delay_seconds END)::numeric, 1)            AS avg_when_delayed
            FROM transit_events
        """)
        row = cur.fetchone()

    total, delayed, on_time, avg_delay, max_delay, avg_when_delayed = row
    delay_rate = (delayed / total * 100) if total else 0

    log.info("=" * 50)
    log.info("  Delay Statistics")
    log.info("=" * 50)
    log.info(f"  Total events:        {total:,}")
    log.info(f"  Delayed (>60s):      {delayed:,} ({delay_rate:.1f}%)")
    log.info(f"  On time:             {on_time:,}")
    log.info(f"  Avg delay (all):     {avg_delay}s")
    log.info(f"  Avg when delayed:    {avg_when_delayed}s")
    log.info(f"  Max delay:           {max_delay}s")
    log.info("=" * 50)


# =============================================================
# SECTION 4: MAIN
# =============================================================

if __name__ == "__main__":
    log.info("=" * 50)
    log.info("  TransitIQ — Delay Data Generator")
    log.info("=" * 50)
    log.info("Generating realistic TTC delay values...")
    log.info("Based on TTC CEO Monthly Performance Reports")

    rows    = load_events()
    updated = update_delays(rows)

    log.info(f"Successfully updated {updated:,} transit events!")
    print_stats()

    log.info("Done! Run feature_engineering.py next.")
