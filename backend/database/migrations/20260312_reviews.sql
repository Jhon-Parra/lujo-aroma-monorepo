-- ---------------------------------------------------------
-- Lujo & Aroma - Resenas (solo compras verificadas)
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS Resenas (
  id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
  usuario_id UUID NOT NULL,
  producto_id UUID NOT NULL,
  orden_id UUID,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comentario TEXT,
  verificada BOOLEAN DEFAULT true,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_resena_usuario FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) ON DELETE CASCADE,
  CONSTRAINT fk_resena_producto FOREIGN KEY (producto_id) REFERENCES Productos (id) ON DELETE CASCADE,
  CONSTRAINT fk_resena_orden FOREIGN KEY (orden_id) REFERENCES Ordenes (id) ON DELETE SET NULL,
  CONSTRAINT uk_resena_usuario_producto UNIQUE (usuario_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_resenas_producto ON Resenas (producto_id);
