-- =============================================================================
-- VitalTrack: Migration 005 — Goals, Notifications & Reports
-- PHI: Health goals and reports contain PHI when linked to an identified user.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. HEALTH GOALS
-- PHI: goal type + target + user = behavioral health PHI
-- ---------------------------------------------------------------------------
CREATE TABLE public.health_goals (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  category        public.goal_category NOT NULL,
  title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description     TEXT        CHECK (char_length(description) <= 1000),

  -- Measurement
  metric_name     TEXT        NOT NULL CHECK (char_length(metric_name) BETWEEN 1 AND 100),
                              -- e.g., 'steps_per_day', 'weight_kg', 'sleep_hours'
  unit            TEXT        NOT NULL CHECK (char_length(unit) BETWEEN 1 AND 30),
                              -- e.g., 'steps', 'kg', 'hours', 'mmHg'
  target_value    NUMERIC(12,4) NOT NULL,
  current_value   NUMERIC(12,4),
  baseline_value  NUMERIC(12,4), -- value at goal creation (for % progress)

  -- Direction: 'increase' (e.g., steps) or 'decrease' (e.g., weight)
  direction       TEXT        NOT NULL DEFAULT 'increase'
                              CHECK (direction IN ('increase', 'decrease', 'maintain')),

  -- Timeline
  start_date      DATE        NOT NULL DEFAULT CURRENT_DATE,
  deadline        DATE,
  CONSTRAINT chk_goal_deadline_after_start
    CHECK (deadline IS NULL OR deadline >= start_date),

  status          public.goal_status NOT NULL DEFAULT 'active',
  completed_at    TIMESTAMPTZ,

  -- Reminders
  check_in_frequency TEXT     DEFAULT 'weekly'
                              CHECK (check_in_frequency IN ('daily','weekly','monthly','none')),

  -- Soft delete
  deleted_at      TIMESTAMPTZ,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.health_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goals_select_own" ON public.health_goals
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "goals_insert_own" ON public.health_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_update_own" ON public.health_goals
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "goals_delete_own" ON public.health_goals
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_health_goals_updated_at
  BEFORE UPDATE ON public.health_goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. Active goals for a user (dashboard)
CREATE INDEX idx_goals_user_status ON public.health_goals (user_id, status)
  WHERE deleted_at IS NULL;

-- 2. Goals by category (e.g., "show my activity goals")
CREATE INDEX idx_goals_user_category ON public.health_goals (user_id, category)
  WHERE deleted_at IS NULL AND status = 'active';

-- 3. Upcoming deadlines (for reminder generation)
CREATE INDEX idx_goals_deadline ON public.health_goals (deadline ASC)
  WHERE deleted_at IS NULL AND status = 'active' AND deadline IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 2. GOAL PROGRESS HISTORY
-- Snapshot of current_value at each check-in for trend charting.
-- ---------------------------------------------------------------------------
CREATE TABLE public.goal_progress_logs (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id     UUID        NOT NULL
                          REFERENCES public.health_goals(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL
                          REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  value       NUMERIC(12,4) NOT NULL,
  notes       TEXT        CHECK (char_length(notes) <= 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Immutable: no updated_at
);

-- RLS
ALTER TABLE public.goal_progress_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "goal_progress_select_own" ON public.goal_progress_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "goal_progress_insert_own" ON public.goal_progress_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- No update/delete: progress log is append-only
CREATE POLICY "goal_progress_no_update" ON public.goal_progress_logs
  FOR UPDATE USING (FALSE);

CREATE POLICY "goal_progress_no_delete" ON public.goal_progress_logs
  FOR DELETE USING (FALSE);

-- Index: chronological progress for a goal
CREATE INDEX idx_goal_progress_goal_time ON public.goal_progress_logs
  (goal_id, recorded_at DESC);


-- ---------------------------------------------------------------------------
-- 3. NOTIFICATION PREFERENCES
-- One row per user per channel+event combination.
-- ---------------------------------------------------------------------------
CREATE TABLE public.notification_preferences (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- What to notify about
  event_type      TEXT        NOT NULL CHECK (char_length(event_type) BETWEEN 1 AND 100),
                              -- e.g., 'medication_reminder', 'goal_check_in',
                              --       'appointment_reminder', 'vital_alert',
                              --       'report_ready', 'weekly_summary'
  channel         public.notification_channel NOT NULL,
  is_enabled      BOOLEAN     NOT NULL DEFAULT TRUE,

  -- Quiet hours (user's local time)
  quiet_from      TIME,
  quiet_to        TIME,

  -- Throttle: min minutes between same event_type notifications
  throttle_minutes INTEGER    CHECK (throttle_minutes >= 0),

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_notif_pref_user_event_channel
    UNIQUE (user_id, event_type, channel)
);

-- RLS
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_pref_select_own" ON public.notification_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_pref_insert_own" ON public.notification_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notif_pref_update_own" ON public.notification_preferences
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notif_pref_delete_own" ON public.notification_preferences
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Index: look up preferences for a user+event during notification dispatch
CREATE INDEX idx_notif_pref_user_event ON public.notification_preferences
  (user_id, event_type)
  WHERE is_enabled = TRUE;


-- ---------------------------------------------------------------------------
-- 4. NOTIFICATION LOGS
-- PHI: notification content may describe health events = PHI.
-- Append-only; not soft-deletable (compliance audit trail).
-- ---------------------------------------------------------------------------
CREATE TABLE public.notification_logs (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  preference_id   UUID        REFERENCES public.notification_preferences(id) ON DELETE SET NULL,

  event_type      TEXT        NOT NULL,
  channel         public.notification_channel NOT NULL,
  title           TEXT        NOT NULL CHECK (char_length(title) <= 200),
  body            TEXT        NOT NULL CHECK (char_length(body) <= 1000),

  -- Delivery status
  sent_at         TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  read_at         TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  failure_reason  TEXT        CHECK (char_length(failure_reason) <= 500),

  -- Device / endpoint info (do NOT store device tokens here — use a separate secure table)
  external_message_id TEXT    CHECK (char_length(external_message_id) <= 200),

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
  -- Immutable: no updated_at
);

-- RLS
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_log_select_own" ON public.notification_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Only the backend (service role) inserts
CREATE POLICY "notif_log_no_user_insert" ON public.notification_logs
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "notif_log_no_update" ON public.notification_logs
  FOR UPDATE USING (FALSE);

CREATE POLICY "notif_log_no_delete" ON public.notification_logs
  FOR DELETE USING (FALSE);

-- Indexes:
-- 1. User's notification inbox (unread in-app)
CREATE INDEX idx_notif_log_user_read ON public.notification_logs
  (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- 2. Delivery failure tracking (ops dashboard)
CREATE INDEX idx_notif_log_failed ON public.notification_logs (failed_at)
  WHERE failed_at IS NOT NULL;

-- 3. Throttle check: "last notification of this event_type to this user"
CREATE INDEX idx_notif_log_user_event ON public.notification_logs
  (user_id, event_type, sent_at DESC);


-- ---------------------------------------------------------------------------
-- 5. PUSH NOTIFICATION DEVICE TOKENS
-- Kept in a separate table from notification_logs for security isolation.
-- PHI: device identifiers linked to a patient.
-- ---------------------------------------------------------------------------
CREATE TABLE public.device_push_tokens (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID        NOT NULL
                          REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token       TEXT        NOT NULL CHECK (char_length(token) <= 512),
  platform    TEXT        NOT NULL CHECK (platform IN ('ios','android','web')),
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,

  -- Audit
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_device_token UNIQUE (token)
);

-- RLS
ALTER TABLE public.device_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_tokens_select_own" ON public.device_push_tokens
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "push_tokens_insert_own" ON public.device_push_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_tokens_update_own" ON public.device_push_tokens
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_tokens_delete_own" ON public.device_push_tokens
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_device_push_tokens_updated_at
  BEFORE UPDATE ON public.device_push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_push_tokens_user ON public.device_push_tokens (user_id)
  WHERE is_active = TRUE;


-- ---------------------------------------------------------------------------
-- 6. GENERATED REPORTS
-- PHI: report content = aggregate of all PHI domains above.
-- Reports are stored by reference to Supabase Storage (not inline BLOB).
-- ---------------------------------------------------------------------------
CREATE TABLE public.generated_reports (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description     TEXT        CHECK (char_length(description) <= 1000),
  format          public.report_format NOT NULL DEFAULT 'pdf',
  status          public.report_status NOT NULL DEFAULT 'pending',

  -- Date range covered by this report [PHI context]
  period_from     DATE,
  period_to       DATE,
  CONSTRAINT chk_report_period
    CHECK (period_to IS NULL OR period_from IS NULL OR period_to >= period_from),

  -- Which domains are included
  domains         TEXT[]      NOT NULL DEFAULT '{}',
                              -- e.g., ARRAY['vitals','sleep','medications']

  -- Supabase Storage path (not a signed URL — sign on demand)
  storage_path    TEXT        CHECK (char_length(storage_path) <= 500),

  -- Generation metadata
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,  -- auto-expire reports for storage cost control
  file_size_bytes BIGINT      CHECK (file_size_bytes >= 0),
  error_message   TEXT        CHECK (char_length(error_message) <= 1000),

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select_own" ON public.generated_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "reports_insert_own" ON public.generated_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update title/description; status updated by backend (service role)
CREATE POLICY "reports_update_own" ON public.generated_reports
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reports_delete_own" ON public.generated_reports
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_generated_reports_updated_at
  BEFORE UPDATE ON public.generated_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. User's report list (most recent first)
CREATE INDEX idx_reports_user_created ON public.generated_reports (user_id, created_at DESC);

-- 2. Expired reports cleanup job
CREATE INDEX idx_reports_expires ON public.generated_reports (expires_at)
  WHERE status = 'ready' AND expires_at IS NOT NULL;

-- 3. Pending reports for the generation worker
CREATE INDEX idx_reports_pending ON public.generated_reports (requested_at ASC)
  WHERE status = 'pending';


-- ---------------------------------------------------------------------------
-- 7. SHARED REPORTS
-- Allows a user to share a report with a provider via a time-limited token.
-- PHI: the share token grants access to PHI — treat like a credential.
-- ---------------------------------------------------------------------------
CREATE TABLE public.shared_reports (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id       UUID        NOT NULL
                              REFERENCES public.generated_reports(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL
                              REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Recipient (optional; can be anonymous link)
  recipient_email TEXT        CHECK (recipient_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  recipient_name  TEXT        CHECK (char_length(recipient_name) <= 120),

  -- Access control
  permission      public.share_permission NOT NULL DEFAULT 'view',
  -- Cryptographically random token (generated by app, stored as hash)
  token_hash      TEXT        NOT NULL UNIQUE,  -- SHA-256 of the actual token
  expires_at      TIMESTAMPTZ NOT NULL,
  max_access_count INTEGER    CHECK (max_access_count > 0),
  access_count    INTEGER     NOT NULL DEFAULT 0,

  -- Status
  revoked_at      TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  last_accessed_ip INET,

  -- Audit
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shared_reports_select_own" ON public.shared_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "shared_reports_insert_own" ON public.shared_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shared_reports_update_own" ON public.shared_reports
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "shared_reports_delete_own" ON public.shared_reports
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER trg_shared_reports_updated_at
  BEFORE UPDATE ON public.shared_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Indexes:
-- 1. Token lookup (fastest path for share link validation — uses hash, not plaintext)
CREATE INDEX idx_shared_reports_token ON public.shared_reports (token_hash)
  WHERE revoked_at IS NULL;

-- 2. Expiry cleanup job
CREATE INDEX idx_shared_reports_expires ON public.shared_reports (expires_at)
  WHERE revoked_at IS NULL;

-- 3. List shares for a report (user managing their shares)
CREATE INDEX idx_shared_reports_report ON public.shared_reports (report_id);
