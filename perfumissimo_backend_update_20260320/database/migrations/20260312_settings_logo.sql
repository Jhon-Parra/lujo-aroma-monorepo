-- Add configurable logo (image + size) to global settings

ALTER TABLE ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);

ALTER TABLE ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS logo_height_mobile INT DEFAULT 96;

ALTER TABLE ConfiguracionGlobal
  ADD COLUMN IF NOT EXISTS logo_height_desktop INT DEFAULT 112;

-- Basic sanity checks (optional). Use NOT VALID to avoid failing on existing data.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_logo_height_mobile'
  ) THEN
    ALTER TABLE ConfiguracionGlobal
      ADD CONSTRAINT chk_logo_height_mobile CHECK (logo_height_mobile IS NULL OR (logo_height_mobile >= 24 AND logo_height_mobile <= 220));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_logo_height_desktop'
  ) THEN
    ALTER TABLE ConfiguracionGlobal
      ADD CONSTRAINT chk_logo_height_desktop CHECK (logo_height_desktop IS NULL OR (logo_height_desktop >= 24 AND logo_height_desktop <= 260));
  END IF;
END $$;
