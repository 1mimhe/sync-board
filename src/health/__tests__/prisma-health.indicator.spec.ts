import { Test, TestingModule } from '@nestjs/testing';
import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaHealthIndicator } from '../prisma-health.indicator';
import { PrismaService } from '../../common/database/prisma.service';

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator;
  let prismaService: jest.Mocked<PrismaService>;
  let healthIndicatorService: jest.Mocked<HealthIndicatorService>;
  let mockCheckIndicator: { up: jest.Mock; down: jest.Mock };

  beforeEach(async () => {
    mockCheckIndicator = {
      up: jest.fn().mockReturnValue({ database: { status: 'up' } }),
      down: jest.fn().mockImplementation((msg) => ({
        database: { status: 'down', message: msg },
      })),
    };

    healthIndicatorService = {
      check: jest.fn().mockReturnValue(mockCheckIndicator),
    };

    prismaService = {
      $queryRaw: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaHealthIndicator,
        { provide: PrismaService, useValue: prismaService },
        { provide: HealthIndicatorService, useValue: healthIndicatorService },
      ],
    }).compile();

    indicator = module.get<PrismaHealthIndicator>(PrismaHealthIndicator);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('pingCheck', () => {
    it('should return up status when $queryRaw succeeds', async () => {
      prismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await indicator.pingCheck('database');

      expect(healthIndicatorService.check).toHaveBeenCalledWith('database');
      expect(mockCheckIndicator.up).toHaveBeenCalled();
      expect(result).toEqual({ database: { status: 'up' } });
    });

    it('should return down status when $queryRaw throws Error', async () => {
      prismaService.$queryRaw.mockRejectedValue(
        new Error('Connection timeout'),
      );

      const result = await indicator.pingCheck('database');

      expect(mockCheckIndicator.down).toHaveBeenCalledWith(
        'Connection timeout',
      );
      expect(result).toEqual({
        database: { status: 'down', message: 'Connection timeout' },
      });
    });

    it('should return down status with fallback message when non-Error thrown', async () => {
      prismaService.$queryRaw.mockRejectedValue('Fatal network crash');

      const result = await indicator.pingCheck('database');

      expect(mockCheckIndicator.down).toHaveBeenCalledWith(
        'Database ping failed',
      );
      expect(result).toEqual({
        database: { status: 'down', message: 'Database ping failed' },
      });
    });
  });
});
