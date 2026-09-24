import { Test, TestingModule } from '@nestjs/testing';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { RabbitPublisherService } from '../publisher.service';
import { retryCountFrom } from '../idempotency.util';

describe('RabbitPublisherService', () => {
  let service: RabbitPublisherService;
  let amqp: DeepMockProxy<AmqpConnection>;

  beforeEach(async () => {
    amqp = mockDeep<AmqpConnection>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RabbitPublisherService,
        { provide: AmqpConnection, useValue: amqp },
      ],
    }).compile();

    service = module.get<RabbitPublisherService>(RabbitPublisherService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should publish an envelope with messageId, version 1 and ISO occurredAt', async () => {
    amqp.publish.mockResolvedValue(undefined as never);

    await service.publish(
      'notification.exchange',
      'notification.card.assigned',
      {
        cardId: 'card-1',
      },
    );

    expect(amqp.publish).toHaveBeenCalledTimes(1);
    const [exchange, routingKey, message, options] = amqp.publish.mock
      .calls[0] as unknown as [
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(exchange).toBe('notification.exchange');
    expect(routingKey).toBe('notification.card.assigned');
    expect(message).toMatchObject({ version: 1 });
    expect(typeof message.messageId).toBe('string');
    expect(new Date(message.occurredAt as string).toISOString()).toBe(
      message.occurredAt,
    );
    expect(message).toMatchObject({ payload: { cardId: 'card-1' } });
    expect(options).toMatchObject({ persistent: true });
    expect(options.messageId).toBe(message.messageId);
  });

  it('should forward correlationId via envelope and headers', async () => {
    amqp.publish.mockResolvedValue(undefined as never);

    await service.publish(
      'email.exchange',
      'email.send',
      { to: 'a@x.com' },
      'corr-1',
    );

    const [, , message, options] = amqp.publish.mock.calls[0] as unknown as [
      string,
      string,
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(message.correlationId).toBe('corr-1');
    expect(
      (options.headers as Record<string, unknown>)['x-correlation-id'],
    ).toBe('corr-1');
  });

  it('should fail open when the broker throws (resolve, log error)', async () => {
    amqp.publish.mockRejectedValue(new Error('broker down'));
    const loggerSpy = jest.spyOn(
      service['logger'] as unknown as { error: jest.Mock },
      'error',
    );

    await expect(
      service.publish('activity.exchange', 'activity.record', { a: 1 }),
    ).resolves.toBeUndefined();
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Publish failed activity.exchange/activity.record',
      ),
    );
  });

  it('should assert a TTL wait queue and schedule retry with x-retry-count and routing key', async () => {
    const message = {
      messageId: 'm-1',
      version: 1 as const,
      occurredAt: new Date().toISOString(),
      payload: { cardId: 'card-1' },
    };

    await service.publishRetry(
      'notification.exchange',
      'notification.card.assigned',
      message,
      5000,
      2,
    );

    expect(amqp.managedChannel.assertQueue).toHaveBeenCalledWith(
      'retry.wait.notification.exchange.notification_card_assigned.5000',
      {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'notification.exchange',
          'x-dead-letter-routing-key': 'notification.card.assigned',
          'x-message-ttl': 5000,
        },
      },
    );
    expect(amqp.managedChannel.sendToQueue).toHaveBeenCalledTimes(1);
    const [, payload, options] = amqp.managedChannel.sendToQueue.mock
      .calls[0] as unknown as [string, Buffer, Record<string, unknown>];
    expect(JSON.parse(payload.toString())).toEqual(message);
    expect(options).toMatchObject({
      persistent: true,
      headers: { 'x-retry-count': 2 },
    });
  });

  it('should no-op gracefully when amqp is not provided', async () => {
    const unattachedService = new RabbitPublisherService(undefined);

    await expect(
      unattachedService.publish('notification.exchange', 'test', {}),
    ).resolves.toBeUndefined();

    await expect(
      unattachedService.publishRetry(
        'notification.exchange',
        'test',
        {
          messageId: 'm-1',
          version: 1,
          occurredAt: '',
          payload: {},
        },
        1000,
        1,
      ),
    ).resolves.toBeUndefined();
  });

  describe('retryCountFrom', () => {
    it('should default to 0 for missing/invalid headers', () => {
      expect(retryCountFrom(undefined)).toBe(0);
      expect(retryCountFrom({})).toBe(0);
      expect(retryCountFrom({ 'x-retry-count': '2' })).toBe(0);
    });

    it('should read numeric retry count', () => {
      expect(retryCountFrom({ 'x-retry-count': 3 })).toBe(3);
    });
  });
});
