#!/usr/bin/env bash
set -euo pipefail

# Download, compile and install Redis 7.x locally

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
REDIS_INSTALL_DIR="$ROOT_DIR/redis/bin"
REDIS_CONF_DIR="$ROOT_DIR/redis"
REDIS_DATA_DIR="$ROOT_DIR/redis/data"

REDIS_VERSION="7.4.2"
REDIS_URL="https://download.redis.io/releases/redis-${REDIS_VERSION}.tar.gz"
BUILD_DIR="/tmp/redis-build-$$"

echo "Downloading Redis ${REDIS_VERSION}..."
mkdir -p "$BUILD_DIR"
curl -fsSL "$REDIS_URL" -o "$BUILD_DIR/redis.tar.gz"

echo "Extracting..."
tar -xzf "$BUILD_DIR/redis.tar.gz" -C "$BUILD_DIR" --strip-components=1

echo "Building Redis..."
cd "$BUILD_DIR"
make -j"$(nproc)" MALLOC=libc

echo "Installing to $REDIS_INSTALL_DIR..."
mkdir -p "$REDIS_INSTALL_DIR"
cp "$BUILD_DIR/src/redis-server" "$REDIS_INSTALL_DIR/"
cp "$BUILD_DIR/src/redis-cli" "$REDIS_INSTALL_DIR/"
cp "$BUILD_DIR/src/redis-benchmark" "$REDIS_INSTALL_DIR/"
cp "$BUILD_DIR/src/redis-check-aof" "$REDIS_INSTALL_DIR/"
cp "$BUILD_DIR/src/redis-check-rdb" "$REDIS_INSTALL_DIR/"
cp "$BUILD_DIR/src/redis-sentinel" "$REDIS_INSTALL_DIR/"

echo "Creating directories..."
mkdir -p "$REDIS_DATA_DIR"

echo "Writing redis.conf..."
cat > "$REDIS_CONF_DIR/redis.conf" <<'EOF'
# Redis local configuration
daemonize no
port 6379
bind 127.0.0.1

# Data directory
dir ./redis/data

# Persistence
dbfilename dump.rdb
appendonly yes
appendfilename "appendonly.aof"

# Logging
loglevel notice

# Memory
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

echo "Cleaning up build files..."
rm -rf "$BUILD_DIR"

echo "Redis ${REDIS_VERSION} installed successfully to ${REDIS_INSTALL_DIR}"
echo "Run ./scripts/start-redis.sh to start the server"
