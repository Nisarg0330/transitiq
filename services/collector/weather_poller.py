"""
TransitIQ — Environment Canada Weather Poller
===============================================
Phase 4A | File 1 of 2

What this file does:
    1. Every hour fetches current weather for Toronto
       from Environment Canada (free, no API key needed)
    2. Parses temperature and precipitation data
    3. Updates recent transit_events rows in TimescaleDB
       with weather conditions at time of event

Why weather matters for our ML model:
    - Snowstorms cause 35%+ more TTC delays
    - Heavy rain slows streetcars significantly
    - Sub-zero temperatures affect vehicle performance
    - Weather is our #1 external prediction feature

Environment Canada feed:
    - Free, no registration needed
    - Updated every hour
    - Provides temp, precipitation, wind, conditions

How to run (in a NEW terminal tab):
    cd services/collector
    python weather_poller.py
"""

import os
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

import requests
import psycopg2
import psycopg2.extras
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
log = logging.getLogger("weather_poller")

# ── Configuration ─────────────────────────────────────────────
# Open-Meteo API — free, no API key, no registration needed
# Toronto coordinates: 43.7001° N, 79.4163° W
WEATHER_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude=43.7001"
    "&longitude=-79.4163"
    "&current=temperature_2m,precipitation,weathercode,"
    "windspeed_10m,relativehumidity_2m"
    "&timezone=America%2FToronto"
)
POLL_INTERVAL = int(os.getenv("WEATHER_POLL_INTERVAL_SECONDS", "3600"))
DATABASE_URL  = os.getenv(
    "DATABASE_URL",
    "postgresql://transitiq:localdev123@localhost:5432/transitiq"
)
# ── Database Connection ───────────────────────────────────────
db_conn = psycopg2.connect(DATABASE_URL)
db_conn.autocommit = False


# =============================================================
# SECTION 1: FETCH & PARSE WEATHER
# =============================================================

def fetch_weather() -> dict | None:
    """
    Fetches current weather for Toronto from Open-Meteo API.
    Free, no API key needed, JSON format — much simpler!
    """
    try:
        headers = {"User-Agent": "TransitIQ/1.0"}
        response = requests.get(WEATHER_URL, timeout=15, headers=headers)
        response.raise_for_status()

        data    = response.json()
        current = data.get("current", {})

        temperature   = current.get("temperature_2m")
        precipitation = current.get("precipitation", 0.0)
        weathercode   = current.get("weathercode", 0)
        wind_speed    = current.get("windspeed_10m")
        humidity      = current.get("relativehumidity_2m")
        condition     = weathercode_to_condition(weathercode)

        weather = {
            "temperature":   temperature,
            "precipitation": precipitation,
            "condition":     condition,
            "humidity":      humidity,
            "wind_speed":    wind_speed,
            "recorded_at":   datetime.now(timezone.utc),
        }

        log.info(
            f"Weather fetched — "
            f"Temp: {temperature}°C | "
            f"Condition: {condition} | "
            f"Precip: {precipitation}mm/hr"
        )
        return weather

    except requests.exceptions.RequestException as e:
        log.error(f"Failed to fetch weather: {e}")
        return None
    except Exception as e:
        log.error(f"Unexpected error: {e}")
        return None


def weathercode_to_condition(code: int) -> str:
    """
    Converts Open-Meteo WMO weather code to human readable string.
    Full code table: https://open-meteo.com/en/docs
    """
    conditions = {
        0:  "Clear Sky",
        1:  "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Fog", 48: "Icy Fog",
        51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
        61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
        71: "Light Snow", 73: "Snow", 75: "Heavy Snow",
        77: "Snow Grains",
        80: "Light Showers", 81: "Showers", 82: "Heavy Showers",
        85: "Snow Showers", 86: "Heavy Snow Showers",
        95: "Thunderstorm",
        96: "Thunderstorm with Hail", 99: "Heavy Thunderstorm with Hail",
    }
    return conditions.get(code, f"Unknown ({code})")

    """
    Fetches current weather conditions from Environment Canada
    XML feed for Toronto.

    Returns a dict with:
        temperature  — degrees Celsius (float)
        precipitation — mm/hr estimate (float)
        condition    — text description e.g. "Light Snow"
        humidity     — percentage (float)
        wind_speed   — km/h (float)
        recorded_at  — UTC datetime

    Returns None if fetch fails.
    """
    try:
        headers = {
            "User-Agent": "TransitIQ/1.0 (transit delay prediction app)"
        }
        response = requests.get(WEATHER_URL, timeout=15, headers=headers)
        response.raise_for_status()

        return parse_weather_xml(response.text)

    except requests.exceptions.RequestException as e:
        log.error(f"Failed to fetch weather: {e}")
        return None
    except Exception as e:
        log.error(f"Unexpected error fetching weather: {e}")
        return None


def parse_weather_xml(xml_text: str) -> dict | None:
    """
    Parses Environment Canada XML weather feed.

    The XML structure looks like:
        <siteData>
          <currentConditions>
            <temperature unitType="metric">-3.2</temperature>
            <relativeHumidity units="%">85</relativeHumidity>
            <wind><speed unitType="metric">15</speed></wind>
            <condition>Light Snow</condition>
          </currentConditions>
        </siteData>

    Returns parsed weather dict or None on failure.
    """
    try:
        root = ET.fromstring(xml_text)
        current = root.find("currentConditions")

        if current is None:
            log.warning("No currentConditions in weather XML")
            return None

        # ── Temperature ──────────────────────────────────────
        temp_elem = current.find("temperature")
        temperature = float(temp_elem.text) if temp_elem is not None and temp_elem.text else None

        # ── Condition text ───────────────────────────────────
        cond_elem = current.find("condition")
        condition = cond_elem.text if cond_elem is not None else "Unknown"

        # ── Humidity ─────────────────────────────────────────
        humidity_elem = current.find("relativeHumidity")
        humidity = float(humidity_elem.text) if humidity_elem is not None and humidity_elem.text else None

        # ── Wind Speed ───────────────────────────────────────
        wind_elem = current.find(".//wind/speed")
        wind_speed = float(wind_elem.text) if wind_elem is not None and wind_elem.text else None

        # ── Estimate Precipitation from condition text ───────
        # Environment Canada doesn't always give mm/hr directly
        # We estimate from condition description
        precipitation = estimate_precipitation(condition)

        weather = {
            "temperature":   temperature,
            "precipitation": precipitation,
            "condition":     condition,
            "humidity":      humidity,
            "wind_speed":    wind_speed,
            "recorded_at":   datetime.now(timezone.utc),
        }

        log.info(
            f"Weather fetched — "
            f"Temp: {temperature}°C | "
            f"Condition: {condition} | "
            f"Precip: {precipitation}mm/hr"
        )

        return weather

    except ET.ParseError as e:
        log.error(f"Failed to parse weather XML: {e}")
        return None
    except Exception as e:
        log.error(f"Unexpected error parsing weather: {e}")
        return None


def estimate_precipitation(condition: str) -> float:
    """
    Estimates precipitation rate in mm/hr from condition text.

    Environment Canada uses standard condition descriptions.
    We map these to approximate mm/hr values for ML features.
    """
    if not condition:
        return 0.0

    condition_lower = condition.lower()

    # Snow conditions
    if "heavy snow" in condition_lower:
        return 4.0
    elif "snow" in condition_lower or "blizzard" in condition_lower:
        return 2.0
    elif "flurries" in condition_lower or "light snow" in condition_lower:
        return 0.5

    # Rain conditions
    elif "heavy rain" in condition_lower or "downpour" in condition_lower:
        return 8.0
    elif "rain" in condition_lower or "shower" in condition_lower:
        return 3.0
    elif "drizzle" in condition_lower or "light rain" in condition_lower:
        return 1.0

    # Freezing conditions
    elif "freezing" in condition_lower or "ice pellets" in condition_lower:
        return 2.0
    elif "fog" in condition_lower or "mist" in condition_lower:
        return 0.2

    # Clear conditions
    else:
        return 0.0


# =============================================================
# SECTION 2: UPDATE DATABASE
# =============================================================

UPDATE_SQL = """
    UPDATE transit_events
    SET
        weather_temp    = %(temperature)s,
        weather_precip  = %(precipitation)s
    WHERE
        scheduled_time >= %(window_start)s
        AND scheduled_time <= %(window_end)s
        AND weather_temp IS NULL
"""


def update_events_with_weather(weather: dict) -> int:
    """
    Updates recent transit_events rows with current weather data.

    We update events from the last 90 minutes that don't
    already have weather data filled in.

    Returns number of rows updated.
    """
    now         = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=90)
    window_end   = now

    try:
        with db_conn.cursor() as cur:
            cur.execute(UPDATE_SQL, {
                "temperature":   weather["temperature"],
                "precipitation": weather["precipitation"],
                "window_start":  window_start,
                "window_end":    window_end,
            })
            updated = cur.rowcount

        db_conn.commit()
        return updated

    except Exception as e:
        db_conn.rollback()
        log.error(f"Failed to update weather in DB: {e}")
        return 0


# =============================================================
# SECTION 3: STORE WEATHER LOG
# =============================================================

def log_weather_to_db(weather: dict):
    """
    Logs each weather reading to a simple table for reference.
    Useful for debugging and historical correlation later.
    """
    try:
        with db_conn.cursor() as cur:
            cur.execute("""
                INSERT INTO weather_log
                    (temperature, precipitation, condition,
                     humidity, wind_speed, recorded_at)
                VALUES
                    (%(temperature)s, %(precipitation)s, %(condition)s,
                     %(humidity)s, %(wind_speed)s, %(recorded_at)s)
                ON CONFLICT DO NOTHING
            """, weather)
        db_conn.commit()
    except Exception:
        # weather_log table added in next migration — skip if not exists
        db_conn.rollback()


# =============================================================
# SECTION 4: MAIN POLL JOB
# =============================================================

def poll_weather():
    """
    Main weather polling function — runs every hour.

    Fetches current Toronto weather and updates recent
    transit events with weather conditions.
    """
    log.info("━" * 50)
    log.info("Starting weather poll...")

    weather = fetch_weather()

    if not weather:
        log.warning("Weather fetch failed — skipping update")
        return

    # Update transit events with weather data
    updated = update_events_with_weather(weather)
    log.info(f"Updated {updated} transit events with weather data")

    # Log weather reading
    log_weather_to_db(weather)

    log.info("Weather poll complete")
    log.info("━" * 50)


# =============================================================
# SECTION 5: STARTUP
# =============================================================

if __name__ == "__main__":

    log.info("=" * 50)
    log.info("  TransitIQ — Weather Poller")
    log.info(f"  Poll interval: every {POLL_INTERVAL} seconds")
    log.info(f"  Source: Environment Canada (Toronto)")
    log.info("=" * 50)

    # ── Verify database connection ────────────────────────────
    try:
        with db_conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM transit_events WHERE weather_temp IS NULL")
            count = cur.fetchone()[0]
        log.info(f"Database connection: ✓ OK")
        log.info(f"Events without weather data: {count}")
    except Exception as e:
        log.critical(f"Cannot connect to database: {e}")
        raise SystemExit(1)

    # ── Run once immediately ──────────────────────────────────
    log.info("Running first weather poll now...")
    poll_weather()

    # ── Schedule hourly ──────────────────────────────────────
    scheduler = BlockingScheduler()
    scheduler.add_job(
        poll_weather,
        trigger="interval",
        seconds=POLL_INTERVAL,
        id="weather_poll",
        name="Environment Canada Weather Poller",
        misfire_grace_time=300,
    )

    log.info(f"Scheduler running. Next poll in {POLL_INTERVAL}s.")
    log.info("Press Ctrl+C to stop.")

    try:
        scheduler.start()
    except KeyboardInterrupt:
        log.info("Weather poller stopped.")
