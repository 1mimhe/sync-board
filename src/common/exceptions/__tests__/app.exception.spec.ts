import { HttpStatus } from '@nestjs/common';
import {
  AppException,
  EntityNotFoundException,
  BusinessRuleException,
} from '../app.exception';

describe('AppException Hierarchy', () => {
  describe('AppException', () => {
    it('should create an AppException with custom parameters', () => {
      const exception = new AppException(
        'TEST_ERROR',
        'Test error message',
        HttpStatus.BAD_REQUEST,
        { field: 'name' },
      );

      expect(exception.errorCode).toBe('TEST_ERROR');
      expect(exception.message).toBe('Test error message');
      expect(exception.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(exception.details).toEqual({ field: 'name' });
      expect(exception.getResponse()).toEqual({
        code: 'TEST_ERROR',
        message: 'Test error message',
        statusCode: HttpStatus.BAD_REQUEST,
        details: { field: 'name' },
      });
    });

    it('should use default statusCode 500 and empty details when not provided', () => {
      const exception = new AppException('DEFAULT_ERROR', 'Default error message');

      expect(exception.errorCode).toBe('DEFAULT_ERROR');
      expect(exception.message).toBe('Default error message');
      expect(exception.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(exception.details).toEqual({});
    });
  });

  describe('EntityNotFoundException', () => {
    it('should format errorCode as {ENTITY}_NOT_FOUND and set status 404', () => {
      const exception = new EntityNotFoundException('Workspace', 'ws-123');

      expect(exception.errorCode).toBe('WORKSPACE_NOT_FOUND');
      expect(exception.message).toBe("Workspace with id 'ws-123' was not found");
      expect(exception.getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('BusinessRuleException', () => {
    it('should create a BusinessRuleException with 422 UNPROCESSABLE_ENTITY and optional details', () => {
      const details = { reason: 'Duplicate email' };
      const exception = new BusinessRuleException(
        'EMAIL_EXISTS',
        'User with email already exists',
        details,
      );

      expect(exception.errorCode).toBe('EMAIL_EXISTS');
      expect(exception.message).toBe('User with email already exists');
      expect(exception.getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(exception.details).toEqual(details);
    });

    it('should handle undefined details with default empty object in base class', () => {
      const exception = new BusinessRuleException(
        'INVALID_OPERATION',
        'Operation invalid',
      );

      expect(exception.errorCode).toBe('INVALID_OPERATION');
      expect(exception.details).toEqual({});
    });
  });
});
