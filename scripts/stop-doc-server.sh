#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$ROOT_DIR/logs"

PID_FILE="$LOG_DIR/doc-server.pid"

if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "停止 DocServer (PID: $PID)..."
        kill -TERM "$PID" 2>/dev/null || true
        sleep 1
        if kill -0 "$PID" 2>/dev/null; then
            kill -KILL "$PID" 2>/dev/null || true
        fi
        echo "DocServer 已停止"
    else
        echo "DocServer 未运行"
    fi
    rm -f "$PID_FILE"
else
    # Fallback: kill by port
    PIDS=$(lsof -tiTCP:8002 -sTCP:LISTEN 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "停止 DocServer (端口 8002)..."
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
        echo "DocServer 已停止"
    else
        echo "DocServer 未运行"
    fi
fi
