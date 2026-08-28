import { validateWsPayload } from '../ws-validation.util';
import {
  WsBoardJoinDto,
  WsCursorDto,
} from '../../../modules/board/realtime/dto/ws-messages.dto';
import { WsException } from '@nestjs/websockets';
import * as classValidator from 'class-validator';

describe('validateWsPayload', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return validated instance when payload is valid', async () => {
    const validPayload = { boardId: '123e4567-e89b-42d3-a456-426614174000' };
    const result = await validateWsPayload(WsBoardJoinDto, validPayload);

    expect(result).toBeInstanceOf(WsBoardJoinDto);
    expect(result.boardId).toBe(validPayload.boardId);
  });

  it('should throw WsException with INVALID_PAYLOAD when validation fails', async () => {
    const invalidPayload = { boardId: 'not-a-valid-uuid' };

    await expect(
      validateWsPayload(WsBoardJoinDto, invalidPayload),
    ).rejects.toThrow(WsException);

    try {
      await validateWsPayload(WsBoardJoinDto, invalidPayload);
    } catch (error) {
      expect(error).toBeInstanceOf(WsException);
      const wsErr = (error as WsException).getError() as {
        code: string;
        message: string;
      };
      expect(wsErr.code).toBe('INVALID_PAYLOAD');
      expect(wsErr.message).toContain('Validation failed');
    }
  });

  it('should reject payloads with missing required properties', async () => {
    const emptyPayload = {};

    await expect(
      validateWsPayload(WsBoardJoinDto, emptyPayload),
    ).rejects.toThrow(WsException);
  });

  it('should reject payloads with extra non-whitelisted properties (forbidNonWhitelisted: true)', async () => {
    const payloadWithExtra = {
      boardId: '123e4567-e89b-42d3-a456-426614174000',
      extraProperty: 'malicious-data',
    };

    await expect(
      validateWsPayload(WsBoardJoinDto, payloadWithExtra),
    ).rejects.toThrow(WsException);
  });

  it('should correctly validate and transform nested optional fields in cursor payload', async () => {
    const validCursorPayload = {
      boardId: '123e4567-e89b-42d3-a456-426614174000',
      cardId: '123e4567-e89b-42d3-a456-426614174001',
      x: 150,
      y: 320,
    };

    const result = await validateWsPayload(WsCursorDto, validCursorPayload);
    expect(result).toBeInstanceOf(WsCursorDto);
    expect(result.x).toBe(150);
    expect(result.y).toBe(320);
    expect(result.cardId).toBe('123e4567-e89b-42d3-a456-426614174001');
  });

  it('should reject cursor payload when coordinates exceed maximum boundaries', async () => {
    const outOfBoundsPayload = {
      boardId: '123e4567-e89b-42d3-a456-426614174000',
      x: -10, // below 0
      y: 200,
    };

    await expect(
      validateWsPayload(WsCursorDto, outOfBoundsPayload),
    ).rejects.toThrow(WsException);
  });

  it('should handle validation errors with undefined constraints safely', async () => {
    const mockError: classValidator.ValidationError = {
      property: 'boardId',
      children: [],
      constraints: undefined,
    };

    jest.spyOn(classValidator, 'validate').mockResolvedValue([mockError]);

    await expect(
      validateWsPayload(WsBoardJoinDto, { boardId: 'test' }),
    ).rejects.toThrow(WsException);
  });
});
