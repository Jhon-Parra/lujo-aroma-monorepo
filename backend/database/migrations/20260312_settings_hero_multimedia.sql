-- ---------------------------------------------------------
-- Perfumissimo - Hero (banner principal) con soporte multimedia
--
-- Permite configurar el recurso del Hero como:
-- - image: jpg/png/webp
-- - gif: image/gif
-- - video: mp4/webm
--
-- Campos nuevos:
-- - hero_media_type: 'image' | 'gif' | 'video'
-- - hero_media_url: URL publica
--
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS hero_media_type VARCHAR(20) DEFAULT 'image',
  ADD COLUMN IF NOT EXISTS hero_media_url VARCHAR(500);

-- Backfill (si ya existia hero_image_url)
UPDATE ConfiguracionGlobal
SET hero_media_url = hero_image_url
WHERE hero_media_url IS NULL;

UPDATE ConfiguracionGlobal
SET hero_media_type = 'image'
WHERE hero_media_type IS NULL OR LENGTH(TRIM(hero_media_type)) = 0;
