-- ---------------------------------------------------------
-- Lujo & Aroma - Home Premium (Carrusel + Categorias)
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS home_carousel JSONB,
  ADD COLUMN IF NOT EXISTS home_categories JSONB;
