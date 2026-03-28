-- ---------------------------------------------------------
-- Lujo & Aroma - Fix Productos: Missing columns and Slug support
-- ---------------------------------------------------------

USE lujo_aroma_db;

-- 1. Add missing columns used by the controller
ALTER TABLE Productos ADD COLUMN imagen_url_2 VARCHAR(500) AFTER imagen_url;
ALTER TABLE Productos ADD COLUMN imagen_url_3 VARCHAR(500) AFTER imagen_url_2;
ALTER TABLE Productos ADD COLUMN es_nuevo TINYINT(1) DEFAULT 0 AFTER imagen_url_3;
ALTER TABLE Productos ADD COLUMN nuevo_hasta DATETIME NULL AFTER es_nuevo;
ALTER TABLE Productos ADD COLUMN slug VARCHAR(255) AFTER nombre;

-- 2. Create an index for slugs for faster lookups
ALTER TABLE Productos ADD UNIQUE INDEX idx_productos_slug (slug);

-- 3. Function/Logic to generate slugs (Manual initialization for existing data)
UPDATE Productos SET slug = LOWER(REPLACE(REPLACE(nombre, ' ', '-'), '.', '')) WHERE slug IS NULL;
