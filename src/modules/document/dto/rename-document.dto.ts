import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

/** Payload for renaming a document. */
export class RenameDocumentDto {
  /** New document title */
  @ApiProperty({
    description: 'New document title',
    example: 'Sprint retro notes',
  })
  @IsString()
  @Transform(({ obj, key }) => {
    const raw = obj[key];
    if (raw === undefined || raw === null) return raw;
    if (typeof raw !== 'string') return raw;
    return raw.trim();
  })
  @Length(1, 500)
  title!: string;
}
