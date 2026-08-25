import { PartialType } from '@nestjs/swagger';
import { CreateChecklistDto } from './create-checklist.dto';

/**
 * Data transfer object for renaming a checklist.
 */
export class UpdateChecklistDto extends PartialType(CreateChecklistDto) {}
