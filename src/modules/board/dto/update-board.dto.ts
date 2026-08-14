import { PartialType } from '@nestjs/swagger';
import { CreateBoardDto } from './create-board.dto';

/**
 * Data transfer object for updating board properties.
 */
export class UpdateBoardDto extends PartialType(CreateBoardDto) {}
