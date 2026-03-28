-- ---------------------------------------------------------
-- Lujo & Aroma - Eventos de recomendacion (IA)
--
-- Guarda interacciones para mejorar el recomendador:
-- - inicio test
-- - envio de respuestas
-- - consulta libre
-- - clicks en recomendados
-- - vistas
--
-- Nota: usuario_id es opcional (visitante anonimo).
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS RecomendacionEventos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID NULL,
  session_id VARCHAR(120) NULL,
  event_type VARCHAR(60) NOT NULL,
  payload JSONB NULL,
  user_agent TEXT NULL,
  creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reco_eventos_usuario ON RecomendacionEventos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reco_eventos_session ON RecomendacionEventos(session_id);
CREATE INDEX IF NOT EXISTS idx_reco_eventos_tipo ON RecomendacionEventos(event_type);
CREATE INDEX IF NOT EXISTS idx_reco_eventos_creado ON RecomendacionEventos(creado_en);
