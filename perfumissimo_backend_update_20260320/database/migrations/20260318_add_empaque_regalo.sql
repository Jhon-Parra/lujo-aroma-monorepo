-- Migración: Agregar Empaque de regalo y nombre editable del perfumero de lujo
-- Fecha: 2026-03-18

-- 1. Nuevas columnas en configuracionglobal
ALTER TABLE configuracionglobal
  ADD COLUMN IF NOT EXISTS empaque_regalo_precio DECIMAL(10,2) DEFAULT 0 COMMENT 'Precio adicional del empaque de regalo',
  ADD COLUMN IF NOT EXISTS empaque_regalo_image_url TEXT DEFAULT NULL COMMENT 'URL de imagen para empaque de regalo',
  ADD COLUMN IF NOT EXISTS perfume_lujo_nombre VARCHAR(100) DEFAULT 'Perfumero de lujo (5ml)' COMMENT 'Nombre visible del extra perfume lujo';

-- 2. Nueva columna en ordenes para guardar si el cliente eligió empaque regalo
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS empaque_regalo BOOLEAN DEFAULT FALSE COMMENT 'El cliente eligió empaque de regalo',
  ADD COLUMN IF NOT EXISTS costo_empaque_regalo DECIMAL(10,2) DEFAULT 0 COMMENT 'Costo del empaque de regalo al momento del pedido';

-- 3. Valor inicial sensato
UPDATE configuracionglobal SET
  empaque_regalo_precio = 0,
  perfume_lujo_nombre = 'Perfumero de lujo (5ml)'
WHERE id = 1;
