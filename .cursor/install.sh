#!/usr/bin/env bash
# Idempotent repository bootstrap for Violet (API + frontend + MinIO).
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v mongod >/dev/null 2>&1; then
  echo "Installing MongoDB Community Server..."
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc \
    | sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor --yes
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
    | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y mongodb-org
fi

# MinIO (local S3-compatible object storage)
if ! command -v minio >/dev/null 2>&1; then
  echo "Installing MinIO server..."
  curl -fsSL https://dl.min.io/server/minio/release/linux-amd64/minio -o /tmp/minio
  sudo install /tmp/minio /usr/local/bin/minio
fi
if ! command -v mc >/dev/null 2>&1; then
  echo "Installing MinIO client (mc)..."
  curl -fsSL https://dl.min.io/client/mc/release/linux-amd64/mc -o /tmp/mc
  sudo install /tmp/mc /usr/local/bin/mc
fi

sudo mkdir -p /data/minio
sudo chown -R "$(id -u):$(id -g)" /data/minio

npm install
npm --prefix frontend install

if [ ! -f config/config.env ]; then
  echo "Creating config/config.env from config/config.env.example..."
  cp config/config.env.example config/config.env
fi

echo "install.sh complete."
