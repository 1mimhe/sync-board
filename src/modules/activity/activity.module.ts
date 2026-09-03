import { Module } from '@nestjs/common';
import { ActivityRepository } from './repositories/activity.repository';
import { BoardActivityListener } from './listeners/board-activity.listener';
import { ListActivityListener } from './listeners/list-activity.listener';
import { CardActivityListener } from './listeners/card-activity.listener';
import { CommentActivityListener } from './listeners/comment-activity.listener';
import { LabelActivityListener } from './listeners/label-activity.listener';
import { DocumentActivityListener } from './listeners/document-activity.listener';

/**
 * Append-only activity audit log. Consumes domain events emitted by other
 */
@Module({
  providers: [
    ActivityRepository,
    BoardActivityListener,
    ListActivityListener,
    CardActivityListener,
    CommentActivityListener,
    LabelActivityListener,
    DocumentActivityListener,
  ],
  exports: [ActivityRepository],
})
export class ActivityModule {}
