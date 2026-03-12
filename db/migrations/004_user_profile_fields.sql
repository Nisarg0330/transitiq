-- Migration 004 — Add user profile fields for Clerk webhook sync
-- Run this in Adminer: http://localhost:8080

ALTER TABLE users ADD COLUMN IF NOT EXISTS email      VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name  VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
