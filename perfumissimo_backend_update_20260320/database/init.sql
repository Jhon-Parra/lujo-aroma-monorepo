-- ---------------------------------------------------------
-- Base de Datos: Perfumissimo (E-commerce de Lujo)
-- ---------------------------------------------------------
CREATE DATABASE IF NOT EXISTS perfumissimo_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE perfumissimo_db;

-- ---------------------------------------------------------
-- Tabla: Usuarios
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Usuarios (
    id BINARY(16) DEFAULT(UUID_TO_BIN(UUID())) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('ADMIN', 'CUSTOMER') DEFAULT 'CUSTOMER' NOT NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_email_format CHECK (email LIKE '%_@__%.__%')
) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Tabla: Promociones
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Promociones (
    id BINARY(16) DEFAULT(UUID_TO_BIN(UUID())) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    porcentaje_descuento DECIMAL(5, 2) NOT NULL CHECK (
        porcentaje_descuento >= 0
        AND porcentaje_descuento <= 100
    ),
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_fechas CHECK (fecha_fin > fecha_inicio)
) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Tabla: Productos
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Productos (
    id BINARY(16) DEFAULT(UUID_TO_BIN(UUID())) PRIMARY KEY,
    nombre VARCHAR(200) NOT NULL,
    descripcion TEXT NOT NULL,
    notas_olfativas VARCHAR(255),
    precio DECIMAL(10, 2) NOT NULL CHECK (precio >= 0),
    stock INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    unidades_vendidas INT NOT NULL DEFAULT 0 CHECK (unidades_vendidas >= 0),
    imagen_url VARCHAR(500),
    promocion_id BINARY(16) NULL,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_producto_promocion FOREIGN KEY (promocion_id) REFERENCES Promociones (id) ON DELETE SET NULL
) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Tabla: Ordenes
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Ordenes (
    id BINARY(16) DEFAULT(UUID_TO_BIN(UUID())) PRIMARY KEY,
    usuario_id BINARY(16) NOT NULL,
    total DECIMAL(10, 2) NOT NULL CHECK (total >= 0),
    estado ENUM(
        'PENDIENTE',
        'PAGADO',
        'ENVIADO',
        'ENTREGADO',
        'CANCELADO'
    ) DEFAULT 'PENDIENTE' NOT NULL,
    direccion_envio TEXT NOT NULL,
    codigo_transaccion VARCHAR(255), -- Referencia de pasarela de pagos
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_orden_usuario FOREIGN KEY (usuario_id) REFERENCES Usuarios (id) ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Tabla: Detalle_Ordenes
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS Detalle_Ordenes (
    id BINARY(16) DEFAULT(UUID_TO_BIN(UUID())) PRIMARY KEY,
    orden_id BINARY(16) NOT NULL,
    producto_id BINARY(16) NOT NULL,
    cantidad INT NOT NULL CHECK (cantidad > 0),
    precio_unitario DECIMAL(10, 2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal DECIMAL(10, 2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    CONSTRAINT fk_detalle_orden FOREIGN KEY (orden_id) REFERENCES Ordenes (id) ON DELETE CASCADE,
    CONSTRAINT fk_detalle_producto FOREIGN KEY (producto_id) REFERENCES Productos (id) ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------
-- Índices para Optimización (Cumplimiento de reglas: Optimizar consultas)
-- ---------------------------------------------------------
CREATE INDEX idx_producto_nombre ON Productos (nombre);

CREATE INDEX idx_ordenes_usuario ON Ordenes (usuario_id);

CREATE INDEX idx_ordenes_estado ON Ordenes (estado);

-- Insertar Administrador por Defecto (Password deberá ser hasheada en la app Node.js)
-- El hash proporcionado es un ejemplo para 'Admin123$'. En producción esto debe cambiarse de inmediato.
INSERT INTO
    Usuarios (
        id,
        nombre,
        apellido,
        email,
        password_hash,
        rol
    )
VALUES (
        UUID_TO_BIN(UUID()),
        'Admin',
        'Sistema',
        'admin@perfumissimo.com',
        '$2b$10$w0aZlE.K/v8Fk6B1i.5bV.E0qK/2A7r4mZpG3gQ6jT9v5xK.6l1gq',
        'ADMIN'
    );