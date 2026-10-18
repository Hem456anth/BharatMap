#!/bin/bash
# Restart the local API server on :8080 (dev/E2E helper).
cd "$(dirname "$0")/.."
PID=$(cat data/server.pid 2>/dev/null); [ -n "$PID" ] && kill "$PID" 2>/dev/null; sleep 0.5
mkdir -p data
PORT=8080 LOG_REQUESTS=0 nohup node --no-warnings server/index.js > data/server.log 2>&1 &
echo $! > data/server.pid; sleep 1.5; curl -s localhost:8080/api/health; echo
