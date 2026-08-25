import { PartialType } from '@nestjs/swagger';
import { CreateListDto } from './create-list.dto';

/**
 * Data transfer object for updating a list title.
 */
export class UpdateListDto extends PartialType(CreateListDto) {}
