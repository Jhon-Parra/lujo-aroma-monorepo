# Database Migrations

This repo contains migrations for multiple database setups.

## MySQL / MariaDB (current backend)

Canonical folder: `backend/database/migrations/mysql/`

Run (from backend container or locally):

```bash
npx ts-node src/scripts/run-migrations.ts
```

The script will:

- Execute the curated MySQL migration list.
- Track applied files in `schema_migrations`.
- Ignore common "already exists" errors (duplicate column/index/table).

## PostgreSQL / Supabase (legacy/alternative)

Many `.sql` files in `backend/database/migrations/` are written for PostgreSQL/Supabase.
Do not execute them against MySQL.
