-- Guarda la llave privada de Wompi cifrada (AES-GCM)
-- Nota: el descifrado requiere SETTINGS_ENCRYPTION_KEY en el backend.

ALTER TABLE ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS wompi_private_key_enc TEXT,
    ADD COLUMN IF NOT EXISTS wompi_private_key_iv VARCHAR(80),
    ADD COLUMN IF NOT EXISTS wompi_private_key_tag VARCHAR(80);
