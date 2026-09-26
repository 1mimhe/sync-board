#!/bin/sh
# docker/entrypoint.sh — Production app entrypoint.
# Generates RSA key pair when key files are absent, then execs the app.
set -e

KEYS_DIR="${JWT_KEYS_DIR:-/app/keys}"
PRIVATE_KEY="$KEYS_DIR/private.pem"
PUBLIC_KEY="$KEYS_DIR/public.pem"

if [ ! -f "$PRIVATE_KEY" ] || [ ! -f "$PUBLIC_KEY" ]; then
  echo "[entrypoint] JWT key files not found — generating RSA-2048 pair..."
  mkdir -p "$KEYS_DIR"
  openssl genrsa -out "$PRIVATE_KEY" 2048
  openssl rsa -in "$PRIVATE_KEY" -pubout -out "$PUBLIC_KEY"
  echo "[entrypoint] Key pair written to $KEYS_DIR"
fi

exec "$@"
