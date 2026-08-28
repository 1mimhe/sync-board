import { WsValidationPipe } from '../ws-validation.pipe';
import {
  WsBoardJoinDto,
  WsCursorDto,
} from '../../../modules/board/realtime/dto/ws-messages.dto';
import { WsException } from '@nestjs/websockets';
import { ArgumentMetadata } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsArray, IsString, ValidateNested } from 'class-validator';

class NestedItemDto {
  @IsString()
  name!: string;
}

class ParentDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NestedItemDto)
  items!: NestedItemDto[];
}

describe('WsValidationPipe', () => {
  let pipe: WsValidationPipe;

  beforeEach(() => {
    pipe = new WsValidationPipe();
  });

  it('should transform and return valid DTO instance', async () => {
    const validPayload = { boardId: '123e4567-e89b-42d3-a456-426614174000' };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: WsBoardJoinDto,
    };

    const result = await pipe.transform(validPayload, metadata);

    expect(result).toBeInstanceOf(WsBoardJoinDto);
    expect(result.boardId).toBe(validPayload.boardId);
  });

  it('should throw WsException with INVALID_PAYLOAD code when validation fails', async () => {
    const invalidPayload = { boardId: 'not-a-valid-uuid' };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: WsBoardJoinDto,
    };

    await expect(pipe.transform(invalidPayload, metadata)).rejects.toThrow(
      WsException,
    );

    try {
      await pipe.transform(invalidPayload, metadata);
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

  it('should reject payloads with extra non-whitelisted properties', async () => {
    const payloadWithExtra = {
      boardId: '123e4567-e89b-42d3-a456-426614174000',
      extraProperty: 'malicious-data',
    };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: WsBoardJoinDto,
    };

    await expect(pipe.transform(payloadWithExtra, metadata)).rejects.toThrow(
      WsException,
    );
  });

  it('should correctly transform nested numeric and string fields', async () => {
    const validCursorPayload = {
      boardId: '123e4567-e89b-42d3-a456-426614174000',
      cardId: '123e4567-e89b-42d3-a456-426614174001',
      x: 150,
      y: 320,
    };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: WsCursorDto,
    };

    const result = await pipe.transform(validCursorPayload, metadata);
    expect(result).toBeInstanceOf(WsCursorDto);
    expect(result.x).toBe(150);
    expect(result.y).toBe(320);
    expect(result.cardId).toBe('123e4567-e89b-42d3-a456-426614174001');
  });

  it('should bypass transformation when metatype is not provided or standard primitive', async () => {
    const rawData = { arbitrary: 'value' };
    const metadata: ArgumentMetadata = {
      type: 'body',
    };

    const result = await pipe.transform(rawData, metadata);
    expect(result).toEqual(rawData);
  });

  it('should include messages from nested validation errors (children)', async () => {
    const invalidNestedPayload = { items: [{ name: 123 }] };
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: ParentDto,
    };

    try {
      await pipe.transform(invalidNestedPayload, metadata);
      fail('Expected transform to throw');
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
});
