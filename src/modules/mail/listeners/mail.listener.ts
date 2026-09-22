import { Injectable, Logger, Optional } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { AUTH_EVENTS } from '../../auth/events/auth-events.constants';
import { WORKSPACE_EVENTS } from '../../workspace/events/workspace-events.constants';
import type { UserRegisteredEvent } from '../../auth/events/auth.events';
import type { EmailVerificationRequestedEvent } from '../../auth/events/auth.events';
import type { EmailVerifiedEvent } from '../../auth/events/auth.events';
import type { PasswordResetRequestedEvent } from '../../auth/events/auth.events';
import type { WorkspaceInvitationCreatedEvent } from '../../workspace/events/workspace.events';
import { RabbitPublisherService } from '../../../common/rabbitmq/publisher.service';
import {
  EXCHANGES,
  ROUTING_KEYS,
} from '../../../common/rabbitmq/rabbitmq.constants';
import type { EmailSendPayload } from '../interfaces/mail.interfaces';

/**
 * Consumes auth/workspace events and sends transactional emails.
 * CONTAINMENT RULE: a mail failure MUST NOT propagate — log and swallow.
 * When `ASYNC_MAIL` is true, handlers publish to `email.exchange` and return;
 * the queued consumer performs the actual send.
 */
@Injectable()
export class MailListener {
  private readonly logger = new Logger(MailListener.name);

  constructor(
    private readonly mailerService: MailerService,
    private readonly config: ConfigService,
    @Optional() private readonly publisher?: RabbitPublisherService,
  ) {}

  /**
   * Whether queued (async) email delivery is enabled.
   *
   * @returns True when `ASYNC_MAIL` is set
   */
  private isAsync(): boolean {
    return this.config.get<boolean>('ASYNC_MAIL', false) === true;
  }

  /**
   * Resolves the public client base URL for email links.
   *
   * @returns Client URL without trailing slash
   */
  private clientUrl(): string {
    return this.config.get<string>('CLIENT_URL', 'http://localhost:3001');
  }

  /**
   * Publishes one email message, swallowing broker errors.
   *
   * @param payload - Template, recipient, and context data
   * @returns Promise resolving when published or skipped
   */
  private async publishEmail(payload: EmailSendPayload): Promise<void> {
    if (!this.publisher) {
      this.logger.debug(
        `RabbitMQ unavailable; dropping queued email (${payload.template} to ${payload.to})`,
      );
      return;
    }
    try {
      await this.publisher.publish(
        EXCHANGES.EMAIL,
        ROUTING_KEYS.EMAIL_SEND,
        payload,
      );
    } catch (error) {
      this.logger.error(
        `Queued email publish failed (${payload.template} to ${payload.to})`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Sends the combined welcome + email-verification message after registration.
   */
  @OnEvent(AUTH_EVENTS.registered)
  async onRegistered(event: UserRegisteredEvent): Promise<void> {
    if (!event.verificationToken) {
      this.logger.warn(
        `registered event without verification token for ${event.email}; skipping verify link`,
      );
      return;
    }
    const data = {
      displayName: event.displayName ?? '',
      verifyUrl: `${this.clientUrl()}/verify-email?token=${encodeURIComponent(event.verificationToken)}`,
      expiresHours: 24,
    };
    if (this.isAsync()) {
      await this.publishEmail({
        template: 'welcome-verify',
        to: event.email,
        subject: 'Welcome to SyncBoard — verify your email',
        data,
      });
      return;
    }
    try {
      await this.mailerService.sendMail({
        to: event.email,
        subject: 'Welcome to SyncBoard — verify your email',
        template: 'welcome-verify',
        context: data,
      });
      this.logger.log(`Welcome/verification email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `welcome-verify email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Sends a fresh verification link when the user requests it again.
   */
  @OnEvent(AUTH_EVENTS.emailVerificationRequested)
  async onEmailVerificationRequested(
    event: EmailVerificationRequestedEvent,
  ): Promise<void> {
    const data = {
      displayName: '',
      verifyUrl: `${this.clientUrl()}/verify-email?token=${encodeURIComponent(event.token)}`,
      expiresHours: 24,
    };
    if (this.isAsync()) {
      await this.publishEmail({
        template: 'welcome-verify',
        to: event.email,
        subject: 'Verify your SyncBoard email',
        data,
      });
      return;
    }
    try {
      await this.mailerService.sendMail({
        to: event.email,
        subject: 'Verify your SyncBoard email',
        template: 'welcome-verify',
        context: data,
      });
      this.logger.log(`Verification email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `verification email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Confirms to the user that their email address has been verified,
   * closing the verification loop.
   */
  @OnEvent(AUTH_EVENTS.emailVerified)
  async onEmailVerified(event: EmailVerifiedEvent): Promise<void> {
    const data = {
      displayName: event.displayName ?? '',
    };
    if (this.isAsync()) {
      await this.publishEmail({
        template: 'email-verified',
        to: event.email,
        subject: 'Your SyncBoard email is verified',
        data,
      });
      return;
    }
    try {
      await this.mailerService.sendMail({
        to: event.email,
        subject: 'Your SyncBoard email is verified',
        template: 'email-verified',
        context: data,
      });
      this.logger.log(`Email-verified confirmation sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `email-verified email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Sends the password-reset link with a single-use token.
   */
  @OnEvent(AUTH_EVENTS.passwordResetRequested)
  async onPasswordResetRequested(
    event: PasswordResetRequestedEvent,
  ): Promise<void> {
    const data = {
      resetUrl: `${this.clientUrl()}/reset-password?token=${encodeURIComponent(event.token)}`,
      expiresMinutes: 60,
    };
    if (this.isAsync()) {
      await this.publishEmail({
        template: 'password-reset',
        to: event.email,
        subject: 'Reset your SyncBoard password',
        data,
      });
      return;
    }
    try {
      await this.mailerService.sendMail({
        to: event.email,
        subject: 'Reset your SyncBoard password',
        template: 'password-reset',
        context: data,
      });
      this.logger.log(`Password reset email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `password-reset email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }

  /**
   * Sends the workspace invitation with the accept link.
   */
  @OnEvent(WORKSPACE_EVENTS.invitationCreated)
  async onInvitationCreated(
    event: WorkspaceInvitationCreatedEvent,
  ): Promise<void> {
    const data = {
      workspaceName: '',
      inviterName: '',
      acceptUrl: `${this.clientUrl()}/invitations/${event.token}/accept`,
    };
    if (this.isAsync()) {
      await this.publishEmail({
        template: 'invitation',
        to: event.email,
        subject: "You're invited to join a workspace on SyncBoard",
        data,
      });
      return;
    }
    try {
      await this.mailerService.sendMail({
        to: event.email,
        subject: "You're invited to join a workspace on SyncBoard",
        template: 'invitation',
        context: data,
      });
      this.logger.log(`Invitation email sent to ${event.email}`);
    } catch (error) {
      this.logger.error(
        `invitation email failed for ${event.email}`,
        (error as Error).stack,
      );
    }
  }
}
