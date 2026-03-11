-- ============================================================
-- TransitIQ — Migration 001: Initial Schema
-- ------------------------------------------------------------
-- This file runs automatically when TimescaleDB container
-- starts for the first time (via docker-entrypoint-initdb.d)
--
-- Tables created:
--   1. agencies           — transit agency reference data
--   2. transit_events     — every delay event we ingest
--   3. route_delay_stats  — pre-aggregated hourly stats
--   4. users              — app user accounts
--   5. user_routes        — saved commute routes per user
--   6. predictions_cache  — ML model output cache
-- ============================================================


-- ── Step 1: Enable TimescaleDB extension ─────────────────────
-- This unlocks time-series superpowers on PostgreSQL
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;


-- ── Table 1: Agencies ────────────────────────────────────────
-- Reference table for all supported transit agencies
CREATE TABLE IF NOT EXISTS agencies (
    code            VARCHAR(20)     PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL,
    gtfs_rt_url     VARCHAR(300),
    timezone        VARCHAR(50)     DEFAULT 'America/Toronto',
    is_active       BOOLEAN         DEFAULT TRUE,
    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

-- Seed with GTA transit agencies
INSERT INTO agencies (code, name, gtfs_rt_url) VALUES
    ('TTC',   'Toronto Transit Commission',
     'https://gtfs.toronto.ca/realtime/'),
    ('GO',    'GO Transit',
     'https://api.openmetrolinx.com/OpenDataAPI/'),
    ('MIWAY', 'MiWay (Mississauga Transit)',
     'https://www.miapp.ca/GTFS_RT/'),
    ('YRT',   'York Region Transit',
     'https://www.yrt.ca/en/about-us/open-data.aspx')
ON CONFLICT DO NOTHING;


-- ── Table 2: Transit Events ───────────────────────────────────
-- Core table — stores every single transit delay event we ingest
-- This becomes a TimescaleDB hypertable (auto-partitioned by time)
CREATE TABLE IF NOT EXISTS transit_events (
    event_id        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    agency          VARCHAR(20)     NOT NULL REFERENCES agencies(code),
    route_id        VARCHAR(50)     NOT NULL,
    vehicle_id      VARCHAR(50),
    stop_id         VARCHAR(50),
    trip_id         VARCHAR(100),
    direction       SMALLINT        DEFAULT 0,

    -- Time data (the most important columns)
    scheduled_time  TIMESTAMPTZ     NOT NULL,
    actual_time     TIMESTAMPTZ,
    delay_seconds   INTEGER         DEFAULT 0,

    -- GPS location
    lat             DOUBLE PRECISION,
    lon             DOUBLE PRECISION,

    -- External enrichment (added in Sprint 2)
    weather_temp    REAL,
    weather_precip  REAL,
    is_event_day    BOOLEAN         DEFAULT FALSE,

    -- Raw data for debugging
    raw_payload     JSONB,

    created_at      TIMESTAMPTZ     DEFAULT NOW()
);

-- Convert to TimescaleDB hypertable
-- This partitions data by week automatically
-- Makes time-range queries 10-100x faster
SELECT create_hypertable(
    'transit_events',
    'scheduled_time',
    chunk_time_interval => INTERVAL '1 week',
    if_not_exists => TRUE
);


-- ── Table 3: Route Delay Stats ────────────────────────────────
-- Pre-aggregated hourly delay statistics per route
-- Used by the ML model for training and the dashboard for charts
CREATE TABLE IF NOT EXISTS route_delay_stats (
    agency              VARCHAR(20)     NOT NULL,
    route_id            VARCHAR(50)     NOT NULL,
    hour_bucket         TIMESTAMPTZ     NOT NULL,
    avg_delay_sec       REAL,
    median_delay_sec    REAL,
    delay_pct           REAL,
    sample_count        INTEGER         DEFAULT 0,
    PRIMARY KEY (agency, route_id, hour_bucket)
);

SELECT create_hypertable(
    'route_delay_stats',
    'hour_bucket',
    chunk_time_interval => INTERVAL '1 month',
    if_not_exists => TRUE
);


-- ── Table 4: Users ────────────────────────────────────────────
-- App user accounts
-- We store hashed email (not plain text) for privacy
CREATE TABLE IF NOT EXISTS users (
    id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash              VARCHAR(64) UNIQUE NOT NULL,
    push_subscription       JSONB,
    notification_threshold  SMALLINT    DEFAULT 70,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);


-- ── Table 5: User Routes ──────────────────────────────────────
-- Each user can save up to 5 personal commute routes
CREATE TABLE IF NOT EXISTS user_routes (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL REFERENCES users(id)
                                    ON DELETE CASCADE,
    label               VARCHAR(100),
    agency              VARCHAR(20) NOT NULL,
    route_id            VARCHAR(50) NOT NULL,
    origin_stop_id      VARCHAR(50),
    dest_stop_id        VARCHAR(50),
    typical_depart_time TIME,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);


-- ── Table 6: Predictions Cache ────────────────────────────────
-- Stores ML model predictions so we don't re-run the model
-- on every API request (predictions are cached for 6 hours)
CREATE TABLE IF NOT EXISTS predictions_cache (
    id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    agency                  VARCHAR(20)     NOT NULL,
    route_id                VARCHAR(50)     NOT NULL,
    target_date             DATE            NOT NULL,
    hour                    SMALLINT        NOT NULL,
    predicted_delay_prob    REAL            NOT NULL,
    model_version           VARCHAR(50),
    generated_at            TIMESTAMPTZ     DEFAULT NOW(),
    UNIQUE (agency, route_id, target_date, hour)
);


-- ── Indexes ───────────────────────────────────────────────────
-- Speed up the most common query patterns

-- Most common: "get delays for route X in last 30 days"
CREATE INDEX IF NOT EXISTS idx_events_agency_route
    ON transit_events (agency, route_id, scheduled_time DESC);

-- Dashboard query: "show me significant delays only"
CREATE INDEX IF NOT EXISTS idx_events_delay
    ON transit_events (delay_seconds, scheduled_time DESC)
    WHERE delay_seconds > 300;

-- Stats dashboard queries
CREATE INDEX IF NOT EXISTS idx_stats_route
    ON route_delay_stats (agency, route_id, hour_bucket DESC);

-- ML prediction lookup
CREATE INDEX IF NOT EXISTS idx_cache_lookup
    ON predictions_cache (agency, route_id, target_date, hour);

-- User routes lookup
CREATE INDEX IF NOT EXISTS idx_user_routes
    ON user_routes (user_id, agency, route_id);


-- ── Done ─────────────────────────────────────────────────────
SELECT 'TransitIQ database schema initialized successfully!' AS status;
