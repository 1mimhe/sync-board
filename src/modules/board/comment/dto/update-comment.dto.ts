import { PartialType } from '@nestjs/swagger';
import { CreateCommentDto } from './create-comment.dto';

/**
 * Data transfer object for updating comment content.
 */
export class UpdateCommentDto extends PartialType(CreateCommentDto) {}
