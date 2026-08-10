import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';
import { ApiResponse } from '../interfaces/response.interface';

/**
 * Global Response Interceptor
 * Envelopes all successful HTTP response payloads into a standardized API structure:
 * { success: true, data: ..., meta: { timestamp, requestId } }
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { correlationId?: string; id?: string }>();

    return next.handle().pipe(
      map((data: T) => ({
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          // Retrieve request ID from correlationId, header, or internal request object
          requestId:
            request.correlationId ||
            (request.headers['x-request-id'] as string) ||
            request.id ||
            '',
        },
      })),
    );
  }
}
