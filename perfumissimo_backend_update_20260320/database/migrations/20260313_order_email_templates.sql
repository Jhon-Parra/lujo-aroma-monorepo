-- ---------------------------------------------------------
-- Perfumissimo - Plantillas de correo por estado de orden
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS OrderEmailTemplates (
  status VARCHAR(50) PRIMARY KEY,
  subject VARCHAR(200) NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_email_templates_status
  ON OrderEmailTemplates(status);
