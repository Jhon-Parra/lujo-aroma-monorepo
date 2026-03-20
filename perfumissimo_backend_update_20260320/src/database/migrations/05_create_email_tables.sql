-- =============================================================================
-- Migración 05: Tablas del sistema de correos automáticos
-- Ejecutar en la BD de producción (Hostinger) si las tablas no existen
-- =============================================================================

-- Plantillas de correo por estado de pedido
CREATE TABLE IF NOT EXISTS `orderemailtemplates` (
    `id`          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    `status`      VARCHAR(30)     NOT NULL,
    `subject`     VARCHAR(255)    NOT NULL DEFAULT '',
    `body_html`   LONGTEXT        NOT NULL DEFAULT '',
    `body_text`   TEXT            DEFAULT NULL,
    `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Log de correos enviados por el sistema
CREATE TABLE IF NOT EXISTS `orderemaillogs` (
    `id`            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `order_id`      VARCHAR(60)     NOT NULL,
    `status`        VARCHAR(30)     NOT NULL,
    `to_email`      VARCHAR(255)    NOT NULL,
    `from_email`    VARCHAR(255)    DEFAULT NULL,
    `subject`       VARCHAR(255)    DEFAULT NULL,
    `success`       TINYINT(1)      NOT NULL DEFAULT 0,
    `error_message` TEXT            DEFAULT NULL,
    `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_order_id` (`order_id`),
    KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
