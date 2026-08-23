import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { WsUser } from '../ws-user.decorator';
import type { JwtPayload } from '../../../modules/auth/interfaces/jwt-payload.interface';

function getParamDecoratorFactory(decorator: Function, data?: any) {
  class TestTarget {
    public test(@decorator(data) _param: any) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestTarget, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('WsUser Decorator', () => {
  const createMockWsContext = (user?: any): ExecutionContext => {
    return {
      switchToWs: () => ({
        getClient: () => ({
          data: user !== undefined ? { user } : {},
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should return entire user payload when data is undefined', () => {
    const factory = getParamDecoratorFactory(WsUser);
    const mockUser: JwtPayload = { sub: 'u-1', email: 'user@test.com', jti: 'jti-1' };
    const context = createMockWsContext(mockUser);

    const result = factory(undefined, context);

    expect(result).toEqual(mockUser);
  });

  it('should return specific field when key is specified', () => {
    const factory = getParamDecoratorFactory(WsUser, 'sub');
    const mockUser: JwtPayload = { sub: 'u-1', email: 'user@test.com', jti: 'jti-1' };
    const context = createMockWsContext(mockUser);

    const result = factory('sub', context);

    expect(result).toBe('u-1');
  });

  it('should return undefined when socket data does not contain user', () => {
    const factory = getParamDecoratorFactory(WsUser);
    const context = createMockWsContext(undefined);

    const result = factory(undefined, context);

    expect(result).toBeUndefined();
  });
});
