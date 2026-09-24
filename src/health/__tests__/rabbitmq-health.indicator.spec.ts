import { ConfigService } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { RabbitMQHealthIndicator } from '../rabbitmq-health.indicator';

describe('RabbitMQHealthIndicator', () => {
  const makeHarness = (enabled: boolean, amqp: AmqpConnection | null) => {
    const config = {
      get: jest.fn().mockReturnValue(enabled),
    } as unknown as ConfigService;
    const up = jest.fn().mockImplementation((data) => ({
      rabbitmq: { status: 'up', ...data },
    }));
    const down = jest.fn().mockImplementation((message: string) => ({
      rabbitmq: { status: 'down', message },
    }));
    const healthIndicatorService = {
      check: jest.fn().mockReturnValue({ up, down }),
    } as unknown as HealthIndicatorService;
    const indicator = new RabbitMQHealthIndicator(
      amqp,
      config,
      healthIndicatorService,
    );
    return { indicator, up, down };
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should report up/disabled when the flag is off', async () => {
    const { indicator, up } = makeHarness(false, null);

    await expect(indicator.pingCheck('rabbitmq')).resolves.toEqual({
      rabbitmq: { status: 'up', enabled: false },
    });
    expect(up).toHaveBeenCalledWith({ enabled: false });
  });

  it('should report up/enabled when the broker answers', async () => {
    const amqp = {
      managedChannel: { checkQueue: jest.fn().mockResolvedValue({}) },
    } as unknown as AmqpConnection;
    const { indicator, up } = makeHarness(true, amqp);

    await expect(indicator.pingCheck('rabbitmq')).resolves.toEqual({
      rabbitmq: { status: 'up', enabled: true },
    });
    expect(up).toHaveBeenCalledWith({ enabled: true });
  });

  it('should report down when the broker check throws', async () => {
    const amqp = {
      managedChannel: {
        checkQueue: jest.fn().mockRejectedValue(new Error('boom')),
      },
    } as unknown as AmqpConnection;
    const { indicator, down } = makeHarness(true, amqp);

    await expect(indicator.pingCheck('rabbitmq')).resolves.toEqual({
      rabbitmq: { status: 'down', message: 'boom' },
    });
    expect(down).toHaveBeenCalledWith('boom');
  });
});
