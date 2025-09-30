#!/usr/bin/env bash
set -euo pipefail

root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
pushd "$root_dir" >/dev/null

echo "Building chat client..."
npm run build -w client

echo "Launching chat server on http://localhost:4000 ..."
trap 'echo "\nStopping chat server..."; kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM
npm run dev -w server &
SERVER_PID=$!

wait "$SERVER_PID"
