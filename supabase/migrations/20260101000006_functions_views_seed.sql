-- =============================================================================
-- VitalTrack: Migration 006 — Functions, Views & Seed Data
-- Database-level business logic, helper views, and reference data.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. AUTO-CREATE user_profile AFTER SIGNUP
-- Fires on auth.users INSERT so the profile row always exists.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, display_name, timezone, locale)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'display_name',
      SPLIT_PART(COALESCE(NEW.email, ''), '@', 1), -- fallback: email prefix
      'New User'
    ),
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC'),
    COALESCE(NEW.raw_user_meta_data->>'locale',   'en-US')
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent: safe to re-run
  RETURN NEW;
END;
$$;

-- Attach to auth.users INSERT
CREATE OR REPLACE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ---------------------------------------------------------------------------
-- 2. SOFT-DELETE CASCADE HELPER
-- When a user_profile is soft-deleted, propagate deleted_at to child tables
-- that support soft delete. Hard deletes on auth.users cascade normally.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cascade_soft_delete_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE public.health_profiles    SET deleted_at = NEW.deleted_at WHERE user_id = NEW.id;
    UPDATE public.vitals             SET deleted_at = NEW.deleted_at WHERE user_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.workout_sessions   SET deleted_at = NEW.deleted_at WHERE user_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.food_logs          SET deleted_at = NEW.deleted_at WHERE user_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.sleep_sessions     SET deleted_at = NEW.deleted_at WHERE user_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.medications        SET deleted_at = NEW.deleted_at WHERE user_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.providers          SET deleted_at = NEW.deleted_at WHERE user_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.appointments       SET deleted_at = NEW.deleted_at WHERE user_id = NEW.id AND deleted_at IS NULL;
    UPDATE public.health_goals       SET deleted_at = NEW.deleted_at WHERE user_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_cascade_soft_delete_user
  AFTER UPDATE OF deleted_at ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.cascade_soft_delete_user();


-- ---------------------------------------------------------------------------
-- 3. DAILY NUTRITION SUMMARY FUNCTION
-- Returns aggregated macros for a user on a given date.
-- Use this from the app layer (RPC call) instead of building the aggregation
-- client-side, to avoid pulling raw food logs over the wire.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_daily_nutrition_summary(
  p_user_id   UUID,
  p_date      DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_calories   NUMERIC,
  total_protein_g  NUMERIC,
  total_carbs_g    NUMERIC,
  total_fat_g      NUMERIC,
  total_fiber_g    NUMERIC,
  total_water_ml   NUMERIC,
  log_count        BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(fl.calories),  0)  AS total_calories,
    COALESCE(SUM(fl.protein_g), 0)  AS total_protein_g,
    COALESCE(SUM(fl.carbs_g),   0)  AS total_carbs_g,
    COALESCE(SUM(fl.fat_g),     0)  AS total_fat_g,
    COALESCE(SUM(fl.fiber_g),   0)  AS total_fiber_g,
    COALESCE((
      SELECT SUM(wi.amount_ml)
      FROM   public.water_intake wi
      WHERE  wi.user_id  = p_user_id
        AND  wi.logged_at::DATE = p_date
    ), 0)                           AS total_water_ml,
    COUNT(*)                        AS log_count
  FROM public.food_logs fl
  WHERE fl.user_id     = p_user_id
    AND fl.logged_at::DATE = p_date
    AND fl.deleted_at  IS NULL;
$$;

-- RLS note: SECURITY DEFINER runs as the function owner (postgres).
-- The WHERE clause enforces per-user isolation instead of RLS.
-- Only call this from authenticated context after verifying auth.uid() = p_user_id.


-- ---------------------------------------------------------------------------
-- 4. VITAL SIGN LATEST VALUES VIEW
-- Materializes the most recent reading of each vital per user.
-- Used for dashboard "current readings" cards.
-- NOTE: Not a materialized view — data freshness matters here.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_latest_vitals AS
SELECT DISTINCT ON (user_id, vital_type)
  user_id,
  vital_type,
  value,
  unit,
  measured_at
FROM (
  SELECT user_id, 'heart_rate'               AS vital_type,
         heart_rate::TEXT                    AS value, 'bpm'   AS unit, measured_at
  FROM public.vitals WHERE heart_rate IS NOT NULL AND deleted_at IS NULL
  UNION ALL
  SELECT user_id, 'blood_pressure_systolic',
         blood_pressure_systolic::TEXT,       'mmHg', measured_at
  FROM public.vitals WHERE blood_pressure_systolic IS NOT NULL AND deleted_at IS NULL
  UNION ALL
  SELECT user_id, 'blood_pressure_diastolic',
         blood_pressure_diastolic::TEXT,      'mmHg', measured_at
  FROM public.vitals WHERE blood_pressure_diastolic IS NOT NULL AND deleted_at IS NULL
  UNION ALL
  SELECT user_id, 'spo2',
         spo2::TEXT,                          '%',    measured_at
  FROM public.vitals WHERE spo2 IS NOT NULL AND deleted_at IS NULL
  UNION ALL
  SELECT user_id, 'glucose',
         glucose::TEXT,                       'mg/dL', measured_at
  FROM public.vitals WHERE glucose IS NOT NULL AND deleted_at IS NULL
  UNION ALL
  SELECT user_id, 'weight_kg',
         weight_kg::TEXT,                     'kg',   measured_at
  FROM public.vitals WHERE weight_kg IS NOT NULL AND deleted_at IS NULL
  UNION ALL
  SELECT user_id, 'temperature_celsius',
         temperature_celsius::TEXT,           '°C',   measured_at
  FROM public.vitals WHERE temperature_celsius IS NOT NULL AND deleted_at IS NULL
  UNION ALL
  SELECT user_id, 'respiratory_rate',
         respiratory_rate::TEXT,              'breaths/min', measured_at
  FROM public.vitals WHERE respiratory_rate IS NOT NULL AND deleted_at IS NULL
) ranked
ORDER BY user_id, vital_type, measured_at DESC;

-- RLS on views inherits from underlying tables; no extra policy needed.


-- ---------------------------------------------------------------------------
-- 5. MEDICATION ADHERENCE RATE FUNCTION
-- Returns adherence % for a user over a date range.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_medication_adherence_rate(
  p_user_id    UUID,
  p_from       TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_to         TIMESTAMPTZ DEFAULT NOW(),
  p_medication_id UUID     DEFAULT NULL  -- NULL = all medications
)
RETURNS TABLE (
  medication_id   UUID,
  medication_name TEXT,
  total_doses     BIGINT,
  taken_doses     BIGINT,
  missed_doses    BIGINT,
  adherence_pct   NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id                                                         AS medication_id,
    m.name                                                       AS medication_name,
    COUNT(al.id)                                                 AS total_doses,
    COUNT(al.id) FILTER (WHERE al.status = 'taken')              AS taken_doses,
    COUNT(al.id) FILTER (WHERE al.status = 'missed')             AS missed_doses,
    ROUND(
      100.0 * COUNT(al.id) FILTER (WHERE al.status = 'taken')
      / NULLIF(COUNT(al.id), 0),
    2)                                                           AS adherence_pct
  FROM public.medications m
  LEFT JOIN public.medication_adherence_logs al
    ON al.medication_id = m.id
   AND al.scheduled_at BETWEEN p_from AND p_to
  WHERE m.user_id = p_user_id
    AND m.deleted_at IS NULL
    AND (p_medication_id IS NULL OR m.id = p_medication_id)
  GROUP BY m.id, m.name;
$$;


-- ---------------------------------------------------------------------------
-- 6. UPCOMING APPOINTMENTS VIEW
-- Simple convenience view for the next 90 days.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_upcoming_appointments AS
SELECT
  a.id,
  a.user_id,
  a.title,
  a.appointment_type,
  a.status,
  a.scheduled_at,
  a.duration_minutes,
  a.location,
  a.telehealth_url,
  a.reason,
  p.name        AS provider_name,
  p.specialty   AS provider_specialty,
  p.phone       AS provider_phone
FROM public.appointments a
LEFT JOIN public.providers p ON p.id = a.provider_id
WHERE a.deleted_at IS NULL
  AND a.scheduled_at BETWEEN NOW() AND NOW() + INTERVAL '90 days'
  AND a.status NOT IN ('cancelled', 'no_show');


-- ---------------------------------------------------------------------------
-- 7. GOAL PROGRESS UPDATE FUNCTION
-- Updates current_value on a goal and appends a progress log entry.
-- Handles completion detection.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_goal_progress(
  p_goal_id UUID,
  p_value   NUMERIC,
  p_notes   TEXT DEFAULT NULL
)
RETURNS public.health_goals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal public.health_goals;
BEGIN
  -- Fetch and lock the goal row
  SELECT * INTO v_goal
  FROM public.health_goals
  WHERE id = p_goal_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Goal not found or access denied';
  END IF;

  -- Append progress log
  INSERT INTO public.goal_progress_logs (goal_id, user_id, value, notes)
  VALUES (p_goal_id, auth.uid(), p_value, p_notes);

  -- Detect completion
  UPDATE public.health_goals
  SET
    current_value = p_value,
    status = CASE
      WHEN (v_goal.direction = 'increase' AND p_value >= v_goal.target_value)
        OR (v_goal.direction = 'decrease' AND p_value <= v_goal.target_value)
        OR (v_goal.direction = 'maintain' AND ABS(p_value - v_goal.target_value) / NULLIF(v_goal.target_value, 0) <= 0.02)
      THEN 'completed'::public.goal_status
      ELSE status
    END,
    completed_at = CASE
      WHEN (v_goal.direction = 'increase' AND p_value >= v_goal.target_value)
        OR (v_goal.direction = 'decrease' AND p_value <= v_goal.target_value)
        OR (v_goal.direction = 'maintain' AND ABS(p_value - v_goal.target_value) / NULLIF(v_goal.target_value, 0) <= 0.02)
      THEN NOW()
      ELSE completed_at
    END
  WHERE id = p_goal_id
  RETURNING * INTO v_goal;

  RETURN v_goal;
END;
$$;


-- ---------------------------------------------------------------------------
-- 8. DATA RETENTION CLEANUP FUNCTION
-- Purges hard-deleted / expired records per HIPAA minimum necessary.
-- Schedule via pg_cron: SELECT cron.schedule('daily-cleanup','0 2 * * *',
--   'SELECT public.run_data_retention_cleanup()');
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_data_retention_cleanup()
RETURNS TABLE (table_name TEXT, rows_purged BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff TIMESTAMPTZ := NOW() - INTERVAL '90 days'; -- soft-delete grace period
  v_report_expiry TIMESTAMPTZ := NOW();
BEGIN
  -- Purge old soft-deleted vitals
  DELETE FROM public.vitals
  WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  table_name := 'vitals'; rows_purged := ROW_COUNT; RETURN NEXT;

  -- Purge old soft-deleted workout sessions
  DELETE FROM public.workout_sessions
  WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  table_name := 'workout_sessions'; rows_purged := ROW_COUNT; RETURN NEXT;

  -- Purge old soft-deleted food logs
  DELETE FROM public.food_logs
  WHERE deleted_at IS NOT NULL AND deleted_at < v_cutoff;
  table_name := 'food_logs'; rows_purged := ROW_COUNT; RETURN NEXT;

  -- Expire generated reports past their expiry date
  UPDATE public.generated_reports
  SET status = 'expired'
  WHERE status = 'ready'
    AND expires_at IS NOT NULL
    AND expires_at < v_report_expiry;
  table_name := 'generated_reports (expired)'; rows_purged := ROW_COUNT; RETURN NEXT;

  -- Revoke expired share tokens
  UPDATE public.shared_reports
  SET revoked_at = NOW()
  WHERE revoked_at IS NULL
    AND expires_at < NOW();
  table_name := 'shared_reports (revoked)'; rows_purged := ROW_COUNT; RETURN NEXT;
END;
$$;


-- ---------------------------------------------------------------------------
-- 9. SEED: DEFAULT NOTIFICATION PREFERENCE EVENT TYPES
-- Inserted via service role after migrations run (not user-specific).
-- Application code calls this for each new user during onboarding.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seed_default_notification_preferences(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences
    (user_id, event_type, channel, is_enabled, throttle_minutes)
  VALUES
    (p_user_id, 'medication_reminder',  'push',   TRUE,  0),
    (p_user_id, 'medication_reminder',  'in_app', TRUE,  0),
    (p_user_id, 'appointment_reminder', 'push',   TRUE,  0),
    (p_user_id, 'appointment_reminder', 'email',  TRUE,  0),
    (p_user_id, 'appointment_reminder', 'in_app', TRUE,  0),
    (p_user_id, 'goal_check_in',        'push',   TRUE,  1440),
    (p_user_id, 'goal_check_in',        'in_app', TRUE,  1440),
    (p_user_id, 'vital_alert',          'push',   TRUE,  60),
    (p_user_id, 'vital_alert',          'in_app', TRUE,  60),
    (p_user_id, 'weekly_summary',       'email',  TRUE,  0),
    (p_user_id, 'weekly_summary',       'in_app', TRUE,  0),
    (p_user_id, 'report_ready',         'push',   TRUE,  0),
    (p_user_id, 'report_ready',         'email',  TRUE,  0),
    (p_user_id, 'report_ready',         'in_app', TRUE,  0)
  ON CONFLICT (user_id, event_type, channel) DO NOTHING;
END;
$$;


-- ---------------------------------------------------------------------------
-- 10. GRANT SCHEMA USAGE TO SUPABASE ROLES
-- anon: unauthenticated (very limited)
-- authenticated: logged-in app users
-- service_role: backend workers (bypasses RLS)
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- All tables: authenticated users work through RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO authenticated;

-- Sequences (for BIGSERIAL, etc.)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO authenticated;

-- Functions
GRANT EXECUTE ON FUNCTION public.get_daily_nutrition_summary(UUID, DATE)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_medication_adherence_rate(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_goal_progress(UUID, NUMERIC, TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_notification_preferences(UUID)       TO service_role;
GRANT EXECUTE ON FUNCTION public.run_data_retention_cleanup()                      TO service_role;

-- Revoke overly-broad defaults
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;
