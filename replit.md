# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **WebSockets**: ws library for real-time updates
- **Frontend**: React + Vite + Tailwind CSS + Wouter routing
- **UI**: Radix UI components, Framer Motion, Recharts

## Project: Overthrone by ISTE

A real-time medieval kingdom warfare competition platform for 3-4 hour events.

### Game Mechanics
- **Teams**: Register/login, start with 10,000 HP and 0 AP
- **Epochs**: 15-minute rounds (configurable), 16 total epochs
- **Cards**: Task, Attack, Alliance, Backstab, Suspicion
- **Tasks**: Math, CTF, Algorithm, Sudoku puzzles earning AP rewards
- **Alliances**: Two teams can merge territories and solve tasks simultaneously
- **Real-time**: WebSocket broadcasts + React Query polling

### Admin Account
- Team name: `ISTE Admin`
- Password: `admin123`

### Key Files
- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — Database schema (teams, tasks, game state, alliances, events)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/` — Auth, WebSocket, game event utilities
- `artifacts/overthrone/src/` — React frontend

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
