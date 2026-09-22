import type { ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { HttpThrottlerGuard } from '../http-throttler.guard';

describe('HttpThrottlerGuard', () => {
  const contextOf = (type: 'http' | 'rpc' | 'ws') =>
    ({ getType: () => type }) as unknown as ExecutionContext;

  const createGuard = () =>
    new HttpThrottlerGuard({} as never, {} as never, {} as never);

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows non-HTTP contexts without invoking throttling', async () => {
    const guard = createGuard();
    const superCanActivate = jest
      .spyOn(ThrottlerGuard.prototype, 'canActivate')
      .mockResolvedValue(true);

    await expect(guard.canActivate(contextOf('rpc'))).resolves.toBe(true);
    await expect(guard.canActivate(contextOf('ws'))).resolves.toBe(true);
    expect(superCanActivate).not.toHaveBeenCalled();
  });

  it('delegates HTTP contexts to ThrottlerGuard', async () => {
    const guard = createGuard();
    const superCanActivate = jest
      .spyOn(ThrottlerGuard.prototype, 'canActivate')
      .mockResolvedValue(false);

    await expect(guard.canActivate(contextOf('http'))).resolves.toBe(false);
    expect(superCanActivate).toHaveBeenCalledTimes(1);
  });
});
