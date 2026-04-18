Supabase setup for Overthrone

1) Link your project
- supabase login
- supabase link --project-ref esbmtfhloqjzktpvemjq

2) Apply SQL files
- psql "$DATABASE_URL" -f supabase/sql/001_schema.sql
- psql "$DATABASE_URL" -f supabase/sql/002_seed.sql
- psql "$DATABASE_URL" -f supabase/sql/003_post_setup.sql

3) Configure edge function secret
- supabase secrets set EDGE_SHARED_SECRET=your-long-random-secret

4) Run edge function locally
- supabase functions serve game-events-hook --env-file .env

5) Deploy edge function
- supabase functions deploy game-events-hook --project-ref esbmtfhloqjzktpvemjq

6) Test edge function
- curl -X POST "https://esbmtfhloqjzktpvemjq.functions.supabase.co/game-events-hook" \
  -H "Authorization: Bearer your-long-random-secret" \
  -H "Content-Type: application/json" \
  -d '{"type":"task_completed","description":"Smoke test"}'
