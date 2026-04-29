#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$ROOT_DIR/logs"

mkdir -p "$LOG_DIR"

PIDS=()
SERVICES=()

log_file() {
    echo "$LOG_DIR/$1.log"
}

cleanup() {
    echo ""
    echo "========================================"
    echo "  正在关闭所有服务..."
    echo "========================================"

    for i in "${!PIDS[@]}"; do
        local pid="${PIDS[$i]}"
        local name="${SERVICES[$i]}"
        if kill -0 "$pid" 2>/dev/null; then
            echo "  → 停止 $name (PID: $pid)"
            kill -TERM "$pid" 2>/dev/null || true
        fi
    done

    # Wait a bit then force kill any remaining
    sleep 1
    for i in "${!PIDS[@]}"; do
        local pid="${PIDS[$i]}"
        local name="${SERVICES[$i]}"
        if kill -0 "$pid" 2>/dev/null; then
            echo "  → 强制停止 $name (PID: $pid)"
            kill -KILL "$pid" 2>/dev/null || true
        fi
    done

    wait
    echo "  所有服务已停止"
    echo "  日志目录: $LOG_DIR"
    exit 0
}

trap cleanup INT TERM

echo "========================================"
echo "  数模Dashboard - 一键启动所有服务"
echo "========================================"
echo ""
echo "日志目录: $LOG_DIR"
echo "按 Ctrl+C 优雅退出"
echo ""

# 1. Redis
echo "[1/5] 启动 Redis..."
if [ ! -f "$ROOT_DIR/redis/bin/redis-server" ]; then
    echo "错误: Redis 未安装，请先运行 ./scripts/setup.sh"
    exit 1
fi
"$ROOT_DIR/redis/bin/redis-server" "$ROOT_DIR/redis/redis.conf" > "$(log_file redis)" 2>&1 &
PIDS+=($!)
SERVICES+=("Redis")
sleep 1

# 2. Backend
echo "[2/5] 启动 Backend (FastAPI)..."
cd "$ROOT_DIR/backend"
uv run uvicorn app.main:app --reload --port 8000 > "$(log_file backend)" 2>&1 &
PIDS+=($!)
SERVICES+=("Backend")
sleep 1

# 3. Cloud Agent
echo "[3/5] 启动 Cloud Agent..."
cd "$ROOT_DIR/cloud_agent"
uv run python main.py > "$(log_file cloud-agent)" 2>&1 &
PIDS+=($!)
SERVICES+=("CloudAgent")
sleep 1

# 4. Local Agent
echo "[4/5] 启动 Local Agent..."
cd "$ROOT_DIR/local_agent"
uv run python main.py > "$(log_file local-agent)" 2>&1 &
PIDS+=($!)
SERVICES+=("LocalAgent")
sleep 1

# 5. Frontend
echo "[5/5] 启动 Frontend (Next.js)..."
cd "$ROOT_DIR/frontend"
npm run dev > "$(log_file frontend)" 2>&1 &
PIDS+=($!)
SERVICES+=("Frontend")
sleep 2

echo ""
echo "========================================"
echo "  所有服务已启动"
echo "========================================"
echo ""
echo "  Redis:       http://localhost:6379"
echo "  Backend:     http://localhost:8000"
echo "  CloudAgent:  http://localhost:8001"
echo "  LocalAgent:  ws://127.0.0.1:8765"
echo "  Frontend:    http://localhost:3000"
echo ""
echo "按 Ctrl+C 停止所有服务"
echo ""

# Keep the script running
while true; do
    all_alive=true
    for i in "${!PIDS[@]}"; do
        if ! kill -0 "${PIDS[$i]}" 2>/dev/null; then
            echo "警告: ${SERVICES[$i]} 已退出"
            all_alive=false
        fi
    done
    if [ "$all_alive" = false ]; then
        echo ""
        echo "有服务异常退出，正在关闭其他服务..."
        cleanup
    fi
    sleep 3
done
