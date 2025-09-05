# Railway setup and database reset

## Prerequisites
- Install Railway CLI

```bash
curl -fsSL https://railway.com/install.sh | sh
railway --version
```

---

## Service 1 (application backend/frontend)

1) Link the project
```bash
railway login  # opens browser if not already logged in
railway link -p 2ec0f5d8-2c7a-42a7-a78c-4168138e03e9
```

2) Deploy when ready
```bash
railway up
```

---

## Database (separate Railway project)

1) Link the database project
```bash
railway login  # only if needed
railway link -p 26648dd3-59c5-4bfe-8800-d25f113fda52
```

2) Show environment variables (look for DATABASE_URL)
```bash
railway variables
```

3) Reset database schema (DROP all tables)
- Save the following as scripts/db_reset.sql:
```sql
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

- Execute the reset using psql (requires psql installed locally):
```bash
# export DATABASE_URL first if not already present
export DATABASE_URL="<paste from railway variables>"
psql "$DATABASE_URL" -f scripts/db_reset.sql
```

4) Verify schema is empty (no user tables)
```bash
psql "$DATABASE_URL" -c "\\dt"
```

You should see: "Did not find any relations".

---

## Connect backend to database
- Ensure the backend uses the DATABASE_URL env var
- On Railway Service 1, set the environment variable and redeploy

```bash
railway link -p 2ec0f5d8-2c7a-42a7-a78c-4168138e03e9
railway variables set DATABASE_URL="<postgres url from DB project>"
railway up
```

Notes
- Never hard-code hosts; use environment variables and /api proxying on the frontend.
- Keep translations externalized; no hard-coded UI strings.

