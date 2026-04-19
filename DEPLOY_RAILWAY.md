# Overthrone Deploy Guide (Railway)

This repository is configured for a single Railway service that serves:
- API + WebSocket from the Express server
- Frontend static assets built from the Vite app

## 1) Create Railway Project

1. In Railway, create a new project from this GitHub repository.
2. Deploy from repository root.
3. Railway will detect [railway.json](railway.json) and use:
   - Build command: `pnpm run build:railway`
   - Start command: `pnpm run start:railway`
   - Health check: `/api/healthz`

## 2) Configure Environment Variables

Use [.env.railway.example](.env.railway.example) as template.
Required production variables:

- `DATABASE_URL`
- `DATABASE_SSL=true`
- `SESSION_SECRET`
- `CORS_ORIGINS=https://<your-railway-domain>`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Recommended pool settings:

- `PG_POOL_MAX=10`
- `PG_IDLE_TIMEOUT_MS=10000`
- `PG_CONNECT_TIMEOUT_MS=5000`

WebSocket note:

- `VITE_ENABLE_WEBSOCKET=false` is the safest default for scaled deployments.
- Set it to `true` only when running a single API instance.

## 3) Database Migration

Run migrations before opening the app to users:

```bash
pnpm --filter @workspace/db run push
```

If you use a different migration workflow, run the equivalent command against the same `DATABASE_URL`.

## 4) Post-Deploy Checks

1. `GET /api/healthz` returns `{"status":"ok"}`.
2. Frontend loads from the Railway domain.
3. Team register/login works.
4. Task submit updates AP.
5. Leaderboard and events update via polling (and websocket if enabled).

## 5) Troubleshooting

- If frontend is blank but API is healthy:
  - Confirm build logs include `@workspace/overthrone` build.
  - Confirm API logs include `Serving frontend static assets`.
- If API cannot connect to DB:
  - Verify `DATABASE_URL` and `DATABASE_SSL` values.
  - Check pool limits if you see connection saturation.
