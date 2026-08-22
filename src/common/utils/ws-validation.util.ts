import { validate, ValidationError } from 'class-validator';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { WsException } from '@nestjs/websockets';

/**
 * Validates an incoming WebSocket message payload against a DTO class.
 * Throws a WsException with INVALID_PAYLOAD code if validation fails.
 *
 * @param dtoClass - The DTO class constructor to validate against
 * @param payload - The raw message payload from the client
 * @returns Validated and transformed DTO instance
 * @throws {WsException} If payload fails validation
 */
export async function validateWsPayload<T extends object>(
  dtoClass: ClassConstructor<T>,
  payload: unknown,
): Promise<T> {
  const instance = plainToInstance(dtoClass, payload);
  const errors: ValidationError[] = await validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  if (errors.length > 0) {
    const messages = errors
      .map((err) => Object.values(err.constraints ?? {}).join(', '))
      .join('; ');

    throw new WsException({
      code: 'INVALID_PAYLOAD',
      message: `Validation failed: ${messages}`,
    });
  }

  return instance;
}
