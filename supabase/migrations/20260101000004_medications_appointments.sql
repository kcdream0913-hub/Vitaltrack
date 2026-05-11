-- =============================================================================
-- VitalTrack: Migration 004 — Medications & Appointments
-- PHI: Medication names, dosages, schedules, and appointment details
--      are ALL PHI and subject to HIPAA minimum necessary standard.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. MEDICATIONS (master list of a user's prescriptions / OTC drugs)
-- PHI: medication name, dose, prescriber = PHI
-- ---------------------------------------------------------------------------
CREATE TABLE public.medications (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL
                                  REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Drug identity [PHI]
  name                TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  generic_name        TEXT        CHECK (char_length(generic_name) <= 200),
  ndc_code            TEXT        CHECK (char_length(ndc_code) <= 20),   -- National Drug Code (US)
  rxnorm_code         TEXT        CHECK (char_length(rxnorm_code) <= 20), -- RxNorm concept ID

  -- Dosage [PHI]
  dose_amount         NUMERIC(10,3) NOT NULL CHECK (dose_amount > 0),
  dose_unit           TEXT        NOT NULL CHECK (char_length(dose_unit) BETWEEN 1 AND 30),
                                  -- e.g., 'mg', 'mcg', 'ml', 'units', 'tablet'
  frequency           public.medication_frequency NOT NULL DEFAULT 'once_daily',
  -- Custom frequency expression (cron-style or plain text) for 'custom' enum value
  frequency_custom    TEXT        CHECK (char_length(frequency_custom) <= 200),

  -- Route of administration
  route               TEXT        DEFAULT 'oral'
                                  CHECK (route IN (
                                    'oral','sublingual','topical','intravenous',
                                    'intramuscular','subcutaneous','inhaled',
                                    'ophthalmic','otic','nasal','rectal','transdermal','other'
                                  )),

  -- Prescriber [PHI]
  prescribed_by       TEXT        CHECK (char_length(prescribed_by) <= 120),
  prescription_date   DATE,
  pharmacy_name       TEXT        CHECK (char_length(pharmacy_name) <= 120),
  rx_number           TEXT        CHECK (char_length(rx_number) <= 60),

  -- Validity window
  started_on          DATE,
  ended_on            DATE,
  CONSTRAINT chk_med_end_after_start
    CHECK (ended_on IS NULL OR started_on IS NULL OR ended_on >= started_on),

  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Refill tracking
  refills_remaining   SMALLINT    CHECK (refills_remaining >= 0),
  next_refill_date    DATE,

  -- Appearance (helps user identify pill)
  color               TEXT        CHECK (char_length(color) <= 60),
  shape               TEXT        CHECK (char_length(shape) <= 60),
  imprint             TEXT        CHECK (char_length(imprint) <= 60),

  -- Side effects / instructions [PHI]
  instructions        TEXT        CHECK (char_length(instructions) <= 2000),
  side_effects_noted  TEXT        CHECK (char_length(side_effects_noted) <= 2000),

  -- Soft delete
  deleted_at          TIMESTAMPTZ,

  -- Audit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "medications_select_own" ON public.medications
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "medications_insert_own" ON public.medications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "medications_update_own" ON public.medications
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "medications_delete_own" ON public.medications
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. Active medications list (most common query)
CREATE INDEX idx_medications_user_active ON public.medications (user_id, is_active)
  WHERE deleted_at IS NULL;

-- 2. NDC lookup for drug interaction checks
CREATE INDEX idx_medications_ndc ON public.medications (ndc_code)
  WHERE ndc_code IS NOT NULL AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 2. MEDICATION SCHEDULES
-- Defines when (time of day) each dose should be taken.
-- A single medication can have multiple schedule rows
-- (e.g., "8am and 8pm" = 2 rows).
-- ---------------------------------------------------------------------------
CREATE TABLE public.medication_schedules (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id UUID        NOT NULL
                            REFERENCES public.medications(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL
                            REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Time of day for this dose (stored as time, timezone applied app-side)
  scheduled_time TIME        NOT NULL,

  -- Days of week (bitmask: bit 0 = Mon … bit 6 = Sun; NULL = every day)
  days_of_week  SMALLINT    CHECK (days_of_week BETWEEN 1 AND 127),

  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Reminder lead time in minutes before scheduled_time
  reminder_minutes SMALLINT CHECK (reminder_minutes BETWEEN 0 AND 1440),

  -- Audit
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.medication_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "med_sched_select_own" ON public.medication_schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "med_sched_insert_own" ON public.medication_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "med_sched_update_own" ON public.medication_schedules
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "med_sched_delete_own" ON public.medication_schedules
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_medication_schedules_updated_at
  BEFORE UPDATE ON public.medication_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index: find schedules for a medication (for notification generation)
CREATE INDEX idx_med_schedules_medication ON public.medication_schedules (medication_id)
  WHERE is_active = TRUE;


-- ---------------------------------------------------------------------------
-- 3. MEDICATION ADHERENCE LOGS
-- PHI: whether a patient took their medication is highly sensitive PHI.
-- Append-only in practice; updates only for corrections.
-- ---------------------------------------------------------------------------
CREATE TABLE public.medication_adherence_logs (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id    UUID        NOT NULL
                               REFERENCES public.medications(id) ON DELETE CASCADE,
  schedule_id      UUID        REFERENCES public.medication_schedules(id) ON DELETE SET NULL,
  user_id          UUID        NOT NULL
                               REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- When the dose was scheduled (ISO timestamp of the planned dose)
  scheduled_at     TIMESTAMPTZ NOT NULL,
  -- When the user actually recorded the action (NULL if not yet logged)
  recorded_at      TIMESTAMPTZ,
  status           public.adherence_status NOT NULL DEFAULT 'taken',

  -- Actual dose taken (may differ from prescribed, e.g., split pill)
  actual_dose      NUMERIC(10,3) CHECK (actual_dose > 0),

  notes            TEXT        CHECK (char_length(notes) <= 500),

  -- Audit
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate entries for the same scheduled dose
  CONSTRAINT uq_adherence_med_scheduled UNIQUE (medication_id, scheduled_at)
);

-- RLS
ALTER TABLE public.medication_adherence_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adherence_select_own" ON public.medication_adherence_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "adherence_insert_own" ON public.medication_adherence_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "adherence_update_own" ON public.medication_adherence_logs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- No delete: corrections go through status updates
CREATE POLICY "adherence_no_delete" ON public.medication_adherence_logs
  FOR DELETE USING (FALSE);

CREATE TRIGGER trg_adherence_updated_at
  BEFORE UPDATE ON public.medication_adherence_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. Adherence rate calculation for a medication over a date range
CREATE INDEX idx_adherence_med_scheduled ON public.medication_adherence_logs
  (medication_id, scheduled_at DESC);

-- 2. User's adherence dashboard (all medications, recent)
CREATE INDEX idx_adherence_user_scheduled ON public.medication_adherence_logs
  (user_id, scheduled_at DESC);

-- 3. Filter by status (missed doses report)
CREATE INDEX idx_adherence_user_status ON public.medication_adherence_logs
  (user_id, status, scheduled_at DESC);


-- ---------------------------------------------------------------------------
-- 4. PROVIDERS (healthcare providers / practices)
-- PHI: provider name + specialty, when linked to a patient, is PHI.
-- ---------------------------------------------------------------------------
CREATE TABLE public.providers (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Provider identity [PHI]
  name            TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  specialty       TEXT        CHECK (char_length(specialty) <= 120),
  practice_name   TEXT        CHECK (char_length(practice_name) <= 200),

  -- Contact [PHI]
  phone           TEXT        CHECK (phone ~ '^\+?[0-9\s\-().]{7,20}$'),
  fax             TEXT        CHECK (fax ~ '^\+?[0-9\s\-().]{7,20}$'),
  email           TEXT        CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  address_line1   TEXT        CHECK (char_length(address_line1) <= 200),
  address_line2   TEXT        CHECK (char_length(address_line2) <= 200),
  city            TEXT        CHECK (char_length(city) <= 100),
  state           TEXT        CHECK (char_length(state) <= 60),
  postal_code     TEXT        CHECK (char_length(postal_code) <= 20),
  country         TEXT        NOT NULL DEFAULT 'US' CHECK (char_length(country) = 2),

  -- NPI (National Provider Identifier — US)
  npi_number      TEXT        CHECK (npi_number ~ '^[0-9]{10}$'),

  notes           TEXT        CHECK (char_length(notes) <= 1000),
  is_primary      BOOLEAN     NOT NULL DEFAULT FALSE,

  -- Soft delete
  deleted_at      TIMESTAMPTZ,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one primary provider per user
CREATE UNIQUE INDEX uq_providers_primary_per_user ON public.providers (user_id)
  WHERE is_primary = TRUE AND deleted_at IS NULL;

-- RLS
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "providers_select_own" ON public.providers
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "providers_insert_own" ON public.providers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "providers_update_own" ON public.providers
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "providers_delete_own" ON public.providers
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_providers_updated_at
  BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_providers_user ON public.providers (user_id)
  WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 5. APPOINTMENTS
-- PHI: appointment date + provider + user = PHI
-- ---------------------------------------------------------------------------
CREATE TABLE public.appointments (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  provider_id     UUID        REFERENCES public.providers(id) ON DELETE SET NULL,

  title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  appointment_type public.appointment_type NOT NULL DEFAULT 'in_person',
  status          public.appointment_status NOT NULL DEFAULT 'scheduled',

  -- Timing [PHI]
  scheduled_at    TIMESTAMPTZ NOT NULL,
  duration_minutes SMALLINT   CHECK (duration_minutes BETWEEN 5 AND 480),
  location        TEXT        CHECK (char_length(location) <= 300),
  telehealth_url  TEXT        CHECK (char_length(telehealth_url) <= 500),

  -- Reason / chief complaint [PHI]
  reason          TEXT        CHECK (char_length(reason) <= 500),

  -- Reminders
  reminder_minutes INTEGER[]  DEFAULT '{1440, 60}', -- default: 24h and 1h before

  -- Post-appointment [PHI]
  summary         TEXT        CHECK (char_length(summary) <= 5000),
  follow_up_date  DATE,

  -- Soft delete
  deleted_at      TIMESTAMPTZ,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appt_select_own" ON public.appointments
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "appt_insert_own" ON public.appointments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "appt_update_own" ON public.appointments
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "appt_delete_own" ON public.appointments
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. Upcoming appointments list
CREATE INDEX idx_appointments_user_scheduled ON public.appointments (user_id, scheduled_at ASC)
  WHERE deleted_at IS NULL AND status NOT IN ('cancelled', 'no_show');

-- 2. Status filter (e.g., "completed appointments for records")
CREATE INDEX idx_appointments_user_status ON public.appointments (user_id, status)
  WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 6. APPOINTMENT NOTES
-- Separate table for SOAP notes / detailed clinical notes to allow
-- granular access control (e.g., provider-entered vs user-entered).
-- PHI: clinical notes are among the most sensitive PHI categories.
-- ---------------------------------------------------------------------------
CREATE TABLE public.appointment_notes (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  appointment_id  UUID        NOT NULL
                              REFERENCES public.appointments(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- SOAP structure (optional; use body for free-form)
  subjective      TEXT        CHECK (char_length(subjective) <= 5000),
  objective       TEXT        CHECK (char_length(objective) <= 5000),
  assessment      TEXT        CHECK (char_length(assessment) <= 5000),
  plan            TEXT        CHECK (char_length(plan) <= 5000),
  body            TEXT        CHECK (char_length(body) <= 10000),

  -- Attachments (stored in Supabase Storage; referenced by path)
  attachment_paths TEXT[]     DEFAULT '{}',

  -- Who wrote this note
  authored_by     TEXT        CHECK (char_length(authored_by) <= 120),

  -- Soft delete
  deleted_at      TIMESTAMPTZ,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.appointment_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "appt_notes_select_own" ON public.appointment_notes
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "appt_notes_insert_own" ON public.appointment_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "appt_notes_update_own" ON public.appointment_notes
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "appt_notes_delete_own" ON public.appointment_notes
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_appointment_notes_updated_at
  BEFORE UPDATE ON public.appointment_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index: find all notes for an appointment
CREATE INDEX idx_appt_notes_appointment ON public.appointment_notes (appointment_id)
  WHERE deleted_at IS NULL;
