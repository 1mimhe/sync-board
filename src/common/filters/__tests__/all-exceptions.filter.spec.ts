import {
  ArgumentsHost,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { AllExceptionsFilter } from '../all-exceptions.filter';
import {
  AppException,
  EntityNotFoundException,
  BusinessRuleException,
} from '../../exceptions/app.exception';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: {
    status: jest.Mock;
    json: jest.Mock;
  };
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockRequest = {
      method: 'GET',
      url: '/api/test',
      headers: {},
    };
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AppException Hierarchy', () => {
    it('should format standard AppException with custom status and error code', () => {
      const exception = new AppException(
        'CUSTOM_ERROR',
        'Custom error message',
        HttpStatus.BAD_REQUEST,
        { field: 'title' },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CUSTOM_ERROR',
            message: 'Custom error message',
            statusCode: HttpStatus.BAD_REQUEST,
            details: { field: 'title' },
          }),
        }),
      );
    });

    it('should format EntityNotFoundException with NOT_FOUND and 404', () => {
      const exception = new EntityNotFoundException('Card', 'card-123');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'CARD_NOT_FOUND',
            statusCode: 404,
          }),
        }),
      );
    });

    it('should format BusinessRuleException with 422 and violation details', () => {
      const exception = new BusinessRuleException(
        'SLUG_COLLISION',
        'Slug collision error',
        { attempts: 3 },
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'SLUG_COLLISION',
            message: 'Slug collision error',
            statusCode: 422,
            details: { attempts: 3 },
          }),
        }),
      );
    });
  });

  describe('HttpException Hierarchy', () => {
    it('should format validation errors array from ValidationPipe', () => {
      const exception = new HttpException(
        {
          message: ['title must be a string', 'email must be an email'],
          error: 'Bad Request',
          statusCode: 400,
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Validation failed',
            details: {
              errors: [
                { field: 'title', message: 'title must be a string' },
                { field: 'email', message: 'email must be an email' },
              ],
            },
          }),
        }),
      );
    });

    it('should format validation errors with custom code if present in response object', () => {
      const exception = new HttpException(
        {
          code: 'CUSTOM_VALIDATION_CODE',
          message: ['title must be a string'],
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'CUSTOM_VALIDATION_CODE',
          }),
        }),
      );
    });

    it('should format HttpException with object response having custom code and string message', () => {
      const exception = new HttpException(
        {
          code: 'CUSTOM_CODE',
          message: 'Custom message',
        },
        HttpStatus.FORBIDDEN,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'CUSTOM_CODE',
            message: 'Custom message',
          }),
        }),
      );
    });

    it('should format HttpException with object response having non-string message', () => {
      const exception = new HttpException(
        {
          code: 'CUSTOM_CODE',
          message: 12345,
        },
        HttpStatus.FORBIDDEN,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'CUSTOM_CODE',
          }),
        }),
      );
    });

    it('should format HttpException with string response', () => {
      const exception = new HttpException(
        'Forbidden resource',
        HttpStatus.FORBIDDEN,
      );

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'FORBIDDEN',
            message: 'Forbidden resource',
          }),
        }),
      );
    });

    it('should map known guard ForbiddenException codes to their specific payload', () => {
      const exception = new ForbiddenException('EMAIL_NOT_VERIFIED');

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'EMAIL_NOT_VERIFIED',
            message:
              'Email verification required before performing this action',
          }),
        }),
      );
    });

    it('should keep generic FORBIDDEN for unknown guard codes', () => {
      const exception = new ForbiddenException('SOME_UNKNOWN_CODE');

      filter.catch(exception, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ code: 'FORBIDDEN' }),
        }),
      );
    });

    it('should format HttpException with non-object non-string response', () => {
      const exception = new HttpException(12345 as any, HttpStatus.NOT_FOUND);

      filter.catch(exception, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'NOT_FOUND',
          }),
        }),
      );
    });

    describe('Unauthorized 401 message mappings', () => {
      it.each([
        ['TOKEN_EXPIRED', 'TOKEN_EXPIRED', 'Access token has expired'],
        [
          'TOKEN_INVALID',
          'TOKEN_INVALID',
          'Invalid or missing authentication token',
        ],
        ['TOKEN_REVOKED', 'TOKEN_REVOKED', 'Access token has been revoked'],
        ['TOKEN_MISSING', 'TOKEN_MISSING', 'Authentication token is missing'],
        ['CUSTOM_AUTH_CODE', 'CUSTOM_AUTH_CODE', 'CUSTOM_AUTH_CODE'],
        ['Unauthorized', 'UNAUTHORIZED', 'Authentication required'],
        [
          'generic error with spaces',
          'UNAUTHORIZED',
          'generic error with spaces',
        ],
      ])(
        'should map 401 with raw message "%s" to code "%s" and message "%s"',
        (rawMsg, expectedCode, expectedMsg) => {
          const exception = new HttpException(rawMsg, HttpStatus.UNAUTHORIZED);

          filter.catch(exception, mockHost);

          expect(mockResponse.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: expect.objectContaining({
                code: expectedCode,
                message: expectedMsg,
              }),
            }),
          );
        },
      );
    });

    describe('Default status code mappings', () => {
      it('should map 400 to BAD_REQUEST', () => {
        const exception = new HttpException(
          'Bad request',
          HttpStatus.BAD_REQUEST,
        );
        filter.catch(exception, mockHost);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ code: 'BAD_REQUEST' }),
          }),
        );
      });

      it('should map 409 to CONFLICT', () => {
        const exception = new HttpException('Conflict', HttpStatus.CONFLICT);
        filter.catch(exception, mockHost);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ code: 'CONFLICT' }),
          }),
        );
      });

      it('should map 429 to TOO_MANY_REQUESTS', () => {
        const exception = new HttpException(
          'Throttled',
          HttpStatus.TOO_MANY_REQUESTS,
        );
        filter.catch(exception, mockHost);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ code: 'TOO_MANY_REQUESTS' }),
          }),
        );
      });

      it('should map unmapped HTTP status (e.g. 502) to HTTP_ERROR', () => {
        const exception = new HttpException(
          'Bad gateway',
          HttpStatus.BAD_GATEWAY,
        );
        filter.catch(exception, mockHost);
        expect(mockResponse.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: expect.objectContaining({ code: 'HTTP_ERROR' }),
          }),
        );
      });
    });
  });

  describe('Unhandled Errors and Non-Errors', () => {
    it('should catch unhandled Error, log stack, and return 500 INTERNAL_ERROR', () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation();
      const error = new Error('Database connection failed');

      filter.catch(error, mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(loggerSpy).toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            statusCode: 500,
          }),
        }),
      );
    });

    it('should catch non-Error thrown primitive (e.g. string)', () => {
      filter.catch('Unexpected string rejection', mockHost);

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            statusCode: 500,
          }),
        }),
      );
    });

    it('should mask error message in production mode for 500 status', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Sensitive database internal detail');
      filter.catch(error, mockHost);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'An unexpected error occurred',
            details: {},
          }),
        }),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Request ID & Correlation ID Extraction', () => {
    it('should extract requestId from x-request-id header', () => {
      mockRequest.headers['x-request-id'] = 'req-header-123';

      filter.catch(
        new HttpException('Error', HttpStatus.BAD_REQUEST),
        mockHost,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            requestId: 'req-header-123',
          }),
        }),
      );
    });

    it('should extract requestId from req.correlationId if header is absent', () => {
      mockRequest.headers = {};
      mockRequest.correlationId = 'correlation-456';

      filter.catch(
        new HttpException('Error', HttpStatus.BAD_REQUEST),
        mockHost,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            requestId: 'correlation-456',
          }),
        }),
      );
    });

    it('should fallback requestId to empty string when no id source is present', () => {
      mockRequest.headers = {};
      delete mockRequest.correlationId;

      filter.catch(
        new HttpException('Error', HttpStatus.BAD_REQUEST),
        mockHost,
      );

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            requestId: '',
          }),
        }),
      );
    });
  });
});
