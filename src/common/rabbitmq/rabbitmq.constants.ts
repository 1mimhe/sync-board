/**
 * Shared RabbitMQ topology constants, queue configurations, and routing keys.
 */
export const EXCHANGES = {
  NOTIFICATION: 'notification.exchange',
  ACTIVITY: 'activity.exchange',
  EMAIL: 'email.exchange',
  DLX: 'dlx.exchange',
} as const;

export const QUEUES = {
  NOTIFICATION: 'notification.queue',
  ACTIVITY: 'activity.queue',
  EMAIL: 'email.queue',
  DLX: 'dlx.queue',
} as const;

export const ROUTING_KEYS = {
  NOTIFICATION_ALL: 'notification.#',
  ACTIVITY_RECORD: 'activity.record',
  EMAIL_SEND: 'email.send',
} as const;

export const QUEUE_OVERFLOW = {
  REJECT_PUBLISH: 'reject-publish',
  DROP_HEAD: 'drop-head',
} as const;

export const QUEUE_LIMITS = {
  NOTIFICATION_MAX_LENGTH: 100_000,
  DLX_MAX_LENGTH: 10_000,
  DLX_BACKLOG_WARN_THRESHOLD: 10,
  DLX_BACKLOG_ERROR_THRESHOLD: 100,
} as const;

export const RABBITMQ_DEFAULTS = {
  DEFAULT_URI: 'amqp://guest:guest@localhost:5672',
  /**
   * Max wait for the initial broker connection at boot. Exceeding it fails
   * startup loudly instead of hanging subscriber setup forever.
   */
  BOOT_TIMEOUT_MS: 15_000,
} as const;

export type ExchangeName = (typeof EXCHANGES)[keyof typeof EXCHANGES];
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];
