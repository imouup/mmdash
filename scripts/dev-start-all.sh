#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  开发模式启动 - 清理缓存后启动"
echo "========================================"
echo ""

# 1. 清理 Next.js 缓存
echo "[清理] 清理 Next.js 缓存 (.next/)..."
rm -rf "$ROOT_DIR/frontend/.next"
echo "  → .next/ 已清理"

# 2. 清理 frontend node_modules/.cache（如果有）
if [ -d "$ROOT_DIR/frontend/node_modules/.cache" ]; then
    echo "[清理] 清理 frontend node_modules/.cache..."
    rm -rf "$ROOT_DIR/frontend/node_modules/.cache"
    echo "  → node_modules/.cache 已清理"
fi

echo ""
echo "========================================"
echo "  缓存清理完成，调用 start-all"
echo "========================================"
echo ""

# 3. 调用 start-all.sh
exec "$SCRIPT_DIR/start-all.sh"
