#!/usr/bin/env bash
# Starts the two processes:
#   agent  (127.0.0.1:8001) — no PayPal credentials in its environment
#   leash  (0.0.0.0:$PORT)  — the only process holding PayPal credentials
set -euo pipefail
cd "$(dirname "$0")"

# Local dev: read .env into this shell. On Render, secrets are already env vars.
if [ -f .env ]; then
  set -a; source .env; set +a
fi

AGENT_PORT="${AGENT_PORT:-8001}"
PORT="${PORT:-8000}"

# The agent gets the Groq and Channel3 keys, and nothing that can move money.
env -u PAYPAL_CLIENT_ID -u PAYPAL_CLIENT_SECRET -u PAYPAL_BASE_URL -u MANDATE_SIGNING_SECRET \
  python -m uvicorn agents.service:app --host 127.0.0.1 --port "$AGENT_PORT" &
AGENT_PID=$!
trap 'kill $AGENT_PID 2>/dev/null || true' EXIT

# The Leash service doesn't need the Channel3 key; only the agent searches.
AGENT_SERVICE_URL="http://127.0.0.1:${AGENT_PORT}" \
  env -u CHANNEL3_API_KEY python -m uvicorn api.main:app --host 0.0.0.0 --port "$PORT"
