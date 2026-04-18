#!/usr/bin/env bash
set -euo pipefail

supabase functions serve game-events-hook --env-file .env
