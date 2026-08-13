import { Injectable, Logger } from '@nestjs/common';
import { HealthIndicatorService, HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../common/database/prisma.service';

/**
 * Terminus health indicator performing a `SELECT 1` against PostgreSQL
 * through the Prisma connection pool.
 */
@Injectable()
export class PrismaHealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly healthIndicatorService: HealthIndicatorService,
  ) {}

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return indicator.up();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Database ping failed';
      this.logger.error(`Database health check failed: ${message}`);
      return indicator.down(message);
    }
  }
}
