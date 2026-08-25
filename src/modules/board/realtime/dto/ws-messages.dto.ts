import { IsUUID, IsNumber, IsOptional, Min, Max } from 'class-validator';

/**
 * DTO for the `workspace:join` WebSocket event payload.
 */
export class WsWorkspaceJoinDto {
  @IsUUID('4')
  workspaceId!: string;
}

/**
 * DTO for the `workspace:leave` WebSocket event payload.
 */
export class WsWorkspaceLeaveDto {
  @IsUUID('4')
  workspaceId!: string;
}

/**
 * DTO for the `board:join` WebSocket event payload.
 */
export class WsBoardJoinDto {
  @IsUUID('4')
  boardId!: string;
}

/**
 * DTO for the `board:leave` WebSocket event payload.
 */
export class WsBoardLeaveDto {
  @IsUUID('4')
  boardId!: string;
}

/**
 * DTO for the `presence:cursor` WebSocket event payload.
 */
export class WsCursorDto {
  @IsUUID('4')
  boardId!: string;

  @IsOptional()
  @IsUUID('4')
  cardId?: string;

  @IsNumber()
  @Min(0)
  @Max(100000)
  x!: number;

  @IsNumber()
  @Min(0)
  @Max(100000)
  y!: number;
}
