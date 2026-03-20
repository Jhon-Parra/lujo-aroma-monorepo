ALTER TABLE IF EXISTS ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS cart_recovery_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cart_recovery_message TEXT,
    ADD COLUMN IF NOT EXISTS cart_recovery_discount_pct INT DEFAULT 10,
    ADD COLUMN IF NOT EXISTS cart_recovery_countdown_seconds INT DEFAULT 120,
    ADD COLUMN IF NOT EXISTS cart_recovery_button_text VARCHAR(60);
