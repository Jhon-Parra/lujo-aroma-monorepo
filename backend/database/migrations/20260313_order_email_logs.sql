-- ---------------------------------------------------------
-- Perfumissimo - Log de envios de correo por orden
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS OrderEmailLogs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID,
  status VARCHAR(50) NOT NULL,
  to_email VARCHAR(200) NOT NULL,
  from_email VARCHAR(200),
  subject VARCHAR(200),
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_email_logs_order_id
  ON OrderEmailLogs(order_id);

CREATE INDEX IF NOT EXISTS idx_order_email_logs_created_at
  ON OrderEmailLogs(created_at);
