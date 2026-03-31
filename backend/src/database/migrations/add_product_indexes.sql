-- Migration: Add indexes for performance optimization
-- Table: productos
CREATE INDEX idx_productos_casa ON productos(casa);
CREATE INDEX idx_productos_genero ON productos(genero);
CREATE INDEX idx_productos_stock ON productos(stock);
CREATE INDEX idx_productos_creado_en ON productos(creado_en);
CREATE INDEX idx_productos_promocion_id ON productos(promocion_id);

-- Table: promociones
CREATE INDEX idx_promociones_activo_fechas ON promociones(activo, fecha_inicio, fecha_fin);
CREATE INDEX idx_promociones_priority ON promociones(priority);

-- Table: promocionproductos
CREATE INDEX idx_promocionproductos_producto_id ON promocionproductos(producto_id);
