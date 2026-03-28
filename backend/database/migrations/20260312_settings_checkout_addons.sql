-- ---------------------------------------------------------
-- Lujo & Aroma - Extras configurables en checkout
--
-- - Envio prioritario
-- - Perfume de lujo
--
-- Precios en COP. 0 = deshabilitado (no cobra).
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS envio_prioritario_precio DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perfume_lujo_precio DECIMAL(10, 2) DEFAULT 0;
