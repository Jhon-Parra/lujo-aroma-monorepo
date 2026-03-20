ALTER TABLE IF EXISTS Usuarios
    ADD COLUMN IF NOT EXISTS supabase_user_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS usuarios_supabase_user_id_unique
    ON Usuarios (supabase_user_id);
