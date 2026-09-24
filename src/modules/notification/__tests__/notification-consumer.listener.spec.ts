import { Test, TestingModule } from '@nestjs/testing';
import { Nack } from '@golevelup/nestjs-rabbitmq';
import { NotificationConsumerListener } from '../listeners/notification-consumer.listener';
import { NotificationRepository } from '../repositories/notification.repository';
import { RedisService } from '../../../common/redis/redis.service';
import { RabbitPublisherService } from '../../../common/rabbitmq/publisher.service';
import { NotificationPushGateway } from '../notification-push.gateway';
import type { DomainMessage } from '../../../common/rabbitmq/interfaces/domain-message.interface';
import type { NotificationMessagePayload } from '../interfaces/notification-message.interface';

describe('NotificationConsumerListener', () => {
  let listener: NotificationConsumerListener;
  let repo: { createOnce: jest.Mock };
  let redis: {
    set: jest.Mock;
    del: jest.Mock;
    incr: jest.Mock;
    expire: jest.Mock;
  };
  let gateway: { emitToUser: jest.Mock };
  let publisher: { publishRetry: jest.Mock };

  const basePayload = (): NotificationMessagePayload => ({
    userId: '11111111-1111-4111-8111-111111111111',
    workspaceId: '22222222-2222-4222-8222-222222222222',
    type: 'card_assigned',
    title: 'Assigned',
  });

  const msg = (
    payload?: Partial<NotificationMessagePayload>,
    messageId = '33333333-3333-4333-8333-333333333333',
  ): DomainMessage<NotificationMessagePayload> => ({
    messageId,
    version: 1,
    occurredAt: new Date().toISOString(),
    payload: { ...basePayload(), ...payload },
  });

  beforeEach(async () => {
    repo = { createOnce: jest.fn() };
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };
    gateway = { emitToUser: jest.fn() };
    publisher = { publishRetry: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationConsumerListener,
        { provide: NotificationRepository, useValue: repo },
        { provide: RedisService, useValue: redis },
        { provide: RabbitPublisherService, useValue: publisher },
        { provide: NotificationPushGateway, useValue: gateway },
      ],
    }).compile();
    listener = module.get(NotificationConsumerListener);
  });

  it('persists, increments counter, and pushes on success', async () => {
    const stored = { id: 'n-1' };
    repo.createOnce.mockResolvedValue(stored);
    await listener.handle(msg());
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('msg:processed:'),
      '1',
      'EX',
      3600,
      'NX',
    );
    expect(repo.createOnce).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: expect.any(String) }),
    );
    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining('notifications:unread:'),
    );
    expect(redis.expire).toHaveBeenCalledWith(expect.any(String), 2592000);
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      basePayload().userId,
      stored,
    );
  });

  it('skips processing when consumeOnce detects duplicate in Redis', async () => {
    redis.set.mockResolvedValueOnce(null);
    await listener.handle(msg());
    expect(repo.createOnce).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });

  it('acks duplicates without side effects', async () => {
    repo.createOnce.mockResolvedValue(null);
    await listener.handle(msg());
    expect(redis.incr).not.toHaveBeenCalled();
    expect(gateway.emitToUser).not.toHaveBeenCalled();
  });

  it('acks poison messages without throwing', async () => {
    await expect(
      listener.handle({
        messageId: 'x',
        version: 1,
        occurredAt: '',
        payload: {} as never,
      }),
    ).resolves.not.toThrow();
    expect(repo.createOnce).not.toHaveBeenCalled();
  });

  it('retries with exponential backoff then acks original', async () => {
    repo.createOnce.mockRejectedValueOnce(new Error('db down'));
    await listener.handle(msg(), undefined, undefined, {
      headers: {},
      routingKey: 'notification.card.assigned',
    });
    expect(publisher.publishRetry).toHaveBeenCalledWith(
      'notification.exchange',
      'notification.card.assigned',
      expect.anything(),
      1000,
      1,
    );
    repo.createOnce.mockRejectedValueOnce(new Error('db down'));
    await listener.handle(msg(), undefined, undefined, {
      headers: { 'x-retry-count': 1 },
      routingKey: 'notification.card.assigned',
    });
    expect(publisher.publishRetry).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      2000,
      2,
    );
  });

  it('dead-letters after exhausting retries', async () => {
    repo.createOnce.mockRejectedValue(new Error('db down'));
    await expect(
      listener.handle(msg(), undefined, undefined, {
        headers: { 'x-retry-count': 3 },
      }),
    ).resolves.toBeInstanceOf(Nack);
  });
});
