import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { MailerService as PackageMailerService } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import * as handlebars from 'handlebars';
import { MailModule } from '../../mail.module';

describe('MailModule wiring', () => {
  it('should build the SMTP transport and Handlebars template config from env', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              SMTP_HOST: 'smtp.test.local',
              SMTP_PORT: 2525,
              SMTP_SECURE: true,
              SMTP_USER: 'mailer',
              SMTP_PASS: 'secret',
              MAIL_FROM: 'SyncBoard <no-reply@syncboard.test>',
            }),
          ],
        }),
        MailModule,
      ],
    }).compile();

    const mailer = moduleRef.get(PackageMailerService);
    expect(mailer).toBeDefined();

    const smtpOptions = (
      mailer.getTransporter() as unknown as {
        transporter: { options: Record<string, unknown> };
      }
    ).transporter.options;
    expect(smtpOptions).toMatchObject({
      host: 'smtp.test.local',
      port: 2525,
      secure: true,
      auth: { user: 'mailer', pass: 'secret' },
    });

    const defaults = (
      mailer as unknown as {
        mailerOptions: { defaults: { from: string } };
      }
    ).mailerOptions.defaults;
    expect(defaults.from).toBe('SyncBoard <no-reply@syncboard.test>');

    const adapter = (mailer as unknown as { templateAdapter: unknown })
      .templateAdapter;
    expect(adapter).toBeInstanceOf(HandlebarsAdapter);
  });

  it('builds an unauthenticated transport when SMTP_USER is empty', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({ SMTP_HOST: 'localhost', SMTP_PORT: 1025, SMTP_USER: '' }),
          ],
        }),
        MailModule,
      ],
    }).compile();

    const mailer = moduleRef.get(PackageMailerService);
    const smtpOptions = (
      mailer.getTransporter() as unknown as {
        transporter: { options: Record<string, unknown> };
      }
    ).transporter.options;
    expect(smtpOptions.auth).toBeUndefined();
  });

  it('points the template dir at real .hbs files with required placeholders', () => {
    const dir = join(__dirname, '..', '..', 'templates');
    for (const name of ['welcome-verify', 'password-reset', 'invitation']) {
      const file = join(dir, `${name}.hbs`);
      expect(existsSync(file)).toBe(true);
      const html = readFileSync(file, 'utf-8');
      expect(html.toLowerCase()).toContain(
        'you received this because of activity on your syncboard account',
      );
    }
    expect(readFileSync(join(dir, 'welcome-verify.hbs'), 'utf-8')).toContain(
      '{{verifyUrl}}',
    );
    expect(readFileSync(join(dir, 'password-reset.hbs'), 'utf-8')).toContain(
      '{{resetUrl}}',
    );
    expect(readFileSync(join(dir, 'invitation.hbs'), 'utf-8')).toContain(
      '{{acceptUrl}}',
    );
  });

  it('renders welcome-verify cleanly with present and empty displayName', () => {
    const dir = join(__dirname, '..', '..', 'templates');
    const raw = readFileSync(join(dir, 'welcome-verify.hbs'), 'utf-8');
    const compile = handlebars.compile(raw);

    const named = compile({
      displayName: 'Ada',
      verifyUrl: 'https://x/verify?token=abc',
      expiresHours: 24,
    });
    expect(named).toContain(', Ada!');
    // handlebars HTML-escapes '=' inside attributes
    expect(named).toContain('https://x/verify?token&#x3D;abc');

    const anon = compile({
      displayName: '',
      verifyUrl: 'u',
      expiresHours: 24,
    });
    expect(anon).not.toContain(', !');
  });
});
