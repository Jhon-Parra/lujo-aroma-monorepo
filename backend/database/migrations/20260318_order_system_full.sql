-- =====================================================================
-- MIGRACIÓN: Sistema Completo de Pedidos v2
-- Fecha: 2026-03-18
-- Descripción: Añade campos de snapshot, pago, envíos e historial
-- =====================================================================

-- ── 1. COLUMNAS NUEVAS EN ordenes ────────────────────────────────────
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS telefono VARCHAR(20) NULL AFTER direccion_envio,
  ADD COLUMN IF NOT EXISTS nombre_cliente VARCHAR(255) NULL AFTER usuario_id,
  ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50) NULL AFTER codigo_transaccion,
  ADD COLUMN IF NOT EXISTS canal_pago VARCHAR(50) NULL AFTER metodo_pago,
  ADD COLUMN IF NOT EXISTS estado_pago ENUM('PENDIENTE','APROBADO','RECHAZADO','CANCELADO') NOT NULL DEFAULT 'PENDIENTE' AFTER canal_pago,
  ADD COLUMN IF NOT EXISTS referencia_pago VARCHAR(255) NULL AFTER estado_pago,
  ADD COLUMN IF NOT EXISTS fecha_pago TIMESTAMP NULL AFTER referencia_pago;

-- ── 2. COLUMNAS NUEVAS EN detalleordenes (snapshots congelados) ───────
ALTER TABLE detalleordenes
  ADD COLUMN IF NOT EXISTS nombre_producto VARCHAR(255) NULL AFTER producto_id,
  ADD COLUMN IF NOT EXISTS imagen_url VARCHAR(500) NULL AFTER nombre_producto,
  ADD COLUMN IF NOT EXISTS subtotal_snapshot DECIMAL(15,2) NULL AFTER precio_unitario;

-- ── 3. TABLA envios (relación 1:1 con ordenes) ───────────────────────
CREATE TABLE IF NOT EXISTS envios (
  id VARCHAR(36) NOT NULL,
  orden_id VARCHAR(36) NOT NULL,
  transportadora VARCHAR(100) NOT NULL,
  numero_guia VARCHAR(100) NOT NULL,
  fecha_envio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  link_rastreo VARCHAR(500) NULL,
  observacion TEXT NULL,
  admin_id VARCHAR(36) NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_envio_orden (orden_id),
  KEY idx_envio_orden (orden_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. TABLA historial_pedido (trazabilidad completa) ─────────────────
CREATE TABLE IF NOT EXISTS historial_pedido (
  id VARCHAR(36) NOT NULL,
  orden_id VARCHAR(36) NOT NULL,
  estado_anterior VARCHAR(50) NULL,
  estado_nuevo VARCHAR(50) NOT NULL,
  cambio_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  admin_id VARCHAR(36) NULL,
  observacion TEXT NULL,
  PRIMARY KEY (id),
  KEY idx_hist_orden (orden_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
