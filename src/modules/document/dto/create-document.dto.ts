import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

/** Payload for creating a new collaborative document. */
export class CreateDocumentDto {
  /** Document title; defaults to 'Untitled' when omitted */
  @ApiPropertyOptional({
    description: 'Document title (defaults to "Untitled")',
    example: 'Sprint retro notes',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @Transform(({ obj, key }) => {
    const raw = obj[key];
    if (raw === undefined || raw === null) return raw;
    if (typeof raw !== 'string') return raw;
    return raw.trim();
  })
  @Length(0, 500)
  title?: string;

  /** Optional card the document is attached to */
  @ApiPropertyOptional({
    description: 'Optional card UUID to link the document to',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  parentCardId?: string;

  /** Alias for parentCardId */
  @ApiPropertyOptional({
    description: 'Alias for parentCardId',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  cardId?: string;
}
