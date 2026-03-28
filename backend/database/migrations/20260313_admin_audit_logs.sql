-- ---------------------------------------------------------
-- Lujo & Aroma - Admin audit logs
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id VARCHAR(64) NOT NULL,
  action VARCHAR(120) NOT NULL,
  target VARCHAR(200),
  metadata JSONB,
  ip VARCHAR(64),
  user_agent VARCHAR(300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS admin_audit_logs_actor_idx
  ON admin_audit_logs(actor_user_id);

CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx
  ON admin_audit_logs(created_at);
