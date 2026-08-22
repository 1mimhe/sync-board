import { Injectable, ValidationPipe } from '@nestjs/common';
import type { ValidationPipeOptions } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { ValidationError } from 'class-validator';

/**
 * Global/Gateway WebSocket validation pipe.
 * Automatically validates incoming @MessageBody() payloads against DTO classes.
 * Formats validation errors into WsException with code 'INVALID_PAYLOAD' to match the WS error spec.
 */
@Injectable()
export class WsValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const formatErrors = (errs: ValidationError[]): string[] => {
          const messages: string[] = [];
          for (const err of errs) {
            if (err.constraints) {
              messages.push(...Object.values(err.constraints));
            }
            if (err.children && err.children.length > 0) {
              messages.push(...formatErrors(err.children));
            }
          }
          return messages;
        };

        const messages = formatErrors(errors).join('; ');
        return new WsException({
          code: 'INVALID_PAYLOAD',
          message: `Validation failed: ${messages}`,
        });
      },
      ...options,
    });
  }
}
