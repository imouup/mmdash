#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
REDIS_SERVER="$ROOT_DIR/redis/bin/redis-server"
REDIS_CONF="$ROOT_DIR/redis/redis.conf"

if [[ ! -f "$REDIS_SERVER" ]]; then
    echo "Redis binary not found. Please run ./scripts/download-redis.sh first."
    exit 1
fi

echo "Starting Redis server..."
exec "$REDIS_SERVER" "$REDIS_CONF"
