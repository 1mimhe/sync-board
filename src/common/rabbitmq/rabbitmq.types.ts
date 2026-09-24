import type { EXCHANGES, QUEUES, ROUTING_KEYS } from './rabbitmq.constants';

/**
 * Topology name unions for RabbitMQ exchanges, queues, and routing keys.
 */
export type ExchangeName = (typeof EXCHANGES)[keyof typeof EXCHANGES];
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];
