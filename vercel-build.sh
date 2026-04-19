#!/usr/bin/env sh
set -eu

APP_DIR="artifacts/overthrone"
if [ -f "vite.config.ts" ] && [ -d "src" ]; then
  APP_DIR="."
fi

if [ "$APP_DIR" = "." ]; then
  pnpm run build
else
  pnpm --filter @workspace/overthrone run build
fi

rm -rf public
mkdir -p public

if [ -d "$APP_DIR/dist/public" ]; then
  cp -R "$APP_DIR/dist/public/." public/
elif [ -d "dist/public" ]; then
  cp -R dist/public/. public/
else
  echo "Build output directory not found"
  pwd
  ls -la
  ls -la artifacts/overthrone || true
  ls -la artifacts/overthrone/dist || true
  exit 1
fi
