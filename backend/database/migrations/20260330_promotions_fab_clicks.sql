-- ---------------------------------------------------------
-- Lujo & Aroma - Metrics: promociones FAB clicks
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS promotions_fab_clicks INT DEFAULT 0;
