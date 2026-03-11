"""
TransitIQ — Feature Engineering Pipeline
==========================================
Phase 5 | File 2 of 4

What this file does:
    1. Pulls raw transit events from TimescaleDB
    2. Cleans and filters the data
    3. Engineers meaningful ML features from raw data
    4. Returns a clean DataFrame ready for model training

Features we engineer:
    Time features:
        - hour of day (rush hour vs off-peak)
        - day of week (weekday vs weekend)
        - month (winter vs summer)
        - is_rush_hour flag
        - is_weekend flag

    Weather features:
        - temperature (celsius)
        - precipitation (mm/hr)
        - is_raining flag
        - is_snowing flag
        - is_freezing flag

    Route features:
        - route_id encoded
        - direction
        - agency encoded

    Target variable:
        - delay_seconds (what we want to predict)
        - is_delayed (binary: delayed > 60 seconds)
"""

import os
import logging
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# ── Load .env ─────────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("feature_engineering")

# ── Database ──────────────────────────────────────────────────
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://transitiq:localdev123@localhost:5432/transitiq"
)
engine = create_engine(DATABASE_URL)

# ── Constants ─────────────────────────────────────────────────
# A delay of more than 60 seconds = "delayed"
DELAY_THRESHOLD_SECONDS = 60

# Rush hour windows (Toronto TTC peak hours)
MORNING_RUSH_START = 7
MORNING_RUSH_END   = 9
EVENING_RUSH_START = 16
EVENING_RUSH_END   = 19


# =============================================================
# SECTION 1: LOAD DATA FROM DATABASE
# =============================================================

QUERY = """
    SELECT
        event_id,
        agency,
        route_id,
        direction,
        scheduled_time,
        delay_seconds,
        weather_temp,
        weather_precip
    FROM transit_events
    WHERE
        scheduled_time IS NOT NULL
        AND delay_seconds IS NOT NULL
        AND delay_seconds BETWEEN -600 AND 3600
    ORDER BY scheduled_time DESC
    LIMIT 100000
"""


def load_raw_data() -> pd.DataFrame:
    """
    Loads raw transit events from TimescaleDB.

    We cap at 100,000 rows for training efficiency.
    Filter out extreme outliers (delays > 1hr or < -10min)
    as these are almost always data errors.

    Returns a raw DataFrame.
    """
    log.info("Loading raw data from TimescaleDB...")

    try:
        with engine.connect() as conn:
            df = pd.read_sql(text(QUERY), conn)

        log.info(f"Loaded {len(df):,} raw events from database")
        return df

    except Exception as e:
        log.error(f"Failed to load data: {e}")
        raise


# =============================================================
# SECTION 2: CLEAN DATA
# =============================================================

def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans raw data:
        - Drops rows with missing critical fields
        - Converts types
        - Removes duplicate events
        - Handles missing weather data
    """
    log.info("Cleaning data...")
    original_count = len(df)

    # ── Convert scheduled_time to datetime ───────────────────
    df["scheduled_time"] = pd.to_datetime(df["scheduled_time"], utc=True)

    # ── Drop rows missing critical fields ────────────────────
    df = df.dropna(subset=["scheduled_time", "delay_seconds", "route_id"])

    # ── Fill missing weather data with Toronto averages ──────
    # If weather wasn't recorded, use sensible defaults
    # Toronto annual average: 8.8°C, 0.0mm precip
    df["weather_temp"]   = df["weather_temp"].fillna(8.8)
    df["weather_precip"] = df["weather_precip"].fillna(0.0)

    # ── Remove duplicates ────────────────────────────────────
    df = df.drop_duplicates(subset=["event_id"])

    # ── Ensure numeric types ─────────────────────────────────
    df["delay_seconds"]  = pd.to_numeric(df["delay_seconds"],  errors="coerce")
    df["weather_temp"]   = pd.to_numeric(df["weather_temp"],   errors="coerce")
    df["weather_precip"] = pd.to_numeric(df["weather_precip"], errors="coerce")
    df["direction"]      = pd.to_numeric(df["direction"],      errors="coerce").fillna(0)

    # ── Drop any remaining NaN rows ──────────────────────────
    df = df.dropna()

    cleaned_count = len(df)
    dropped       = original_count - cleaned_count
    log.info(f"Cleaned data: {cleaned_count:,} rows kept, {dropped:,} dropped")

    return df


# =============================================================
# SECTION 3: ENGINEER FEATURES
# =============================================================

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Transforms raw cleaned data into ML-ready features.

    This is the core of our prediction system — we extract
    meaningful signals from raw timestamps and weather data
    that the LightGBM model can learn from.
    """
    log.info("Engineering features...")

    # ── TIME FEATURES ─────────────────────────────────────────

    # Extract time components from scheduled_time
    df["hour"]        = df["scheduled_time"].dt.hour
    df["day_of_week"] = df["scheduled_time"].dt.dayofweek   # 0=Mon, 6=Sun
    df["month"]       = df["scheduled_time"].dt.month
    df["day_of_year"] = df["scheduled_time"].dt.dayofyear

    # Is it rush hour? (most important delay predictor)
    df["is_morning_rush"] = (
        (df["hour"] >= MORNING_RUSH_START) &
        (df["hour"] <= MORNING_RUSH_END)
    ).astype(int)

    df["is_evening_rush"] = (
        (df["hour"] >= EVENING_RUSH_START) &
        (df["hour"] <= EVENING_RUSH_END)
    ).astype(int)

    df["is_rush_hour"] = (
        (df["is_morning_rush"] == 1) |
        (df["is_evening_rush"] == 1)
    ).astype(int)

    # Is it a weekend? (less crowded, fewer delays)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)

    # Is it winter? (Nov-Mar = higher delay risk)
    df["is_winter"] = df["month"].isin([11, 12, 1, 2, 3]).astype(int)

    # Time as cyclical features (captures 23:59 → 00:00 relationship)
    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)
    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)
    df["dow_sin"]  = np.sin(2 * np.pi * df["day_of_week"] / 7)
    df["dow_cos"]  = np.cos(2 * np.pi * df["day_of_week"] / 7)

    # ── WEATHER FEATURES ──────────────────────────────────────

    # Is it raining or snowing?
    df["is_raining"] = (df["weather_precip"] > 0.5).astype(int)
    df["is_snowing"]  = (
        (df["weather_precip"] > 0.5) &
        (df["weather_temp"] <= 2.0)
    ).astype(int)

    # Is it freezing? (affects streetcar wires and road grip)
    df["is_freezing"] = (df["weather_temp"] <= 0).astype(int)

    # Severe weather flag (heavy rain or snow)
    df["is_severe_weather"] = (df["weather_precip"] > 3.0).astype(int)

    # ── ROUTE FEATURES ────────────────────────────────────────

    # Encode agency as integer (TTC=0, GO=1, MIWAY=2, YRT=3)
    agency_map = {"TTC": 0, "GO": 1, "MIWAY": 2, "YRT": 3}
    df["agency_encoded"] = df["agency"].map(agency_map).fillna(0).astype(int)

    # Encode route_id as category code
    # LightGBM handles high-cardinality categoricals well
    df["route_encoded"] = df["route_id"].astype("category").cat.codes

    # ── TARGET VARIABLES ──────────────────────────────────────

    # Binary target: is this trip delayed by more than 60 seconds?
    df["is_delayed"] = (df["delay_seconds"] > DELAY_THRESHOLD_SECONDS).astype(int)

    delay_rate = df["is_delayed"].mean() * 100
    avg_delay  = df["delay_seconds"].mean()
    log.info(f"Delay rate in dataset: {delay_rate:.1f}%")
    log.info(f"Average delay: {avg_delay:.1f} seconds")

    return df


# =============================================================
# SECTION 4: SELECT FINAL FEATURES
# =============================================================

# These are the exact features our model will train on
FEATURE_COLUMNS = [
    # Time features
    "hour",
    "day_of_week",
    "month",
    "is_rush_hour",
    "is_morning_rush",
    "is_evening_rush",
    "is_weekend",
    "is_winter",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    # Weather features
    "weather_temp",
    "weather_precip",
    "is_raining",
    "is_snowing",
    "is_freezing",
    "is_severe_weather",
    # Route features
    "agency_encoded",
    "route_encoded",
    "direction",
]

TARGET_COLUMN = "is_delayed"


def get_feature_matrix(df: pd.DataFrame):
    """
    Returns X (features) and y (target) ready for model training.
    Also returns the route encoding map for use during prediction.
    """
    # Build route encoding map (route_id → encoded int)
    route_map = dict(zip(
        df["route_id"].astype("category").cat.categories,
        range(len(df["route_id"].astype("category").cat.categories))
    ))

    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMN].copy()

    log.info(f"Feature matrix: {X.shape[0]:,} rows × {X.shape[1]} features")
    log.info(f"Target distribution: {y.sum():,} delayed / {(~y.astype(bool)).sum():,} on-time")

    return X, y, route_map


# =============================================================
# SECTION 5: MAIN PIPELINE
# =============================================================

def run_pipeline():
    """
    Runs the full feature engineering pipeline.
    Returns X, y, route_map ready for model training.
    """
    log.info("=" * 50)
    log.info("  TransitIQ — Feature Engineering Pipeline")
    log.info("=" * 50)

    df = load_raw_data()
    df = clean_data(df)
    df = engineer_features(df)
    X, y, route_map = get_feature_matrix(df)

    log.info("Feature engineering complete!")
    log.info(f"Ready to train on {X.shape[0]:,} samples")

    return X, y, route_map


if __name__ == "__main__":
    # Run standalone to verify pipeline works
    X, y, route_map = run_pipeline()

    print("\n── Feature Sample ──────────────────────────")
    print(X.head())
    print("\n── Target Distribution ─────────────────────")
    print(y.value_counts())
    print("\n── Feature Columns ─────────────────────────")
    for col in X.columns:
        print(f"  {col}")
