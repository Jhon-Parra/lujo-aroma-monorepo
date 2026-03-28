-- ---------------------------------------------------------
-- Lujo & Aroma - Refresh token rotation storage
-- PostgreSQL / Supabase
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGSERIAL PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  token_hash VARCHAR(128) NOT NULL,
  replaced_by_hash VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  ip VARCHAR(64),
  user_agent VARCHAR(300)
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_hash_uq
  ON refresh_tokens(token_hash);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
  ON refresh_tokens(user_id);
