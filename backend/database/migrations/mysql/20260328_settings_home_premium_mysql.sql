-- ================================================================
-- Lujo & Aroma - Home Premium (Carrusel + Categorias) para MySQL
-- Ejecutar en phpMyAdmin / Hostinger
-- ================================================================

ALTER TABLE `configuracionglobal`
  ADD COLUMN IF NOT EXISTS `home_carousel` JSON DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS `home_categories` JSON DEFAULT NULL;
