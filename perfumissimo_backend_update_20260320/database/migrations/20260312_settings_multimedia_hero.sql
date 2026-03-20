-- ---------------------------------------------------------
-- Perfumissimo - ConfiguracionGlobal: Soporte Multimedia para Banner
--
-- Agrega soporte para videos y GIFs en el banner principal.
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
ADD COLUMN IF NOT EXISTS hero_media_type VARCHAR(20) DEFAULT 'image',
ADD COLUMN IF NOT EXISTS hero_media_url VARCHAR(500);

-- Actualizar hero_media_url con el valor actual de hero_image_url para compatibilidad
UPDATE ConfiguracionGlobal
SET
    hero_media_url = hero_image_url
WHERE
    hero_media_url IS NULL
    AND hero_image_url IS NOT NULL;