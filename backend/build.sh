#!/usr/bin/env bash
# Render build: install the backend, build the frontend into backend/static.
set -euo pipefail
cd "$(dirname "$0")"

pip install -r requirements.txt

(cd ../frontend && npm ci && npm run build)
rm -rf static
cp -r ../frontend/dist static
