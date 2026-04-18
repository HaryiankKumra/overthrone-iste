# overthrone-iste

Real-time strategy game platform for ISTE events.

## Stack

- Frontend: React + Vite
- API: Express + TypeScript
- DB: PostgreSQL (Supabase) + Drizzle
- Realtime: WebSocket invalidation + polling

## Quick Start

1. Copy .env.example to .env and fill required values.
2. Install dependencies: pnpm install
3. Run API: pnpm --filter @workspace/api-server run dev
4. Run frontend: PORT=21379 BASE_PATH=/ pnpm --filter @workspace/overthrone run dev

## Supabase Setup

- SQL files: supabase/sql
- Edge functions: supabase/functions
- Deployment guide: DEPLOY_VERCEL_SUPABASE.md
