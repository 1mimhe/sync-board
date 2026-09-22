import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common/dto/cursor-pagination-query.dto';

export class NotificationListQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ type: Boolean })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => {
    const value = obj.unreadOnly;
    return value === 'true' ? true : value === 'false' ? false : value;
  })
  @IsOptional()
  @IsBoolean()
  unreadOnly?: boolean;
}
