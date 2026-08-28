import Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  DATABASE_REPLICA_URL: Joi.string().optional().allow(''),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace')
    .default('info'),
  JWT_SECRET: Joi.string()
    .optional()
    .when('NODE_ENV', { is: 'production', then: Joi.forbidden() }),
  JWT_PRIVATE_KEY_PATH: Joi.string().optional().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
  }),
  JWT_PUBLIC_KEY_PATH: Joi.string().optional().when('NODE_ENV', {
    is: 'production',
    then: Joi.string().required(),
  }),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(''),
  RABBITMQ_URL: Joi.string()
    .optional()
    .default('amqp://guest:guest@localhost:5672'),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  GOOGLE_CLIENT_SECRET: Joi.string().required(),
  GOOGLE_CALLBACK_URL: Joi.string()
    .optional()
    .default('http://localhost:3000/api/auth/google/callback'),
  CLIENT_URL: Joi.string().optional().default('http://localhost:3001'),
  SMTP_HOST: Joi.string().default('localhost'),
  SMTP_PORT: Joi.number().default(1025),
  SMTP_SECURE: Joi.boolean().default(false),
  SMTP_USER: Joi.string().optional().allow(''),
  SMTP_PASS: Joi.string().optional().allow(''),
  MAIL_FROM: Joi.string().default('SyncBoard <no-reply@syncboard.local>'),
  MAIL_FROM_NAME: Joi.string().default('SyncBoard'),
});
