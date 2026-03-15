-- ---------------------------------------------------------
-- Perfumissimo - ConfiguracionGlobal: redes sociales
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS instagram_url VARCHAR(500);

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS facebook_url VARCHAR(500);

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS whatsapp_number VARCHAR(40);

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS whatsapp_message VARCHAR(255);
