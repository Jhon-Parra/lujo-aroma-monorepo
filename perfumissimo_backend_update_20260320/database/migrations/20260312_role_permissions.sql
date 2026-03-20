-- Permisos por rol (RBAC) almacenados como JSONB

ALTER TABLE ConfiguracionGlobal
    ADD COLUMN IF NOT EXISTS role_permissions JSONB DEFAULT '{}'::jsonb;
