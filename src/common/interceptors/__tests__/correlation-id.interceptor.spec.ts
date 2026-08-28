import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { CorrelationIdInterceptor } from '../correlation-id.interceptor';

describe('CorrelationIdInterceptor', () => {
  let interceptor: CorrelationIdInterceptor;
  let mockRequest: any;
  let mockResponse: any;
  let mockContext: ExecutionContext;
  let mockHandler: CallHandler;

  beforeEach(() => {
    interceptor = new CorrelationIdInterceptor();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      setHeader: jest.fn(),
    };
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
    mockHandler = {
      handle: jest.fn().mockReturnValue(of('response')),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should reuse existing x-request-id from request header', (done) => {
    mockRequest.headers['x-request-id'] = 'existing-header-id';

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result).toBe('response');
      expect(mockRequest.correlationId).toBe('existing-header-id');
      expect(mockRequest.headers['x-request-id']).toBe('existing-header-id');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        'existing-header-id',
      );
      expect(mockHandler.handle).toHaveBeenCalledTimes(1);
      done();
    });
  });

  it('should reuse existing request.id when x-request-id header is absent', (done) => {
    mockRequest.id = 'existing-req-id';

    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result).toBe('response');
      expect(mockRequest.correlationId).toBe('existing-req-id');
      expect(mockRequest.headers['x-request-id']).toBe('existing-req-id');
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        'existing-req-id',
      );
      done();
    });
  });

  it('should generate new req_UUID when neither header nor request.id is present', (done) => {
    interceptor.intercept(mockContext, mockHandler).subscribe((result) => {
      expect(result).toBe('response');
      expect(mockRequest.correlationId).toMatch(/^req_[0-9a-f-]{36}$/);
      expect(mockRequest.headers['x-request-id']).toBe(
        mockRequest.correlationId,
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-Request-Id',
        mockRequest.correlationId,
      );
      done();
    });
  });
});
