import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

/**
 * Correlation ID Interceptor
 * Extracts or generates a unique X-Request-Id for every incoming HTTP request.
 * Sets the ID on request object, headers, and outgoing response headers for distributed tracing.
 */
@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<
      Request & { correlationId?: string; id?: string }
    >();
    const response = http.getResponse<Response>();

    // Extract existing header or generate a new request UUID
    const correlationId =
      (request.headers['x-request-id'] as string) ||
      request.id ||
      `req_${randomUUID()}`;

    // Attach correlation ID to request object and headers
    request.correlationId = correlationId;
    request.headers['x-request-id'] = correlationId;
    response.setHeader('X-Request-Id', correlationId);

    return next.handle();
  }
}
