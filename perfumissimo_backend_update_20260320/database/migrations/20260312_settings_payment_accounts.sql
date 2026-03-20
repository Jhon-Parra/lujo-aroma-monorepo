-- Campos para pagos manuales (transferencia / datos del vendedor)

ALTER TABLE ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS seller_bank_name VARCHAR(120) DEFAULT '',
    ADD COLUMN IF NOT EXISTS seller_bank_account_type VARCHAR(40) DEFAULT '',
    ADD COLUMN IF NOT EXISTS seller_bank_account_number VARCHAR(60) DEFAULT '',
    ADD COLUMN IF NOT EXISTS seller_bank_account_holder VARCHAR(120) DEFAULT '',
    ADD COLUMN IF NOT EXISTS seller_bank_account_id VARCHAR(40) DEFAULT '',
    ADD COLUMN IF NOT EXISTS seller_nequi_number VARCHAR(30) DEFAULT '',
    ADD COLUMN IF NOT EXISTS seller_payment_notes VARCHAR(500) DEFAULT '';
