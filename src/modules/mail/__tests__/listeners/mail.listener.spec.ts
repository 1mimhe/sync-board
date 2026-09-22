import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { MailListener } from '../../listeners/mail.listener';
import { RabbitPublisherService } from '../../../../common/rabbitmq/publisher.service';
import {
  EXCHANGES,
  ROUTING_KEYS,
} from '../../../../common/rabbitmq/rabbitmq.constants';

describe('MailListener', () => {
  let listener: MailListener;
  let mailerService: DeepMockProxy<MailerService>;
  let config: DeepMockProxy<ConfigService>;
  let publisher: DeepMockProxy<RabbitPublisherService>;

  beforeEach(async () => {
    mailerService = mockDeep<MailerService>();
    config = mockDeep<ConfigService>();
    publisher = mockDeep<RabbitPublisherService>();
    config.get.mockImplementation((key: string, defaultValue?: unknown) => {
      if (key === 'ASYNC_MAIL') return false;
      if (key === 'CLIENT_URL') return 'http://localhost:3001';
      return defaultValue;
    });
    mailerService.sendMail.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailListener,
        { provide: MailerService, useValue: mailerService },
        { provide: ConfigService, useValue: config },
        { provide: RabbitPublisherService, useValue: publisher },
      ],
    }).compile();

    listener = module.get<MailListener>(MailListener);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onRegistered', () => {
    it('should send welcome-verify template with encoded token URL', async () => {
      await listener.onRegistered({
        userId: 'u-1',
        email: 'new@example.com',
        displayName: 'New User',
        verificationToken: 'tok en+1',
      });

      expect(mailerService.sendMail).toHaveBeenCalledTimes(1);
      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'new@example.com',
          subject: 'Welcome to SyncBoard — verify your email',
          template: 'welcome-verify',
          context: expect.objectContaining({
            displayName: 'New User',
            verifyUrl: 'http://localhost:3001/verify-email?token=tok%20en%2B1',
            expiresHours: 24,
          }),
        }),
      );
    });

    it('should skip sending when verificationToken is absent', async () => {
      await listener.onRegistered({ userId: 'u-1', email: 'a@b.c' });

      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('must not propagate mailer failures', async () => {
      mailerService.sendMail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        listener.onRegistered({
          userId: 'u-1',
          email: 'x@example.com',
          verificationToken: 't',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('onEmailVerificationRequested', () => {
    it('should resend welcome-verify template with new token', async () => {
      await listener.onEmailVerificationRequested({
        userId: 'u-1',
        email: 'again@example.com',
        token: 'fresh-token',
      });

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'again@example.com',
          subject: 'Verify your SyncBoard email',
          template: 'welcome-verify',
          context: expect.objectContaining({
            verifyUrl: 'http://localhost:3001/verify-email?token=fresh-token',
          }),
        }),
      );
    });

    it('must not propagate mailer failures', async () => {
      mailerService.sendMail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        listener.onEmailVerificationRequested({
          userId: 'u-1',
          email: 'x@example.com',
          token: 't',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('onEmailVerified', () => {
    it('should send email-verified confirmation template', async () => {
      await listener.onEmailVerified({
        userId: 'u-1',
        email: 'verified@example.com',
        displayName: 'Verified User',
      });

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'verified@example.com',
          subject: 'Your SyncBoard email is verified',
          template: 'email-verified',
          context: expect.objectContaining({
            displayName: 'Verified User',
          }),
        }),
      );
    });

    it('must not propagate mailer failures', async () => {
      mailerService.sendMail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        listener.onEmailVerified({
          userId: 'u-1',
          email: 'x@example.com',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('onPasswordResetRequested', () => {
    it('should send password-reset template with encoded token URL', async () => {
      await listener.onPasswordResetRequested({
        userId: 'u-1',
        email: 'reset@example.com',
        token: 'r+ t',
      });

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'reset@example.com',
          subject: 'Reset your SyncBoard password',
          template: 'password-reset',
          context: expect.objectContaining({
            resetUrl: 'http://localhost:3001/reset-password?token=r%2B%20t',
            expiresMinutes: 60,
          }),
        }),
      );
    });

    it('must not propagate mailer failures', async () => {
      mailerService.sendMail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        listener.onPasswordResetRequested({
          userId: 'u-1',
          email: 'x@example.com',
          token: 't',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('async queue mode (ASYNC_MAIL=true)', () => {
    beforeEach(() => {
      config.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'ASYNC_MAIL') return true;
        if (key === 'CLIENT_URL') return 'http://localhost:3001';
        return defaultValue;
      });
    });

    it('should publish welcome-verify instead of sending on registered', async () => {
      await listener.onRegistered({
        userId: 'u-1',
        email: 'new@example.com',
        displayName: 'New User',
        verificationToken: 'tok',
      });

      expect(publisher.publish).toHaveBeenCalledTimes(1);
      expect(publisher.publish).toHaveBeenCalledWith(
        EXCHANGES.EMAIL,
        ROUTING_KEYS.EMAIL_SEND,
        expect.objectContaining({
          template: 'welcome-verify',
          to: 'new@example.com',
        }),
      );
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should publish email-verified instead of sending', async () => {
      await listener.onEmailVerified({
        userId: 'u-1',
        email: 'v@example.com',
        displayName: 'V',
      });

      expect(publisher.publish).toHaveBeenCalledWith(
        EXCHANGES.EMAIL,
        ROUTING_KEYS.EMAIL_SEND,
        expect.objectContaining({ template: 'email-verified' }),
      );
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should publish password-reset instead of sending', async () => {
      await listener.onPasswordResetRequested({
        userId: 'u-1',
        email: 'r@example.com',
        token: 't',
      });

      expect(publisher.publish).toHaveBeenCalledWith(
        EXCHANGES.EMAIL,
        ROUTING_KEYS.EMAIL_SEND,
        expect.objectContaining({ template: 'password-reset' }),
      );
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('should publish invitation instead of sending', async () => {
      await listener.onInvitationCreated({
        workspaceId: 'ws-1',
        email: 'i@example.com',
        invitedBy: 'o-1',
        token: 't',
      });

      expect(publisher.publish).toHaveBeenCalledWith(
        EXCHANGES.EMAIL,
        ROUTING_KEYS.EMAIL_SEND,
        expect.objectContaining({ template: 'invitation' }),
      );
      expect(mailerService.sendMail).not.toHaveBeenCalled();
    });

    it('must not propagate publish failures', async () => {
      publisher.publish.mockRejectedValue(new Error('broker down'));

      await expect(
        listener.onEmailVerified({ userId: 'u-1', email: 'x@example.com' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('onInvitationCreated', () => {
    it('should send invitation template with acceptUrl containing token', async () => {
      await listener.onInvitationCreated({
        workspaceId: 'ws-1',
        email: 'invited@example.com',
        invitedBy: 'owner-1',
        token: 'invite-token',
      });

      expect(mailerService.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'invited@example.com',
          subject: "You're invited to join a workspace on SyncBoard",
          template: 'invitation',
          context: expect.objectContaining({
            acceptUrl: 'http://localhost:3001/invitations/invite-token/accept',
          }),
        }),
      );
    });

    it('must not propagate mailer failures', async () => {
      mailerService.sendMail.mockRejectedValue(new Error('SMTP down'));

      await expect(
        listener.onInvitationCreated({
          workspaceId: 'ws-1',
          email: 'x@example.com',
          invitedBy: 'o-1',
          token: 't',
        }),
      ).resolves.toBeUndefined();
    });
  });
});
