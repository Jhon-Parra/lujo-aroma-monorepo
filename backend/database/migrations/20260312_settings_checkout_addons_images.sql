-- ---------------------------------------------------------
-- Lujo & Aroma - Imagenes para extras en checkout
--
-- Permite subir imagenes (opcional) para:
-- - Envio prioritario
-- - Perfume de lujo
--
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS envio_prioritario_image_url VARCHAR(500),
  ADD COLUMN IF NOT EXISTS perfume_lujo_image_url VARCHAR(500);
