-- ============================================================
-- TransitIQ — Migration 002: Weather Log Table
-- ------------------------------------------------------------
-- Run with:
--   docker exec -i transitiq_db psql -U transitiq -d transitiq < db/migrations/002_weather_log.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS weather_log (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    temperature     REAL,                        -- degrees Celsius
    precipitation   REAL,                        -- mm/hr estimate
    condition       VARCHAR(100),                -- e.g. "Light Snow"
    humidity        REAL,                        -- percentage
    wind_speed      REAL,                        -- km/h
    recorded_at     TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (recorded_at)
);

-- Index for time-based lookups
CREATE INDEX IF NOT EXISTS idx_weather_log_time
    ON weather_log (recorded_at DESC);

SELECT 'Weather log table created successfully!' AS status;
