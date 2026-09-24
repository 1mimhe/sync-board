import { isUuidV4 } from '../../../common/utils/validation.util';
import type { NotificationMessagePayload } from '../interfaces/notification-message.interface';

/**
 * Rejects malformed notification payloads before persistence.
 *
 * @param payload - Incoming notification payload
 * @returns True when the payload carries every required field
 */
export function isValidNotificationPayload(
  payload: NotificationMessagePayload | undefined,
): payload is NotificationMessagePayload {
  return (
    !!payload &&
    isUuidV4(payload.userId) &&
    isUuidV4(payload.workspaceId) &&
    typeof payload.type === 'string' &&
    payload.type.length > 0 &&
    typeof payload.title === 'string' &&
    payload.title.length > 0
  );
}
