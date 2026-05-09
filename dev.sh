#!/usr/bin/env bash
# Local dev orchestrator: ensures SearXNG is up in Docker, then runs `next dev`
# with hot reload. Idempotent — reuses the searxng container across runs.

set -euo pipefail
cd "$(dirname "$0")"

red()    { printf "\033[31m%s\033[0m\n" "$*"; }
green()  { printf "\033[32m%s\033[0m\n" "$*"; }
yellow() { printf "\033[33m%s\033[0m\n" "$*"; }
blue()   { printf "\033[34m%s\033[0m\n" "$*"; }

if ! docker info >/dev/null 2>&1; then
  red "Docker daemon is not running. Start Docker Desktop and re-run."
  exit 1
fi

if [ "${1:-}" = "stop" ]; then
  if docker ps --format '{{.Names}}' | grep -q "^avgpt-searxng$"; then
    blue "→ Stopping SearXNG"
    docker stop avgpt-searxng >/dev/null
    green "✓ Stopped"
  else
    yellow "SearXNG not running"
  fi
  exit 0
fi

if [ ! -f .env ]; then
  red "Missing .env. Copy .env.example to .env and fill in values, then re-run."
  exit 1
fi

# --- SearXNG ------------------------------------------------------------------

SEARXNG_NAME="avgpt-searxng"
SEARXNG_PORT="${SEARXNG_PORT:-8080}"

if docker ps --format '{{.Names}}' | grep -q "^${SEARXNG_NAME}$"; then
  green "✓ SearXNG already running on :${SEARXNG_PORT}"
elif docker ps -a --format '{{.Names}}' | grep -q "^${SEARXNG_NAME}$"; then
  blue "→ Starting existing SearXNG container"
  docker start "${SEARXNG_NAME}" >/dev/null
else
  blue "→ Creating SearXNG container"
  docker run -d \
    --name "${SEARXNG_NAME}" \
    -p "${SEARXNG_PORT}:8080" \
    -v "$PWD/searxng:/etc/searxng" \
    --restart unless-stopped \
    searxng/searxng:latest >/dev/null
fi

printf "→ Waiting for SearXNG on :%s " "${SEARXNG_PORT}"
ready=0
for _ in $(seq 1 60); do
  if curl -fsS "http://localhost:${SEARXNG_PORT}/healthz" >/dev/null 2>&1; then
    ready=1
    break
  fi
  printf "."
  sleep 1
done
if [ "$ready" = "0" ]; then
  echo
  red "SearXNG didn't become healthy in 60s. Check: docker logs ${SEARXNG_NAME}"
  exit 1
fi
green "ready"

# --- avGPT --------------------------------------------------------------------

if [ ! -d node_modules ]; then
  blue "→ Installing dependencies"
  npm install
fi

# Tell the app where SearXNG lives if .env didn't.
export SEARXNG_URL="${SEARXNG_URL:-http://localhost:${SEARXNG_PORT}}"

echo
green "✓ Starting avGPT (hot reload) → http://localhost:3000"
yellow "  Ctrl-C stops the dev server. SearXNG keeps running in Docker."
yellow "  Run ./dev.sh stop to also stop SearXNG."
echo

exec npm run dev
