# Railway setup (Unified: Service 1 + Postgres) and database reset

## Prerequisites
- Install Railway CLI
```bash
curl -fsSL https://railway.com/install.sh | sh
railway --version
```

---

## 1) Link Service 1 project (application)
```bash
railway login
railway link -p 2ec0f5d8-2c7a-42a7-a78c-4168138e03e9
railway status
# Expect:
# Project: Progetto 1 - API (FastAPI)
# Environment: production
```

---

## 2) Add Postgres as a service in the same project
```bash
railway add --database postgres --service Postgres
railway service        # select "Postgres"
railway variables      # shows DATABASE_URL and DATABASE_PUBLIC_URL for Postgres
```
Notes
- DATABASE_URL uses private networking host: postgres.railway.internal:5432 (for use inside Railway).
- DATABASE_PUBLIC_URL uses the public TCP proxy (for local tools like psql).

---

## 3) Reset database schema (drop all tables)
Create or reuse the SQL reset script:
```bash
# scripts/db_reset.sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

Run reset using the public proxy URL (works locally):
```bash
# Read DATABASE_PUBLIC_URL from Postgres service
railway run -- printenv DATABASE_PUBLIC_URL
export DATABASE_PUBLIC_URL="postgresql://...@shinkansen.proxy.rlwy.net:PORT/railway"

# Execute reset
psql "$DATABASE_PUBLIC_URL" -f scripts/db_reset.sql

# Verify empty schema
psql "$DATABASE_PUBLIC_URL" -c "\\dt"
# Expect: Did not find any relations.
```
Tip
- Private DNS (postgres.railway.internal) is not resolvable locally, so use DATABASE_PUBLIC_URL with psql. Inside Railway services, use DATABASE_URL.

---

## 4) Set DATABASE_URL on Service 1 (to use private networking)
```bash
# Select Service 1
railway service   # choose "Service 1"

# Set the env var using the internal Postgres URL
railway variables --set "DATABASE_URL=postgresql://postgres:***@postgres.railway.internal:5432/railway"

# Confirm it is set
railway variables | sed -n 's/^\s*DATABASE_URL\s*:\s*//p'
```

---

## 5) Deploy Service 1
```bash
railway up
```

---

## Quick commands reference
```bash
# Show current context
railway status

# Switch to Postgres service
railway service

# Print Postgres URLs
railway run -- printenv DATABASE_URL
railway run -- printenv DATABASE_PUBLIC_URL

# Reset DB again if needed
psql "$DATABASE_PUBLIC_URL" -f scripts/db_reset.sql
psql "$DATABASE_PUBLIC_URL" -c "\\dt"
```

Notes
- Keep environment variables in Railway; do not hard-code hosts in code.
- Frontend should proxy API calls via /api and use environment configuration.

