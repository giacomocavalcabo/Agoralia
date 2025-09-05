# Railway setup and database reset

## Prerequisites
- Railway CLI installed
- Dockerfile-based deployment enabled

---

## Service 1 (application backend)

1) Link the project
```bash
railway login
railway link -p 2ec0f5d8-2c7a-42a7-a78c-4168138e03e9
```

2) Build & Deploy (Railway will detect Dockerfile)
- Ensure `Dockerfile` exists at repo root
- Leave Custom Start Command empty (Dockerfile CMD is used)
- Healthcheck path: `/health`

Dockerfile used
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

3) Environment variables
- DATABASE_URL (internal Postgres)
- JWT_SECRET (random secret)
- REDIS_URL (optional)

---

## Database reset & verification
See DB reset steps above. Verify tables after first boot:
```bash
psql "$DATABASE_PUBLIC_URL" -c "\\dt"
```

---

## Backend API (minimal starter)
- POST /api/auth/register → creates user + workspace (admin)
- PATCH /api/user/update → update name/password
- PATCH /api/workspace/update → rename workspace (admin)
- GET /health → healthcheck

Examples in previous section.

