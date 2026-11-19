CREATE TABLE IF NOT EXISTS notification_reads (
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  audit_log_id UUID NOT NULL REFERENCES audit_logs (id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, audit_log_id)
);

CREATE INDEX IF NOT EXISTS notification_reads_user_idx
  ON notification_reads (user_id, read_at DESC);

CREATE TABLE IF NOT EXISTS support_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies (id) ON DELETE SET NULL,
  subject VARCHAR(160) NOT NULL,
  message VARCHAR(4000) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT support_requests_subject_check CHECK (char_length(btrim(subject)) >= 3),
  CONSTRAINT support_requests_message_check CHECK (char_length(btrim(message)) >= 10)
);

CREATE INDEX IF NOT EXISTS support_requests_user_idx
  ON support_requests (user_id, created_at DESC);
