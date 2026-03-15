ALTER TABLE IF EXISTS ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS show_instagram_section BOOLEAN DEFAULT TRUE;
