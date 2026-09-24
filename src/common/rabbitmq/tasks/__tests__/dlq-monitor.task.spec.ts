import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { DlqMonitorTask } from '../dlq-monitor.task';

describe('DlqMonitorTask', () => {
  let task: DlqMonitorTask;
  let amqp: DeepMockProxy<AmqpConnection>;
  let config: DeepMockProxy<ConfigService>;

  beforeEach(async () => {
    amqp = mockDeep<AmqpConnection>();
    config = mockDeep<ConfigService>();
    config.get.mockImplementation((key: string, fallback?: unknown) =>
      key === 'RABBITMQ_ENABLE' ? true : fallback,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DlqMonitorTask,
        { provide: AmqpConnection, useValue: amqp },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    task = module.get<DlqMonitorTask>(DlqMonitorTask);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should skip the check when RABBITMQ_ENABLE=false', async () => {
    config.get.mockReturnValue(false);

    await task.checkDlq();

    expect(amqp.managedChannel.checkQueue).not.toHaveBeenCalled();
  });

  it('should stay quiet when backlog is small (<=10)', async () => {
    amqp.managedChannel.checkQueue.mockResolvedValue({
      messageCount: 10,
    } as never);
    const warn = jest.spyOn(task['logger'], 'warn');
    const err = jest.spyOn(task['logger'], 'error');

    await task.checkDlq();

    expect(warn).not.toHaveBeenCalled();
    expect(err).not.toHaveBeenCalledWith(expect.stringContaining('DLQ'));
  });

  it('should warn when backlog is growing (>10)', async () => {
    amqp.managedChannel.checkQueue.mockResolvedValue({
      messageCount: 11,
    } as never);
    const warn = jest.spyOn(task['logger'], 'warn');

    await task.checkDlq();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('DLQ growing'));
  });

  it('should error when backlog exceeds 100', async () => {
    amqp.managedChannel.checkQueue.mockResolvedValue({
      messageCount: 101,
    } as never);
    const err = jest.spyOn(task['logger'], 'error');

    await task.checkDlq();

    expect(err).toHaveBeenCalledWith(expect.stringContaining('DLQ backlog'));
  });

  it('should log check failures without throwing', async () => {
    amqp.managedChannel.checkQueue.mockRejectedValue(new Error('conn refused'));
    const err = jest.spyOn(task['logger'], 'error');

    await expect(task.checkDlq()).resolves.toBeUndefined();
    expect(err).toHaveBeenCalledWith('DLQ check failed', expect.any(String));
  });
});
