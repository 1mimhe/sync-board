import { configValidationSchema } from '../config.schema';

describe('configValidationSchema', () => {
  const validConfig = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/syncboard',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
  };

  it('should validate valid configuration and apply defaults', () => {
    const { error, value } = configValidationSchema.validate(validConfig);

    expect(error).toBeUndefined();
    expect(value.NODE_ENV).toBe('development');
    expect(value.PORT).toBe(3000);
    expect(value.LOG_LEVEL).toBe('info');
    expect(value.REDIS_HOST).toBe('localhost');
    expect(value.REDIS_PORT).toBe(6379);
    expect(value.RABBITMQ_URL).toBe('amqp://guest:guest@localhost:5672');
    expect(value.RABBITMQ_ENABLE).toBe(true);
    expect(value.ASYNC_MAIL).toBe(false);
    expect(value.AWS_REGION).toBe('us-east-1');
    expect(value.AWS_S3_BUCKET).toBe('syncboard-files');
    expect(value.S3_FORCE_PATH_STYLE).toBe(false);
    expect(value.S3_PRESIGN_EXPIRES_SECONDS).toBe(3600);
    expect(value.MAX_FILE_SIZE_BYTES).toBe(26_214_400);
    expect(value.GOOGLE_CALLBACK_URL).toBe(
      'http://localhost:3000/api/auth/google/callback',
    );
    expect(value.CLIENT_URL).toBe('http://localhost:3001');
    expect(value.SMTP_HOST).toBe('localhost');
    expect(value.SMTP_PORT).toBe(1025);
    expect(value.SMTP_SECURE).toBe(false);
    expect(value.MAIL_FROM).toBe('SyncBoard <no-reply@syncboard.local>');
    expect(value.MAIL_FROM_NAME).toBe('SyncBoard');
  });

  it('should accept explicit SMTP auth credentials', () => {
    const { error, value } = configValidationSchema.validate({
      ...validConfig,
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: 587,
      SMTP_SECURE: true,
      SMTP_USER: 'mailer',
      SMTP_PASS: 'secret',
    });

    expect(error).toBeUndefined();
    expect(value.SMTP_HOST).toBe('smtp.example.com');
    expect(value.SMTP_PORT).toBe(587);
    expect(value.SMTP_SECURE).toBe(true);
    expect(value.SMTP_USER).toBe('mailer');
    expect(value.SMTP_PASS).toBe('secret');
  });

  it('should fail validation when DATABASE_URL is missing', () => {
    const { error } = configValidationSchema.validate({
      GOOGLE_CLIENT_ID: 'id',
      GOOGLE_CLIENT_SECRET: 'secret',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('"DATABASE_URL" is required');
  });

  it('should fail validation when GOOGLE_CLIENT_ID is missing', () => {
    const { error } = configValidationSchema.validate({
      DATABASE_URL: 'postgres://...',
      GOOGLE_CLIENT_SECRET: 'secret',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('"GOOGLE_CLIENT_ID" is required');
  });

  it('should fail validation for invalid NODE_ENV', () => {
    const { error } = configValidationSchema.validate({
      ...validConfig,
      NODE_ENV: 'staging',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('"NODE_ENV" must be one of');
  });

  it('should allow optional fields like DATABASE_REPLICA_URL and REDIS_PASSWORD', () => {
    const { error, value } = configValidationSchema.validate({
      ...validConfig,
      DATABASE_REPLICA_URL: '',
      REDIS_PASSWORD: 'mypassword',
      JWT_SECRET: 'secret',
    });

    expect(error).toBeUndefined();
    expect(value.REDIS_PASSWORD).toBe('mypassword');
    expect(value.JWT_SECRET).toBe('secret');
  });

  it('should fail validation in production without JWT key paths', () => {
    const { error } = configValidationSchema.validate(
      { ...validConfig, NODE_ENV: 'production' },
      { allowUnknown: true },
    );

    expect(error).toBeDefined();
    expect(error?.message).toContain('"JWT_PRIVATE_KEY_PATH" is required');
  });

  it('should fail validation in production when JWT_SECRET is provided', () => {
    const { error } = configValidationSchema.validate({
      ...validConfig,
      NODE_ENV: 'production',
      JWT_PRIVATE_KEY_PATH: 'keys/private.pem',
      JWT_PUBLIC_KEY_PATH: 'keys/public.pem',
      JWT_SECRET: 'secret',
    });

    expect(error).toBeDefined();
    expect(error?.message).toContain('"JWT_SECRET" is not allowed');
  });

  it('should pass validation in development with only JWT_SECRET', () => {
    const { error } = configValidationSchema.validate({
      ...validConfig,
      NODE_ENV: 'development',
      JWT_SECRET: 'secret',
    });

    expect(error).toBeUndefined();
  });

  it('should accept async/S3 overrides for Phase 6A (incl. RABBITMQ_ENABLE=false)', () => {
    const { error, value } = configValidationSchema.validate({
      ...validConfig,
      RABBITMQ_ENABLE: false,
      ASYNC_MAIL: true,
      AWS_REGION: 'eu-west-1',
      AWS_ACCESS_KEY_ID: 'minio',
      AWS_SECRET_ACCESS_KEY: 'minio123',
      AWS_S3_BUCKET: 'local-bucket',
      S3_ENDPOINT: 'http://localhost:9000',
      S3_FORCE_PATH_STYLE: true,
      S3_PRESIGN_EXPIRES_SECONDS: 600,
      MAX_FILE_SIZE_BYTES: 1024,
    });

    expect(error).toBeUndefined();
    expect(value.RABBITMQ_ENABLE).toBe(false);
    expect(value.ASYNC_MAIL).toBe(true);
    expect(value.S3_ENDPOINT).toBe('http://localhost:9000');
    expect(value.S3_FORCE_PATH_STYLE).toBe(true);
    expect(value.MAX_FILE_SIZE_BYTES).toBe(1024);
  });
});
