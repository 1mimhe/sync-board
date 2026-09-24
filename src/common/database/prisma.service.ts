import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService?: ConfigService) {
    const connectionString =
      configService?.get<string>('DATABASE_URL') || process.env.DATABASE_URL;
    // Fail fast at boot when the database accepts but never answers
    // (pg default waits forever and would hang module init).
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 10_000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
