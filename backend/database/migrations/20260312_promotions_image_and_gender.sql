-- ---------------------------------------------------------
-- Lujo & Aroma - Promociones: imagen + filtro por genero
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS Promociones
  ADD COLUMN IF NOT EXISTS imagen_url VARCHAR(500);

ALTER TABLE IF EXISTS Promociones
  ADD COLUMN IF NOT EXISTS product_gender VARCHAR(50);

DO $$
BEGIN
  -- Actualizar constraint de product_scope si existe (para permitir GENDER)
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promociones_product_scope_check') THEN
    ALTER TABLE Promociones DROP CONSTRAINT promociones_product_scope_check;
  END IF;
  ALTER TABLE Promociones
    ADD CONSTRAINT promociones_product_scope_check CHECK (product_scope IN ('GLOBAL','SPECIFIC','GENDER'));

  -- Constraint para product_gender
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promociones_product_gender_check') THEN
    ALTER TABLE Promociones
      ADD CONSTRAINT promociones_product_gender_check CHECK (product_gender IS NULL OR product_gender IN ('hombre','mujer','unisex'));
  END IF;
END $$;
