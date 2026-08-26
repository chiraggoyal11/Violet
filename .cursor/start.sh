#!/usr/bin/env bash
# Per-boot startup: MongoDB + MinIO readiness.
set -euo pipefail

sudo mkdir -p /data/db /var/log/mongodb /data/minio
sudo chown -R "$(id -u):$(id -g)" /data/db /var/log/mongodb /data/minio

if ! pgrep -x mongod >/dev/null 2>&1; then
  echo "Starting mongod..."
  mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 \
    --logpath /var/log/mongodb/mongod.log --logappend --fork
fi

for _ in $(seq 1 30); do
  if (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null; then
    exec 3>&- 3<&-
    echo "MongoDB is ready on 127.0.0.1:27017"
    break
  fi
  sleep 1
done

if ! (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null; then
  echo "MongoDB did not become ready in time" >&2
  exit 1
fi
exec 3>&- 3<&- || true

# Start MinIO if not already listening
if ! (exec 3<>/dev/tcp/127.0.0.1/9000) 2>/dev/null; then
  echo "Starting MinIO..."
  export MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
  export MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-minioadmin}"
  nohup minio server /data/minio --address 127.0.0.1:9000 --console-address 127.0.0.1:9001 \
    >/var/log/mongodb/minio.log 2>&1 &
fi

for _ in $(seq 1 30); do
  if (exec 3<>/dev/tcp/127.0.0.1/9000) 2>/dev/null; then
    exec 3>&- 3<&-
    echo "MinIO is ready on 127.0.0.1:9000"
    break
  fi
  sleep 1
done

if ! (exec 3<>/dev/tcp/127.0.0.1/9000) 2>/dev/null; then
  echo "MinIO did not become ready in time" >&2
  exit 1
fi
exec 3>&- 3<&- || true

# Ensure default bucket exists (idempotent)
if command -v mc >/dev/null 2>&1; then
  mc alias set violet-local http://127.0.0.1:9000 \
    "${MINIO_ROOT_USER:-minioadmin}" "${MINIO_ROOT_PASSWORD:-minioadmin}" >/dev/null
  mc mb -p violet-local/violet-products >/dev/null 2>&1 || true
fi

echo "Startup complete."
