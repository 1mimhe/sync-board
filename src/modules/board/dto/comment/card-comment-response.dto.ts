import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response DTO representing comment author profile details.
 */
export class CommentAuthorDto {
  @ApiProperty({
    description: 'User UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'User display name',
    example: 'John Doe',
  })
  displayName!: string;

  @ApiPropertyOptional({
    description: 'User avatar URL',
    example: 'https://cdn.example.com/avatar.png',
    nullable: true,
  })
  avatarUrl!: string | null;
}

/**
 * Response DTO representing a single card comment.
 */
export class CardCommentResponseDto {
  @ApiProperty({
    description: 'Comment UUID',
    example: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  })
  id!: string;

  @ApiProperty({
    description: 'Card UUID',
    example: 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  })
  cardId!: string;

  @ApiProperty({
    description: 'Author user UUID',
    example: 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  })
  authorId!: string;

  @ApiProperty({
    description: 'Comment content text',
    example: 'Great progress on this card!',
  })
  content!: string;

  @ApiProperty({
    description: 'Comment author details',
    type: CommentAuthorDto,
  })
  author!: CommentAuthorDto;

  @ApiProperty({
    description: 'Comment creation timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    description: 'Comment update timestamp',
    example: '2026-08-12T12:00:00.000Z',
  })
  updatedAt!: Date;

  @ApiPropertyOptional({
    description: 'Comment deletion timestamp',
    example: null,
    nullable: true,
  })
  deletedAt!: Date | null;
}
