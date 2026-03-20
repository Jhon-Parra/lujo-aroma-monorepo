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
