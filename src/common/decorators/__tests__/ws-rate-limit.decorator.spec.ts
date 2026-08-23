import { WsRateLimit, WS_RATE_LIMIT_KEY } from '../ws-rate-limit.decorator';

describe('WsRateLimit Decorator', () => {
  it('should set metadata when passed an options object', () => {
    class TestClass {
      @WsRateLimit({
        category: 'cursor' as any,
        limit: 10,
        windowMs: 1000,
        silent: true,
      })
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      WS_RATE_LIMIT_KEY,
      TestClass.prototype.testMethod,
    );

    expect(metadata).toEqual({
      category: 'cursor',
      limit: 10,
      windowMs: 1000,
      silent: true,
    });
  });

  it('should set metadata when passed positional arguments', () => {
    class TestClass {
      @WsRateLimit('presence' as any, 20, 5000, true)
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      WS_RATE_LIMIT_KEY,
      TestClass.prototype.testMethod,
    );

    expect(metadata).toEqual({
      category: 'presence',
      limit: 20,
      windowMs: 5000,
      silent: true,
    });
  });

  it('should apply default values for positional parameters when limit/windowMs omitted', () => {
    class TestClass {
      @WsRateLimit('card_move' as any, undefined as any, undefined as any)
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      WS_RATE_LIMIT_KEY,
      TestClass.prototype.testMethod,
    );

    expect(metadata).toEqual({
      category: 'card_move',
      limit: 60,
      windowMs: 60000,
      silent: false,
    });
  });
});
