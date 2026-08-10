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
    .default('default-super-secret-key-change-in-prod'),
  JWT_PRIVATE_KEY_PATH: Joi.string().optional(),
  JWT_PUBLIC_KEY_PATH: Joi.string().optional(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  RABBITMQ_URL: Joi.string()
    .optional()
    .default('amqp://guest:guest@localhost:5672'),
  GOOGLE_CLIENT_ID: Joi.string().optional().default(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().default(''),
  GOOGLE_CALLBACK_URL: Joi.string()
    .optional()
    .default('http://localhost:3000/api/v1/auth/google/callback'),
  CLIENT_URL: Joi.string().optional().default('http://localhost:3001'),
});
