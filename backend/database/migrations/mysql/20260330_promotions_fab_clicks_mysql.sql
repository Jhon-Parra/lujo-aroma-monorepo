-- ================================================================
-- Lujo & Aroma - Metrics: promociones FAB clicks (MySQL)
-- Ejecutar en phpMyAdmin / Hostinger
-- ================================================================

ALTER TABLE `configuracionglobal`
  ADD COLUMN IF NOT EXISTS `promotions_fab_clicks` INT DEFAULT 0;
