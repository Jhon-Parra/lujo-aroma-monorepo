-- ---------------------------------------------------------
-- Standardize MySQL Schema to VARCHAR(36) IDs (Matching User Environment)
-- ---------------------------------------------------------

USE lujo_aroma_db;

-- 1. Disable foreign key checks
SET FOREIGN_KEY_CHECKS = 0;

-- 2. Drop existing foreign keys
ALTER TABLE Detalle_Ordenes DROP FOREIGN KEY IF EXISTS fk_detalle_orden;
ALTER TABLE Detalle_Ordenes DROP FOREIGN KEY IF EXISTS fk_detalle_producto;
ALTER TABLE Ordenes DROP FOREIGN KEY IF EXISTS fk_orden_usuario;
ALTER TABLE Productos DROP FOREIGN KEY IF EXISTS fk_producto_promocion;

-- 3. Convert ID columns to VARCHAR(36)
ALTER TABLE Usuarios MODIFY id VARCHAR(36) NOT NULL;

ALTER TABLE Promociones MODIFY id VARCHAR(36) NOT NULL;

ALTER TABLE Productos MODIFY id VARCHAR(36) NOT NULL;
ALTER TABLE Productos MODIFY promocion_id VARCHAR(36) NULL;

ALTER TABLE Ordenes MODIFY id VARCHAR(36) NOT NULL;
ALTER TABLE Ordenes MODIFY usuario_id VARCHAR(36) NOT NULL;

ALTER TABLE Detalle_Ordenes MODIFY id VARCHAR(36) NOT NULL;
ALTER TABLE Detalle_Ordenes MODIFY orden_id VARCHAR(36) NOT NULL;
ALTER TABLE Detalle_Ordenes MODIFY producto_id VARCHAR(36) NOT NULL;

-- 4. Re-add/Standardize Columns in Productos
ALTER TABLE Productos 
    MODIFY nombre VARCHAR(255) NOT NULL,
    MODIFY genero VARCHAR(100) DEFAULT 'unisex',
    MODIFY notas_olfativas VARCHAR(500) NULL,
    MODIFY precio DECIMAL(15,2) NOT NULL;

-- Ensure required columns exist
ALTER TABLE Productos ADD COLUMN IF NOT EXISTS slug VARCHAR(255) AFTER nombre;
ALTER TABLE Productos ADD COLUMN IF NOT EXISTS imagen_url_2 VARCHAR(500) AFTER imagen_url;
ALTER TABLE Productos ADD COLUMN IF NOT EXISTS imagen_url_3 VARCHAR(500) AFTER imagen_url_2;
ALTER TABLE Productos ADD COLUMN IF NOT EXISTS es_nuevo TINYINT(1) DEFAULT 0;
ALTER TABLE Productos ADD COLUMN IF NOT EXISTS nuevo_hasta DATETIME NULL;

-- 5. Add missing Tables
CREATE TABLE IF NOT EXISTS Categorias (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    descripcion TEXT,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS PromocionProductos (
    promocion_id VARCHAR(36) NOT NULL,
    producto_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (promocion_id, producto_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS PromocionUsuarios (
    promocion_id VARCHAR(36) NOT NULL,
    usuario_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (promocion_id, usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Re-create foreign keys with VARCHAR(36) compatibility
ALTER TABLE Detalle_Ordenes ADD CONSTRAINT fk_detalle_orden FOREIGN KEY (orden_id) REFERENCES Ordenes (id) ON DELETE CASCADE;
ALTER TABLE Detalle_Ordenes ADD CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES Productos (id) ON DELETE RESTRICT;
ALTER TABLE Ordenes ADD CONSTRAINT fk_orden_usuario FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) ON DELETE RESTRICT;
ALTER TABLE Productos ADD CONSTRAINT fk_producto_promocion FOREIGN KEY (promocion_id) REFERENCES Promociones (id) ON DELETE SET NULL;

-- 7. Enable foreign key checks
SET FOREIGN_KEY_CHECKS = 1;

-- 8. Slugs Initialization
UPDATE Productos SET slug = LOWER(REPLACE(REPLACE(nombre, ' ', '-'), '.', '')) WHERE slug IS NULL;
