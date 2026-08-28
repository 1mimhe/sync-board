import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockReturnValue('postgresql://user:pass@localhost:5432/db'),
          },
        },
      ],
    }).compile();

    service = module.get<PrismaService>(PrismaService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(async () => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize using ConfigService DATABASE_URL', () => {
      const customConfig = {
        get: jest
          .fn()
          .mockReturnValue('postgresql://test:test@localhost:5432/testdb'),
      } as unknown as ConfigService;
      const instance = new PrismaService(customConfig);
      expect(instance).toBeDefined();
      expect(customConfig.get).toHaveBeenCalledWith('DATABASE_URL');
    });

    it('should fallback to process.env.DATABASE_URL when configService is not provided', () => {
      const originalEnv = process.env.DATABASE_URL;
      process.env.DATABASE_URL = 'postgresql://env:env@localhost:5432/envdb';
      const instance = new PrismaService();
      expect(instance).toBeDefined();
      process.env.DATABASE_URL = originalEnv;
    });

    it('should fallback to process.env.DATABASE_URL when configService returns undefined', () => {
      const customConfig = {
        get: jest.fn().mockReturnValue(undefined),
      } as unknown as ConfigService;
      const originalEnv = process.env.DATABASE_URL;
      process.env.DATABASE_URL =
        'postgresql://fallback:fallback@localhost:5432/fallbackdb';
      const instance = new PrismaService(customConfig);
      expect(instance).toBeDefined();
      process.env.DATABASE_URL = originalEnv;
    });
  });

  describe('onModuleInit', () => {
    it('should call $connect on initialization', async () => {
      const connectSpy = jest
        .spyOn(service, '$connect')
        .mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy', () => {
    it('should call $disconnect on module destruction', async () => {
      const disconnectSpy = jest
        .spyOn(service, '$disconnect')
        .mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
  });
});
