/**
 * SMTP credential smoke test — sends one real email using the same
 * SMTP_* / MAIL_FROM variables the API reads from .env.
 *
 * Usage:
 *   node scripts/smtp-smoke.js <recipient@example.com>
 *
 * Exit code 0 = credentials + delivery accepted by the server.
 */
process.chdir(require('path').join(__dirname, '..'));

require('dotenv').config();
const nodemailer = require('nodemailer');

async function main() {
  const to = process.argv[2];
  if (!to) {
    console.error('Usage: node scripts/smtp-smoke.js <recipient@example.com>');
    process.exit(1);
  }

  const host = process.env.SMTP_HOST || 'localhost';
  const port = Number(process.env.SMTP_PORT || 1025);
  const secure = String(process.env.SMTP_SECURE) === 'true';

  if (host === 'localhost' && port === 1025) {
    console.warn(
      'WARNING: SMTP_HOST/PORT still point at MailHog — this will NOT send real email.',
    );
  }

  const transportOptions = {
    host,
    port,
    secure,
    ...(process.env.SMTP_USER
      ? {
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || '',
          },
        }
      : {}),
  };

  console.log(
    `Connecting to ${host}:${port} (secure=${secure}, auth=${process.env.SMTP_USER ? 'yes' : 'no'})...`,
  );

  const transporter = nodemailer.createTransport(transportOptions);

  try {
    await transporter.verify();
    console.log('✔ SMTP connection and authentication OK');

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || 'SyncBoard <no-reply@syncboard.local>',
      to,
      subject: 'SyncBoard SMTP smoke test',
      text: 'If you can read this, real email delivery works.',
      html: '<p>If you can read this, <strong>real email delivery works</strong>.</p>',
    });

    console.log(`✔ Message accepted: ${info.messageId}`);
    console.log(`Check the inbox of ${to} (and spam folder).`);
  } finally {
    transporter.close();
  }
}

main().catch((error) => {
  console.error('✖ SMTP smoke test FAILED:', error.message);
  process.exit(1);
});
