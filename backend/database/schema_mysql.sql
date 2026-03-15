-- MySQL dump 10.13  Distrib 8.2.0, for macos13 (arm64)
--
-- Host: 127.0.0.1    Database: perfumissimo_db
-- ------------------------------------------------------
-- Server version	8.2.0

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
-- Table structure for table `ConfiguracionGlobal`
--

DROP TABLE IF EXISTS `ConfiguracionGlobal`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ConfiguracionGlobal` (
  `id` int NOT NULL DEFAULT '1',
  `hero_title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `hero_subtitle` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `accent_color` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `show_banner` tinyint(1) DEFAULT '1',
  `banner_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `hero_image_url` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT '/assets/images/hero_bg.webp',
  PRIMARY KEY (`id`),
  CONSTRAINT `configuracionglobal_chk_1` CHECK ((`id` = 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Detalle_Ordenes`
--

DROP TABLE IF EXISTS `Detalle_Ordenes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Detalle_Ordenes` (
  `id` binary(16) NOT NULL DEFAULT (uuid_to_bin(uuid())),
  `orden_id` binary(16) NOT NULL,
  `producto_id` binary(16) NOT NULL,
  `cantidad` int NOT NULL,
  `precio_unitario` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) GENERATED ALWAYS AS ((`cantidad` * `precio_unitario`)) STORED,
  PRIMARY KEY (`id`),
  KEY `fk_detalle_orden` (`orden_id`),
  KEY `fk_detalle_producto` (`producto_id`),
  CONSTRAINT `fk_detalle_orden` FOREIGN KEY (`orden_id`) REFERENCES `Ordenes` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_detalle_producto` FOREIGN KEY (`producto_id`) REFERENCES `Productos` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `detalle_ordenes_chk_1` CHECK ((`cantidad` > 0)),
  CONSTRAINT `detalle_ordenes_chk_2` CHECK ((`precio_unitario` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Ordenes`
--

DROP TABLE IF EXISTS `Ordenes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Ordenes` (
  `id` binary(16) NOT NULL DEFAULT (uuid_to_bin(uuid())),
  `usuario_id` binary(16) NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `estado` enum('PENDIENTE','PAGADO','ENVIADO','ENTREGADO','CANCELADO') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'PENDIENTE',
  `direccion_envio` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `codigo_transaccion` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ordenes_usuario` (`usuario_id`),
  KEY `idx_ordenes_estado` (`estado`),
  CONSTRAINT `fk_orden_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `Usuarios` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `ordenes_chk_1` CHECK ((`total` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Productos`
--

DROP TABLE IF EXISTS `Productos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Productos` (
  `id` binary(16) NOT NULL DEFAULT (uuid_to_bin(uuid())),
  `nombre` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `genero` enum('mujer','hombre','unisex') COLLATE utf8mb4_unicode_ci DEFAULT 'unisex',
  `descripcion` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notas_olfativas` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `precio` decimal(10,2) NOT NULL,
  `stock` int NOT NULL DEFAULT '0',
  `unidades_vendidas` int NOT NULL DEFAULT '0',
  `imagen_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `promocion_id` binary(16) DEFAULT NULL,
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_producto_promocion` (`promocion_id`),
  KEY `idx_producto_nombre` (`nombre`),
  CONSTRAINT `fk_producto_promocion` FOREIGN KEY (`promocion_id`) REFERENCES `Promociones` (`id`) ON DELETE SET NULL,
  CONSTRAINT `productos_chk_1` CHECK ((`precio` >= 0)),
  CONSTRAINT `productos_chk_2` CHECK ((`stock` >= 0)),
  CONSTRAINT `productos_chk_3` CHECK ((`unidades_vendidas` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Promociones`
--

DROP TABLE IF EXISTS `Promociones`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Promociones` (
  `id` binary(16) NOT NULL DEFAULT (uuid_to_bin(uuid())),
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `porcentaje_descuento` decimal(5,2) NOT NULL,
  `fecha_inicio` datetime NOT NULL,
  `fecha_fin` datetime NOT NULL,
  `activo` tinyint(1) DEFAULT '1',
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_fechas` CHECK ((`fecha_fin` > `fecha_inicio`)),
  CONSTRAINT `promociones_chk_1` CHECK (((`porcentaje_descuento` >= 0) and (`porcentaje_descuento` <= 100)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table `Usuarios`
--

DROP TABLE IF EXISTS `Usuarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Usuarios` (
  `id` binary(16) NOT NULL DEFAULT (uuid_to_bin(uuid())),
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `apellido` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `telefono` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rol` enum('SUPERADMIN','ADMIN','VENTAS','PRODUCTOS','CUSTOMER') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'CUSTOMER',
  `creado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `actualizado_en` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  CONSTRAINT `chk_email_format` CHECK ((`email` like _utf8mb4'%_@__%.__%'))
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

-- Dump completed on 2026-03-11  9:23:37
