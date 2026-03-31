-- ---------------------------------------------------------
-- Lujo & Aroma - Productos: agregar "casa" (marca)
--
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS Productos
  ADD COLUMN IF NOT EXISTS casa VARCHAR(120);
