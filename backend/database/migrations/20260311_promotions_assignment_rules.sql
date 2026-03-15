-- ---------------------------------------------------------
-- Perfumissimo - Promociones: reglas de asignacion
-- PostgreSQL / Supabase
--
-- Agrega:
-- - Usuarios.segmento
-- - Promociones.product_scope / audience_scope / audience_segment
-- - Tablas PromocionProductos y PromocionUsuarios
--
-- Ejecutar en Supabase SQL editor.
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS Usuarios
  ADD COLUMN IF NOT EXISTS segmento VARCHAR(100);

ALTER TABLE IF EXISTS Promociones
  ADD COLUMN IF NOT EXISTS product_scope VARCHAR(20) NOT NULL DEFAULT 'GLOBAL';

ALTER TABLE IF EXISTS Promociones
  ADD COLUMN IF NOT EXISTS audience_scope VARCHAR(20) NOT NULL DEFAULT 'ALL';

ALTER TABLE IF EXISTS Promociones
  ADD COLUMN IF NOT EXISTS audience_segment VARCHAR(100);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promociones_product_scope_check'
  ) THEN
    ALTER TABLE Promociones
      ADD CONSTRAINT promociones_product_scope_check CHECK (product_scope IN ('GLOBAL','SPECIFIC'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'promociones_audience_scope_check'
  ) THEN
    ALTER TABLE Promociones
      ADD CONSTRAINT promociones_audience_scope_check CHECK (audience_scope IN ('ALL','SEGMENT','CUSTOMERS'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS PromocionProductos (
  promocion_id UUID NOT NULL,
  producto_id UUID NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (promocion_id, producto_id),
  CONSTRAINT fk_pp_promocion FOREIGN KEY (promocion_id) REFERENCES Promociones (id) ON DELETE CASCADE,
  CONSTRAINT fk_pp_producto FOREIGN KEY (producto_id) REFERENCES Productos (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS PromocionUsuarios (
  promocion_id UUID NOT NULL,
  usuario_id UUID NOT NULL,
  creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (promocion_id, usuario_id),
  CONSTRAINT fk_pu_promocion FOREIGN KEY (promocion_id) REFERENCES Promociones (id) ON DELETE CASCADE,
  CONSTRAINT fk_pu_usuario FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) ON DELETE CASCADE
);
