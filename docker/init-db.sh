#!/bin/sh
# docker/init-db.sh — Database initialisation for the `db-init` container.
# Runs once on `docker compose up`; exits 0 on success so Docker marks it "exited (0)".
#
# Steps performed (in order):
#   1. prisma db push      — sync schema to database (idempotent)
#   2. activity-partitions — create monthly RANGE partitions for activity log
#   3. custom-indexes      — create partial + GIN indexes not managed by Prisma
#   4. prisma db seed      — (runs by default; disable with RUN_SEED=false)
set -e

echo "[init-db] Waiting for Postgres to accept connections..."
until pg_isready -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -q; do
  sleep 2
done

echo "[init-db] Running prisma db push..."
npx prisma db push --skip-generate

echo "[init-db] Applying activity log partitions..."
psql "$DATABASE_URL" -f /app/prisma/activity-partitions.sql

echo "[init-db] Applying custom indexes..."
psql "$DATABASE_URL" -f /app/prisma/custom-indexes.sql

if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "[init-db] Seeding demo data..."
  npm run db:seed
fi

echo "[init-db] Done."
