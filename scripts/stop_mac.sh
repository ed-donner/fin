#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="finally"

# Stop and remove container, keep volume (idempotent)
docker rm -f "$CONTAINER_NAME" &>/dev/null || true

echo "FinAlly stopped."
