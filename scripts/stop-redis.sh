#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
REDIS_CLI="$ROOT_DIR/redis/bin/redis-cli"

if [[ ! -f "$REDIS_CLI" ]]; then
    echo "redis-cli not found. Please run ./scripts/download-redis.sh first."
    exit 1
fi

echo "Stopping Redis server..."
"$REDIS_CLI" shutdown
