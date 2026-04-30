#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

LOG_DIR="$ROOT_DIR/logs"
mkdir -p "$LOG_DIR"

cd "$ROOT_DIR/doc_server"

# Check if already running
if lsof -tiTCP:8002 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "DocServer 已在运行 (端口 8002)"
    exit 0
fi

echo "启动 DocServer (端口 8002)..."
PYTHONPATH="$ROOT_DIR" uv run uvicorn doc_server.main:app --port 8002 > "$LOG_DIR/doc-server.log" 2>&1 &
echo $! > "$LOG_DIR/doc-server.pid"
echo "DocServer 已启动，PID: $!"
echo "日志: $LOG_DIR/doc-server.log"
