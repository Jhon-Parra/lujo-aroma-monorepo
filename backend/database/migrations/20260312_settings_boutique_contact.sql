-- Agrega campos editables para "Nuestra Boutique" (footer y contacto)

ALTER TABLE ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS boutique_title VARCHAR(120) DEFAULT 'Nuestra Boutique',
    ADD COLUMN IF NOT EXISTS boutique_address_line1 VARCHAR(200) DEFAULT 'Calle 12 #13-85',
    ADD COLUMN IF NOT EXISTS boutique_address_line2 VARCHAR(200) DEFAULT 'Bogotá, Colombia',
    ADD COLUMN IF NOT EXISTS boutique_phone VARCHAR(60) DEFAULT '+57 (300) 123-4567',
    ADD COLUMN IF NOT EXISTS boutique_email VARCHAR(200) DEFAULT 'contacto@lujo_aroma.com';
