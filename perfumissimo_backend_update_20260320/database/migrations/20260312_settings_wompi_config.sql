-- Configuracion de Wompi (NO incluye llaves privadas)

ALTER TABLE ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS wompi_env VARCHAR(20) DEFAULT 'sandbox',
    ADD COLUMN IF NOT EXISTS wompi_public_key VARCHAR(200) DEFAULT '';
