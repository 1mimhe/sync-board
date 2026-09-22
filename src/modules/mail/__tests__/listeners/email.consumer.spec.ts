import { Test, TestingModule } from '@nestjs/testing';
import { Nack } from '@golevelup/nestjs-rabbitmq';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { EmailConsumer } from '../../listeners/email.consumer';
import { RedisService } from '../../../../common/redis/redis.service';
import { RabbitPublisherService } from '../../../../common/rabbitmq/publisher.service';
import type { DomainMessage } from '../../../../common/rabbitmq/interfaces/domain-message.interface';
import type { EmailSendPayload } from '../../interfaces/mail.interfaces';

describe('EmailConsumer', () => {
  let consumer: EmailConsumer;
  let mailer: { sendMail: jest.Mock };
  let config: { get: jest.Mock };
  let redis: { set: jest.Mock; del: jest.Mock };
  let publisher: { publishRetry: jest.Mock };

  const payload = (
    overrides?: Partial<EmailSendPayload>,
  ): EmailSendPayload => ({
    template: 'welcome-verify',
    to: 'user@example.com',
    subject: 'Welcome to SyncBoard — verify your email',
    data: {
      displayName: 'User',
      verifyUrl: 'http://x/verify',
      expiresHours: 24,
    },
    ...overrides,
  });

  const msg = (
    overrides?: Partial<EmailSendPayload>,
    messageId = '33333333-3333-4333-8333-333333333333',
  ): DomainMessage<EmailSendPayload> => ({
    messageId,
    version: 1,
    occurredAt: new Date().toISOString(),
    payload: payload(overrides),
  });

  beforeEach(async () => {
    mailer = { sendMail: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn().mockReturnValue(true) };
    redis = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    publisher = { publishRetry: jest.fn().mockResolvedValue(undefined) };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailConsumer,
        { provide: MailerService, useValue: mailer },
        { provide: ConfigService, useValue: config },
        { provide: RedisService, useValue: redis },
        { provide: RabbitPublisherService, useValue: publisher },
      ],
    }).compile();
    consumer = module.get(EmailConsumer);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('sends welcome-verify mail on first delivery', async () => {
    await consumer.handle(msg());
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('msg:processed:'),
      '1',
      'EX',
      3600,
      'NX',
    );
    expect(mailer.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@example.com',
        template: 'welcome-verify',
      }),
    );
  });

  it('sends each of the five template shapes', async () => {
    const cases: Array<[string, Partial<EmailSendPayload>]> = [
      [
        'welcome-verify',
        {
          template: 'welcome-verify',
          subject: 'Verify your SyncBoard email',
          data: { verifyUrl: 'http://x', expiresHours: 24 },
        },
      ],
      [
        'email-verified',
        {
          template: 'email-verified',
          subject: 'Your SyncBoard email is verified',
          data: { displayName: 'V' },
        },
      ],
      [
        'password-reset',
        {
          template: 'password-reset',
          subject: 'Reset your SyncBoard password',
          data: { resetUrl: 'http://x', expiresMinutes: 60 },
        },
      ],
      [
        'invitation',
        {
          template: 'invitation',
          subject: "You're invited to join a workspace on SyncBoard",
          data: { acceptUrl: 'http://x' },
        },
      ],
    ];
    for (const [template, override] of cases) {
      mailer.sendMail.mockClear();
      await consumer.handle(msg(override));
      expect(mailer.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ template }),
      );
    }
  });

  it('skips sending when consumeOnce detects a duplicate', async () => {
    redis.set.mockResolvedValueOnce(null);
    await consumer.handle(msg());
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('acks poison messages without throwing', async () => {
    await expect(
      consumer.handle({
        messageId: 'x',
        version: 1,
        occurredAt: '',
        payload: {} as never,
      }),
    ).resolves.not.toThrow();
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('no-ops when RABBITMQ_ENABLE is false', async () => {
    config.get.mockReturnValue(false);
    await consumer.handle(msg());
    expect(redis.set).not.toHaveBeenCalled();
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('retries with exponential backoff then acks original', async () => {
    mailer.sendMail.mockRejectedValueOnce(new Error('SMTP down'));
    await consumer.handle(msg(), undefined, undefined, {
      headers: {},
      routingKey: 'email.send',
    });
    expect(redis.del).toHaveBeenCalledWith(
      expect.stringContaining('msg:processed:'),
    );
    expect(publisher.publishRetry).toHaveBeenCalledWith(
      'email.exchange',
      'email.send',
      expect.anything(),
      1000,
      1,
    );
  });

  it('dead-letters with Nack(false) after retries are exhausted', async () => {
    mailer.sendMail.mockRejectedValue(new Error('SMTP down'));
    const result = await consumer.handle(msg(), undefined, undefined, {
      headers: { 'x-retry-count': 3 },
      routingKey: 'email.send',
    });
    expect(result).toBeInstanceOf(Nack);
    expect(publisher.publishRetry).not.toHaveBeenCalled();
  });
});
