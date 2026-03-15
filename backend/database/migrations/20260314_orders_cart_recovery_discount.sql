ALTER TABLE IF EXISTS Ordenes
    ADD COLUMN IF NOT EXISTS cart_recovery_applied BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cart_recovery_discount_pct INT DEFAULT 0,
    ADD COLUMN IF NOT EXISTS cart_recovery_discount_amount DECIMAL(10, 2) DEFAULT 0;
