import { Allow, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Payload for joining a document room. */
export class WsDocJoinDto {
  /** Document UUID to join */
  @ApiProperty({ description: 'Document UUID', format: 'uuid' })
  @IsUUID('4')
  documentId!: string;

  /** Workspace UUID the document belongs to (access check) */
  @ApiProperty({ description: 'Workspace UUID', format: 'uuid' })
  @IsUUID('4')
  workspaceId!: string;

  /** Optional client state vector for diff sync (binary) */
  @ApiPropertyOptional({
    description: 'Binary state vector for incremental sync',
  })
  @Allow()
  stateVector?: unknown;
}

/** Payload for relaying a binary CRDT update. */
export class WsDocUpdateDto {
  /** Document UUID the update applies to */
  @ApiProperty({ description: 'Document UUID', format: 'uuid' })
  @IsUUID('4')
  documentId!: string;

  /** Binary Yjs update (Socket.IO may deliver Buffer or Uint8Array) */
  @ApiPropertyOptional({ description: 'Binary Yjs update payload' })
  @Allow()
  update?: unknown;
}

/** Payload for relaying opaque awareness state (cursor/selection etc.). */
export class WsDocAwarenessDto {
  /** Document UUID the awareness state belongs to */
  @ApiProperty({ description: 'Document UUID', format: 'uuid' })
  @IsUUID('4')
  documentId!: string;

  /** Opaque binary awareness state */
  @ApiPropertyOptional({ description: 'Binary awareness payload' })
  @Allow()
  data?: unknown;
}

/** Payload for leaving a document room. */
export class WsDocLeaveDto {
  /** Document UUID to leave */
  @ApiProperty({ description: 'Document UUID', format: 'uuid' })
  @IsUUID('4')
  documentId!: string;
}
