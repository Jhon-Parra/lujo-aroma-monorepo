-- Migración para corregir esquema de pedidos y evitar Error 500 en my-orders
-- 1. Agregar columnas faltantes a detalleordenes
ALTER TABLE detalleordenes 
ADD COLUMN IF NOT EXISTS nombre_producto VARCHAR(255),
ADD COLUMN IF NOT EXISTS imagen_url TEXT,
ADD COLUMN IF NOT EXISTS subtotal_snapshot DECIMAL(15,2);

-- 2. Agregar columnas faltantes a ordenes
ALTER TABLE ordenes
ADD COLUMN IF NOT EXISTS telefono VARCHAR(50),
ADD COLUMN IF NOT EXISTS nombre_cliente VARCHAR(255),
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(100),
ADD COLUMN IF NOT EXISTS canal_pago VARCHAR(100),
ADD COLUMN IF NOT EXISTS estado_pago VARCHAR(50) DEFAULT 'PENDIENTE',
ADD COLUMN IF NOT EXISTS referencia_pago VARCHAR(255);

-- 3. Crear tabla de historial de estados
CREATE TABLE IF NOT EXISTS historial_pedido (
    id VARCHAR(36) PRIMARY KEY,
    orden_id VARCHAR(36) NOT NULL,
    estado_anterior VARCHAR(50),
    estado_nuevo VARCHAR(50) NOT NULL,
    admin_id VARCHAR(36),
    observacion TEXT,
    cambio_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (orden_id),
    FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Crear tabla de envios
CREATE TABLE IF NOT EXISTS envios (
    id VARCHAR(36) PRIMARY KEY,
    orden_id VARCHAR(36) NOT NULL UNIQUE,
    transportadora VARCHAR(100) NOT NULL,
    numero_guia VARCHAR(100) NOT NULL,
    fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
    link_rastreo TEXT,
    observacion TEXT,
    admin_id VARCHAR(36),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE,
    FOREIGN KEY (admin_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
