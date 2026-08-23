import { ArgumentsHost } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { WsExceptionFilter } from '../ws-exception.filter';
import type { Socket } from 'socket.io';

describe('WsExceptionFilter', () => {
  let filter: WsExceptionFilter;
  let mockSocket: { id: string; emit: jest.Mock };
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new WsExceptionFilter();
    mockSocket = {
      id: 'sock-1',
      emit: jest.fn(),
    };

    mockHost = {
      switchToWs: () => ({
        getClient: () => mockSocket as unknown as Socket,
        getData: () => ({}),
        getPattern: () => '',
      }),
    } as unknown as ArgumentsHost;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should format and emit structured error for WsException with object payload', () => {
    const wsException = new WsException({
      code: 'BOARD_ACCESS_DENIED',
      message: 'You do not have access to this board',
      event: 'board:join',
    });

    filter.catch(wsException, mockHost);

    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      code: 'BOARD_ACCESS_DENIED',
      message: 'You do not have access to this board',
      event: 'board:join',
      timestamp: expect.any(String),
    });
  });

  it('should use default code and message when object payload lacks code and message', () => {
    const wsException = new WsException({});

    filter.catch(wsException, mockHost);

    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: expect.any(String),
    });
  });

  it('should format and emit structured error for WsException with string message', () => {
    const wsException = new WsException('Unauthorized access');

    filter.catch(wsException, mockHost);

    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      code: 'INTERNAL_ERROR',
      message: 'Unauthorized access',
      timestamp: expect.any(String),
    });
  });

  it('should handle unhandled Error with generic INTERNAL_ERROR message', () => {
    const genericError = new Error('Database connection failed');

    filter.catch(genericError, mockHost);

    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: expect.any(String),
    });
  });

  it('should handle non-Error primitives gracefully', () => {
    filter.catch('Unexpected string thrown', mockHost);

    expect(mockSocket.emit).toHaveBeenCalledWith('error', {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      timestamp: expect.any(String),
    });
  });

  it('should not throw if client is undefined or lacks emit method', () => {
    const emptyHost = {
      switchToWs: () => ({
        getClient: () => null as any,
      }),
    } as unknown as ArgumentsHost;

    expect(() => {
      filter.catch(new WsException('error'), emptyHost);
    }).not.toThrow();
  });
});
