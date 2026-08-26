#!/usr/bin/env bash
# Per-boot startup: ensure MongoDB is running and accepting connections.
set -euo pipefail

sudo mkdir -p /data/db /var/log/mongodb
sudo chown -R "$(id -u):$(id -g)" /data/db /var/log/mongodb

if ! pgrep -x mongod >/dev/null 2>&1; then
  echo "Starting mongod..."
  mongod --dbpath /data/db --bind_ip 127.0.0.1 --port 27017 \
    --logpath /var/log/mongodb/mongod.log --logappend --fork
fi

for _ in $(seq 1 30); do
  if (exec 3<>/dev/tcp/127.0.0.1/27017) 2>/dev/null; then
    exec 3>&- 3<&-
    echo "MongoDB is ready on 127.0.0.1:27017"
    exit 0
  fi
  sleep 1
done

echo "MongoDB did not become ready in time" >&2
exit 1
