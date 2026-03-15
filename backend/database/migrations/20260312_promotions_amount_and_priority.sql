-- Perfumissimo - Promociones: descuento fijo + prioridad

ALTER TABLE Promociones
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(10) NOT NULL DEFAULT 'PERCENT';

ALTER TABLE Promociones
  ADD COLUMN IF NOT EXISTS amount_discount DECIMAL(10, 2);

ALTER TABLE Promociones
  ADD COLUMN IF NOT EXISTS priority INT NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_promotions_discount_type'
  ) THEN
    ALTER TABLE Promociones
      ADD CONSTRAINT chk_promotions_discount_type CHECK (discount_type IN ('PERCENT', 'AMOUNT'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_promotions_amount_discount'
  ) THEN
    ALTER TABLE Promociones
      ADD CONSTRAINT chk_promotions_amount_discount CHECK (amount_discount IS NULL OR amount_discount >= 0);
  END IF;
END $$;
