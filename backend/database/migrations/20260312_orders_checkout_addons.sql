-- ---------------------------------------------------------
-- Lujo & Aroma - Guardar extras seleccionados en orden
--
-- Se guardan flags y costos para que el recibo/correo no dependa
-- de configuraciones futuras.
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS Ordenes
  ADD COLUMN IF NOT EXISTS subtotal_productos DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS envio_prioritario BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS costo_envio_prioritario DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS perfume_lujo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS costo_perfume_lujo DECIMAL(10, 2) DEFAULT 0;
