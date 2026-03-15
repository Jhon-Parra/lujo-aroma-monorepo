-- ---------------------------------------------------------
-- Perfumissimo - Productos: ampliar longitud del slug de categoria
--
-- `Productos.genero` se usa como slug de categoria.
-- Alinea con `Categorias.slug` (hasta 120).
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS Productos
  ALTER COLUMN genero TYPE VARCHAR(120);
