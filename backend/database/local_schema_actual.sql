-- MySQL dump 10.13  Distrib 8.2.0, for macos13 (arm64)
--
-- Host: 127.0.0.1    Database: lujo_aroma
-- ------------------------------------------------------
-- Server version	5.5.5-10.4.28-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_audit_logs`
--

DROP TABLE IF EXISTS `admin_audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_audit_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `actor_user_id` varchar(36) NOT NULL,
  `action` varchar(255) NOT NULL,
  `target` varchar(255) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `ip` varchar(50) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `actor_user_id` (`actor_user_id`),
  CONSTRAINT `admin_audit_logs_ibfk_1` FOREIGN KEY (`actor_user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `authsecurityevents`
--

DROP TABLE IF EXISTS `authsecurityevents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `authsecurityevents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `event_type` varchar(50) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `ip` varchar(50) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `success` tinyint(1) DEFAULT 0,
  `user_id` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `authsecurityevents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `cartsessions`
--

DROP TABLE IF EXISTS `cartsessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cartsessions` (
  `session_id` varchar(255) NOT NULL,
  `user_id` varchar(36) DEFAULT NULL,
  `items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`items`)),
  `total` decimal(15,2) DEFAULT 0.00,
  `status` varchar(50) NOT NULL DEFAULT 'OPEN',
  `order_id` varchar(36) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`session_id`),
  KEY `user_id` (`user_id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `cartsessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `cartsessions_ibfk_2` FOREIGN KEY (`order_id`) REFERENCES `ordenes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `categorias`
--

DROP TABLE IF EXISTS `categorias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `categorias` (
  `id` varchar(36) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `configuracionglobal`
--

DROP TABLE IF EXISTS `configuracionglobal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `configuracionglobal` (
  `id` int(11) NOT NULL DEFAULT 1,
  `hero_title` varchar(255) DEFAULT NULL,
  `hero_subtitle` text DEFAULT NULL,
  `accent_color` varchar(50) DEFAULT NULL,
  `show_banner` tinyint(1) DEFAULT 1,
  `banner_text` varchar(255) DEFAULT NULL,
  `hero_image_url` varchar(500) DEFAULT '/assets/images/hero_bg.webp',
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `instagram_url` varchar(500) DEFAULT NULL,
  `facebook_url` varchar(500) DEFAULT NULL,
  `whatsapp_number` varchar(50) DEFAULT NULL,
  `whatsapp_message` varchar(500) DEFAULT NULL,
  `instagram_access_token` varchar(500) DEFAULT NULL,
  `logo_url` varchar(500) DEFAULT NULL,
  `logo_height_mobile` int(11) DEFAULT 96,
  `logo_height_desktop` int(11) DEFAULT 112,
  `email_from_name` varchar(100) DEFAULT NULL,
  `email_from_address` varchar(100) DEFAULT NULL,
  `email_reply_to` varchar(100) DEFAULT NULL,
  `email_bcc_orders` varchar(100) DEFAULT NULL,
  `boutique_title` varchar(255) DEFAULT 'Nuestra Boutique',
  `boutique_address_line1` varchar(255) DEFAULT 'Calle 12 #13-85',
  `boutique_address_line2` varchar(255) DEFAULT 'Bogotá, Colombia',
  `boutique_phone` varchar(50) DEFAULT '+57 (300) 123-4567',
  `boutique_email` varchar(100) DEFAULT 'contacto@lujo_aroma.com',
  `role_permissions` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`role_permissions`)),
  `seller_bank_name` varchar(100) DEFAULT '',
  `seller_bank_account_type` varchar(50) DEFAULT '',
  `seller_bank_account_number` varchar(50) DEFAULT '',
  `seller_bank_account_holder` varchar(100) DEFAULT '',
  `seller_bank_account_id` varchar(50) DEFAULT '',
  `seller_nequi_number` varchar(50) DEFAULT '',
  `seller_payment_notes` text DEFAULT NULL,
  `wompi_env` varchar(20) DEFAULT 'sandbox',
  `wompi_public_key` varchar(255) DEFAULT '',
  `wompi_private_key_enc` text DEFAULT NULL,
  `wompi_private_key_iv` varchar(255) DEFAULT NULL,
  `wompi_private_key_tag` varchar(255) DEFAULT NULL,
  `hero_media_type` varchar(20) DEFAULT 'image',
  `hero_media_url` varchar(500) DEFAULT NULL,
  `envio_prioritario_precio` decimal(15,2) DEFAULT 0.00,
  `perfume_lujo_precio` decimal(15,2) DEFAULT 0.00,
  `envio_prioritario_image_url` varchar(500) DEFAULT NULL,
  `perfume_lujo_image_url` varchar(500) DEFAULT NULL,
  `banner_accent_color` varchar(50) DEFAULT '#C2A878',
  `smtp_host` varchar(255) DEFAULT NULL,
  `smtp_port` int(11) DEFAULT NULL,
  `smtp_secure` tinyint(1) DEFAULT NULL,
  `smtp_user` varchar(255) DEFAULT NULL,
  `smtp_from` varchar(255) DEFAULT NULL,
  `smtp_pass_enc` text DEFAULT NULL,
  `smtp_pass_iv` varchar(255) DEFAULT NULL,
  `smtp_pass_tag` varchar(255) DEFAULT NULL,
  `tiktok_url` varchar(500) DEFAULT NULL,
  `alert_sales_delta_pct` int(11) DEFAULT 20,
  `alert_abandoned_delta_pct` int(11) DEFAULT 20,
  `alert_abandoned_value_threshold` decimal(15,2) DEFAULT 1000000.00,
  `alert_negative_reviews_threshold` int(11) DEFAULT 3,
  `alert_trend_growth_pct` int(11) DEFAULT 30,
  `alert_trend_min_units` int(11) DEFAULT 5,
  `alert_failed_login_threshold` int(11) DEFAULT 5,
  `alert_abandoned_hours` int(11) DEFAULT 24,
  `cart_recovery_enabled` tinyint(1) DEFAULT 0,
  `cart_recovery_message` text DEFAULT NULL,
  `cart_recovery_discount_pct` int(11) DEFAULT 10,
  `cart_recovery_countdown_seconds` int(11) DEFAULT 120,
  `cart_recovery_button_text` varchar(255) DEFAULT NULL,
  `show_instagram_section` tinyint(1) DEFAULT 1,
  `home_carousel` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`home_carousel`)),
  `home_categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`home_categories`)),
  `empaque_regalo_precio` decimal(10,2) DEFAULT 0.00,
  `perfume_lujo_nombre` varchar(120) DEFAULT 'Perfumero de lujo (5ml)',
  `empaque_regalo_image_url` varchar(500) DEFAULT NULL,
  `promotions_fab_clicks` int(11) DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `detalleordenes`
--

DROP TABLE IF EXISTS `detalleordenes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `detalleordenes` (
  `id` varchar(36) NOT NULL,
  `orden_id` varchar(36) NOT NULL,
  `producto_id` varchar(36) NOT NULL,
  `cantidad` int(11) NOT NULL,
  `precio_unitario` decimal(15,2) NOT NULL,
  `subtotal` decimal(15,2) GENERATED ALWAYS AS (`cantidad` * `precio_unitario`) STORED,
  `nombre_producto` varchar(255) DEFAULT NULL,
  `imagen_url` text DEFAULT NULL,
  `subtotal_snapshot` decimal(15,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `orden_id` (`orden_id`),
  KEY `producto_id` (`producto_id`),
  CONSTRAINT `detalleordenes_ibfk_1` FOREIGN KEY (`orden_id`) REFERENCES `ordenes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `detalleordenes_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `envios`
--

DROP TABLE IF EXISTS `envios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `envios` (
  `id` varchar(36) NOT NULL,
  `orden_id` varchar(36) NOT NULL,
  `transportadora` varchar(100) NOT NULL,
  `numero_guia` varchar(100) NOT NULL,
  `fecha_envio` datetime DEFAULT current_timestamp(),
  `link_rastreo` text DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `admin_id` varchar(36) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `orden_id` (`orden_id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `envios_ibfk_1` FOREIGN KEY (`orden_id`) REFERENCES `ordenes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `envios_ibfk_2` FOREIGN KEY (`admin_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `favoritos`
--

DROP TABLE IF EXISTS `favoritos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `favoritos` (
  `id` varchar(36) NOT NULL,
  `usuario_id` varchar(36) NOT NULL,
  `producto_id` varchar(36) NOT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuario_id` (`usuario_id`,`producto_id`),
  KEY `producto_id` (`producto_id`),
  CONSTRAINT `favoritos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `favoritos_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `historial_pedido`
--

DROP TABLE IF EXISTS `historial_pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `historial_pedido` (
  `id` varchar(36) NOT NULL,
  `orden_id` varchar(36) NOT NULL,
  `estado_anterior` varchar(50) DEFAULT NULL,
  `estado_nuevo` varchar(50) NOT NULL,
  `admin_id` varchar(36) DEFAULT NULL,
  `observacion` text DEFAULT NULL,
  `cambio_en` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `orden_id` (`orden_id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `historial_pedido_ibfk_1` FOREIGN KEY (`orden_id`) REFERENCES `ordenes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `historial_pedido_ibfk_2` FOREIGN KEY (`admin_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `ordenes`
--

DROP TABLE IF EXISTS `ordenes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ordenes` (
  `id` varchar(36) NOT NULL,
  `usuario_id` varchar(36) NOT NULL,
  `total` decimal(15,2) NOT NULL,
  `estado` enum('PENDIENTE','PAGADO','PROCESANDO','ENVIADO','ENTREGADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
  `direccion_envio` text NOT NULL,
  `codigo_transaccion` varchar(255) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `subtotal_productos` decimal(15,2) DEFAULT 0.00,
  `envio_prioritario` tinyint(1) DEFAULT 0,
  `costo_envio_prioritario` decimal(15,2) DEFAULT 0.00,
  `perfume_lujo` tinyint(1) DEFAULT 0,
  `costo_perfume_lujo` decimal(15,2) DEFAULT 0.00,
  `cart_recovery_applied` tinyint(1) DEFAULT 0,
  `cart_recovery_discount_pct` int(11) DEFAULT 0,
  `cart_recovery_discount_amount` decimal(15,2) DEFAULT 0.00,
  `telefono` varchar(50) DEFAULT NULL,
  `nombre_cliente` varchar(255) DEFAULT NULL,
  `metodo_pago` varchar(100) DEFAULT NULL,
  `canal_pago` varchar(100) DEFAULT NULL,
  `estado_pago` varchar(50) DEFAULT 'PENDIENTE',
  `referencia_pago` varchar(255) DEFAULT NULL,
  `empaque_regalo` tinyint(1) DEFAULT 0 COMMENT 'El cliente eligió empaque de regalo',
  `costo_empaque_regalo` decimal(10,2) DEFAULT 0.00 COMMENT 'Costo del empaque de regalo al momento del pedido',
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `ordenes_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orderemaillogs`
--

DROP TABLE IF EXISTS `orderemaillogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orderemaillogs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` varchar(36) NOT NULL,
  `status` varchar(50) NOT NULL,
  `to_email` varchar(255) NOT NULL,
  `from_email` varchar(255) DEFAULT NULL,
  `subject` varchar(255) DEFAULT NULL,
  `success` tinyint(1) DEFAULT 0,
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  CONSTRAINT `orderemaillogs_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `ordenes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `orderemailtemplates`
--

DROP TABLE IF EXISTS `orderemailtemplates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orderemailtemplates` (
  `status` varchar(50) NOT NULL,
  `subject` varchar(255) NOT NULL,
  `body_html` mediumtext DEFAULT NULL,
  `body_text` mediumtext DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `productos`
--

DROP TABLE IF EXISTS `productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productos` (
  `id` varchar(36) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `genero` varchar(100) DEFAULT 'unisex',
  `casa` varchar(120) DEFAULT NULL,
  `descripcion` text NOT NULL,
  `notas_olfativas` varchar(500) DEFAULT NULL,
  `precio` decimal(15,2) NOT NULL,
  `stock` int(11) NOT NULL DEFAULT 0,
  `unidades_vendidas` int(11) NOT NULL DEFAULT 0,
  `imagen_url` varchar(500) DEFAULT NULL,
  `imagen_url_2` varchar(500) DEFAULT NULL,
  `imagen_url_3` varchar(500) DEFAULT NULL,
  `promocion_id` varchar(36) DEFAULT NULL,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `es_nuevo` tinyint(1) DEFAULT 0,
  `nuevo_hasta` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_productos_casa` (`casa`),
  KEY `idx_productos_genero` (`genero`),
  KEY `idx_productos_stock` (`stock`),
  KEY `idx_productos_creado_en` (`creado_en`),
  KEY `idx_productos_promocion_id` (`promocion_id`),
  CONSTRAINT `productos_ibfk_1` FOREIGN KEY (`promocion_id`) REFERENCES `promociones` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `productviewevents`
--

DROP TABLE IF EXISTS `productviewevents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `productviewevents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(36) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `product_id` varchar(36) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `product_id` (`product_id`),
  CONSTRAINT `productviewevents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `productviewevents_ibfk_2` FOREIGN KEY (`product_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=21 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `promociones`
--

DROP TABLE IF EXISTS `promociones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promociones` (
  `id` varchar(36) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `porcentaje_descuento` decimal(5,2) NOT NULL DEFAULT 0.00,
  `fecha_inicio` datetime NOT NULL,
  `fecha_fin` datetime NOT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `product_scope` varchar(50) NOT NULL DEFAULT 'GLOBAL',
  `audience_scope` varchar(50) NOT NULL DEFAULT 'ALL',
  `audience_segment` varchar(100) DEFAULT NULL,
  `imagen_url` varchar(500) DEFAULT NULL,
  `product_gender` varchar(100) DEFAULT NULL,
  `discount_type` varchar(20) NOT NULL DEFAULT 'PERCENT',
  `amount_discount` decimal(15,2) DEFAULT NULL,
  `priority` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_promociones_activo_fechas` (`activo`,`fecha_inicio`,`fecha_fin`),
  KEY `idx_promociones_priority` (`priority`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `promocionproductos`
--

DROP TABLE IF EXISTS `promocionproductos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promocionproductos` (
  `promocion_id` varchar(36) NOT NULL,
  `producto_id` varchar(36) NOT NULL,
  PRIMARY KEY (`promocion_id`,`producto_id`),
  KEY `idx_promocionproductos_producto_id` (`producto_id`),
  CONSTRAINT `promocionproductos_ibfk_1` FOREIGN KEY (`promocion_id`) REFERENCES `promociones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promocionproductos_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `promocionusuarios`
--

DROP TABLE IF EXISTS `promocionusuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `promocionusuarios` (
  `promocion_id` varchar(36) NOT NULL,
  `usuario_id` varchar(36) NOT NULL,
  PRIMARY KEY (`promocion_id`,`usuario_id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `promocionusuarios_ibfk_1` FOREIGN KEY (`promocion_id`) REFERENCES `promociones` (`id`) ON DELETE CASCADE,
  CONSTRAINT `promocionusuarios_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `recomendacioneventos`
--

DROP TABLE IF EXISTS `recomendacioneventos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `recomendacioneventos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `usuario_id` varchar(36) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `event_type` varchar(50) NOT NULL,
  `payload` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`payload`)),
  `user_agent` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `recomendacioneventos_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `resenas`
--

DROP TABLE IF EXISTS `resenas`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `resenas` (
  `id` varchar(36) NOT NULL,
  `usuario_id` varchar(36) NOT NULL,
  `producto_id` varchar(36) NOT NULL,
  `orden_id` varchar(36) DEFAULT NULL,
  `rating` int(11) NOT NULL,
  `comentario` text DEFAULT NULL,
  `verificada` tinyint(1) DEFAULT 1,
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `producto_id` (`producto_id`),
  KEY `orden_id` (`orden_id`),
  CONSTRAINT `resenas_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `resenas_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `productos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `resenas_ibfk_3` FOREIGN KEY (`orden_id`) REFERENCES `ordenes` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `schema_migrations`
--

DROP TABLE IF EXISTS `schema_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `schema_migrations` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `applied_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_schema_migrations_filename` (`filename`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `searchevents`
--

DROP TABLE IF EXISTS `searchevents`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `searchevents` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(36) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `query` varchar(255) NOT NULL,
  `product_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`product_ids`)),
  `results_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `searchevents_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `usuarios`
--

DROP TABLE IF EXISTS `usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuarios` (
  `id` varchar(36) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `apellido` varchar(255) NOT NULL,
  `telefono` varchar(50) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `rol` enum('SUPERADMIN','ADMIN','VENTAS','PRODUCTOS','CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
  `creado_en` timestamp NOT NULL DEFAULT current_timestamp(),
  `actualizado_en` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `foto_perfil` varchar(255) DEFAULT NULL,
  `segmento` varchar(100) DEFAULT NULL,
  `supabase_user_id` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-31 21:09:32
