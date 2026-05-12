-- =============================================================================
-- VitalTrack: Migration 008 — Appointments (Sprint 1 model-aligned table)
-- PHI: appointment date, provider name, specialty, location, notes are ALL PHI
--      and subject to HIPAA minimum necessary standard.
--
-- NOTE: This table (appointments_v2) supersedes the appointments table created
--       in migration 004 for the FastAPI model layer. The Sprint 1 model uses a
--       simplified, self-contained schema that does not depend on the providers
--       table and matches the SQLAlchemy Appointment model exactly.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. ENUM TYPE
-- appointment_status may already exist from migration 004; guard with a DO block.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_namespace n ON n.oid = t.typnamespace
        WHERE t.typname = 'appointment_status'
          AND n.nspname = 'public'
    ) THEN
        CREATE TYPE public.appointment_status AS ENUM (
            'scheduled',
            'completed',
            'cancelled',
            'no_show'
        );
    END IF;
END
$$;


-- ---------------------------------------------------------------------------
-- 2. APPOINTMENTS_V2
-- Self-contained appointments table aligned with the Sprint 1 SQLAlchemy model.
-- No FK to providers — provider details are stored inline as text fields.
-- PHI: title, provider_name, specialty, location, notes, appointment_date
-- ---------------------------------------------------------------------------
CREATE TABLE public.appointments_v2 (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID        NOT NULL
                               REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Appointment identity [PHI]
  title            TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  provider_name    TEXT        CHECK (char_length(provider_name) <= 200),
  specialty        TEXT        CHECK (char_length(specialty) <= 120),
                               -- e.g., 'Cardiology', 'General Practice'
  location         TEXT        CHECK (char_length(location) <= 300),

  -- Scheduling [PHI]
  appointment_date TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT    NOT NULL DEFAULT 30
                               CHECK (duration_minutes BETWEEN 1 AND 1440),

  -- Status
  status           public.appointment_status NOT NULL DEFAULT 'scheduled',

  -- Notes [PHI]
  notes            TEXT        CHECK (char_length(notes) <= 5000),

  -- Reminder tracking
  reminder_sent    BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Soft delete
  deleted_at       TIMESTAMPTZ,

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.appointments_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appts_v2_select_own" ON public.appointments_v2
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "appts_v2_insert_own" ON public.appointments_v2
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "appts_v2_update_own" ON public.appointments_v2
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "appts_v2_delete_own" ON public.appointments_v2
  FOR DELETE USING (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 4. UPDATED_AT TRIGGER
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_appointments_v2_updated_at
  BEFORE UPDATE ON public.appointments_v2
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 5. INDEXES
-- ---------------------------------------------------------------------------

-- Upcoming appointments list (primary query: user + date range, active only)
CREATE INDEX idx_appts_v2_user_date ON public.appointments_v2 (user_id, appointment_date ASC)
  WHERE deleted_at IS NULL;

-- Status filter (e.g., "show only scheduled", "show completed history")
CREATE INDEX idx_appts_v2_user_status ON public.appointments_v2 (user_id, status)
  WHERE deleted_at IS NULL;
