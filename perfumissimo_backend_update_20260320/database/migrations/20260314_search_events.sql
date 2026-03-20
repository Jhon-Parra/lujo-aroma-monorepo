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
