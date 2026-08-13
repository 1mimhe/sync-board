import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppException } from '../exceptions/app.exception';
import { ApiErrorDetail } from '../interfaces/response.interface';

/**
 * Global Exception Filter
 * Catches all unhandled exceptions, formats error payloads uniformly,
 * redacts sensitive server details in production, and logs unhandled errors.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  private readonly unauthorizedErrorMap: Record<
    string,
    { code: string; message: string }
  > = {
    TOKEN_EXPIRED: {
      code: 'TOKEN_EXPIRED',
      message: 'Access token has expired',
    },
    TOKEN_INVALID: {
      code: 'TOKEN_INVALID',
      message: 'Invalid or missing authentication token',
    },
    TOKEN_REVOKED: {
      code: 'TOKEN_REVOKED',
      message: 'Access token has been revoked',
    },
    TOKEN_MISSING: {
      code: 'TOKEN_MISSING',
      message: 'Authentication token is missing',
    },
  };

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred';
    let details: Record<string, unknown> = {};

    // Extract request correlation ID from headers or attached request property
    const requestId =
      (request.headers['x-request-id'] as string) ||
      ((request as unknown as Record<string, unknown>)[
        'correlationId'
      ] as string) ||
      '';

    // Handle custom domain exceptions (AppException)
    if (exception instanceof AppException) {
      statusCode = exception.getStatus();
      errorCode = exception.errorCode;
      message = exception.message;
      details = exception.details;
    }
    // Handle standard NestJS HTTP exceptions (e.g. ValidationPipe errors)
    else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'object' && exResponse !== null) {
        const resp = exResponse as Record<string, unknown>;
        const rawMessage = resp['message'];

        if (Array.isArray(rawMessage)) {
          errorCode = (resp['code'] as string) || 'VALIDATION_ERROR';
          message = 'Validation failed';
          details = {
            errors: this.formatValidationErrors(rawMessage as string[]),
          };
        } else {
          const strMsg = typeof rawMessage === 'string' ? rawMessage : undefined;
          errorCode =
            (resp['code'] as string) ||
            this.getDefaultErrorCodeForStatus(statusCode, strMsg);
          message = this.getReadableMessageForException(
            statusCode,
            strMsg || exception.message,
          );
        }
      } else if (typeof exResponse === 'string') {
        errorCode = this.getDefaultErrorCodeForStatus(statusCode, exResponse);
        message = this.getReadableMessageForException(statusCode, exResponse);
      } else {
        errorCode = this.getDefaultErrorCodeForStatus(statusCode);
        message = exception.message;
      }
    }
    // Log unhandled unexpected errors
    else if (exception instanceof Error) {
      this.logger.error(
        `Unhandled exception: ${exception.message}`,
        exception.stack,
        {
          requestId,
          method: request.method,
          url: request.url,
        },
      );
    }

    // Mask internal error details in production environments for security
    if (
      statusCode === HttpStatus.INTERNAL_SERVER_ERROR &&
      process.env.NODE_ENV === 'production'
    ) {
      message = 'An unexpected error occurred';
      details = {};
    }

    // Return standardized API error JSON
    response.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message,
        statusCode,
        details,
        timestamp: new Date().toISOString(),
        requestId,
      },
    });
  }

  private getDefaultErrorCodeForStatus(
    statusCode: number,
    rawMessage?: string,
  ): string {
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      if (rawMessage && this.unauthorizedErrorMap[rawMessage]) {
        return this.unauthorizedErrorMap[rawMessage].code;
      }
      if (rawMessage && /^[A-Z0-9_]+$/.test(rawMessage)) {
        return rawMessage;
      }
      return 'UNAUTHORIZED';
    }
    if (statusCode === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (statusCode === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (statusCode === HttpStatus.BAD_REQUEST) return 'BAD_REQUEST';
    if (statusCode === HttpStatus.CONFLICT) return 'CONFLICT';
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) return 'TOO_MANY_REQUESTS';
    return 'HTTP_ERROR';
  }

  private getReadableMessageForException(
    statusCode: number,
    rawMessage: string,
  ): string {
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      if (this.unauthorizedErrorMap[rawMessage]) {
        return this.unauthorizedErrorMap[rawMessage].message;
      }
      if (rawMessage === 'Unauthorized') {
        return 'Authentication required';
      }
    }
    return rawMessage;
  }

  /**
   * Helper to transform class-validator message array into field-level error objects
   */
  private formatValidationErrors(messages: string[]): ApiErrorDetail[] {
    return messages.map((msg) => {
      const parts = msg.split(' ');
      return {
        field: parts[0],
        message: msg,
      };
    });
  }
}
