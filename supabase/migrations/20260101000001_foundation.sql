-- =============================================================================
-- VitalTrack: Migration 001 — Foundation
-- Extensions, shared utilities, enum types, users & health profiles
-- HIPAA Notes are marked inline. PHI = Protected Health Information.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy text search (food items, provider names)


-- ---------------------------------------------------------------------------
-- 1. SHARED UTILITY: updated_at auto-trigger function
--    Applied to every table that has an updated_at column.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------------------
-- 2. ENUM TYPES
-- ---------------------------------------------------------------------------

-- Generic active/inactive for preferences and settings
CREATE TYPE public.status_basic AS ENUM ('active', 'inactive');

-- Blood types (PHI — part of health profile)
CREATE TYPE public.blood_type AS ENUM (
  'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'
);

-- Biological sex (used for clinical reference ranges)
CREATE TYPE public.biological_sex AS ENUM ('male', 'female', 'intersex', 'not_specified');

-- Vital sign measurement source
CREATE TYPE public.measurement_source AS ENUM (
  'manual',        -- user-entered
  'device',        -- wearable / medical device
  'import',        -- third-party data import (Apple Health, Google Fit, etc.)
  'provider'       -- entered by a healthcare provider
);

-- Workout / activity types
CREATE TYPE public.activity_type AS ENUM (
  'walk', 'run', 'cycle', 'swim', 'strength_training', 'yoga',
  'hiit', 'pilates', 'rowing', 'elliptical', 'hiking', 'dance',
  'martial_arts', 'sports', 'stretching', 'other'
);

-- Sleep stage labels
CREATE TYPE public.sleep_stage AS ENUM ('awake', 'light', 'deep', 'rem');

-- Medication frequency
CREATE TYPE public.medication_frequency AS ENUM (
  'once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily',
  'every_other_day', 'weekly', 'as_needed', 'custom'
);

-- Medication adherence outcome
CREATE TYPE public.adherence_status AS ENUM ('taken', 'missed', 'skipped', 'late');

-- Appointment status
CREATE TYPE public.appointment_status AS ENUM (
  'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled'
);

-- Appointment type
CREATE TYPE public.appointment_type AS ENUM (
  'in_person', 'telehealth', 'phone', 'home_visit'
);

-- Goal status
CREATE TYPE public.goal_status AS ENUM (
  'active', 'completed', 'abandoned', 'paused'
);

-- Goal category — mirrors the domain list
CREATE TYPE public.goal_category AS ENUM (
  'vitals', 'activity', 'nutrition', 'sleep', 'medication', 'weight', 'custom'
);

-- Notification channel
CREATE TYPE public.notification_channel AS ENUM (
  'push', 'email', 'sms', 'in_app'
);

-- Report format
CREATE TYPE public.report_format AS ENUM ('pdf', 'csv', 'json', 'html');

-- Report status
CREATE TYPE public.report_status AS ENUM ('pending', 'generating', 'ready', 'failed', 'expired');

-- Shared report permission
CREATE TYPE public.share_permission AS ENUM ('view', 'download');


-- ---------------------------------------------------------------------------
-- 3. USERS (extends auth.users)
-- PHI: display_name, phone, timezone (combined with health data = PHI)
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_profiles (
  id                UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Display / contact  [PHI]
  display_name      TEXT        NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  avatar_url        TEXT,
  phone             TEXT        CHECK (phone ~ '^\+?[0-9\s\-().]{7,20}$'),
  timezone          TEXT        NOT NULL DEFAULT 'UTC'
                                CHECK (char_length(timezone) <= 64),
  locale            TEXT        NOT NULL DEFAULT 'en-US'
                                CHECK (char_length(locale) <= 10),

  -- Preferences
  units_system      TEXT        NOT NULL DEFAULT 'metric'
                                CHECK (units_system IN ('metric', 'imperial')),
  onboarding_done   BOOLEAN     NOT NULL DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted_at TIMESTAMPTZ,

  -- Soft delete
  deleted_at        TIMESTAMPTZ,

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_own" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id AND deleted_at IS NULL);

CREATE POLICY "users_insert_own" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users_update_own" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = id);

-- Soft-delete: never physically delete user_profiles
CREATE POLICY "users_no_hard_delete" ON public.user_profiles
  FOR DELETE USING (FALSE);

-- Trigger
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes
-- Lookup by phone for de-duplication / login flows
CREATE INDEX idx_user_profiles_phone ON public.user_profiles (phone)
  WHERE phone IS NOT NULL AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 4. HEALTH PROFILES
-- PHI: ALL columns — DOB, sex, blood type, conditions, allergies,
--      emergency contact name/phone are clearly PHI under HIPAA.
-- ---------------------------------------------------------------------------
CREATE TABLE public.health_profiles (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL UNIQUE
                                  REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Demographics [PHI]
  date_of_birth       DATE        CHECK (
                                    date_of_birth > '1900-01-01'
                                    AND date_of_birth < CURRENT_DATE
                                  ),
  biological_sex      public.biological_sex NOT NULL DEFAULT 'not_specified',
  blood_type          public.blood_type     NOT NULL DEFAULT 'unknown',
  height_cm           NUMERIC(5,1) CHECK (height_cm BETWEEN 30 AND 300),
  weight_kg           NUMERIC(6,2) CHECK (weight_kg BETWEEN 1 AND 700),

  -- Clinical [PHI]
  -- Stored as text arrays; consider encrypting at rest via pgcrypto if needed
  medical_conditions  TEXT[]      NOT NULL DEFAULT '{}',
  allergies           TEXT[]      NOT NULL DEFAULT '{}',
  current_medications TEXT[]      NOT NULL DEFAULT '{}', -- free-text summary; detail in medications table

  -- Emergency Contact [PHI]
  emergency_contact_name     TEXT CHECK (char_length(emergency_contact_name) <= 120),
  emergency_contact_phone    TEXT CHECK (emergency_contact_phone ~ '^\+?[0-9\s\-().]{7,20}$'),
  emergency_contact_relation TEXT CHECK (char_length(emergency_contact_relation) <= 60),

  -- Insurance (optional, PHI)
  insurance_provider  TEXT        CHECK (char_length(insurance_provider) <= 120),
  insurance_member_id TEXT        CHECK (char_length(insurance_member_id) <= 60),

  -- Soft delete
  deleted_at          TIMESTAMPTZ,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.health_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hp_select_own" ON public.health_profiles
  FOR SELECT USING (
    auth.uid() = user_id AND deleted_at IS NULL
  );

CREATE POLICY "hp_insert_own" ON public.health_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hp_update_own" ON public.health_profiles
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hp_no_hard_delete" ON public.health_profiles
  FOR DELETE USING (FALSE);

-- Trigger
CREATE TRIGGER trg_health_profiles_updated_at
  BEFORE UPDATE ON public.health_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index: user_id is UNIQUE so the constraint already creates one;
-- no additional index needed for the PK lookup.


-- ---------------------------------------------------------------------------
-- 5. AUDIT LOG (HIPAA §164.312(b) — audit controls)
--    Immutable append-only log for all PHI table mutations.
--    Use a Postgres publication + external SIEM for long-term retention.
-- ---------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
  id            BIGSERIAL   PRIMARY KEY,
  user_id       UUID        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  actor_id      UUID,       -- could differ from user_id if admin/provider acts
  table_name    TEXT        NOT NULL,
  record_id     UUID,
  action        TEXT        NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE','SELECT')),
  old_data      JSONB,
  new_data      JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No UPDATE/DELETE allowed on audit_logs (immutable)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins / service role only — regular users cannot read audit logs
CREATE POLICY "audit_no_user_access" ON public.audit_logs
  FOR ALL USING (FALSE);

-- Performance: look up by user + time range for compliance reports
CREATE INDEX idx_audit_logs_user_time ON public.audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);
