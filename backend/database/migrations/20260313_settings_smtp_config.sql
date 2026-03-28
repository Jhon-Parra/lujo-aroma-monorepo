-- ---------------------------------------------------------
-- Lujo & Aroma - Configuracion SMTP en ConfiguracionGlobal
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255),
    ADD COLUMN IF NOT EXISTS smtp_port INT,
    ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN,
    ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(200),
    ADD COLUMN IF NOT EXISTS smtp_from VARCHAR(255),
    ADD COLUMN IF NOT EXISTS smtp_pass_enc TEXT,
    ADD COLUMN IF NOT EXISTS smtp_pass_iv VARCHAR(255),
    ADD COLUMN IF NOT EXISTS smtp_pass_tag VARCHAR(255);
