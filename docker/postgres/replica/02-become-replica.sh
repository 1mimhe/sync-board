#!/bin/bash
# Runs on postgres-replica initdb: replaces the fresh data dir with a
# base backup streamed from postgres-primary and enables standby mode.
# (`pg_basebackup -R` writes standby.signal + primary conninfo automatically.)
set -e
until pg_isready -h postgres-primary -U syncuser; do sleep 1; done
rm -rf /var/lib/postgresql/data/*
PGPASSWORD=repl_pass pg_basebackup -h postgres-primary -U replicator -D /var/lib/postgresql/data -vP --wal-method=stream --slot=replica_slot_1 -R
