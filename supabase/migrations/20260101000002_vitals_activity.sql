-- =============================================================================
-- VitalTrack: Migration 002 — Vitals & Activity
-- PHI: All vital sign measurements are PHI under HIPAA.
--      Activity data linked to a user is also considered PHI.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. VITALS
-- One row per measurement event. A single event can carry multiple readings
-- (e.g., blood pressure has both systolic and diastolic).
-- All nullable — record only the fields captured by the device/user.
-- ---------------------------------------------------------------------------
CREATE TABLE public.vitals (
  id                        UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                   UUID            NOT NULL
                                            REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Timestamp of measurement (not insertion time — device may sync later)
  measured_at               TIMESTAMPTZ     NOT NULL,
  source                    public.measurement_source NOT NULL DEFAULT 'manual',
  device_identifier         TEXT,           -- e.g., "Omron HEM-7150T" serial / model

  -- Cardiovascular [PHI]
  heart_rate                SMALLINT        CHECK (heart_rate BETWEEN 20 AND 300),       -- bpm
  blood_pressure_systolic   SMALLINT        CHECK (blood_pressure_systolic BETWEEN 50 AND 300),  -- mmHg
  blood_pressure_diastolic  SMALLINT        CHECK (blood_pressure_diastolic BETWEEN 30 AND 200), -- mmHg
  -- Pulse pressure validity: systolic must exceed diastolic
  CONSTRAINT chk_bp_systolic_gt_diastolic
    CHECK (
      blood_pressure_systolic IS NULL
      OR blood_pressure_diastolic IS NULL
      OR blood_pressure_systolic > blood_pressure_diastolic
    ),

  -- Blood oxygen [PHI]
  spo2                      NUMERIC(5,2)    CHECK (spo2 BETWEEN 50 AND 100),             -- %

  -- Metabolic [PHI]
  glucose                   NUMERIC(6,2)    CHECK (glucose BETWEEN 10 AND 1500),          -- mg/dL
  -- Flag whether reading was fasting
  glucose_fasting           BOOLEAN,

  -- Anthropometric [PHI]
  weight_kg                 NUMERIC(6,2)    CHECK (weight_kg BETWEEN 1 AND 700),
  height_cm                 NUMERIC(5,1)    CHECK (height_cm BETWEEN 30 AND 300),
  -- Computed BMI stored for reporting efficiency (recomputed on update)
  bmi                       NUMERIC(5,2)
                              GENERATED ALWAYS AS (
                                CASE
                                  WHEN weight_kg IS NOT NULL AND height_cm IS NOT NULL AND height_cm > 0
                                  THEN ROUND((weight_kg / POWER(height_cm / 100.0, 2))::NUMERIC, 2)
                                  ELSE NULL
                                END
                              ) STORED,

  -- Respiratory [PHI]
  respiratory_rate          SMALLINT        CHECK (respiratory_rate BETWEEN 4 AND 80),   -- breaths/min
  temperature_celsius       NUMERIC(4,1)    CHECK (temperature_celsius BETWEEN 25 AND 45), -- °C

  -- Notes (PHI — free text from user/provider)
  notes                     TEXT            CHECK (char_length(notes) <= 1000),

  -- Soft delete
  deleted_at                TIMESTAMPTZ,

  -- Audit
  created_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vitals_select_own" ON public.vitals
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "vitals_insert_own" ON public.vitals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vitals_update_own" ON public.vitals
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vitals_delete_own" ON public.vitals
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger
CREATE TRIGGER trg_vitals_updated_at
  BEFORE UPDATE ON public.vitals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. Time-series queries: "show me the last 30 days of heart rate"
CREATE INDEX idx_vitals_user_measured ON public.vitals (user_id, measured_at DESC)
  WHERE deleted_at IS NULL;

-- 2. Partial indexes per vital type — used by charting queries that filter
--    on a single metric (optimizer can skip rows with NULL for that column)
CREATE INDEX idx_vitals_heart_rate ON public.vitals (user_id, measured_at DESC)
  WHERE heart_rate IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_vitals_blood_pressure ON public.vitals (user_id, measured_at DESC)
  WHERE blood_pressure_systolic IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_vitals_glucose ON public.vitals (user_id, measured_at DESC)
  WHERE glucose IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_vitals_weight ON public.vitals (user_id, measured_at DESC)
  WHERE weight_kg IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_vitals_spo2 ON public.vitals (user_id, measured_at DESC)
  WHERE spo2 IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX idx_vitals_temperature ON public.vitals (user_id, measured_at DESC)
  WHERE temperature_celsius IS NOT NULL AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 2. ACTIVITY — DAILY SUMMARIES
-- Aggregated daily step / calorie counters, typically synced from wearables.
-- One row per user per calendar day (enforced by unique constraint).
-- ---------------------------------------------------------------------------
CREATE TABLE public.daily_activity (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  activity_date   DATE        NOT NULL,

  -- Counters [PHI]
  steps           INTEGER     CHECK (steps BETWEEN 0 AND 200000),
  distance_meters NUMERIC(9,2) CHECK (distance_meters BETWEEN 0 AND 200000), -- max ~marathon×5
  calories_burned NUMERIC(8,2) CHECK (calories_burned BETWEEN 0 AND 50000),   -- kcal
  active_minutes  SMALLINT    CHECK (active_minutes BETWEEN 0 AND 1440),

  -- Source of data
  source          public.measurement_source NOT NULL DEFAULT 'manual',

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One summary row per user per day
  CONSTRAINT uq_daily_activity_user_date UNIQUE (user_id, activity_date)
);

-- RLS
ALTER TABLE public.daily_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_activity_select_own" ON public.daily_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "daily_activity_insert_own" ON public.daily_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_activity_update_own" ON public.daily_activity
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_activity_delete_own" ON public.daily_activity
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_daily_activity_updated_at
  BEFORE UPDATE ON public.daily_activity
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index: date-range queries ("steps this week")
CREATE INDEX idx_daily_activity_user_date ON public.daily_activity (user_id, activity_date DESC);


-- ---------------------------------------------------------------------------
-- 3. WORKOUT SESSIONS
-- Discrete workout events with duration, type, and effort metrics.
-- ---------------------------------------------------------------------------
CREATE TABLE public.workout_sessions (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL
                               REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  daily_activity_id UUID       REFERENCES public.daily_activity(id) ON DELETE SET NULL,

  activity_type    public.activity_type NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ,
  CONSTRAINT chk_workout_end_after_start
    CHECK (ended_at IS NULL OR ended_at > started_at),

  -- Duration stored explicitly for fast aggregation even if ended_at is null
  duration_seconds INTEGER     CHECK (duration_seconds BETWEEN 0 AND 86400),
  distance_meters  NUMERIC(9,2) CHECK (distance_meters >= 0),
  calories_burned  NUMERIC(8,2) CHECK (calories_burned >= 0),
  avg_heart_rate   SMALLINT    CHECK (avg_heart_rate BETWEEN 20 AND 300),
  max_heart_rate   SMALLINT    CHECK (max_heart_rate BETWEEN 20 AND 300),
  CONSTRAINT chk_workout_hr_max_gte_avg
    CHECK (max_heart_rate IS NULL OR avg_heart_rate IS NULL OR max_heart_rate >= avg_heart_rate),

  -- Perceived exertion 1–10 (Borg-inspired)
  perceived_exertion SMALLINT  CHECK (perceived_exertion BETWEEN 1 AND 10),

  -- Optional route / GPS polyline (encoded as string to avoid PostGIS dependency)
  route_polyline   TEXT,

  source           public.measurement_source NOT NULL DEFAULT 'manual',
  notes            TEXT        CHECK (char_length(notes) <= 2000),

  -- Soft delete
  deleted_at       TIMESTAMPTZ,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workout_select_own" ON public.workout_sessions
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "workout_insert_own" ON public.workout_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_update_own" ON public.workout_sessions
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "workout_delete_own" ON public.workout_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_workout_sessions_updated_at
  BEFORE UPDATE ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. Time-series and type-filter queries
CREATE INDEX idx_workout_user_started ON public.workout_sessions (user_id, started_at DESC)
  WHERE deleted_at IS NULL;

-- 2. Filter by activity type (e.g., "show all my runs")
CREATE INDEX idx_workout_user_type ON public.workout_sessions (user_id, activity_type)
  WHERE deleted_at IS NULL;
