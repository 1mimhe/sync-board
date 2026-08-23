import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis.service';
import Redis from 'ioredis';

let capturedOptions: any;
const mockQuit = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(function (options: any) {
    capturedOptions = options;
    const listeners: Record<string, Function[]> = {};

    this.on = jest.fn((event: string, cb: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
      return this;
    });

    this.emit = jest.fn((event: string, ...args: any[]) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(...args));
      }
      return true;
    });

    this.quit = mockQuit;
  });
});

describe('RedisService', () => {
  let service: RedisService;
  let mockConfigService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'REDIS_HOST') return 'redis-host';
        if (key === 'REDIS_PORT') return 6380;
        if (key === 'REDIS_PASSWORD') return 'secret-pass';
        return defaultVal;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new RedisService(mockConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should initialize ioredis with configured host, port, password', () => {
    expect(capturedOptions.host).toBe('redis-host');
    expect(capturedOptions.port).toBe(6380);
    expect(capturedOptions.password).toBe('secret-pass');
    expect(capturedOptions.maxRetriesPerRequest).toBe(3);
  });

  it('should initialize ioredis without password when password is empty', () => {
    const noPassConfig = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'REDIS_HOST') return 'localhost';
        if (key === 'REDIS_PORT') return 6379;
        if (key === 'REDIS_PASSWORD') return undefined;
        return defaultVal;
      }),
    } as unknown as ConfigService;

    new RedisService(noPassConfig);
    expect(capturedOptions.password).toBeUndefined();
  });

  describe('retryStrategy', () => {
    it('should return calculated delay for retry attempts <= 10', () => {
      const retry = capturedOptions.retryStrategy;
      expect(retry(1)).toBe(300);
      expect(retry(5)).toBe(1500);
      expect(retry(10)).toBe(3000);
    });

    it('should return null and stop retry loop after 10 attempts', () => {
      const retry = capturedOptions.retryStrategy;
      expect(retry(11)).toBeNull();
    });
  });

  describe('event handlers', () => {
    it('should handle connect and ready events', () => {
      expect(() => {
        (service as any).emit('connect');
        (service as any).emit('ready');
        (service as any).emit('close');
      }).not.toThrow();
    });

    it('should handle ECONNREFUSED error event', () => {
      expect(() => {
        (service as any).emit('error', new Error('ECONNREFUSED connection failed'));
      }).not.toThrow();
    });

    it('should handle general error event', () => {
      expect(() => {
        (service as any).emit('error', new Error('General socket timeout'));
      }).not.toThrow();
    });
  });

  describe('onModuleDestroy', () => {
    it('should call quit on module destroy', async () => {
      await service.onModuleDestroy();
      expect(mockQuit).toHaveBeenCalled();
    });
  });
});
