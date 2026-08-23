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
    expect(value.GOOGLE_CALLBACK_URL).toBe('http://localhost:3000/api/auth/google/callback');
    expect(value.CLIENT_URL).toBe('http://localhost:3001');
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
});
