import { Socket, io } from 'socket.io-client';

/**
 * WebSocket helpers for socket.io-client based e2e specs
 * (e2e-test-generation.md §3.2).
 */

export type AnyPayload = Record<string, unknown>;

const DEFAULT_TIMEOUT_MS = 5000;

/** Connect an authenticated socket.io client (websocket transport, no reconnect). */
export async function connect(
  baseUrl: string,
  token: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Socket> {
  const serverPort =
    typeof baseUrl === 'string' ? baseUrl : `http://127.0.0.1:${baseUrl}`;
  const sock = io(serverPort, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: timeoutMs,
  });
  await waitFor(sock, 'connect', timeoutMs);
  // Allow server-side handleConnection async verification to settle
  await new Promise((r) => setTimeout(r, 20));
  return sock;
}

/** Connect without a token — resolves on `connect` OR rejects on `error`/`disconnect`. */
export function connectUnauthenticated(
  baseUrl: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = io(baseUrl, {
      transports: ['websocket'],
      reconnection: false,
      timeout: timeoutMs,
    });
    const fail = (err: Error) => {
      sock.removeAllListeners();
      sock.close();
      reject(err);
    };
    sock.once('connect', () => resolve(sock));
    sock.once('error', (payload: AnyPayload) =>
      fail(new Error(`error frame: ${JSON.stringify(payload)}`)),
    );
    sock.once('connect_error', (err: Error) => fail(err));
    setTimeout(() => fail(new Error('timeout waiting connect')), timeoutMs);
  });
}

/** Resolve the next occurrence of `event` (rejects on timeout). */
export function onceEvent<T = AnyPayload>(
  sock: Socket,
  event: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      sock.off(event, onEvent);
      sock.off('error', onError);
      sock.off('connect_error', onError);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`timeout waiting "${event}"`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      cleanup();
      resolve(payload);
    };

    const onError = (payload: unknown) => {
      cleanup();
      reject(
        new Error(
          `ws error received while waiting for "${event}": ${JSON.stringify(payload)}`,
        ),
      );
    };

    sock.once(event, onEvent);
    sock.once('error', onError);
    sock.once('connect_error', onError);
  });
}

/**
 * Subscribe before acting, then await the Nth event.
 * Usage: const w = collect(sock, 'card:created'); await act(); await w.next(1);
 */
export function collect(sock: Socket, event: string) {
  const events: AnyPayload[] = [];
  const handler = (payload: AnyPayload) => events.push(payload);
  sock.on(event, handler);
  return {
    events,
    async waitForCount(n: number, timeoutMs = DEFAULT_TIMEOUT_MS) {
      const start = Date.now();
      while (events.length < n) {
        if (Date.now() - start > timeoutMs) {
          throw new Error(
            `timeout waiting for ${n} "${event}" events (got ${events.length})`,
          );
        }
        await new Promise((r) => setTimeout(r, 25));
      }
      return events;
    },
    async next(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<AnyPayload> {
      const count = events.length;
      await this.waitForCount(count + 1, timeoutMs);
      return events[events.length - 1];
    },
    dispose() {
      sock.off(event, handler);
    },
  };
}

/** Generic wait for any socket event (connect, error, disconnect...). */
export function waitFor(
  sock: Socket,
  event: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<unknown> {
  return onceEvent(sock, event, timeoutMs);
}

/** Await an `error` frame and return its structured payload. */
export async function waitForError(
  sock: Socket,
  expectedCode?: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<AnyPayload> {
  const payload = await onceEvent<AnyPayload>(sock, 'error', timeoutMs);
  if (expectedCode) {
    expect(payload.code).toBe(expectedCode);
  }
  return payload;
}

/** Expect a connection attempt to be rejected (error frame + close). */
export async function expectRejectedConnection(
  baseUrl: string,
  token: string,
  expectedCode: string,
): Promise<void> {
  const sock = io(baseUrl, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
  try {
    const payload = await onceEvent<AnyPayload>(sock, 'error', 5000);
    expect(payload.code).toBe(expectedCode);
  } finally {
    sock.close();
  }
}

/** Close a socket and wait for the server-side disconnect to settle. */
export async function closeSocket(sock?: Socket | null): Promise<void> {
  if (!sock) return;
  if (!sock.connected) {
    sock.close();
    return;
  }
  await new Promise<void>((resolve) => {
    sock.once('disconnect', () => resolve());
    sock.disconnect();
  });
}

/** Helper to build a ws base url from a listening port. */
export function wsUrl(port: number): string {
  return `ws://127.0.0.1:${port}`;
}
