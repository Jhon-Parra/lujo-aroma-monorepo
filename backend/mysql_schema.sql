-- LUJO & AROMA MYSQL DATABASE SCHEMA
-- Export/Conversion Date: 2026-03-15

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Table: usuarios
DROP TABLE IF EXISTS usuarios;
CREATE TABLE usuarios (
    id VARCHAR(36) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    apellido VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('SUPERADMIN', 'ADMIN', 'VENTAS', 'PRODUCTOS', 'CUSTOMER') NOT NULL DEFAULT 'CUSTOMER',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    foto_perfil VARCHAR(255) DEFAULT NULL,
    segmento VARCHAR(100),
    supabase_user_id VARCHAR(36),
    PRIMARY KEY (id),
    UNIQUE KEY (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Table: categorias
DROP TABLE IF EXISTS categorias;
CREATE TABLE categorias (
    id VARCHAR(36) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY (nombre),
    UNIQUE KEY (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Table: promociones
DROP TABLE IF EXISTS promociones;
CREATE TABLE promociones (
    id VARCHAR(36) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    porcentaje_descuento DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    product_scope VARCHAR(50) NOT NULL DEFAULT 'GLOBAL',
    audience_scope VARCHAR(50) NOT NULL DEFAULT 'ALL',
    audience_segment VARCHAR(100),
    imagen_url VARCHAR(500),
    product_gender VARCHAR(100),
    discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENT',
    amount_discount DECIMAL(15,2),
    priority INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Table: productos
DROP TABLE IF EXISTS productos;
CREATE TABLE productos (
    id VARCHAR(36) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    genero VARCHAR(100) DEFAULT 'unisex',
    casa VARCHAR(120) DEFAULT NULL,
    descripcion TEXT NOT NULL,
    notas_olfativas VARCHAR(500),
    precio DECIMAL(15,2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    unidades_vendidas INTEGER NOT NULL DEFAULT 0,
    imagen_url VARCHAR(500),
    imagen_url_2 VARCHAR(500) DEFAULT NULL,
    imagen_url_3 VARCHAR(500) DEFAULT NULL,
    promocion_id VARCHAR(36),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    es_nuevo BOOLEAN DEFAULT FALSE,
    nuevo_hasta DATETIME,
    PRIMARY KEY (id),
    FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Table: ordenes
DROP TABLE IF EXISTS ordenes;
CREATE TABLE ordenes (
    id VARCHAR(36) NOT NULL,
    usuario_id VARCHAR(36) NOT NULL,
    total DECIMAL(15,2) NOT NULL,
    estado ENUM('PENDIENTE', 'PAGADO', 'PROCESANDO', 'ENVIADO', 'ENTREGADO', 'CANCELADO') NOT NULL DEFAULT 'PENDIENTE',
    direccion_envio TEXT NOT NULL,
    codigo_transaccion VARCHAR(255),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    subtotal_productos DECIMAL(15,2) DEFAULT 0.00,
    envio_prioritario BOOLEAN DEFAULT FALSE,
    costo_envio_prioritario DECIMAL(15,2) DEFAULT 0.00,
    perfume_lujo BOOLEAN DEFAULT FALSE,
    costo_perfume_lujo DECIMAL(15,2) DEFAULT 0.00,
    cart_recovery_applied BOOLEAN DEFAULT FALSE,
    cart_recovery_discount_pct INTEGER DEFAULT 0,
    cart_recovery_discount_amount DECIMAL(15,2) DEFAULT 0.00,
    PRIMARY KEY (id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Table: detalleordenes
DROP TABLE IF EXISTS detalleordenes;
CREATE TABLE detalleordenes (
    id VARCHAR(36) NOT NULL,
    orden_id VARCHAR(36) NOT NULL,
    producto_id VARCHAR(36) NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario DECIMAL(15,2) NOT NULL,
    subtotal DECIMAL(15,2) AS (cantidad * precio_unitario) STORED,
    PRIMARY KEY (id),
    FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Table: favoritos
DROP TABLE IF EXISTS favoritos;
CREATE TABLE favoritos (
    id VARCHAR(36) NOT NULL,
    usuario_id VARCHAR(36) NOT NULL,
    producto_id VARCHAR(36) NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY (usuario_id, producto_id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Table: resenas
DROP TABLE IF EXISTS resenas;
CREATE TABLE resenas (
    id VARCHAR(36) NOT NULL,
    usuario_id VARCHAR(36) NOT NULL,
    producto_id VARCHAR(36) NOT NULL,
    orden_id VARCHAR(36),
    rating INTEGER NOT NULL,
    comentario TEXT,
    verificada BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
    FOREIGN KEY (orden_id) REFERENCES ordenes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Table: configuracionglobal
DROP TABLE IF EXISTS configuracionglobal;
CREATE TABLE configuracionglobal (
    id INTEGER NOT NULL DEFAULT 1,
    hero_title VARCHAR(255),
    hero_subtitle TEXT,
    accent_color VARCHAR(50),
    show_banner BOOLEAN DEFAULT TRUE,
    banner_text VARCHAR(255),
    hero_image_url VARCHAR(500) DEFAULT '/assets/images/hero_bg.webp',
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    instagram_url VARCHAR(500),
    facebook_url VARCHAR(500),
    whatsapp_number VARCHAR(50),
    whatsapp_message VARCHAR(500),
    instagram_access_token VARCHAR(500),
    logo_url VARCHAR(500),
    logo_height_mobile INTEGER DEFAULT 96,
    logo_height_desktop INTEGER DEFAULT 112,
    email_from_name VARCHAR(100),
    email_from_address VARCHAR(100),
    email_reply_to VARCHAR(100),
    email_bcc_orders VARCHAR(100),
    boutique_title VARCHAR(255) DEFAULT 'Nuestra Boutique',
    boutique_address_line1 VARCHAR(255) DEFAULT 'Calle 12 #13-85',
    boutique_address_line2 VARCHAR(255) DEFAULT 'Bogotá, Colombia',
    boutique_phone VARCHAR(50) DEFAULT '+57 (300) 123-4567',
    boutique_email VARCHAR(100) DEFAULT 'contacto@lujo_aroma.com',
    role_permissions JSON,
    seller_bank_name VARCHAR(100) DEFAULT '',
    seller_bank_account_type VARCHAR(50) DEFAULT '',
    seller_bank_account_number VARCHAR(50) DEFAULT '',
    seller_bank_account_holder VARCHAR(100) DEFAULT '',
    seller_bank_account_id VARCHAR(50) DEFAULT '',
    seller_nequi_number VARCHAR(50) DEFAULT '',
    seller_payment_notes TEXT,
    wompi_env VARCHAR(20) DEFAULT 'sandbox',
    wompi_public_key VARCHAR(255) DEFAULT '',
    wompi_private_key_enc TEXT,
    wompi_private_key_iv VARCHAR(255),
    wompi_private_key_tag VARCHAR(255),
    hero_media_type VARCHAR(20) DEFAULT 'image',
    hero_media_url VARCHAR(500),
    envio_prioritario_precio DECIMAL(15,2) DEFAULT 0.00,
    perfume_lujo_precio DECIMAL(15,2) DEFAULT 0.00,
    envio_prioritario_image_url VARCHAR(500),
    perfume_lujo_image_url VARCHAR(500),
    banner_accent_color VARCHAR(50) DEFAULT '#C2A878',
    smtp_host VARCHAR(255),
    smtp_port INTEGER,
    smtp_secure BOOLEAN,
    smtp_user VARCHAR(255),
    smtp_from VARCHAR(255),
    smtp_pass_enc TEXT,
    smtp_pass_iv VARCHAR(255),
    smtp_pass_tag VARCHAR(255),
    tiktok_url VARCHAR(500),
    alert_sales_delta_pct INTEGER DEFAULT 20,
    alert_abandoned_delta_pct INTEGER DEFAULT 20,
    alert_abandoned_value_threshold DECIMAL(15,2) DEFAULT 1000000.00,
    alert_negative_reviews_threshold INTEGER DEFAULT 3,
    alert_trend_growth_pct INTEGER DEFAULT 30,
    alert_trend_min_units INTEGER DEFAULT 5,
    alert_failed_login_threshold INTEGER DEFAULT 5,
    alert_abandoned_hours INTEGER DEFAULT 24,
    cart_recovery_enabled BOOLEAN DEFAULT FALSE,
    cart_recovery_message TEXT,
    cart_recovery_discount_pct INTEGER DEFAULT 10,
    cart_recovery_countdown_seconds INTEGER DEFAULT 120,
    cart_recovery_button_text VARCHAR(255),
    show_instagram_section BOOLEAN DEFAULT TRUE,
    home_carousel JSON DEFAULT NULL,
    home_categories JSON DEFAULT NULL,
    promotions_fab_clicks INTEGER DEFAULT 0,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Table: cartsessions
DROP TABLE IF EXISTS cartsessions;
CREATE TABLE cartsessions (
    session_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(36),
    items JSON NOT NULL,
    total DECIMAL(15,2) DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'OPEN',
    order_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (session_id),
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES ordenes(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Table: promocionproductos
DROP TABLE IF EXISTS promocionproductos;
CREATE TABLE promocionproductos (
    promocion_id VARCHAR(36) NOT NULL,
    producto_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (promocion_id, producto_id),
    FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Table: promocionusuarios
DROP TABLE IF EXISTS promocionusuarios;
CREATE TABLE promocionusuarios (
    promocion_id VARCHAR(36) NOT NULL,
    usuario_id VARCHAR(36) NOT NULL,
    PRIMARY KEY (promocion_id, usuario_id),
    FOREIGN KEY (promocion_id) REFERENCES promociones(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Table: orderemailtemplates
DROP TABLE IF EXISTS orderemailtemplates;
CREATE TABLE orderemailtemplates (
    status VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html MEDIUMTEXT,
    body_text MEDIUMTEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Table: orderemaillogs
DROP TABLE IF EXISTS orderemaillogs;
CREATE TABLE orderemaillogs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id VARCHAR(36) NOT NULL,
    status VARCHAR(50) NOT NULL,
    to_email VARCHAR(255) NOT NULL,
    from_email VARCHAR(255),
    subject VARCHAR(255),
    success BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES ordenes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Event Tables (Intelligence)
DROP TABLE IF EXISTS searchevents;
CREATE TABLE searchevents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36),
    session_id VARCHAR(255),
    `query` VARCHAR(255) NOT NULL,
    product_ids JSON,
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS productviewevents;
CREATE TABLE productviewevents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36),
    session_id VARCHAR(255),
    product_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL,
    FOREIGN KEY (product_id) REFERENCES productos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS recomendacioneventos;
CREATE TABLE recomendacioneventos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id VARCHAR(36),
    session_id VARCHAR(255),
    event_type VARCHAR(50) NOT NULL,
    payload JSON,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS authsecurityevents;
CREATE TABLE authsecurityevents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    ip VARCHAR(50),
    user_agent TEXT,
    success BOOLEAN DEFAULT FALSE,
    user_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS admin_audit_logs;
CREATE TABLE admin_audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    actor_user_id VARCHAR(36) NOT NULL,
    action VARCHAR(255) NOT NULL,
    target VARCHAR(255),
    metadata JSON,
    ip VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_user_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- Seed initial data
INSERT IGNORE INTO configuracionglobal (id) VALUES (1);

-- Admin User Seed (Password: Admin123!)
INSERT IGNORE INTO usuarios (id, nombre, apellido, email, password_hash, rol)
VALUES (
    'f6f7e8a9-b0c1-4d2e-8f3a-4b5c6d7e8f9a', 
    'Admin', 
    'Lujo & Aroma', 
    'admin@lujo_aroma.com', 
    '$2b$10$mnX9cssrpnFN/xoiICcjLu2PTAO5EsqLRFmuSlKJOjU6BBy2IAdzO', 
    'SUPERADMIN'
);
