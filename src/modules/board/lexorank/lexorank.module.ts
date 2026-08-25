import { Module } from '@nestjs/common';
import { LexorankService } from './services/lexorank.service';

/** Lexorank ordering service shared by list, card, and checklist slices. */
@Module({
  providers: [LexorankService],
  exports: [LexorankService],
})
export class LexorankSubModule {}
