/** Raw consume context passed through by RabbitMQ subscribers. */
export interface ConsumeContext {
  headers?: Record<string, unknown>;
  routingKey?: string;
}
