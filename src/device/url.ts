/**
 * Turn what a user types ("192.168.4.1", "motionx.local:81", "ws://10.0.0.5/ws") into a
 * WebSocket URL. Returns null if it cannot be a valid address.
 */
export function normalizeDeviceUrl(input: string): string | null {
  let t = input.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) t = t.replace(/^http/i, 'ws');
  if (!/^wss?:\/\//i.test(t)) t = `ws://${t}`;
  let url: URL;
  try {
    url = new URL(t);
  } catch {
    return null;
  }
  if (!url.hostname || /\s/.test(input.trim())) return null;
  if (url.pathname === '/' || url.pathname === '') url.pathname = '/ws';
  return `${url.protocol}//${url.host}${url.pathname}${url.search}`;
}

/** Short form for display: "192.168.4.1" for the default path, otherwise host + path. */
export function displayDeviceAddress(wsUrl: string): string {
  try {
    const url = new URL(wsUrl);
    return url.pathname === '/ws' && url.protocol === 'ws:' ? url.host : wsUrl;
  } catch {
    return wsUrl;
  }
}
