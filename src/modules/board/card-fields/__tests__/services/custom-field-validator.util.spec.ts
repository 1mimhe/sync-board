import { BadRequestException } from '@nestjs/common';
import { validateFieldValue } from '../../utils/custom-field-validator.util';

describe('custom-field-validator.util', () => {
  it('should pass null and undefined', () => {
    expect(() => validateFieldValue('text', null, null)).not.toThrow();
    expect(() => validateFieldValue('number', null, undefined)).not.toThrow();
  });

  it('should validate text', () => {
    expect(() => validateFieldValue('text', null, 'ok')).not.toThrow();
    expect(() => validateFieldValue('text', null, 123)).toThrow(
      BadRequestException,
    );
  });

  it('should validate number', () => {
    expect(() => validateFieldValue('number', null, 5)).not.toThrow();
    expect(() => validateFieldValue('number', null, 'x')).toThrow(
      BadRequestException,
    );
    expect(() => validateFieldValue('number', null, NaN)).toThrow(
      BadRequestException,
    );
  });

  it('should validate date', () => {
    expect(() => validateFieldValue('date', null, '2026-01-01')).not.toThrow();
    expect(() => validateFieldValue('date', null, 'nope')).toThrow(
      BadRequestException,
    );
    expect(() => validateFieldValue('date', null, 123)).toThrow(
      BadRequestException,
    );
  });

  it('should validate select with wrapped and flat options', () => {
    expect(() =>
      validateFieldValue('select', { options: ['a', 'b'] }, 'a'),
    ).not.toThrow();
    expect(() => validateFieldValue('select', ['a', 'b'], 'b')).not.toThrow();
    expect(() => validateFieldValue('select', { options: ['a'] }, 'z')).toThrow(
      BadRequestException,
    );
    expect(() => validateFieldValue('select', { options: ['a'] }, 123)).toThrow(
      BadRequestException,
    );
  });

  it('should reject select values when options are not an array', () => {
    expect(() => validateFieldValue('select', 'not-an-array', 'a')).toThrow(
      BadRequestException,
    );
    expect(() => validateFieldValue('select', null, 'a')).toThrow(
      BadRequestException,
    );
  });

  it('should validate user uuid', () => {
    expect(() =>
      validateFieldValue('user', null, '123e4567-e89b-42d3-a456-426614174000'),
    ).not.toThrow();
    expect(() => validateFieldValue('user', null, 'not-a-uuid')).toThrow(
      BadRequestException,
    );
    expect(() => validateFieldValue('user', null, 123)).toThrow(
      BadRequestException,
    );
  });
});
