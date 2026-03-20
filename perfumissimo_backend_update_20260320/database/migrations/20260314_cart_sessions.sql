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
