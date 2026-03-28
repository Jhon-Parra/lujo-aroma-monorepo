-- ---------------------------------------------------------
-- Lujo & Aroma - ConfiguracionGlobal: instagram token (server-side)
-- PostgreSQL / Supabase
--
-- Nota: Este token NO debe ser expuesto al frontend.
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS instagram_access_token VARCHAR(500);
