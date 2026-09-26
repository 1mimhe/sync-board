import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

/**
 * Lazily-created read-only PrismaClient pointed at DATABASE_REPLICA_URL
 * (same driver-adapter wiring as PrismaService).
 * Returns null when no replica configured — callers MUST fall back to primary.
 */
let replica: PrismaClient | null | undefined;

/**
 * Returns the replica client, creating it on first use.
 *
 * @returns Replica PrismaClient, or null when DATABASE_REPLICA_URL is unset
 */
export function getReplicaClient(): PrismaClient | null {
  if (replica !== undefined) return replica;
  const url = process.env.DATABASE_REPLICA_URL;
  if (!url) {
    replica = null;
    return replica;
  }
  const pool = new Pool({
    connectionString: url,
    connectionTimeoutMillis: 10_000,
  });
  replica = new PrismaClient({ adapter: new PrismaPg(pool) });
  return replica;
}

/**
 * Resets the cached replica client (test-only).
 *
 * @returns void
 */
export function __resetReplicaForTests(): void {
  replica = undefined;
}
