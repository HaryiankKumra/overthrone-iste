#!/usr/bin/env bash
set -euo pipefail

PROJECT_REF="${SUPABASE_PROJECT_REF:-esbmtfhloqjzktpvemjq}"

supabase link --project-ref "$PROJECT_REF"
supabase functions deploy game-events-hook --project-ref "$PROJECT_REF"
