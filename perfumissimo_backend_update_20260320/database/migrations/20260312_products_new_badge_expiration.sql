-- ---------------------------------------------------------
-- Perfumissimo - Productos: etiqueta "Nuevo" con expiracion
--
-- - es_nuevo: flag visual
-- - nuevo_hasta: fecha/hora limite para mostrar la etiqueta
--
-- Si nuevo_hasta es NULL y es_nuevo=true -> se muestra indefinidamente.
-- Si nuevo_hasta < NOW() -> no se muestra.
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS Productos
  ADD COLUMN IF NOT EXISTS es_nuevo BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS nuevo_hasta TIMESTAMPTZ;
