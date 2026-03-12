"""
TransitIQ — ML Prediction Service
====================================
Phase 5 | File 4 of 4

What this file does:
    Serves delay predictions via a FastAPI REST API.
    The Node.js backend (Phase 6) calls this service
    to get delay probability for any route/time/weather.

Endpoints:
    GET  /health                  — health check
    POST /predict                 — predict delay for one trip
    POST /predict/batch           — predict delays for multiple trips
    GET  /predict/route/{route_id} — forecast for next 12 hours

How to run:
    cd services/ml-engine
    uvicorn predictor:app --host 0.0.0.0 --port 8001 --reload

Then test in browser:
    http://localhost:8001/docs    ← interactive API docs (Swagger UI)
"""

import os
import json
import logging
import joblib
import numpy as np
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# ── Load .env ─────────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("predictor")

# ── Model paths ───────────────────────────────────────────────
MODELS_DIR     = Path(__file__).parent / "models"
MODEL_PATH     = MODELS_DIR / "delay_classifier.pkl"
METADATA_PATH  = MODELS_DIR / "model_metadata.json"
ROUTE_MAP_PATH = MODELS_DIR / "route_map.pkl"


# =============================================================
# SECTION 1: LOAD MODEL AT STARTUP
# =============================================================

def load_model():
    """Loads trained model, metadata and route map from disk."""
    if not MODEL_PATH.exists():
        raise RuntimeError(
            f"Model not found at {MODEL_PATH}. "
            "Run train_model.py first!"
        )

    model     = joblib.load(MODEL_PATH)
    route_map = joblib.load(ROUTE_MAP_PATH)

    with open(METADATA_PATH) as f:
        metadata = json.load(f)

    log.info(f"Model loaded — version {metadata['version']}")
    log.info(f"Trained at: {metadata['trained_at']}")
    log.info(f"ROC-AUC: {metadata['metrics']['roc_auc']}")

    return model, route_map, metadata


# Load model once at startup
try:
    MODEL, ROUTE_MAP, METADATA = load_model()
    log.info("✓ Model ready for predictions")
except Exception as e:
    log.critical(f"Failed to load model: {e}")
    MODEL, ROUTE_MAP, METADATA = None, None, None


# =============================================================
# SECTION 2: FASTAPI APP
# =============================================================

app = FastAPI(
    title="TransitIQ Prediction API",
    description="ML-powered GTA transit delay predictions",
    version="1.0.0",
)

# Allow requests from React frontend and Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================
# SECTION 3: REQUEST / RESPONSE MODELS
# =============================================================

class PredictionRequest(BaseModel):
    """Input for a single delay prediction."""
    route_id:       str   = Field(..., example="504")
    agency:         str   = Field("TTC", example="TTC")
    direction:      int   = Field(0,   example=0)
    scheduled_time: Optional[str] = Field(
        None,
        description="ISO datetime. Defaults to current time.",
        example="2026-03-12T08:30:00Z"
    )
    weather_temp:   float = Field(5.0,  example=5.0)
    weather_precip: float = Field(0.0,  example=2.5)


class PredictionResponse(BaseModel):
    """Output of a single delay prediction."""
    route_id:           str
    agency:             str
    scheduled_time:     str
    delay_probability:  float   # 0.0 to 1.0
    is_delayed:         bool    # True if probability > threshold
    risk_level:         str     # "low", "moderate", "high", "severe"
    estimated_delay_min: float  # estimated delay in minutes
    confidence:         str     # "high", "medium", "low"
    features_used:      dict    # for transparency / debugging


class BatchPredictionRequest(BaseModel):
    """Input for batch predictions."""
    requests: list[PredictionRequest]


# =============================================================
# SECTION 4: FEATURE ENGINEERING (INFERENCE)
# =============================================================

def build_features(req: PredictionRequest) -> dict:
    """
    Builds the feature vector for a prediction request.
    Must match EXACTLY the features used during training.
    """
    # Parse or default scheduled_time
    if req.scheduled_time:
        try:
            dt = datetime.fromisoformat(
                req.scheduled_time.replace("Z", "+00:00")
            )
        except ValueError:
            dt = datetime.now(timezone.utc)
    else:
        dt = datetime.now(timezone.utc)

    hour        = dt.hour
    day_of_week = dt.weekday()
    month       = dt.month

    # Time features
    is_morning_rush = int(7 <= hour <= 9)
    is_evening_rush = int(16 <= hour <= 19)
    is_rush_hour    = int(is_morning_rush or is_evening_rush)
    is_weekend      = int(day_of_week >= 5)
    is_winter       = int(month in [11, 12, 1, 2, 3])

    hour_sin = np.sin(2 * np.pi * hour / 24)
    hour_cos = np.cos(2 * np.pi * hour / 24)
    dow_sin  = np.sin(2 * np.pi * day_of_week / 7)
    dow_cos  = np.cos(2 * np.pi * day_of_week / 7)

    # Weather features
    temp   = req.weather_temp
    precip = req.weather_precip

    is_raining       = int(precip > 0.5 and temp > 2)
    is_snowing       = int(precip > 0.5 and temp <= 2)
    is_freezing      = int(temp <= 0)
    is_severe_weather = int(precip > 3.0)

    # Route features
    agency_map = {"TTC": 0, "GO": 1, "MIWAY": 2, "YRT": 3}
    agency_encoded = agency_map.get(req.agency.upper(), 0)
    route_encoded  = ROUTE_MAP.get(req.route_id, 0)

    return {
        "hour":              hour,
        "day_of_week":       day_of_week,
        "month":             month,
        "is_rush_hour":      is_rush_hour,
        "is_morning_rush":   is_morning_rush,
        "is_evening_rush":   is_evening_rush,
        "is_weekend":        is_weekend,
        "is_winter":         is_winter,
        "hour_sin":          hour_sin,
        "hour_cos":          hour_cos,
        "dow_sin":           dow_sin,
        "dow_cos":           dow_cos,
        "weather_temp":      temp,
        "weather_precip":    precip,
        "is_raining":        is_raining,
        "is_snowing":        is_snowing,
        "is_freezing":       is_freezing,
        "is_severe_weather": is_severe_weather,
        "agency_encoded":    agency_encoded,
        "route_encoded":     route_encoded,
        "direction":         req.direction,
    }


def probability_to_risk(probability: float) -> tuple[str, float]:
    """
    Converts raw delay probability to human-readable risk level
    and estimated delay in minutes.
    """
    if probability < 0.25:
        return "low", 0.5
    elif probability < 0.50:
        return "moderate", 2.5
    elif probability < 0.75:
        return "high", 6.0
    else:
        return "severe", 12.0


def probability_to_confidence(probability: float) -> str:
    """Returns model confidence based on how decisive the prediction is."""
    distance_from_boundary = abs(probability - 0.5)
    if distance_from_boundary > 0.35:
        return "high"
    elif distance_from_boundary > 0.15:
        return "medium"
    else:
        return "low"


# =============================================================
# SECTION 5: PREDICTION LOGIC
# =============================================================

DELAY_THRESHOLD = 0.40   # predict "delayed" if probability > 40%

def make_prediction(req: PredictionRequest) -> PredictionResponse:
    """Core prediction logic for a single request."""
    if MODEL is None:
        raise HTTPException(
            status_code=503,
            detail="Model not loaded. Run train_model.py first."
        )

    # Build feature vector
    features = build_features(req)

    # Convert to numpy array in correct column order
    from feature_engineering import FEATURE_COLUMNS
    feature_vector = np.array([[features[col] for col in FEATURE_COLUMNS]])

    # Get prediction
    probability = float(MODEL.predict_proba(feature_vector)[0][1])
    is_delayed  = probability > DELAY_THRESHOLD

    # Convert to human readable
    risk_level, estimated_delay = probability_to_risk(probability)
    confidence                  = probability_to_confidence(probability)

    # Determine scheduled time string
    scheduled_time = req.scheduled_time or datetime.now(timezone.utc).isoformat()

    return PredictionResponse(
        route_id            = req.route_id,
        agency              = req.agency,
        scheduled_time      = scheduled_time,
        delay_probability   = round(probability, 4),
        is_delayed          = is_delayed,
        risk_level          = risk_level,
        estimated_delay_min = estimated_delay,
        confidence          = confidence,
        features_used       = {
            "hour":         features["hour"],
            "is_rush_hour": bool(features["is_rush_hour"]),
            "is_weekend":   bool(features["is_weekend"]),
            "weather_temp": features["weather_temp"],
            "is_snowing":   bool(features["is_snowing"]),
            "is_raining":   bool(features["is_raining"]),
        }
    )


# =============================================================
# SECTION 6: API ENDPOINTS
# =============================================================

@app.get("/health")
def health_check():
    """Health check endpoint — used by Docker and Railway."""
    if MODEL is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    return {
        "status":       "healthy",
        "model_version": METADATA.get("version", "unknown"),
        "roc_auc":      METADATA.get("metrics", {}).get("roc_auc"),
        "trained_at":   METADATA.get("trained_at"),
    }


@app.post("/predict", response_model=PredictionResponse)
def predict(req: PredictionRequest):
    """
    Predicts delay probability for a single trip.

    Example request body:
    {
        "route_id": "504",
        "agency": "TTC",
        "direction": 0,
        "scheduled_time": "2026-03-12T08:30:00Z",
        "weather_temp": -3.0,
        "weather_precip": 2.5
    }
    """
    log.info(f"Prediction request — Route {req.route_id} @ {req.scheduled_time}")
    return make_prediction(req)


@app.post("/predict/batch")
def predict_batch(batch: BatchPredictionRequest):
    """
    Predicts delay probability for multiple trips at once.
    Used by the frontend to load a full commute forecast.
    """
    if len(batch.requests) > 50:
        raise HTTPException(
            status_code=400,
            detail="Batch size limited to 50 requests"
        )

    results = []
    for req in batch.requests:
        try:
            result = make_prediction(req)
            results.append(result)
        except Exception as e:
            log.error(f"Batch prediction failed for route {req.route_id}: {e}")

    return {"predictions": results, "count": len(results)}


@app.get("/predict/route/{route_id}")
def predict_route_forecast(
    route_id: str,
    agency:         str   = "TTC",
    weather_temp:   float = 5.0,
    weather_precip: float = 0.0,
):
    """
    Returns a 12-hour delay forecast for a specific route.
    Used by the frontend to show a delay chart for the day.

    Example:
        GET /predict/route/504?weather_temp=-3&weather_precip=2.5
    """
    now       = datetime.now(timezone.utc)
    forecasts = []

    for hour_offset in range(12):
        future_time = now + timedelta(hours=hour_offset)
        req = PredictionRequest(
            route_id       = route_id,
            agency         = agency,
            direction      = 0,
            scheduled_time = future_time.isoformat(),
            weather_temp   = weather_temp,
            weather_precip = weather_precip,
        )
        prediction = make_prediction(req)
        forecasts.append({
            "time":              future_time.strftime("%H:%M"),
            "delay_probability": prediction.delay_probability,
            "risk_level":        prediction.risk_level,
            "estimated_delay_min": prediction.estimated_delay_min,
        })

    return {
        "route_id":  route_id,
        "agency":    agency,
        "generated": now.isoformat(),
        "forecast":  forecasts,
    }


# =============================================================
# SECTION 7: STARTUP EVENT
# =============================================================

@app.on_event("startup")
async def startup_event():
    log.info("=" * 50)
    log.info("  TransitIQ — Prediction API")
    log.info("  http://localhost:8001/docs")
    log.info("=" * 50)
    if MODEL:
        log.info("✓ Model loaded and ready")
    else:
        log.warning("✗ Model not loaded — run train_model.py first")
