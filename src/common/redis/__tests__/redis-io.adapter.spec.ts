import { INestApplicationContext } from '@nestjs/common';
import { RedisIoAdapter } from '../redis-io.adapter';
import { RedisService } from '../redis.service';
import { IoAdapter } from '@nestjs/platform-socket.io';
import * as redisAdapterPkg from '@socket.io/redis-adapter';

jest.mock('@socket.io/redis-adapter');

describe('RedisIoAdapter', () => {
  let adapter: RedisIoAdapter;
  let mockAppContext: jest.Mocked<INestApplicationContext>;
  let mockRedisService: any;
  let mockPubClient: any;
  let mockSubClient: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const pubListeners: Record<string, Function[]> = {};
    const subListeners: Record<string, Function[]> = {};

    mockPubClient = {
      on: jest.fn((event: string, cb: Function) => {
        pubListeners[event] = pubListeners[event] || [];
        pubListeners[event].push(cb);
        return mockPubClient;
      }),
      emit: jest.fn((event: string, ...args: any[]) => {
        if (pubListeners[event]) {
          pubListeners[event].forEach((cb) => cb(...args));
        }
      }),
    };

    mockSubClient = {
      on: jest.fn((event: string, cb: Function) => {
        subListeners[event] = subListeners[event] || [];
        subListeners[event].push(cb);
        return mockSubClient;
      }),
      emit: jest.fn((event: string, ...args: any[]) => {
        if (subListeners[event]) {
          subListeners[event].forEach((cb) => cb(...args));
        }
      }),
    };

    mockRedisService = {
      duplicate: jest
        .fn()
        .mockReturnValueOnce(mockPubClient)
        .mockReturnValueOnce(mockSubClient),
    };

    mockAppContext = {
      get: jest.fn().mockReturnValue(mockRedisService),
    } as unknown as jest.Mocked<INestApplicationContext>;

    adapter = new RedisIoAdapter(mockAppContext);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('connectToRedis', () => {
    it('should create dedicated pub and sub clients and initialize adapter constructor', async () => {
      const mockAdapterCtor = jest.fn();
      (redisAdapterPkg.createAdapter as jest.Mock).mockReturnValue(
        mockAdapterCtor,
      );

      await adapter.connectToRedis();

      expect(mockAppContext.get).toHaveBeenCalledWith(RedisService);
      expect(mockRedisService.duplicate).toHaveBeenCalledTimes(2);
      expect(mockPubClient.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(mockSubClient.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(redisAdapterPkg.createAdapter).toHaveBeenCalledWith(
        mockPubClient,
        mockSubClient,
      );
    });

    it('should log error when pub or sub clients emit an error', async () => {
      await adapter.connectToRedis();

      expect(() => {
        mockPubClient.emit('error', new Error('Pub connection lost'));
        mockSubClient.emit('error', new Error('Sub connection lost'));
      }).not.toThrow();
    });
  });

  describe('createIOServer', () => {
    it('should create IO server with CORS settings and attach Redis adapter when connected', async () => {
      const mockServer = {
        adapter: jest.fn(),
      };
      const superCreateSpy = jest
        .spyOn(IoAdapter.prototype, 'createIOServer')
        .mockReturnValue(mockServer as any);

      const mockAdapterCtor = jest.fn();
      (redisAdapterPkg.createAdapter as jest.Mock).mockReturnValue(
        mockAdapterCtor,
      );

      await adapter.connectToRedis();
      const server = adapter.createIOServer(3000, {
        path: '/socket.io',
      } as any);

      expect(superCreateSpy).toHaveBeenCalledWith(
        3000,
        expect.objectContaining({
          path: '/socket.io',
          cors: {
            origin: true,
            credentials: true,
          },
        }),
      );
      expect(mockServer.adapter).toHaveBeenCalledWith(mockAdapterCtor);
      expect(server).toBe(mockServer);
    });

    it('should create IO server without attaching adapter if connectToRedis was not called', () => {
      const mockServer = {
        adapter: jest.fn(),
      };
      jest
        .spyOn(IoAdapter.prototype, 'createIOServer')
        .mockReturnValue(mockServer as any);

      const server = adapter.createIOServer(3000);

      expect(mockServer.adapter).not.toHaveBeenCalled();
      expect(server).toBe(mockServer);
    });
  });
});
