-- ---------------------------------------------------------
-- Lujo & Aroma - Promociones: permitir categoria dinamica
--
-- Reutilizamos las columnas existentes:
-- - product_scope = 'GENDER'
-- - product_gender = <categoria_slug>
--
-- Este script elimina el constraint que limitaba product_gender a
-- ('hombre','mujer','unisex') para permitir slugs dinamicos.
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'promociones_product_gender_check') THEN
    ALTER TABLE Promociones DROP CONSTRAINT promociones_product_gender_check;
  END IF;
END $$;
