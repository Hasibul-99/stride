#!/bin/sh
set -e

# Apply pending migrations on release, then start the API.
echo "Running prisma migrate deploy…"
node node_modules/prisma/build/index.js migrate deploy

echo "Starting API…"
exec node dist/main.js
