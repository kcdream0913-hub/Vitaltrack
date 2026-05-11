-- =============================================================================
-- VitalTrack: Migration 003 — Nutrition & Sleep
-- PHI: Nutrition and sleep data linked to an individual is PHI under HIPAA.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. FOOD ITEMS (reference / catalog table)
-- Shared catalog — not user-specific, so no RLS user filter needed.
-- Custom items added by users are flagged with created_by.
-- ---------------------------------------------------------------------------
CREATE TABLE public.food_items (
  id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  name              TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  brand             TEXT        CHECK (char_length(brand) <= 200),
  barcode           TEXT        CHECK (char_length(barcode) <= 50),

  -- Per-100g macros (industry standard normalization)
  calories_per_100g NUMERIC(8,2) NOT NULL CHECK (calories_per_100g >= 0),
  protein_g         NUMERIC(7,3) CHECK (protein_g >= 0),
  carbs_g           NUMERIC(7,3) CHECK (carbs_g >= 0),
  fat_g             NUMERIC(7,3) CHECK (fat_g >= 0),
  fiber_g           NUMERIC(7,3) CHECK (fiber_g >= 0),
  sugar_g           NUMERIC(7,3) CHECK (sugar_g >= 0),
  sodium_mg         NUMERIC(8,2) CHECK (sodium_mg >= 0),
  cholesterol_mg    NUMERIC(8,2) CHECK (cholesterol_mg >= 0),
  saturated_fat_g   NUMERIC(7,3) CHECK (saturated_fat_g >= 0),

  -- Micronutrients (commonly tracked)
  vitamin_c_mg      NUMERIC(8,2) CHECK (vitamin_c_mg >= 0),
  vitamin_d_iu      NUMERIC(8,2) CHECK (vitamin_d_iu >= 0),
  calcium_mg        NUMERIC(8,2) CHECK (calcium_mg >= 0),
  iron_mg           NUMERIC(8,2) CHECK (iron_mg >= 0),
  potassium_mg      NUMERIC(8,2) CHECK (potassium_mg >= 0),

  -- Data provenance
  source            TEXT        DEFAULT 'usda',  -- 'usda', 'openfoodfacts', 'user', 'provider'
  external_id       TEXT,                        -- ID in source system
  created_by        UUID        REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  is_verified       BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Soft delete
  deleted_at        TIMESTAMPTZ,

  -- Audit
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_food_barcode UNIQUE (barcode)
);

-- RLS: everyone can read verified items; only owner can read their own custom items
ALTER TABLE public.food_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_items_select_verified" ON public.food_items
  FOR SELECT USING (
    deleted_at IS NULL
    AND (is_verified = TRUE OR created_by = auth.uid())
  );

CREATE POLICY "food_items_insert_own" ON public.food_items
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "food_items_update_own" ON public.food_items
  FOR UPDATE USING (created_by = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "food_items_delete_own" ON public.food_items
  FOR DELETE USING (created_by = auth.uid());

CREATE TRIGGER trg_food_items_updated_at
  BEFORE UPDATE ON public.food_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. Barcode scan lookup — most frequent path for food logging
CREATE INDEX idx_food_items_barcode ON public.food_items (barcode)
  WHERE barcode IS NOT NULL AND deleted_at IS NULL;

-- 2. Full-text search on name + brand (uses pg_trgm)
CREATE INDEX idx_food_items_name_trgm ON public.food_items
  USING gin (name gin_trgm_ops)
  WHERE deleted_at IS NULL;

-- 3. External ID lookup for sync jobs
CREATE INDEX idx_food_items_external ON public.food_items (source, external_id)
  WHERE external_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 2. FOOD LOGS (user diary)
-- PHI: user's eating pattern + timestamps = PHI
-- ---------------------------------------------------------------------------
CREATE TABLE public.food_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID        NOT NULL
                            REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  food_item_id  UUID        REFERENCES public.food_items(id) ON DELETE RESTRICT,

  -- When eaten
  logged_at     TIMESTAMPTZ NOT NULL,
  meal_label    TEXT        CHECK (meal_label IN ('breakfast','lunch','dinner','snack','other')),

  -- Quantity
  quantity_g    NUMERIC(8,2) NOT NULL CHECK (quantity_g > 0),

  -- Computed macros stored for fast aggregation (avoid re-joining food_items constantly)
  calories      NUMERIC(8,2) NOT NULL CHECK (calories >= 0),
  protein_g     NUMERIC(7,3) CHECK (protein_g >= 0),
  carbs_g       NUMERIC(7,3) CHECK (carbs_g >= 0),
  fat_g         NUMERIC(7,3) CHECK (fat_g >= 0),
  fiber_g       NUMERIC(7,3) CHECK (fiber_g >= 0),

  -- Free-text for untracked items (no food_item_id)
  custom_name   TEXT        CHECK (char_length(custom_name) <= 200),
  CONSTRAINT chk_food_log_has_item_or_name
    CHECK (food_item_id IS NOT NULL OR custom_name IS NOT NULL),

  notes         TEXT        CHECK (char_length(notes) <= 500),

  -- Soft delete
  deleted_at    TIMESTAMPTZ,

  -- Audit
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.food_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "food_logs_select_own" ON public.food_logs
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "food_logs_insert_own" ON public.food_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "food_logs_update_own" ON public.food_logs
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "food_logs_delete_own" ON public.food_logs
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_food_logs_updated_at
  BEFORE UPDATE ON public.food_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. Daily nutrition summary ("what did I eat today?")
CREATE INDEX idx_food_logs_user_logged ON public.food_logs (user_id, logged_at DESC)
  WHERE deleted_at IS NULL;

-- 2. Meal-label breakdown
CREATE INDEX idx_food_logs_user_meal ON public.food_logs (user_id, meal_label, logged_at DESC)
  WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 3. WATER INTAKE
-- PHI: hydration patterns + timestamps
-- ---------------------------------------------------------------------------
CREATE TABLE public.water_intake (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL
                          REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  logged_at   TIMESTAMPTZ NOT NULL,
  amount_ml   NUMERIC(7,2) NOT NULL CHECK (amount_ml BETWEEN 1 AND 5000),
  source      public.measurement_source NOT NULL DEFAULT 'manual',

  -- Audit
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.water_intake ENABLE ROW LEVEL SECURITY;

CREATE POLICY "water_select_own" ON public.water_intake
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "water_insert_own" ON public.water_intake
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "water_update_own" ON public.water_intake
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "water_delete_own" ON public.water_intake
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_water_intake_updated_at
  BEFORE UPDATE ON public.water_intake
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index: daily total queries
CREATE INDEX idx_water_intake_user_logged ON public.water_intake (user_id, logged_at DESC);


-- ---------------------------------------------------------------------------
-- 4. NUTRITION GOALS
-- One active goal per category per user (unique partial index enforces this).
-- ---------------------------------------------------------------------------
CREATE TABLE public.nutrition_goals (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID        NOT NULL
                                    REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Daily macro targets
  daily_calories_kcal   NUMERIC(8,2) CHECK (daily_calories_kcal BETWEEN 500 AND 20000),
  daily_protein_g       NUMERIC(7,2) CHECK (daily_protein_g >= 0),
  daily_carbs_g         NUMERIC(7,2) CHECK (daily_carbs_g >= 0),
  daily_fat_g           NUMERIC(7,2) CHECK (daily_fat_g >= 0),
  daily_fiber_g         NUMERIC(7,2) CHECK (daily_fiber_g >= 0),
  daily_water_ml        NUMERIC(8,2) CHECK (daily_water_ml BETWEEN 100 AND 20000),

  -- Effective date range
  effective_from        DATE        NOT NULL DEFAULT CURRENT_DATE,
  effective_to          DATE,
  CONSTRAINT chk_nutrition_goal_dates
    CHECK (effective_to IS NULL OR effective_to >= effective_from),

  is_active             BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Audit
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.nutrition_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutrition_goals_select_own" ON public.nutrition_goals
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "nutrition_goals_insert_own" ON public.nutrition_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_goals_update_own" ON public.nutrition_goals
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "nutrition_goals_delete_own" ON public.nutrition_goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_nutrition_goals_updated_at
  BEFORE UPDATE ON public.nutrition_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enforce at most one active goal per user
CREATE UNIQUE INDEX uq_nutrition_goals_active_user
  ON public.nutrition_goals (user_id)
  WHERE is_active = TRUE;


-- ---------------------------------------------------------------------------
-- 5. SLEEP SESSIONS
-- PHI: sleep patterns + timestamps
-- ---------------------------------------------------------------------------
CREATE TABLE public.sleep_sessions (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ,
  CONSTRAINT chk_sleep_end_after_start
    CHECK (ended_at IS NULL OR ended_at > started_at),

  -- Duration in minutes (stored for fast aggregation; derived from timestamps)
  total_minutes   SMALLINT    GENERATED ALWAYS AS (
                                CASE
                                  WHEN ended_at IS NOT NULL
                                  THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER / 60
                                  ELSE NULL
                                END
                              ) STORED,

  -- Aggregated stage durations (minutes) — summary level
  awake_minutes   SMALLINT    CHECK (awake_minutes >= 0),
  light_minutes   SMALLINT    CHECK (light_minutes >= 0),
  deep_minutes    SMALLINT    CHECK (deep_minutes >= 0),
  rem_minutes     SMALLINT    CHECK (rem_minutes >= 0),

  -- Subjective quality 1–5
  sleep_quality   SMALLINT    CHECK (sleep_quality BETWEEN 1 AND 5),

  -- Respiratory disturbance (AHI for CPAP users, if available)
  ahi_events_per_hour NUMERIC(5,2) CHECK (ahi_events_per_hour >= 0),

  source          public.measurement_source NOT NULL DEFAULT 'manual',
  notes           TEXT        CHECK (char_length(notes) <= 1000),

  -- Soft delete
  deleted_at      TIMESTAMPTZ,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.sleep_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sleep_select_own" ON public.sleep_sessions
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "sleep_insert_own" ON public.sleep_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sleep_update_own" ON public.sleep_sessions
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sleep_delete_own" ON public.sleep_sessions
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_sleep_sessions_updated_at
  BEFORE UPDATE ON public.sleep_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index: chronological sleep history
CREATE INDEX idx_sleep_sessions_user_started ON public.sleep_sessions (user_id, started_at DESC)
  WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 6. SLEEP STAGE SEGMENTS (granular, per-segment detail)
-- Optional detail table — only populated when a device provides stage data.
-- If you have millions of users, consider partitioning this by month.
-- ---------------------------------------------------------------------------
CREATE TABLE public.sleep_stage_segments (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  sleep_session_id UUID        NOT NULL
                               REFERENCES public.sleep_sessions(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL
                               REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  stage            public.sleep_stage NOT NULL,
  started_at       TIMESTAMPTZ NOT NULL,
  ended_at         TIMESTAMPTZ NOT NULL,
  CONSTRAINT chk_sleep_seg_end_after_start CHECK (ended_at > started_at),

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- No updated_at: segments are immutable once written from device
);

-- RLS
ALTER TABLE public.sleep_stage_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sleep_seg_select_own" ON public.sleep_stage_segments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sleep_seg_insert_own" ON public.sleep_stage_segments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sleep_seg_delete_own" ON public.sleep_stage_segments
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes:
-- 1. Join from session to segments
CREATE INDEX idx_sleep_segs_session ON public.sleep_stage_segments (sleep_session_id);

-- 2. Time-range query within a session (timeline chart)
CREATE INDEX idx_sleep_segs_user_time ON public.sleep_stage_segments (user_id, started_at);
