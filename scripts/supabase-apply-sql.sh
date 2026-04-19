#!/usr/bin/env bash
set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "Supabase CLI is required. Install it first."
  exit 1
fi

PROJECT_REF="${SUPABASE_PROJECT_REF:-esbmtfhloqjzktpvemjq}"
MIGRATION_FILE="supabase/migrations/202604190001_init_schema.sql"

mkdir -p supabase/migrations
cat supabase/sql/001_schema.sql supabase/sql/002_seed.sql supabase/sql/003_post_setup.sql > "$MIGRATION_FILE"

echo "Linking Supabase project: $PROJECT_REF"
supabase link --project-ref "$PROJECT_REF"

echo "Pushing migrations to remote database"
supabase db push --linked

echo "Done."
