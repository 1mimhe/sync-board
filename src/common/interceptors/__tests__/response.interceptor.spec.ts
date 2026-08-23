import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ResponseInterceptor } from '../response.interceptor';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<any>;

  const createMockContext = (requestData: any = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {},
          ...requestData,
        }),
      }),
    } as unknown as ExecutionContext;
  };

  const createMockCallHandler = (data: any): CallHandler => ({
    handle: () => of(data),
  });

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  it('should wrap response object in { success: true, data, meta } structure', (done) => {
    const context = createMockContext({
      correlationId: 'test-correlation-id',
    });
    const handler = createMockCallHandler({ id: '123', name: 'Test' });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: '123', name: 'Test' });
      expect(result.meta.requestId).toBe('test-correlation-id');
      expect(typeof result.meta.timestamp).toBe('string');
      done();
    });
  });

  it('should pass through null or undefined data wrapped in data: null/undefined', (done) => {
    const context = createMockContext();
    const handler = createMockCallHandler(null);

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
      done();
    });
  });

  it('should pass through array data correctly', (done) => {
    const context = createMockContext();
    const handler = createMockCallHandler([1, 2, 3]);

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2, 3]);
      done();
    });
  });

  it('should extract requestId from headers when correlationId is absent', (done) => {
    const context = createMockContext({
      headers: { 'x-request-id': 'header-req-id' },
    });
    const handler = createMockCallHandler('ok');

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.meta.requestId).toBe('header-req-id');
      done();
    });
  });

  it('should extract requestId from req.id when correlationId and header are absent', (done) => {
    const context = createMockContext({
      id: 'req-internal-id',
    });
    const handler = createMockCallHandler('ok');

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.meta.requestId).toBe('req-internal-id');
      done();
    });
  });

  it('should fallback requestId to empty string when no id source is present', (done) => {
    const context = createMockContext();
    const handler = createMockCallHandler('ok');

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result.meta.requestId).toBe('');
      done();
    });
  });
});
