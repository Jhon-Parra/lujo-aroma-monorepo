-- ---------------------------------------------------------
-- Perfumissimo - ConfiguracionGlobal: TikTok
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

ALTER TABLE IF EXISTS ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS tiktok_url VARCHAR(500);
