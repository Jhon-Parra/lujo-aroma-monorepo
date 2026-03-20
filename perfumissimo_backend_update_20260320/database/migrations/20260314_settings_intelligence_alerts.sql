ALTER TABLE IF EXISTS ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS alert_sales_delta_pct INT DEFAULT 20,
    ADD COLUMN IF NOT EXISTS alert_abandoned_delta_pct INT DEFAULT 20,
    ADD COLUMN IF NOT EXISTS alert_abandoned_value_threshold DECIMAL(12, 2) DEFAULT 1000000,
    ADD COLUMN IF NOT EXISTS alert_negative_reviews_threshold INT DEFAULT 3,
    ADD COLUMN IF NOT EXISTS alert_trend_growth_pct INT DEFAULT 30,
    ADD COLUMN IF NOT EXISTS alert_trend_min_units INT DEFAULT 5,
    ADD COLUMN IF NOT EXISTS alert_failed_login_threshold INT DEFAULT 5,
    ADD COLUMN IF NOT EXISTS alert_abandoned_hours INT DEFAULT 24;
