import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { CurrentUser } from '../current-user.decorator';

function getParamDecoratorFactory(decorator: Function, data?: any) {
  class TestTarget {
    public test(@decorator(data) _param: any) {}
  }
  const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, TestTarget, 'test');
  return args[Object.keys(args)[0]].factory;
}

describe('CurrentUser Decorator', () => {
  const createMockContext = (user?: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  };

  it('should return entire user object when data is undefined', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const mockUser = { sub: 'user-123', email: 'test@example.com' };
    const context = createMockContext(mockUser);

    const result = factory(undefined, context);

    expect(result).toEqual(mockUser);
  });

  it('should return specific user property when data parameter is provided', () => {
    const factory = getParamDecoratorFactory(CurrentUser, 'email');
    const mockUser = { sub: 'user-123', email: 'test@example.com' };
    const context = createMockContext(mockUser);

    const result = factory('email', context);

    expect(result).toBe('test@example.com');
  });

  it('should return undefined when request.user is undefined', () => {
    const factory = getParamDecoratorFactory(CurrentUser);
    const context = createMockContext(undefined);

    const result = factory(undefined, context);

    expect(result).toBeUndefined();
  });
});
