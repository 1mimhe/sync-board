import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Global module providing and exporting RedisService.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
