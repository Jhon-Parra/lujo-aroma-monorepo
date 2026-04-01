-- Lujo & Aroma - FINAL CONSOLIDATED SCHEMA (22 TABLES)
-- Optimized for MariaDB (Hostinger) with BINARY(16) UUIDs
-- Source: Fully synchronized with local development environment (33065)

SET FOREIGN_KEY_CHECKS = 0;
SET NAMES utf8mb4;
SET TIME_ZONE = '+00:00';

-- 1. Usuarios
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id` BINARY(16) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `apellido` VARCHAR(255) NOT NULL,
  `telefono` VARCHAR(50) DEFAULT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `rol` ENUM('SUPERADMIN','ADMIN','VENTAS','PRODUCTOS','CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `foto_perfil` VARCHAR(255) DEFAULT NULL,
  `segmento` VARCHAR(100) DEFAULT NULL,
  `supabase_user_id` VARCHAR(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Categorias
CREATE TABLE IF NOT EXISTS `categorias` (
  `id` BINARY(16) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `slug` VARCHAR(255) NOT NULL,
  `activo` TINYINT(1) DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Promociones
CREATE TABLE IF NOT EXISTS `promociones` (
  `id` BINARY(16) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `descripcion` TEXT DEFAULT NULL,
  `porcentaje_descuento` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `fecha_inicio` DATETIME NOT NULL,
  `fecha_fin` DATETIME NOT NULL,
  `activo` TINYINT(1) DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `product_scope` VARCHAR(50) NOT NULL DEFAULT 'GLOBAL',
  `audience_scope` VARCHAR(50) NOT NULL DEFAULT 'ALL',
  `audience_segment` VARCHAR(100) DEFAULT NULL,
  `imagen_url` VARCHAR(500) DEFAULT NULL,
  `product_gender` VARCHAR(100) DEFAULT NULL,
  `discount_type` VARCHAR(20) NOT NULL DEFAULT 'PERCENT',
  `amount_discount` DECIMAL(15,2) DEFAULT NULL,
  `priority` INT(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_promociones_activo_fechas` (`activo`,`fecha_inicio`,`fecha_fin`),
  KEY `idx_promociones_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Productos
CREATE TABLE IF NOT EXISTS `productos` (
  `id` BINARY(16) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `genero` VARCHAR(100) DEFAULT 'unisex',
  `casa` VARCHAR(120) DEFAULT NULL,
  `descripcion` TEXT NOT NULL,
  `notas_olfativas` VARCHAR(500) DEFAULT NULL,
  `precio` DECIMAL(15,2) NOT NULL,
  `stock` INT(11) NOT NULL DEFAULT 0,
  `unidades_vendidas` INT(11) NOT NULL DEFAULT 0,
  `imagen_url` VARCHAR(500) DEFAULT NULL,
  `imagen_url_2` VARCHAR(500) DEFAULT NULL,
  `imagen_url_3` VARCHAR(500) DEFAULT NULL,
  `promocion_id` BINARY(16) DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `es_nuevo` TINYINT(1) DEFAULT 0,
  `nuevo_hasta` DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_productos_casa` (`casa`),
  KEY `idx_productos_genero` (`genero`),
  KEY `idx_productos_stock` (`stock`),
  KEY `idx_productos_creado_en` (`creado_en`),
  CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`promocion_id`) REFERENCES `promociones` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Ordenes
CREATE TABLE IF NOT EXISTS `ordenes` (
  `id` BINARY(16) NOT NULL,
  `usuario_id` BINARY(16) NOT NULL,
  `total` DECIMAL(15,2) NOT NULL,
  `estado` ENUM('PENDIENTE','PAGADO','PROCESANDO','ENVIADO','ENTREGADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  `direccion_envio` TEXT NOT NULL,
  `codigo_transaccion` VARCHAR(255) DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `subtotal_productos` DECIMAL(15,2) DEFAULT 0.00,
  `envio_prioritario` TINYINT(1) DEFAULT 0,
  `costo_envio_prioritario` DECIMAL(15,2) DEFAULT 0.00,
  `perfume_lujo` TINYINT(1) DEFAULT 0,
  `costo_perfume_lujo` DECIMAL(15,2) DEFAULT 0.00,
  `cart_recovery_applied` TINYINT(1) DEFAULT 0,
  `cart_recovery_discount_pct` INT(11) DEFAULT 0,
  `cart_recovery_discount_amount` DECIMAL(15,2) DEFAULT 0.00,
  `telefono` VARCHAR(50) DEFAULT NULL,
  `nombre_cliente` VARCHAR(255) DEFAULT NULL,
  `metodo_pago` VARCHAR(100) DEFAULT NULL,
  `canal_pago` VARCHAR(100) DEFAULT NULL,
  `estado_pago` VARCHAR(50) DEFAULT 'PENDIENTE',
  `referencia_pago` VARCHAR(255) DEFAULT NULL,
  `empaque_regalo` TINYINT(1) DEFAULT 0,
  `costo_empaque_regalo` DECIMAL(10,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `ordenes_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. DetalleOrdenes
CREATE TABLE IF NOT EXISTS `detalleordenes` (
  `id` BINARY(16) NOT NULL,
  `orden_id` BINARY(16) NOT NULL,
  `producto_id` BINARY(16) NOT NULL,
  `cantidad` INT(11) NOT NULL,
  `precio_unitario` DECIMAL(15,2) NOT NULL,
  `subtotal_snapshot` DECIMAL(15,2) DEFAULT NULL,
  `nombre_producto` VARCHAR(255) DEFAULT NULL,
  `imagen_url` TEXT DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `orden_id` (`orden_id`),
  KEY `producto_id` (`producto_id`),
  CONSTRAINT `detalleordenes_ibfk_1` FOREIGN KEY (`orden_id`) REFERENCES `ordenes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `detalleordenes_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Envios
CREATE TABLE IF NOT EXISTS `envios` (
  `id` BINARY(16) NOT NULL,
  `orden_id` BINARY(16) NOT NULL,
  `transportadora` VARCHAR(100) NOT NULL,
  `numero_guia` VARCHAR(100) NOT NULL,
  `fecha_envio` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `link_rastreo` TEXT DEFAULT NULL,
  `observacion` TEXT DEFAULT NULL,
  `admin_id` BINARY(16) DEFAULT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orden_id` (`orden_id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `envios_ibfk_1` FOREIGN KEY (`orden_id`) REFERENCES `ordenes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `envios_ibfk_2` FOREIGN KEY (`admin_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Favoritos
CREATE TABLE IF NOT EXISTS `favoritos` (
  `id` BINARY(16) NOT NULL,
  `usuario_id` BINARY(16) NOT NULL,
  `producto_id` BINARY(16) NOT NULL,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario_id` (`usuario_id`,`producto_id`),
  KEY `producto_id` (`producto_id`),
  CONSTRAINT `favoritos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `favoritos_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Resenas
CREATE TABLE IF NOT EXISTS `resenas` (
  `id` BINARY(16) NOT NULL,
  `usuario_id` BINARY(16) NOT NULL,
  `producto_id` BINARY(16) NOT NULL,
  `orden_id` BINARY(16) DEFAULT NULL,
  `rating` INT(11) NOT NULL,
  `comentario` TEXT DEFAULT NULL,
  `verificada` TINYINT(1) DEFAULT 1,
  `creado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `producto_id` (`producto_id`),
  KEY `orden_id` (`orden_id`),
  CONSTRAINT `resenas_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `resenas_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `resenas_ibfk_3` FOREIGN KEY (`orden_id`) REFERENCES `ordenes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. ConfiguracionGlobal
CREATE TABLE IF NOT EXISTS `configuracionglobal` (
  `id` INT(11) NOT NULL DEFAULT 1,
  `hero_title` VARCHAR(255) DEFAULT NULL,
  `hero_subtitle` TEXT DEFAULT NULL,
  `accent_color` VARCHAR(50) DEFAULT NULL,
  `show_banner` TINYINT(1) DEFAULT 1,
  `banner_text` VARCHAR(255) DEFAULT NULL,
  `hero_image_url` VARCHAR(500) DEFAULT '/assets/images/hero_bg.webp',
  `actualizado_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `instagram_url` VARCHAR(500) DEFAULT NULL,
  `facebook_url` VARCHAR(500) DEFAULT NULL,
  `whatsapp_number` VARCHAR(50) DEFAULT NULL,
  `whatsapp_message` VARCHAR(500) DEFAULT NULL,
  `instagram_access_token` VARCHAR(500) DEFAULT NULL,
  `logo_url` VARCHAR(500) DEFAULT NULL,
  `logo_height_mobile` INT(11) DEFAULT 96,
  `logo_height_desktop` INT(11) DEFAULT 112,
  `email_from_name` VARCHAR(100) DEFAULT NULL,
  `email_from_address` VARCHAR(100) DEFAULT NULL,
  `email_reply_to` VARCHAR(100) DEFAULT NULL,
  `email_bcc_orders` VARCHAR(100) DEFAULT NULL,
  `boutique_title` VARCHAR(255) DEFAULT 'Nuestra Boutique',
  `boutique_address_line1` VARCHAR(255) DEFAULT 'Calle 12 #13-85',
  `boutique_address_line2` VARCHAR(255) DEFAULT 'Bogotá, Colombia',
  `boutique_phone` VARCHAR(50) DEFAULT '+57 (300) 123-4567',
  `boutique_email` VARCHAR(100) DEFAULT 'contacto@lujo_aroma.com',
  `role_permissions` LONGTEXT DEFAULT NULL,
  `seller_bank_name` VARCHAR(100) DEFAULT '',
  `seller_bank_account_type` VARCHAR(50) DEFAULT '',
  `seller_bank_account_number` VARCHAR(50) DEFAULT '',
  `seller_bank_account_holder` VARCHAR(100) DEFAULT '',
  `seller_bank_account_id` VARCHAR(50) DEFAULT '',
  `seller_nequi_number` VARCHAR(50) DEFAULT '',
  `seller_payment_notes` TEXT DEFAULT NULL,
  `wompi_env` VARCHAR(20) DEFAULT 'sandbox',
  `wompi_public_key` VARCHAR(255) DEFAULT '',
  `wompi_private_key_enc` TEXT DEFAULT NULL,
  `wompi_private_key_iv` VARCHAR(255) DEFAULT NULL,
  `wompi_private_key_tag` VARCHAR(255) DEFAULT NULL,
  `hero_media_type` VARCHAR(20) DEFAULT 'image',
  `hero_media_url` VARCHAR(500) DEFAULT NULL,
  `envio_prioritario_precio` DECIMAL(15,2) DEFAULT 0.00,
  `perfume_lujo_precio` DECIMAL(15,2) DEFAULT 0.00,
  `envio_prioritario_image_url` VARCHAR(500) DEFAULT NULL,
  `perfume_lujo_image_url` VARCHAR(500) DEFAULT NULL,
  `banner_accent_color` VARCHAR(50) DEFAULT '#C2A878',
  `smtp_host` VARCHAR(255) DEFAULT NULL,
  `smtp_port` INT(11) DEFAULT NULL,
  `smtp_secure` TINYINT(1) DEFAULT NULL,
  `smtp_user` VARCHAR(255) DEFAULT NULL,
  `smtp_from` VARCHAR(255) DEFAULT NULL,
  `smtp_pass_enc` TEXT DEFAULT NULL,
  `smtp_pass_iv` VARCHAR(255) DEFAULT NULL,
  `smtp_pass_tag` VARCHAR(255) DEFAULT NULL,
  `tiktok_url` VARCHAR(500) DEFAULT NULL,
  `alert_sales_delta_pct` INT(11) DEFAULT 20,
  `alert_abandoned_delta_pct` INT(11) DEFAULT 20,
  `alert_abandoned_value_threshold` DECIMAL(15,2) DEFAULT 1000000.00,
  `alert_negative_reviews_threshold` INT(11) DEFAULT 3,
  `alert_trend_growth_pct` INT(11) DEFAULT 30,
  `alert_trend_min_units` INT(11) DEFAULT 5,
  `alert_failed_login_threshold` INT(11) DEFAULT 5,
  `alert_abandoned_hours` INT(11) DEFAULT 24,
  `cart_recovery_enabled` TINYINT(1) DEFAULT 0,
  `cart_recovery_message` TEXT DEFAULT NULL,
  `cart_recovery_discount_pct` INT(11) DEFAULT 10,
  `cart_recovery_countdown_seconds` INT(11) DEFAULT 120,
  `cart_recovery_button_text` VARCHAR(255) DEFAULT NULL,
  `show_instagram_section` TINYINT(1) DEFAULT 1,
  `home_carousel` LONGTEXT DEFAULT NULL,
  `home_categories` LONGTEXT DEFAULT NULL,
  `empaque_regalo_precio` DECIMAL(10,2) DEFAULT 0.00,
  `perfume_lujo_nombre` VARCHAR(120) DEFAULT 'Perfumero de lujo (5ml)',
  `empaque_regalo_image_url` VARCHAR(500) DEFAULT NULL,
  `promotions_fab_clicks` INT(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. PromocionProductos
CREATE TABLE IF NOT EXISTS `promocionproductos` (
  `promocion_id` BINARY(16) NOT NULL,
  `producto_id` BINARY(16) NOT NULL,
  PRIMARY KEY (`promocion_id`,`producto_id`),
  CONSTRAINT `promocionproductos_ibfk_1` FOREIGN KEY (`promocion_id`) REFERENCES `promociones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promocionproductos_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. HistorialPedido
CREATE TABLE IF NOT EXISTS `historial_pedido` (
  `id` BINARY(16) NOT NULL,
  `orden_id` BINARY(16) NOT NULL,
  `estado_anterior` VARCHAR(50) DEFAULT NULL,
  `estado_nuevo` VARCHAR(50) NOT NULL,
  `admin_id` BINARY(16) DEFAULT NULL,
  `observacion` TEXT DEFAULT NULL,
  `cambio_en` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `historial_pedido_ibfk_1` FOREIGN KEY (`orden_id`) REFERENCES `ordenes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `historial_pedido_ibfk_2` FOREIGN KEY (`admin_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. AdminAuditLogs
CREATE TABLE `admin_audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` BINARY(16) DEFAULT NULL,
  `action` varchar(255) NOT NULL,
  `entity_type` varchar(50) NOT NULL,
  `entity_id` varchar(255) DEFAULT NULL,
  `old_values` longtext DEFAULT NULL,
  `new_values` longtext DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `admin_audit_logs_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. AuthSecurityEvents
CREATE TABLE `authsecurityevents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` BINARY(16) DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `severity` enum('info','warning','critical') NOT NULL DEFAULT 'info',
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `metadata` longtext DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `authsecurityevents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. CartSessions
CREATE TABLE `cartsessions` (
  `session_id` varchar(128) NOT NULL,
  `user_id` BINARY(16) DEFAULT NULL,
  `cart_data` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `abandoned_email_sent` tinyint(1) DEFAULT 0,
  `last_active` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`session_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `cartsessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. OrderEmailLogs
CREATE TABLE `orderemaillogs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` BINARY(16) DEFAULT NULL,
  `template_slug` varchar(100) NOT NULL,
  `recipient_email` varchar(255) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `status` enum('sent','failed','queued') NOT NULL DEFAULT 'queued',
  `error_message` text DEFAULT NULL,
  `sent_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `orderemaillogs_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `ordenes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. OrderEmailTemplates
CREATE TABLE `orderemailtemplates` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `slug` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `subject_template` varchar(255) NOT NULL,
  `body_html` longtext NOT NULL,
  `body_text` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 18. ProductViewEvents
CREATE TABLE `productviewevents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` BINARY(16) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `product_id` BINARY(16) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `productviewevents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `productviewevents_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 19. PromocionUsuarios
CREATE TABLE IF NOT EXISTS `promocionusuarios` (
  `promocion_id` BINARY(16) NOT NULL,
  `usuario_id` BINARY(16) NOT NULL,
  PRIMARY KEY (`promocion_id`,`usuario_id`),
  CONSTRAINT `promocionusuarios_ibfk_1` FOREIGN KEY (`promocion_id`) REFERENCES `promociones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promocionusuarios_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 20. RecomendacionEventos
CREATE TABLE `recomendacioneventos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` BINARY(16) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `payload` longtext DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `recomendacioneventos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 21. SearchEvents
CREATE TABLE `searchevents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` BINARY(16) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `query` varchar(255) NOT NULL,
  `product_ids` longtext DEFAULT NULL,
  `results_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `searchevents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 22. SchemaMigrations
CREATE TABLE IF NOT EXISTS `schema_migrations` (
  `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `filename` VARCHAR(255) NOT NULL,
  `applied_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_schema_migrations_filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
