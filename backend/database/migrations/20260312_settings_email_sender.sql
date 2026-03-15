-- ---------------------------------------------------------
-- Perfumissimo - ConfiguracionGlobal: remitente de correos
-- PostgreSQL / Supabase
--
-- Esto NO guarda credenciales SMTP. Solo personaliza el "From"/"Reply-To".
-- Las credenciales SMTP siguen en variables de entorno del backend.
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS email_from_name VARCHAR(120);

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS email_from_address VARCHAR(200);

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS email_reply_to VARCHAR(200);

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS email_bcc_orders VARCHAR(500);
