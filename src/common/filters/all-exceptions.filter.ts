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
        errorCode = (resp['code'] as string) || 'VALIDATION_ERROR';
        message = (resp['message'] as string) || exception.message;

        // Format class-validator array messages into structured error objects
        if (Array.isArray(resp['message'])) {
          errorCode = 'VALIDATION_ERROR';
          message = 'Validation failed';
          details = {
            errors: this.formatValidationErrors(resp['message'] as string[]),
          };
        }
      } else if (typeof exResponse === 'string') {
        message = exResponse;
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
