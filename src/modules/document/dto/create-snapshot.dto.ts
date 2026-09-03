import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length } from 'class-validator';

/** Payload for creating a snapshot of a document's current CRDT state. */
export class CreateSnapshotDto {
  /** Optional human-readable snapshot name */
  @ApiPropertyOptional({
    description: 'Optional snapshot name',
    example: 'Before big rewrite',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Transform(({ obj, key }) => {
    const raw = obj[key];
    if (raw === undefined || raw === null) return raw;
    if (typeof raw !== 'string') return raw;
    return raw.trim();
  })
  @Length(0, 200)
  name?: string;

  /** Optional human-readable snapshot name (alias for name) */
  @ApiPropertyOptional({
    description: 'Optional snapshot name alias',
    example: 'Before big rewrite',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @Transform(({ obj, key }) => {
    const raw = obj[key];
    if (raw === undefined || raw === null) return raw;
    if (typeof raw !== 'string') return raw;
    return raw.trim();
  })
  @Length(0, 200)
  snapshotName?: string;
}
