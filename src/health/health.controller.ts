import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiResponse,
} from '@nestjs/swagger';
import {
  DiskHealthIndicator,
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';

/**
 * Liveness & readiness probe for load balancers and orchestrators.
 * Unauthenticated by design; returns 503 when any dependency is unhealthy.
 */
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Full system health check' })
  @ApiOkResponse({
    description: 'Health status of all system dependencies',
    schema: {
      example: {
        status: 'ok',
        info: { database: { status: 'up' }, redis: { status: 'up' } },
        error: {},
        details: {
          database: { status: 'up' },
          redis: { status: 'up' },
          memory_heap: { status: 'up' },
          disk: { status: 'up' },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more health indicators failed',
  })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300 MB
      () =>
        this.disk.checkStorage('disk', {
          thresholdPercent: 0.9,
          path: process.cwd(),
        }),
    ]);
  }

  @Get('liveness')
  @HealthCheck()
  @ApiOperation({ summary: 'Liveness probe for container orchestrators' })
  @ApiOkResponse({ description: 'Application process is alive' })
  @ApiResponse({
    status: 503,
    description: 'Application process is unresponsive',
  })
  checkLiveness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ]);
  }

  @Get('readiness')
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe for load balancers' })
  @ApiOkResponse({ description: 'Application is ready to serve traffic' })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready to serve traffic',
  })
  checkReadiness(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prisma.pingCheck('database'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
