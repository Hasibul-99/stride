/**
 * In-memory stand-in for the socket.io client. Mock `@/lib/socket` to return it:
 *
 *   vi.mock('@/lib/socket', async () => {
 *     const { fakeSocket } = await import('@/test/fakeSocket');
 *     return { connectSocket: () => fakeSocket, getSocket: () => fakeSocket,
 *              disconnectSocket: () => {}, clientId: 'test-client' };
 *   });
 *
 * Then drive inbound events with `fakeSocket.server(event, payload)` and inspect
 * outbound emits via `fakeSocket.emitted`.
 */
type Handler = (payload: unknown) => void;

class FakeSocket {
  connected = true;
  private handlers = new Map<string, Set<Handler>>();
  emitted: { event: string; payload: unknown }[] = [];

  on(event: string, fn: Handler) {
    (this.handlers.get(event) ?? this.handlers.set(event, new Set()).get(event)!).add(fn);
    return this;
  }

  off(event: string, fn: Handler) {
    this.handlers.get(event)?.delete(fn);
    return this;
  }

  emit(event: string, payload?: unknown, ack?: (res: unknown) => void) {
    this.emitted.push({ event, payload });
    if (ack) ack({ ok: true });
    return this;
  }

  connect() {
    this.connected = true;
  }
  disconnect() {
    this.connected = false;
  }

  /** Simulate an inbound server event. */
  server(event: string, payload?: unknown) {
    this.handlers.get(event)?.forEach((fn) => fn(payload));
  }

  /** Outbound emits for a given event name. */
  emitsFor(event: string) {
    return this.emitted.filter((e) => e.event === event);
  }

  reset() {
    this.handlers.clear();
    this.emitted = [];
    this.connected = true;
  }
}

export const fakeSocket = new FakeSocket();
