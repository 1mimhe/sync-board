import { PartialType } from '@nestjs/swagger';
import { CreateListDto } from './create-list.dto';

/**
 * Data transfer object for updating list properties.
 */
export class UpdateListDto extends PartialType(CreateListDto) {}
