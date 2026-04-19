Supabase setup for Overthrone

1) Link and authenticate
- supabase login

2) Apply SQL files (creates tables and seed data)
- ./scripts/supabase-apply-sql.sh

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
