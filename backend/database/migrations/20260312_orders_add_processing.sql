-- ---------------------------------------------------------
-- Perfumissimo - Ordenes: agregar estado PROCESANDO
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

DO $$
BEGIN
  -- constraint por defecto del CHECK en estado suele llamarse ordenes_estado_check
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ordenes_estado_check'
  ) THEN
    ALTER TABLE Ordenes DROP CONSTRAINT ordenes_estado_check;
  END IF;

  ALTER TABLE Ordenes
    ADD CONSTRAINT ordenes_estado_check CHECK (
      estado IN ('PENDIENTE','PAGADO','PROCESANDO','ENVIADO','ENTREGADO','CANCELADO')
    );
END $$;
