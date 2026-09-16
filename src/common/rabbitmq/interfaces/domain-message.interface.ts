export interface DomainMessage<T> {
  messageId: string;
  version: 1;
  occurredAt: string;
  correlationId?: string;
  payload: T;
}
