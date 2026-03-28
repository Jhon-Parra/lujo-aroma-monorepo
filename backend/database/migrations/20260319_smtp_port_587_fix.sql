-- Migración para corregir intermitencia SMTP (Greeting never received)
-- Cambiando a Puerto 587 y STARTTLS (secure: false)

UPDATE configuracionglobal 
SET smtp_port = 587, 
    smtp_secure = 0 
WHERE id = 1;

-- Asegurar que el remitente sea el correcto (tienda@)
UPDATE configuracionglobal
SET email_from_address = 'tienda@lujo_aromacol.com'
WHERE id = 1;
