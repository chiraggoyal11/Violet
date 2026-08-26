#!/usr/bin/env bash
# Idempotent repository bootstrap for Violet (API + frontend).
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

npm install
npm --prefix frontend install

if [ ! -f config/config.env ]; then
  echo "Creating config/config.env with local development defaults..."
  cat > config/config.env <<'EOF'
PORT=5000
MONGO=mongodb://127.0.0.1:27017/violet
jwtSecret=local_dev_jwt_secret_change_me
CORS_ORIGIN=http://localhost:5173

# AWS S3 (placeholder values for local dev; product image upload/read routes
# require real AWS credentials to function).
BUCKET_NAME=violet-local-dev
BUCKET_REGION=us-east-1
ACCESS_KEY=local-dev-access-key
SECRET_ACCESS_KEY=local-dev-secret-key
EOF
fi

echo "install.sh complete."
