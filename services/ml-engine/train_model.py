"""
TransitIQ — LightGBM Model Trainer
=====================================
Phase 5 | File 3 of 4

What this file does:
    1. Loads engineered features from feature_engineering.py
    2. Splits data into train/validation/test sets
    3. Trains a LightGBM classifier to predict delay probability
    4. Evaluates model performance
    5. Saves trained model + metadata to disk

Why LightGBM?
    - Extremely fast training on tabular data
    - Handles mixed feature types natively
    - Industry standard for transit/mobility ML
    - Used by Uber, Lyft, Transit App for similar problems
    - Better than neural nets for structured tabular data

Output files:
    models/delay_classifier.pkl   ← trained model
    models/model_metadata.json    ← feature list, metrics, version
    models/route_map.pkl          ← route encoding map

How to run:
    cd services/ml-engine
    python train_model.py
"""

import os
import json
import logging
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path

import lightgbm as lgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    classification_report,
)
from dotenv import load_dotenv

from feature_engineering import run_pipeline, FEATURE_COLUMNS

# ── Load .env ─────────────────────────────────────────────────
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../../.env"))

# ── Logging ───────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("train_model")

# ── Output directory ──────────────────────────────────────────
MODELS_DIR = Path(__file__).parent / "models"
MODELS_DIR.mkdir(exist_ok=True)

MODEL_PATH    = MODELS_DIR / "delay_classifier.pkl"
METADATA_PATH = MODELS_DIR / "model_metadata.json"
ROUTE_MAP_PATH = MODELS_DIR / "route_map.pkl"


# =============================================================
# SECTION 1: SPLIT DATA
# =============================================================

def split_data(X, y):
    """
    Splits data into train, validation, and test sets.

    70% train   — model learns from this
    15% val     — used during training to prevent overfitting
    15% test    — final evaluation (model never sees this)

    Stratified split ensures both sets have same delay rate.
    """
    # First split: 85% train+val, 15% test
    X_trainval, X_test, y_trainval, y_test = train_test_split(
        X, y,
        test_size=0.15,
        random_state=42,
        stratify=y,
    )

    # Second split: 70% train, 15% val
    X_train, X_val, y_train, y_val = train_test_split(
        X_trainval, y_trainval,
        test_size=0.176,   # 0.176 of 0.85 ≈ 0.15 of total
        random_state=42,
        stratify=y_trainval,
    )

    log.info(f"Train set:      {len(X_train):,} samples")
    log.info(f"Validation set: {len(X_val):,} samples")
    log.info(f"Test set:       {len(X_test):,} samples")

    return X_train, X_val, X_test, y_train, y_val, y_test




# =============================================================
# SECTION 2: TRAIN MODEL
# =============================================================

def train_model(X_train, X_val, y_train, y_val):
    """
    Trains a LightGBM binary classifier.

    Key hyperparameters explained:
        n_estimators    — number of trees (more = better but slower)
        learning_rate   — how fast model learns (lower = more careful)
        max_depth       — tree depth (prevents overfitting)
        num_leaves      — complexity of each tree
        class_weight    — handles imbalanced data (more delayed = rarer)
        early_stopping  — stops if val score doesn't improve

    Returns trained model.
    """
    log.info("Training LightGBM model...")
    log.info("This may take 1-2 minutes...")

    model = lgb.LGBMClassifier(
        n_estimators=500,
        learning_rate=0.05,
        max_depth=6,
        num_leaves=63,
        min_child_samples=20,
        subsample=0.8,
        colsample_bytree=0.8,
        reg_alpha=0.1,
        reg_lambda=0.1,
        is_unbalance=True,   # ← replaces scale_pos_weight + class_weight
        n_jobs=-1,
        random_state=42,
        verbose=-1,
    )

    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[
            lgb.early_stopping(stopping_rounds=50, verbose=False),
            lgb.log_evaluation(period=50),
        ],
    )

    log.info(f"Training complete! Best iteration: {model.best_iteration_}")
    return model


# =============================================================
# SECTION 3: EVALUATE MODEL
# =============================================================

def evaluate_model(model, X_test, y_test) -> dict:
    """
    Evaluates model on held-out test set.

    Metrics explained:
        Accuracy   — % of predictions correct overall
        Precision  — when we say "delayed", how often right?
        Recall     — of all delayed trips, how many did we catch?
        F1         — balance between precision and recall
        ROC-AUC    — overall discrimination ability (0.5=random, 1.0=perfect)

    For transit delays, Recall is most important —
    we'd rather warn users about a delay that doesn't happen
    than miss a real delay entirely.
    """
    log.info("Evaluating model on test set...")

    y_pred      = model.predict(X_test)
    y_pred_prob = model.predict_proba(X_test)[:, 1]

    metrics = {
        "accuracy":  round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall":    round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "f1":        round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "roc_auc":   round(float(roc_auc_score(y_test, y_pred_prob)), 4),
    }

    log.info("=" * 50)
    log.info("  Model Performance on Test Set")
    log.info("=" * 50)
    log.info(f"  Accuracy:   {metrics['accuracy']*100:.1f}%")
    log.info(f"  Precision:  {metrics['precision']*100:.1f}%")
    log.info(f"  Recall:     {metrics['recall']*100:.1f}%")
    log.info(f"  F1 Score:   {metrics['f1']*100:.1f}%")
    log.info(f"  ROC-AUC:    {metrics['roc_auc']:.4f}")
    log.info("=" * 50)

    # Full classification report
    print("\n── Detailed Classification Report ──────────────")
    print(classification_report(
        y_test, y_pred,
        target_names=["On Time", "Delayed"]
    ))

    return metrics


# =============================================================
# SECTION 4: FEATURE IMPORTANCE
# =============================================================

def log_feature_importance(model):
    """Logs the top features so we understand what drives delays."""
    importance = pd.DataFrame({
        "feature":    FEATURE_COLUMNS,
        "importance": model.feature_importances_,
    }).sort_values("importance", ascending=False)

    log.info("\n── Top 10 Most Important Features ─────────────")
    for _, row in importance.head(10).iterrows():
        bar = "█" * int(row["importance"] / importance["importance"].max() * 20)
        log.info(f"  {row['feature']:<20} {bar} {row['importance']:.0f}")


# =============================================================
# SECTION 5: SAVE MODEL
# =============================================================

def save_model(model, metrics: dict, route_map: dict):
    """
    Saves trained model and metadata to disk.

    Files saved:
        models/delay_classifier.pkl  — the trained model
        models/model_metadata.json   — metrics + feature list
        models/route_map.pkl         — route encoding map
    """
    # Save model
    joblib.dump(model, MODEL_PATH)
    log.info(f"Model saved → {MODEL_PATH}")

    # Save route map
    joblib.dump(route_map, ROUTE_MAP_PATH)
    log.info(f"Route map saved → {ROUTE_MAP_PATH}")

    # Save metadata
    metadata = {
        "version":         "1.0.0",
        "trained_at":      datetime.now(timezone.utc).isoformat(),
        "model_type":      "LightGBMClassifier",
        "feature_columns": FEATURE_COLUMNS,
        "metrics":         metrics,
        "description":     "TTC delay probability classifier",
        "delay_threshold": 60,
    }

    with open(METADATA_PATH, "w") as f:
        json.dump(metadata, f, indent=2)

    log.info(f"Metadata saved → {METADATA_PATH}")


# =============================================================
# SECTION 6: MAIN
# =============================================================

if __name__ == "__main__":

    log.info("=" * 50)
    log.info("  TransitIQ — Model Training")
    log.info("=" * 50)

    # ── Step 1: Load features ─────────────────────────────────
    log.info("Step 1/4 — Loading and engineering features...")
    X, y, route_map = run_pipeline()

    # ── Step 2: Split data ────────────────────────────────────
    log.info("Step 2/4 — Splitting data...")
    X_train, X_val, X_test, y_train, y_val, y_test = split_data(X, y)

    # ── Oversample delayed class in training data ─────────────
    from sklearn.utils import resample

    X_train_df = X_train.copy()
    X_train_df["target"] = y_train.values

    majority = X_train_df[X_train_df["target"] == 0]
    minority = X_train_df[X_train_df["target"] == 1]

    minority_upsampled = resample(
        minority,
        replace=True,
        n_samples=int(len(majority) * 0.4),
        random_state=42
    )

    balanced = pd.concat([majority, minority_upsampled])
    X_train  = balanced.drop("target", axis=1)
    y_train  = balanced["target"]

    log.info(f"After balancing — Train set: {len(X_train):,} samples")
    log.info(f"Delay rate in training: {y_train.mean()*100:.1f}%")

    # ── Step 3: Train model ───────────────────────────────────
    log.info("Step 3/4 — Training LightGBM model...")
    model = train_model(X_train, X_val, y_train, y_val)

    # ── Step 4: Evaluate ──────────────────────────────────────
    log.info("Step 4/4 — Evaluating model...")
    metrics = evaluate_model(model, X_test, y_test)
    log_feature_importance(model)

    # ── Save everything ───────────────────────────────────────
    save_model(model, metrics, route_map)

    log.info("=" * 50)
    log.info("  Training Complete!")
    log.info(f"  ROC-AUC: {metrics['roc_auc']:.4f}")
    log.info(f"  Model saved to: {MODEL_PATH}")
    log.info("  Next step: run predictor.py")
    log.info("=" * 50)
