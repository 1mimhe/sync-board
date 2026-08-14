import { PartialType } from '@nestjs/swagger';
import { CreateLabelDto } from './create-label.dto';

/**
 * Data transfer object for updating label name or color.
 */
export class UpdateLabelDto extends PartialType(CreateLabelDto) {}
