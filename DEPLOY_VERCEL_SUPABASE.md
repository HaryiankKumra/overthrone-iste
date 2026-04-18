# Overthrone Deploy Guide (Vercel + Supabase)

## 1) Supabase Setup

1. Create a Supabase project.
2. Open Settings -> Database and copy the Transaction Pooler connection string.
3. In your deployment env, set:
   - `DATABASE_URL` to pooler URL
   - `DATABASE_SSL=true`
   - `PG_POOL_MAX=10`
   - `PG_IDLE_TIMEOUT_MS=10000`
   - `PG_CONNECT_TIMEOUT_MS=5000`

## 2) Vercel Project Setup

1. Import this repository into Vercel.
2. Framework preset: Vite.
3. Root directory: repository root.
4. Build command: `pnpm --filter @workspace/overthrone run build`
5. Output directory: `artifacts/overthrone/dist/public`
6. Install command: `pnpm install --frozen-lockfile`

If Vercel shows `No entrypoint found in output directory`, it is running in Node.js mode.
Switch Framework Preset back to Vite (or clear overridden build settings) and redeploy.

## 3) Environment Variables in Vercel

Set these for Production (and Preview if needed):

- `DATABASE_URL`
- `DATABASE_SSL=true`
- `PG_POOL_MAX=10`
- `PG_IDLE_TIMEOUT_MS=10000`
- `PG_CONNECT_TIMEOUT_MS=5000`
- `SESSION_SECRET=<long-random-secret>`
- `CORS_ORIGINS=https://<your-vercel-domain>`
- `VITE_ENABLE_WEBSOCKET=false`
- `BASE_PATH=/`

## 4) Database Migration

Run migrations against Supabase before opening the event:

```bash
pnpm --filter @workspace/db run drizzle-kit push
```

If you use a different migration command in your workflow, run that equivalent command with the same `DATABASE_URL`.

## 5) Post-Deploy Checks

1. `GET /api/healthz` returns `ok`.
2. Team register/login works.
3. Task submit updates AP.
4. Alliance request/accept/backstab flow works.
5. Leaderboard and map refresh every 5s.

## 6) Notes for Event Traffic (100+ users)

- Keep DB pool small per function instance (`PG_POOL_MAX=10`), rely on Supabase pooler.
- Keep websocket disabled on Vercel and use polling (already configured).
- Avoid large payload logs in production; default logger is production-safe.
