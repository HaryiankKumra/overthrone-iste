#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

echo "Applying supabase/sql/001_schema.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/sql/001_schema.sql

echo "Applying supabase/sql/002_seed.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/sql/002_seed.sql

echo "Applying supabase/sql/003_post_setup.sql"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/sql/003_post_setup.sql

echo "Done."
