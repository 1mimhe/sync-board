import { Test, TestingModule } from '@nestjs/testing';
import {
  HealthCheckService,
  HealthIndicatorService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from '../health.controller';
import { PrismaHealthIndicator } from '../prisma-health.indicator';
import { RedisHealthIndicator } from '../redis-health.indicator';
import { PrismaService } from '../../common/database/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

describe('Health Module', () => {
  describe('PrismaHealthIndicator', () => {
    let indicator: PrismaHealthIndicator;
    let prisma: { $queryRaw: jest.Mock };
    let healthIndicatorService: { check: jest.Mock };

    beforeEach(() => {
      prisma = { $queryRaw: jest.fn() };
      healthIndicatorService = {
        check: jest.fn().mockReturnValue({
          up: jest.fn().mockReturnValue({ database: { status: 'up' } }),
          down: jest.fn().mockImplementation((msg) => ({
            database: { status: 'down', message: msg },
          })),
        }),
      };
      indicator = new PrismaHealthIndicator(
        prisma as unknown as PrismaService,
        healthIndicatorService as unknown as HealthIndicatorService,
      );
    });

    it('should return up status when query succeeds', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      const res = await indicator.pingCheck('database');
      expect(res).toEqual({ database: { status: 'up' } });
    });

    it('should return down status when query fails', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('Connection lost'));
      const res = await indicator.pingCheck('database');
      expect(res).toEqual({
        database: { status: 'down', message: 'Connection lost' },
      });
    });
  });

  describe('RedisHealthIndicator', () => {
    let indicator: RedisHealthIndicator;
    let redis: { ping: jest.Mock };
    let healthIndicatorService: { check: jest.Mock };

    beforeEach(() => {
      redis = { ping: jest.fn() };
      healthIndicatorService = {
        check: jest.fn().mockReturnValue({
          up: jest.fn().mockReturnValue({ redis: { status: 'up' } }),
          down: jest.fn().mockImplementation((msg) => ({
            redis: { status: 'down', message: msg },
          })),
        }),
      };
      indicator = new RedisHealthIndicator(
        redis as unknown as RedisService,
        healthIndicatorService as unknown as HealthIndicatorService,
      );
    });

    it('should return up status when ping succeeds', async () => {
      redis.ping.mockResolvedValue('PONG');
      const res = await indicator.pingCheck('redis');
      expect(res).toEqual({ redis: { status: 'up' } });
    });

    it('should return down status when ping fails', async () => {
      redis.ping.mockRejectedValue(new Error('Connection refused'));
      const res = await indicator.pingCheck('redis');
      expect(res).toEqual({
        redis: { status: 'down', message: 'Connection refused' },
      });
    });
  });

  describe('HealthController', () => {
    let controller: HealthController;
    let healthCheckService: jest.Mocked<HealthCheckService>;

    beforeEach(async () => {
      healthCheckService = {
        check: jest.fn().mockImplementation((indicators) => {
          indicators.forEach((fn: () => void) => fn());
          return Promise.resolve({
            status: 'ok',
            info: {},
            error: {},
            details: {},
          });
        }),
      } as unknown as jest.Mocked<HealthCheckService>;

      const mockPrismaIndicator = {
        pingCheck: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
      };

      const mockRedisIndicator = {
        pingCheck: jest.fn().mockResolvedValue({ redis: { status: 'up' } }),
      };

      const mockMemoryIndicator = {
        checkHeap: jest.fn().mockResolvedValue({ memory_heap: { status: 'up' } }),
      };

      const mockDiskIndicator = {
        checkStorage: jest.fn().mockResolvedValue({ disk: { status: 'up' } }),
      };

      const module: TestingModule = await Test.createTestingModule({
        controllers: [HealthController],
        providers: [
          { provide: HealthCheckService, useValue: healthCheckService },
          { provide: PrismaHealthIndicator, useValue: mockPrismaIndicator },
          { provide: RedisHealthIndicator, useValue: mockRedisIndicator },
          { provide: MemoryHealthIndicator, useValue: mockMemoryIndicator },
          { provide: DiskHealthIndicator, useValue: mockDiskIndicator },
        ],
      }).compile();

      controller = module.get<HealthController>(HealthController);
    });

    it('should execute full health check', async () => {
      const result = await controller.check();
      expect(result.status).toBe('ok');
      expect(healthCheckService.check).toHaveBeenCalled();
    });

    it('should execute liveness probe check', async () => {
      const result = await controller.checkLiveness();
      expect(result.status).toBe('ok');
      expect(healthCheckService.check).toHaveBeenCalled();
    });

    it('should execute readiness probe check', async () => {
      const result = await controller.checkReadiness();
      expect(result.status).toBe('ok');
      expect(healthCheckService.check).toHaveBeenCalled();
    });
  });
});
