import { HttpException, HttpStatus } from '@nestjs/common';

export class AppException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(
      {
        code: errorCode,
        message,
        statusCode,
        details,
      },
      statusCode,
    );
  }
}

export class EntityNotFoundException extends AppException {
  constructor(entityName: string, entityId: string) {
    super(
      `${entityName.toUpperCase()}_NOT_FOUND`,
      `${entityName} with id '${entityId}' was not found`,
      HttpStatus.NOT_FOUND,
    );
  }
}

export class BusinessRuleException extends AppException {
  constructor(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(code, message, HttpStatus.UNPROCESSABLE_ENTITY, details);
  }
}
