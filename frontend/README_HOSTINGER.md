# Despliegue en Hostinger (Frontend + Backend)

Este documento describe como desplegar Perfumissimo con:
- Frontend estatico en Hostinger (public_html)
- Backend Node.js en Hostinger (hPanel > Node.js)

## Frontend (GitHub Actions + SFTP)

### 1) Secrets en GitHub
Repositorio: `perfumissimo-frontend`

En `Settings > Secrets and variables > Actions` crea:
- `SFTP_HOST` = `86.38.202.54`
- `SFTP_PORT` = `65002`
- `SFTP_USER` = `u498956148`
- `SFTP_PASS` = (tu password SFTP)
- `SFTP_REMOTE_PATH` = `/home/u498956148/domains/perfumissimocol.com/public_html`

### 2) Workflow
El workflow ya esta en:
`/.github/workflows/deploy-hostinger.yml`

Cada push a `main`:
1) `npm ci`
2) `npm run build`
3) Sube `dist/frontend` a `public_html`

## Backend (hPanel > Node.js)

### 1) Crear app Node.js
- Subdominio: `backend.perfumissimocol.com`
- Ruta: `/home/u498956148/domains/perfumissimocol.com/public_html/backend`

### 2) Conectar repo
Repo: `perfumissimo-backend`

### 3) Comandos
- Build: `npm install`
- Start: `npm run start`

### 4) Variables de entorno (minimas)
- `NODE_ENV=production`
- `FRONTEND_URL=https://perfumissimocol.com`
- `DATABASE_URL=...`
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `JWT_SECRET=...`
- `SMTP_*` (si envias emails)
- `WOMPI_*` (si usas pagos)

### 5) Migraciones
Ejecutar una vez:
```
npx ts-node src/scripts/run-migrations.ts
```

## Verificacion
1) Frontend: `https://perfumissimocol.com`
2) Backend: `https://backend.perfumissimocol.com/api/settings`
