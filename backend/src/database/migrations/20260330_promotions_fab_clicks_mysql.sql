-- Migración para rastreo de clicks en el botón flotante de promociones
ALTER TABLE configuracionglobal 
ADD COLUMN IF NOT EXISTS promotions_fab_clicks INT DEFAULT 0;
