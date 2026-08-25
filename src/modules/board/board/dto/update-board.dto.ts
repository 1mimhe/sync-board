import { PartialType } from '@nestjs/swagger';
import { CreateBoardDto } from './create-board.dto';

/**
 * Data transfer object for updating board properties (title, description, background color).
 */
export class UpdateBoardDto extends PartialType(CreateBoardDto) {}
