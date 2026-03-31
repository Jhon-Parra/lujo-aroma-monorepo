-- ================================================================
-- Lujo & Aroma - Migración SMTP para MySQL / MariaDB (Hostinger)
-- Ejecutar en phpMyAdmin del panel de Hostinger
-- SEGURO: usa columnas condicionales para no fallar si ya existen
-- ================================================================

-- Añadir columnas SMTP a configuracionglobal (compatibilidad MySQL/MariaDB)
ALTER TABLE `configuracionglobal`
    ADD COLUMN IF NOT EXISTS `smtp_host`     VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `smtp_port`     INT          DEFAULT 465,
    ADD COLUMN IF NOT EXISTS `smtp_secure`   TINYINT(1)   DEFAULT 1,
    ADD COLUMN IF NOT EXISTS `smtp_user`     VARCHAR(200) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `smtp_from`     VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `smtp_pass_enc` TEXT         DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `smtp_pass_iv`  VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `smtp_pass_tag` VARCHAR(255) DEFAULT NULL;

-- Añadir columnas de remitente (sender config)
ALTER TABLE `configuracionglobal`
    ADD COLUMN IF NOT EXISTS `email_from_name`    VARCHAR(100) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `email_from_address` VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `email_reply_to`     VARCHAR(255) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS `email_bcc_orders`   VARCHAR(500) DEFAULT NULL;

-- Insertar configuración inicial SMTP directamente
-- (Esto aplica SMTP en la BD para que el email service lo tome inmediatamente)
UPDATE `configuracionglobal`
SET
    `smtp_host`    = 'smtp.hostinger.com',
    `smtp_port`    = 465,
    `smtp_secure`  = 1,
    `smtp_user`    = 'tienda@lujo_aromacol.com',
    `smtp_from`    = 'Lujo & Aroma <tienda@lujo_aromacol.com>',
    `email_bcc_orders` = 'ventas@lujo_aromacol.com'
WHERE id = 1;

-- NOTA: smtp_pass_enc se configura desde el panel admin de Lujo & Aroma
-- (Admin → Configuración → SMTP → ingresar contraseña → guardar)
-- La contraseña se cifra con AES-256-GCM antes de guardarse en la BD.
