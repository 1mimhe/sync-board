import { PartialType } from '@nestjs/swagger';
import { CreateCardAttachmentDto } from './create-card-attachment.dto';

/**
 * Data transfer object for updating card attachment properties or URL.
 */
export class UpdateCardAttachmentDto extends PartialType(
  CreateCardAttachmentDto,
) {}
