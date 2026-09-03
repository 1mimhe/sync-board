import { ApiProperty } from '@nestjs/swagger';

/** Public snapshot representation — metadata only, never the CRDT bytes. */
export class SnapshotResponseDto {
  /** Snapshot UUID */
  @ApiProperty({ description: 'Snapshot UUID', format: 'uuid' })
  id!: string;

  /** Document UUID the snapshot belongs to */
  @ApiProperty({ description: 'Document UUID', format: 'uuid' })
  documentId!: string;

  /** Optional snapshot name */
  @ApiProperty({
    description: 'Snapshot name',
    nullable: true,
    example: 'Before big rewrite',
  })
  snapshotName!: string | null;

  /** Creator user UUID */
  @ApiProperty({ description: 'Creator user UUID', format: 'uuid' })
  createdBy!: string;

  /** Creation timestamp */
  @ApiProperty({ description: 'Creation timestamp', format: 'date-time' })
  createdAt!: Date;
}
