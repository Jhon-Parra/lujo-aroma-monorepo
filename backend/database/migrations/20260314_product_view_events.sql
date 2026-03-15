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
