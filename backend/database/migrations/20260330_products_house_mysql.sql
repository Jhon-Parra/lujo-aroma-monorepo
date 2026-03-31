-- ---------------------------------------------------------
-- Lujo & Aroma - Productos: agregar "casa" (marca)
--
-- MySQL
-- ---------------------------------------------------------

USE lujo_aroma_db;

ALTER TABLE Productos
  ADD COLUMN casa VARCHAR(120) NULL AFTER genero;
