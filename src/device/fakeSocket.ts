import type { SocketLike } from './real';

/** In-memory WebSocket stand-in for tests. */
export class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: SocketLike['onopen'] = null;
  onclose: SocketLike['onclose'] = null;
  onerror: SocketLike['onerror'] = null;
  onmessage: SocketLike['onmessage'] = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  static last(): FakeSocket {
    return FakeSocket.instances[FakeSocket.instances.length - 1];
  }

  send(data: string) {
    if (this.readyState !== 1) throw new Error('not open');
    this.sent.push(data);
  }

  close() {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({});
  }

  // test helpers
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }

  fail() {
    this.onerror?.({});
    this.close();
  }

  receive(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
}
