import { OmitType } from '@nestjs/swagger';
import { CreateCommentDto } from './create-comment.dto';

/**
 * Data transfer object for updating comment content (re-parenting is forbidden).
 */
export class UpdateCommentDto extends OmitType(CreateCommentDto, [
  'parentCommentId',
] as const) {}
