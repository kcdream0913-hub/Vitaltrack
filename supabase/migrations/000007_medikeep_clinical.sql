-- ============================================================
-- Migration 000007: MediKeep clinical domain tables
-- Adds: conditions, allergies, encounters, immunizations,
--       lab_results, lab_test_components, symptoms,
--       symptom_occurrences
-- All tables use UUID PKs + user_id FK to user_profiles,
-- Row Level Security mirrors existing VitalTrack RLS pattern.
-- ============================================================

-- ── Conditions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conditions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    condition_name  TEXT,
    diagnosis       TEXT NOT NULL,
    notes           TEXT,
    onset_date      DATE,
    end_date        DATE,

    -- active | inactive | resolved | chronic | recurrence | relapse
    status          TEXT NOT NULL DEFAULT 'active',
    -- mild | moderate | severe | critical
    severity        TEXT,

    icd10_code      TEXT,
    snomed_code     TEXT,
    code_description TEXT,
    prescribed_by   TEXT,
    tags            JSONB NOT NULL DEFAULT '[]',

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_conditions_user_id     ON public.conditions (user_id);
CREATE INDEX IF NOT EXISTS idx_conditions_user_status ON public.conditions (user_id, status);

ALTER TABLE public.conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conditions_owner" ON public.conditions
    USING (user_id = auth.uid());

-- ── Allergies ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.allergies (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    allergen         TEXT NOT NULL,
    reaction         TEXT NOT NULL,
    -- mild | moderate | severe | critical
    severity         TEXT,
    onset_date       DATE,
    -- active | inactive | resolved
    status           TEXT NOT NULL DEFAULT 'active',
    notes            TEXT,
    medication_name  TEXT,   -- drug allergy: name of the med
    tags             JSONB NOT NULL DEFAULT '[]',

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at       TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_allergies_user_id ON public.allergies (user_id);

ALTER TABLE public.allergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allergies_owner" ON public.allergies
    USING (user_id = auth.uid());

-- ── Encounters ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encounters (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                 UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    condition_id            UUID REFERENCES public.conditions(id) ON DELETE SET NULL,

    reason                  TEXT NOT NULL,
    encounter_date          DATE NOT NULL,
    notes                   TEXT,

    -- annual_checkup | follow_up | consultation | emergency | telehealth | specialist
    visit_type              TEXT,
    chief_complaint         TEXT,
    diagnosis               TEXT,
    treatment_plan          TEXT,
    follow_up_instructions  TEXT,
    duration_minutes        INTEGER,
    -- office | hospital | telehealth | urgent_care | er
    location                TEXT,
    -- routine | urgent | emergency
    priority                TEXT,

    practitioner_name       TEXT,
    facility_name           TEXT,
    tags                    JSONB NOT NULL DEFAULT '[]',

    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_encounters_user_id   ON public.encounters (user_id);
CREATE INDEX IF NOT EXISTS idx_encounters_user_date ON public.encounters (user_id, encounter_date);

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "encounters_owner" ON public.encounters
    USING (user_id = auth.uid());

-- ── Immunizations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.immunizations (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    vaccine_name       TEXT NOT NULL,
    vaccine_trade_name TEXT,
    date_administered  DATE NOT NULL,
    dose_number        INTEGER,
    ndc_number         TEXT,
    lot_number         TEXT,
    manufacturer       TEXT,
    site               TEXT,
    route              TEXT,
    expiration_date    DATE,
    location           TEXT,
    notes              TEXT,
    practitioner_name  TEXT,
    tags               JSONB NOT NULL DEFAULT '[]',

    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_immunizations_user_id ON public.immunizations (user_id);

ALTER TABLE public.immunizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "immunizations_owner" ON public.immunizations
    USING (user_id = auth.uid());

-- ── Lab Results ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_results (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    test_name         TEXT NOT NULL,
    test_code         TEXT,   -- LOINC / CPT
    -- blood_work | imaging | pathology | microbiology | urine | other
    test_category     TEXT,
    test_type         TEXT,
    facility          TEXT,
    -- ordered | in_progress | completed | cancelled
    status            TEXT NOT NULL DEFAULT 'ordered',
    -- normal | abnormal | critical | inconclusive
    labs_result       TEXT,
    ordered_date      DATE,
    completed_date    DATE,
    notes             TEXT,
    practitioner_name TEXT,
    tags              JSONB NOT NULL DEFAULT '[]',

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_lab_results_user_id   ON public.lab_results (user_id);
CREATE INDEX IF NOT EXISTS idx_lab_results_user_date ON public.lab_results (user_id, completed_date);

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_results_owner" ON public.lab_results
    USING (user_id = auth.uid());

-- ── Lab Test Components ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lab_test_components (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lab_result_id       UUID NOT NULL REFERENCES public.lab_results(id) ON DELETE CASCADE,

    test_name           TEXT NOT NULL,
    abbreviation        TEXT,
    test_code           TEXT,              -- LOINC
    canonical_test_name TEXT,

    -- quantitative | qualitative
    result_type         TEXT NOT NULL DEFAULT 'quantitative',

    value               NUMERIC(12, 4),
    unit                TEXT,
    qualitative_value   TEXT,              -- positive | negative | detected

    ref_range_min       NUMERIC(12, 4),
    ref_range_max       NUMERIC(12, 4),
    ref_range_text      TEXT,

    -- normal | high | low | critical
    status              TEXT,
    -- hematology | chemistry | immunology | microbiology | etc.
    category            TEXT,
    display_order       INTEGER,
    notes               TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_test_components_lab_result_id ON public.lab_test_components (lab_result_id);
CREATE INDEX IF NOT EXISTS idx_lab_test_components_status        ON public.lab_test_components (status);

-- RLS via the parent lab_result (no direct user_id here)
ALTER TABLE public.lab_test_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lab_test_components_owner" ON public.lab_test_components
    USING (
        EXISTS (
            SELECT 1 FROM public.lab_results lr
            WHERE lr.id = lab_result_id
              AND lr.user_id = auth.uid()
        )
    );

-- ── Symptoms ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.symptoms (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

    symptom_name         TEXT NOT NULL,
    -- Neurological | Gastrointestinal | Musculoskeletal | Respiratory | etc.
    category             TEXT,
    -- active | resolved | chronic
    status               TEXT NOT NULL DEFAULT 'active',
    is_chronic           BOOLEAN NOT NULL DEFAULT FALSE,

    first_occurrence_date DATE NOT NULL,
    last_occurrence_date  DATE,
    resolved_date         DATE,

    typical_triggers     JSONB NOT NULL DEFAULT '[]',
    general_notes        TEXT,
    tags                 JSONB NOT NULL DEFAULT '[]',

    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_symptoms_user_id ON public.symptoms (user_id);

ALTER TABLE public.symptoms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "symptoms_owner" ON public.symptoms
    USING (user_id = auth.uid());

-- ── Symptom Occurrences ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.symptom_occurrences (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symptom_id        UUID NOT NULL REFERENCES public.symptoms(id) ON DELETE CASCADE,

    occurred_at       TIMESTAMPTZ NOT NULL,
    severity_scale    INTEGER CHECK (severity_scale BETWEEN 1 AND 10),
    duration_minutes  INTEGER,
    triggers          JSONB NOT NULL DEFAULT '[]',
    relieving_factors JSONB NOT NULL DEFAULT '[]',
    resolved          BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at       TIMESTAMPTZ,
    notes             TEXT,

    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_symptom_occurrences_symptom_id ON public.symptom_occurrences (symptom_id);

ALTER TABLE public.symptom_occurrences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "symptom_occurrences_owner" ON public.symptom_occurrences
    USING (
        EXISTS (
            SELECT 1 FROM public.symptoms s
            WHERE s.id = symptom_id
              AND s.user_id = auth.uid()
        )
    );

-- ── Updated-at triggers ───────────────────────────────────
-- Reuse the update_updated_at_column() function from migration 001 if it exists,
-- otherwise create it here.
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  -- Conditions
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_conditions_updated_at') THEN
    CREATE TRIGGER trg_conditions_updated_at
      BEFORE UPDATE ON public.conditions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  -- Allergies
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_allergies_updated_at') THEN
    CREATE TRIGGER trg_allergies_updated_at
      BEFORE UPDATE ON public.allergies
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  -- Encounters
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_encounters_updated_at') THEN
    CREATE TRIGGER trg_encounters_updated_at
      BEFORE UPDATE ON public.encounters
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  -- Immunizations
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_immunizations_updated_at') THEN
    CREATE TRIGGER trg_immunizations_updated_at
      BEFORE UPDATE ON public.immunizations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  -- Lab results
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lab_results_updated_at') THEN
    CREATE TRIGGER trg_lab_results_updated_at
      BEFORE UPDATE ON public.lab_results
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  -- Lab test components
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lab_test_components_updated_at') THEN
    CREATE TRIGGER trg_lab_test_components_updated_at
      BEFORE UPDATE ON public.lab_test_components
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  -- Symptoms
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_symptoms_updated_at') THEN
    CREATE TRIGGER trg_symptoms_updated_at
      BEFORE UPDATE ON public.symptoms
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
  -- Symptom occurrences
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_symptom_occurrences_updated_at') THEN
    CREATE TRIGGER trg_symptom_occurrences_updated_at
      BEFORE UPDATE ON public.symptom_occurrences
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
