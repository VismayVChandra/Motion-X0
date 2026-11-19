import { signal } from '@preact/signals';

export type Route = 'home' | 'device' | 'history' | 'settings' | 'setup' | 'live' | 'done' | 'report';
export const ROUTES: readonly Route[] = ['home', 'device', 'history', 'settings', 'setup', 'live', 'done', 'report'];

/** Which bottom tab is highlighted for each route. */
export const TAB_FOR: Record<Route, Route> = {
  home: 'home',
  device: 'device',
  history: 'history',
  settings: 'settings',
  setup: 'home',
  live: 'home',
  done: 'home',
  report: 'history',
};

/** "#/report/abc" → { route: 'report', param: 'abc' } */
export function parseHash(hash: string): { route: Route; param: string | null } {
  const [name, ...rest] = hash.replace(/^#\/?/, '').split('/');
  const r = ROUTES.includes(name as Route) ? (name as Route) : 'home';
  const param = rest.length ? decodeURIComponent(rest.join('/')) : null;
  return { route: r, param: r === name ? param : null };
}

const initial = parseHash(typeof location === 'undefined' ? '' : location.hash);

/** Hash routing: works from any static file server, including the ESP32. */
export const route = signal<Route>(initial.route);
/** Optional path parameter, e.g. the session id in #/report/<id>. */
export const routeParam = signal<string | null>(initial.param);

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const next = parseHash(location.hash);
    route.value = next.route;
    routeParam.value = next.param;
    window.scrollTo({ top: 0 });
  });
}

export const hrefFor = (r: Route, param?: string) => `#/${r}${param ? `/${encodeURIComponent(param)}` : ''}`;

export function navigate(r: Route, param?: string): void {
  if (typeof location === 'undefined') {
    route.value = r;
    routeParam.value = param ?? null;
    return;
  }
  location.hash = hrefFor(r, param);
}
