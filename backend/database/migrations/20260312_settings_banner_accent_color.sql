-- ---------------------------------------------------------
-- Lujo & Aroma - Banner superior: color de resaltado
--
-- banner_accent_color: color para borde/contorno del texto del banner.
-- Hex (#RRGGBB)
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS banner_accent_color VARCHAR(50) DEFAULT '#C2A878';
