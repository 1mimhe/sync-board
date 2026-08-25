import { Module } from '@nestjs/common';
import { ActivityRepository } from './repositories/activity.repository';
import { ActivityListener } from './listeners/activity.listener';

/**
 * Append-only activity audit log. Consumes domain events emitted by other
 * modules via EventEmitter2; imports none of them (boundary rule).
 */
@Module({
  providers: [ActivityRepository, ActivityListener],
  exports: [ActivityRepository],
})
export class ActivityModule {}
