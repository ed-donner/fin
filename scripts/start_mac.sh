#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="finally"
IMAGE_NAME="finally"
PORT=8000

cd "$(dirname "$0")/.."

# Build if image doesn't exist or --build flag passed
if [[ "${1:-}" == "--build" ]] || ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "Building image..."
    docker build -t "$IMAGE_NAME" .
fi

# Stop existing container if running (idempotent)
docker rm -f "$CONTAINER_NAME" &>/dev/null || true

# Run container
docker run -d \
    --name "$CONTAINER_NAME" \
    -p "$PORT:8000" \
    -v finally-data:/app/db \
    --env-file .env \
    "$IMAGE_NAME"

echo "FinAlly running at http://localhost:$PORT"

# Open browser if on macOS
if command -v open &>/dev/null; then
    open "http://localhost:$PORT"
fi
