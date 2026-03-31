-- ---------------------------------------------------------
-- Base de Datos: Supabase (PostgreSQL) - Migración del e-commerce Lujo & Aroma
-- Convertido desde init.sql
-- ---------------------------------------------------------

-- Extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------
-- Tabla: Usuarios
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Usuarios (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    supabase_user_id UUID,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    segmento VARCHAR(100),
    rol VARCHAR(50) DEFAULT 'CUSTOMER' NOT NULL CHECK (
        rol IN (
            'ADMIN',
            'SUPERADMIN',
            'CUSTOMER',
            'PRODUCTOS',
            'VENTAS'
        )
    ),
    foto_perfil VARCHAR(500) DEFAULT 'https://api.dicebear.com/7.x/initials/svg?seed=USER',
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_email_format CHECK (email LIKE '%_@__%.__%')
);

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_supabase_user_id_unique ON Usuarios (supabase_user_id);

-- ---------------------------------------------------------
-- Tabla: Promociones
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Promociones (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    imagen_url VARCHAR(500),
    porcentaje_descuento DECIMAL(5, 2) NOT NULL CHECK (
        porcentaje_descuento >= 0
        AND porcentaje_descuento <= 100
    ),

    -- Descuentos avanzados
    discount_type VARCHAR(10) NOT NULL DEFAULT 'PERCENT' CHECK (discount_type IN ('PERCENT', 'AMOUNT')),
    amount_discount DECIMAL(10, 2) CHECK (amount_discount IS NULL OR amount_discount >= 0),
    priority INT NOT NULL DEFAULT 0,

    fecha_inicio TIMESTAMP NOT NULL,
    fecha_fin TIMESTAMP NOT NULL,
    product_scope VARCHAR(20) NOT NULL DEFAULT 'GLOBAL' CHECK (product_scope IN ('GLOBAL', 'SPECIFIC', 'GENDER')),
    -- product_gender se usa como slug de categoria cuando product_scope = 'GENDER'
    product_gender VARCHAR(120),
    audience_scope VARCHAR(20) NOT NULL DEFAULT 'ALL' CHECK (audience_scope IN ('ALL', 'SEGMENT', 'CUSTOMERS')),
    audience_segment VARCHAR(100),
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fechas CHECK (fecha_fin > fecha_inicio)
);

-- ---------------------------------------------------------
-- Tabla: Productos
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Productos (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    notas_olfativas VARCHAR(255),
    precio DECIMAL(10, 2) NOT NULL CHECK (precio >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    unidades_vendidas INT NOT NULL DEFAULT 0 CHECK (unidades_vendidas >= 0),
    imagen_url VARCHAR(500),
    es_nuevo BOOLEAN DEFAULT false,
    nuevo_hasta TIMESTAMPTZ,
    promocion_id UUID NULL,
    -- slug de categoria (antes genero)
    genero VARCHAR(120),
    casa VARCHAR(120),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_producto_promocion FOREIGN KEY (promocion_id) REFERENCES Promociones (id) ON DELETE SET NULL
);

-- ---------------------------------------------------------
-- Tabla: Categorias
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Categorias (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS categorias_nombre_unique_ci ON Categorias (LOWER(nombre));
CREATE UNIQUE INDEX IF NOT EXISTS categorias_slug_unique_ci ON Categorias (LOWER(slug));

-- ---------------------------------------------------------
-- Tabla: PromocionProductos (Asignación producto/promoción)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS PromocionProductos (
    promocion_id UUID NOT NULL,
    producto_id UUID NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (promocion_id, producto_id),
    CONSTRAINT fk_pp_promocion FOREIGN KEY (promocion_id) REFERENCES Promociones (id) ON DELETE CASCADE,
    CONSTRAINT fk_pp_producto FOREIGN KEY (producto_id) REFERENCES Productos (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Tabla: PromocionUsuarios (Asignación usuario/promoción)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS PromocionUsuarios (
    promocion_id UUID NOT NULL,
    usuario_id UUID NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (promocion_id, usuario_id),
    CONSTRAINT fk_pu_promocion FOREIGN KEY (promocion_id) REFERENCES Promociones (id) ON DELETE CASCADE,
    CONSTRAINT fk_pu_usuario FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) ON DELETE CASCADE
);

-- ---------------------------------------------------------
-- Tabla: Ordenes
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Ordenes (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    usuario_id UUID NOT NULL,
    total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
    estado VARCHAR(50) DEFAULT 'PENDIENTE' NOT NULL CHECK (
        estado IN (
            'PENDIENTE',
            'PAGADO',
            'PROCESANDO',
            'ENVIADO',
            'ENTREGADO',
            'CANCELADO'
        )
    ),
    direccion_envio TEXT NOT NULL,
    codigo_transaccion VARCHAR(255),
    subtotal_productos DECIMAL(10, 2) DEFAULT 0,
    envio_prioritario BOOLEAN DEFAULT false,
    costo_envio_prioritario DECIMAL(10, 2) DEFAULT 0,
    perfume_lujo BOOLEAN DEFAULT false,
    costo_perfume_lujo DECIMAL(10, 2) DEFAULT 0,
    cart_recovery_applied BOOLEAN DEFAULT false,
    cart_recovery_discount_pct INT DEFAULT 0,
    cart_recovery_discount_amount DECIMAL(10, 2) DEFAULT 0,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orden_usuario FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------
-- Tabla: Detalle_Ordenes
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Detalle_Ordenes (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    orden_id UUID NOT NULL,
    producto_id UUID NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    CONSTRAINT fk_detalle_orden FOREIGN KEY (orden_id) REFERENCES Ordenes (id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES Productos (id) ON DELETE RESTRICT
);

-- ---------------------------------------------------------
-- Tabla: RecomendacionEventos (IA)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS RecomendacionEventos (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    usuario_id UUID NULL,
    session_id VARCHAR(120) NULL,
    event_type VARCHAR(60) NOT NULL,
    payload JSONB NULL,
    user_agent TEXT NULL,
    creado_en TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reco_eventos_usuario ON RecomendacionEventos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reco_eventos_session ON RecomendacionEventos(session_id);
CREATE INDEX IF NOT EXISTS idx_reco_eventos_tipo ON RecomendacionEventos(event_type);
CREATE INDEX IF NOT EXISTS idx_reco_eventos_creado ON RecomendacionEventos(creado_en);

-- ---------------------------------------------------------
-- Tabla: ConfiguracionGlobal
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ConfiguracionGlobal (
    id INT DEFAULT 1 PRIMARY KEY CHECK (id = 1),
    hero_title VARCHAR(255) DEFAULT 'La Esencia del Lujo',
    hero_subtitle TEXT DEFAULT 'Descubre colecciones exclusivas creadas por maestros perfumistas de todo el mundo.',
    accent_color VARCHAR(20) DEFAULT '#c379ac',
    show_banner BOOLEAN DEFAULT true,
    banner_text VARCHAR(255) DEFAULT 'ENVÍO GRATIS EN PEDIDOS SUPERIORES 4000',
    banner_accent_color VARCHAR(50) DEFAULT '#C2A878',
    hero_image_url VARCHAR(500) DEFAULT '/assets/images/logo.png',

    -- Hero multimedia (cuando se usa video/gif/imagen desde admin)
    hero_media_type VARCHAR(20) DEFAULT 'image',
    hero_media_url VARCHAR(500),

    logo_url VARCHAR(500),
    logo_height_mobile INT DEFAULT 96,
    logo_height_desktop INT DEFAULT 112,

    instagram_url VARCHAR(500),
    show_instagram_section BOOLEAN DEFAULT TRUE,
    instagram_access_token VARCHAR(500),
    facebook_url VARCHAR(500),
    whatsapp_number VARCHAR(40),
    whatsapp_message VARCHAR(255),

    -- Extras checkout
    envio_prioritario_precio DECIMAL(10, 2) DEFAULT 0,
    perfume_lujo_precio DECIMAL(10, 2) DEFAULT 0,
    envio_prioritario_image_url VARCHAR(500),
    perfume_lujo_image_url VARCHAR(500),

    email_from_name VARCHAR(120),
    email_from_address VARCHAR(200),
    email_reply_to VARCHAR(200),
    email_bcc_orders VARCHAR(500),

    -- Info de boutique (footer / contacto)
    boutique_title VARCHAR(120) DEFAULT 'Nuestra Boutique',
    boutique_address_line1 VARCHAR(200) DEFAULT 'Calle 12 #13-85',
    boutique_address_line2 VARCHAR(200) DEFAULT 'Bogotá, Colombia',
    boutique_phone VARCHAR(60) DEFAULT '+57 (300) 123-4567',
    boutique_email VARCHAR(200) DEFAULT 'contacto@lujo_aroma.com',

    -- Datos del vendedor (pagos manuales)
    seller_bank_name VARCHAR(120) DEFAULT '',
    seller_bank_account_type VARCHAR(40) DEFAULT '',
    seller_bank_account_number VARCHAR(60) DEFAULT '',
    seller_bank_account_holder VARCHAR(120) DEFAULT '',
    seller_bank_account_id VARCHAR(40) DEFAULT '',
    seller_nequi_number VARCHAR(30) DEFAULT '',
    seller_payment_notes VARCHAR(500) DEFAULT ''

    ,
    -- Wompi (configurable desde admin; no guardar llaves privadas)
    wompi_env VARCHAR(20) DEFAULT 'sandbox',
    wompi_public_key VARCHAR(200) DEFAULT '',
    wompi_private_key_enc TEXT,
    wompi_private_key_iv VARCHAR(80),
    wompi_private_key_tag VARCHAR(80)

    ,
    -- Permisos por rol (RBAC)
    role_permissions JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE IF EXISTS ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS smtp_host VARCHAR(255),
    ADD COLUMN IF NOT EXISTS smtp_port INT,
    ADD COLUMN IF NOT EXISTS smtp_secure BOOLEAN,
    ADD COLUMN IF NOT EXISTS smtp_user VARCHAR(200),
    ADD COLUMN IF NOT EXISTS smtp_from VARCHAR(255),
    ADD COLUMN IF NOT EXISTS smtp_pass_enc TEXT,
    ADD COLUMN IF NOT EXISTS smtp_pass_iv VARCHAR(255),
    ADD COLUMN IF NOT EXISTS smtp_pass_tag VARCHAR(255);

ALTER TABLE IF EXISTS ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS alert_sales_delta_pct INT DEFAULT 20,
    ADD COLUMN IF NOT EXISTS alert_abandoned_delta_pct INT DEFAULT 20,
    ADD COLUMN IF NOT EXISTS alert_abandoned_value_threshold DECIMAL(12, 2) DEFAULT 1000000,
    ADD COLUMN IF NOT EXISTS alert_negative_reviews_threshold INT DEFAULT 3,
    ADD COLUMN IF NOT EXISTS alert_trend_growth_pct INT DEFAULT 30,
    ADD COLUMN IF NOT EXISTS alert_trend_min_units INT DEFAULT 5,
    ADD COLUMN IF NOT EXISTS alert_failed_login_threshold INT DEFAULT 5,
    ADD COLUMN IF NOT EXISTS alert_abandoned_hours INT DEFAULT 24,
    ADD COLUMN IF NOT EXISTS cart_recovery_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cart_recovery_message TEXT,
    ADD COLUMN IF NOT EXISTS cart_recovery_discount_pct INT DEFAULT 10,
    ADD COLUMN IF NOT EXISTS cart_recovery_countdown_seconds INT DEFAULT 120,
    ADD COLUMN IF NOT EXISTS cart_recovery_button_text VARCHAR(60);

ALTER TABLE IF EXISTS ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS home_carousel JSONB,
    ADD COLUMN IF NOT EXISTS home_categories JSONB;

ALTER TABLE IF EXISTS ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS promotions_fab_clicks INT DEFAULT 0;

-- ---------------------------------------------------------
-- Tabla: OrderEmailTemplates (plantillas de correo por estado)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS OrderEmailTemplates (
    status VARCHAR(50) PRIMARY KEY,
    subject VARCHAR(200) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_email_templates_status
    ON OrderEmailTemplates(status);

-- ---------------------------------------------------------
-- Tabla: OrderEmailLogs (auditoria de envios)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS OrderEmailLogs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id UUID,
    status VARCHAR(50) NOT NULL,
    to_email VARCHAR(200) NOT NULL,
    from_email VARCHAR(200),
    subject VARCHAR(200),
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_email_logs_order_id
    ON OrderEmailLogs(order_id);

CREATE INDEX IF NOT EXISTS idx_order_email_logs_created_at
    ON OrderEmailLogs(created_at);

-- ---------------------------------------------------------
-- Tabla: Favoritos
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Favoritos (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    usuario_id UUID NOT NULL,
    producto_id UUID NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_favorito_usuario FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_favorito_producto FOREIGN KEY (producto_id) REFERENCES Productos (id) ON DELETE CASCADE,
    CONSTRAINT uk_favorito_usuario_producto UNIQUE (usuario_id, producto_id)
);

-- ---------------------------------------------------------
-- Índices para Optimización
-- ---------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_producto_nombre ON Productos (nombre);

CREATE INDEX IF NOT EXISTS idx_ordenes_usuario ON Ordenes (usuario_id);

CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON Ordenes (estado);

CREATE INDEX IF NOT EXISTS idx_favoritos_usuario ON Favoritos (usuario_id);

-- ---------------------------------------------------------
-- Tabla: Resenas (solo compras verificadas)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Resenas (
    id UUID DEFAULT uuid_generate_v4 () PRIMARY KEY,
    usuario_id UUID NOT NULL,
    producto_id UUID NOT NULL,
    orden_id UUID,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comentario TEXT,
    verificada BOOLEAN DEFAULT true,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_resena_usuario FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) ON DELETE CASCADE,
    CONSTRAINT fk_resena_producto FOREIGN KEY (producto_id) REFERENCES Productos (id) ON DELETE CASCADE,
    CONSTRAINT fk_resena_orden FOREIGN KEY (orden_id) REFERENCES Ordenes (id) ON DELETE SET NULL,
    CONSTRAINT uk_resena_usuario_producto UNIQUE (usuario_id, producto_id)
);

CREATE INDEX IF NOT EXISTS idx_resenas_producto ON Resenas (producto_id);

-- ---------------------------------------------------------
-- Tabla: SearchEvents (busquedas)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS SearchEvents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NULL,
    session_id VARCHAR(80) NULL,
    query TEXT NOT NULL,
    product_ids JSONB,
    results_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_events_created_at ON SearchEvents(created_at);
CREATE INDEX IF NOT EXISTS idx_search_events_user_id ON SearchEvents(user_id);

-- ---------------------------------------------------------
-- Tabla: ProductViewEvents (vistas de producto)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ProductViewEvents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NULL,
    session_id VARCHAR(80) NULL,
    product_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_product_view_product FOREIGN KEY (product_id) REFERENCES Productos (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_product_views_created_at ON ProductViewEvents(created_at);
CREATE INDEX IF NOT EXISTS idx_product_views_product_id ON ProductViewEvents(product_id);

-- ---------------------------------------------------------
-- Tabla: CartSessions (carritos)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS CartSessions (
    session_id VARCHAR(80) PRIMARY KEY,
    user_id UUID NULL,
    items JSONB NOT NULL,
    total NUMERIC(12, 2) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CONVERTED', 'ABANDONED')),
    order_id UUID NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES Usuarios (id) ON DELETE SET NULL,
    CONSTRAINT fk_cart_order FOREIGN KEY (order_id) REFERENCES Ordenes (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cart_sessions_updated_at ON CartSessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_cart_sessions_status ON CartSessions(status);

-- ---------------------------------------------------------
-- Tabla: AuthSecurityEvents (seguridad)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS AuthSecurityEvents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email VARCHAR(150),
    ip TEXT,
    user_agent TEXT,
    event_type VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_security_events_created_at ON AuthSecurityEvents(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_security_events_email ON AuthSecurityEvents(email);
