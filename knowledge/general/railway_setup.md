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

---

## 6) Variables snapshot (masked) and how to re-fetch

Service 1 (application) — current variables (masked values)
- ADMIN_EMAILS: giacomo.cavalcabo14@gmail.com
- ADMIN_EMAIL_ALLOWLIST: giacomo.cavalcabo14@gmail.com
- AGORALIA_WEBHOOK_SECRET: ********
- APP_BASE_URL: https://api.agoralia.app
- APP_KMS_KEY: ********
- APP_SESSION_SECRET: ********
- AUTO_LOGIN_AFTER_REGISTER: true
- AUTO_MIGRATE: 1
- COOKIE_DOMAIN: .agoralia.app
- CORS_ALLOWED_ORIGINS: https://app.agoralia.com,https://agoralia.com,https://agoralia.vercel.app
- CRM_HUBSPOT_CLIENT_ID: ********
- CRM_HUBSPOT_CLIENT_SECRET: ********
- CRM_HUBSPOT_REDIRECT_URI: https://app.agoralia.app/api/crm/oauth/callback
- CRM_HUBSPOT_SCOPES: oauth crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write
- CRM_HUBSPOT_WEBHOOK_SECRET: ********
- CRM_ZOHO_CLIENT_ID: ********
- CRM_ZOHO_CLIENT_SECRET: ********
- CRM_ZOHO_DC: eu
- CRM_ZOHO_REDIRECT_URI: https://api.agoralia.app/crm/zoho/callback
- DATABASE_URL: postgresql://postgres:********@postgres.railway.internal:5432/railway
- DEFAULT_FROM_NUMBER: +12025551234
- DEMO_ADMIN_EMAILS: giacomo.cavalcabo14@gmail.com
- EMAIL_PROVIDER: mailersend
- ENABLE_CRM_SYNC: true
- ENABLE_METRICS: true
- ENABLE_POLLING: true
- ENABLE_WEBHOOKS: true
- ENCRYPTION_KEY: ********
- ENV: production
- FRONTEND_ALLOWED_ORIGINS: https://app.agoralia.app,https://www.agoralia.app
- FRONTEND_ALLOWED_ORIGIN_REGEX: ^https://agoralia-git-[a-z0-9\-]+-streetfire99s-projects\.vercel\.app$
- FRONTEND_BASE_URL: https://app.agoralia.app
- FRONTEND_ORIGIN: https://agoralia.vercel.app
- GOOGLE_REDIRECT_URI: https://api.agoralia.app/auth/oauth/google/callback
- JWT_SECRET: ********
- MAILERSEND_API_KEY: ********
- MS_REDIRECT_URI: https://api.agoralia.app/auth/oauth/microsoft/callback
- OAUTH_GOOGLE_CLIENT_ID: ********
- OAUTH_GOOGLE_CLIENT_SECRET: ********
- OAUTH_MS_CLIENT_ID: ********
- OAUTH_MS_CLIENT_SECRET: ********
- OAUTH_MS_TENANT: common
- OAUTH_STATE_SECRET: ********
- OPENAI_API_KEY: ********
- PROMETHEUS_MULTIPROC_DIR: /tmp
- PYTHONPATH: /app/backend
- RAILWAY_ENVIRONMENT: production
- RAILWAY_ENVIRONMENT_ID: b7d30f04-3af9-43e5-a313-cbec25c1337c
- RAILWAY_ENVIRONMENT_NAME: production
- RAILWAY_PRIVATE_DOMAIN: agoralia.railway.internal
- RAILWAY_PROJECT_ID: 2ec0f5d8-2c7a-42a7-a78c-4168138e03e9
- RAILWAY_PROJECT_NAME: Progetto 1 - API (FastAPI)
- RAILWAY_PUBLIC_DOMAIN: api.agoralia.app
- RAILWAY_SERVICE_ID: 28b34b42-8286-4e34-be2f-2ffea8ab7bd3
- RAILWAY_SERVICE_NAME: Service 1
- RAILWAY_SERVICE_SERVICE_1_URL: api.agoralia.app
- RAILWAY_STATIC_URL: api.agoralia.app
- REDIS_URL: redis://default:@maglev.proxy.rlwy.net:45825
- RETELL_API_KEY: ********
- RETELL_WEBHOOK_SECRET: https://service-1-production.up.railway.app/webhooks/retell
- SECRET_KEY: ********
- SEND_EMAILS: false
- SESSION_COOKIE_NAME: ag_sess
- SESSION_SECRET: ********
- SESSION_TTL_DAYS: 14
- SESSION_TTL_SECONDS: 2592000
- STRIPE_SECRET_KEY: ********
- STRIPE_WEBHOOK_SECRET: ********
- VITE_STRIPE_PUBLISHABLE_KEY: ********
- VITE_WS_URL: (empty)

Postgres service — current variables (masked values)
- DATABASE_URL: postgresql://postgres:********@postgres.railway.internal:5432/railway
- DATABASE_PUBLIC_URL: postgresql://postgres:********@shinkansen.proxy.rlwy.net:27637/railway
- PGHOST: postgres.railway.internal
- PGPORT: 5432
- PGUSER: postgres
- PGPASSWORD: ********
- PGDATABASE: railway
- POSTGRES_USER: postgres
- POSTGRES_PASSWORD: ********
- POSTGRES_DB: railway
- RAILWAY_PRIVATE_DOMAIN: postgres.railway.internal
- RAILWAY_TCP_PROXY_DOMAIN: shinkansen.proxy.rlwy.net
- RAILWAY_TCP_PROXY_PORT: 27637

How to re-fetch variables at any time
```bash
# Service 1
railway link -p 2ec0f5d8-2c7a-42a7-a78c-4168138e03e9
railway service        # select "Service 1"
railway variables      # pretty table
railway variables --kv # KEY=VALUE (avoid committing secrets)

# Postgres service
railway service        # select "Postgres"
railway variables
railway run -- printenv DATABASE_URL
railway run -- printenv DATABASE_PUBLIC_URL
```

Security note
- Do NOT commit plaintext secrets. This snapshot is masked; always use the CLI to view real values when needed.

---

## 7) Worker service (optional)
We added a placeholder service "Worker" inside the same project (Service 1) to keep topology unified.

Disable the worker (recommended for now)
- Via UI: set Replicas = 0 for the Worker service OR set Start Command to a no-op like:
  - tail -f /dev/null
  - bash -c "sleep infinity"

CLI caveat
- railway scale flags may error depending on region flag parsing; prefer UI for scaling to 0.

Later, when a real Python worker is needed
- Recreate a backend worker with proper start command (e.g., dramatiq …) and required env (e.g., REDIS_URL).

---

## 8) Verification checklist (current state)
- Database (Postgres): schema empty
  - Command: `psql "$DATABASE_PUBLIC_URL" -c "\\dt"`
  - Result: `Did not find any relations.`
- Redis: configured
  - `REDIS_PUBLIC_URL` present on Redis service
  - `REDIS_URL` set on Service 1 (private networking preferred)
- Worker: disabled
  - No active deployments for Worker service (keep replicas 0 or no-op start)

