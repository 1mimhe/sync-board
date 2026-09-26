import { __resetReplicaForTests, getReplicaClient } from '../replica.client';

describe('replica.client', () => {
  const originalEnv = process.env.DATABASE_REPLICA_URL;

  beforeEach(() => {
    __resetReplicaForTests();
  });

  afterEach(() => {
    __resetReplicaForTests();
    if (originalEnv === undefined) {
      delete process.env.DATABASE_REPLICA_URL;
    } else {
      process.env.DATABASE_REPLICA_URL = originalEnv;
    }
  });

  it('returns null (primary fallback) when no replica is configured', () => {
    delete process.env.DATABASE_REPLICA_URL;
    expect(getReplicaClient()).toBeNull();
  });

  it('creates a client when DATABASE_REPLICA_URL is set', () => {
    process.env.DATABASE_REPLICA_URL =
      'postgresql://syncuser:syncpass@localhost:5433/syncboard?schema=public';
    const client = getReplicaClient();
    expect(client).not.toBeNull();
    expect(getReplicaClient()).toBe(client);
    void client?.$disconnect();
  });
});
