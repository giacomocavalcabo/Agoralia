# Progress Log

## 2025-09-05
- Reset repository to minimal scaffold (backend/frontend deploy files only)
- Created knowledge docs and DB reset SQL
- Unified Postgres service inside Service 1 on Railway
- Reset database schema via DATABASE_PUBLIC_URL and verified empty
- Set DATABASE_URL (private) on Service 1
- Added minimal i18n-enabled frontend (login + app info with phone)
- Switched i18n JSON to flat dotted keys grouped by cluster (en-US, it-IT)
- Updated translation guidelines to enforce clustering and flat keys
- Added minimal React JSX app with routing and i18n bootstrap (Login/AppInfo)
- Added Nixpacks config to build frontend and serve dist on $PORT
- Fix: Nixpacks install step uses `npm install` (not `npm ci`); ensured `serve` present as devDependency
- Added placeholder Worker service in Service 1 project; documented how to disable (replicas 0 or no-op start)
- Added Redis service and set REDIS_URL on Service 1
- Verification: DB empty, Redis configured, Worker disabled
- Updated Railway Start Command on Service 1 to: `npx --yes serve -s frontend/dist -l $PORT`
- Implemented minimal FastAPI backend (users, workspaces, memberships) with JWT auth
- Switched Nixpacks to Python backend start (`uvicorn backend.main:app`)
