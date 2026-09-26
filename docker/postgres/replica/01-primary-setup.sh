#!/bin/bash
# Runs once on postgres-primary initdb: creates the replication user and slot
# consumed by postgres-replica (see 02-become-replica.sh).
set -e
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
  CREATE USER replicator WITH REPLICATION PASSWORD 'repl_pass';
  SELECT pg_create_physical_replication_slot('replica_slot_1');
EOSQL
# Allow the replica to open replication connections (initdb defaults lack it).
echo "host replication replicator all scram-sha-256" >> "$PGDATA/pg_hba.conf"
