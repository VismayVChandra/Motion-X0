import { signal } from '@preact/signals';

export type Route = 'home' | 'device' | 'history' | 'settings' | 'setup' | 'live' | 'done';
export const ROUTES: readonly Route[] = ['home', 'device', 'history', 'settings', 'setup', 'live', 'done'];

/** Which bottom tab is highlighted for each route. */
export const TAB_FOR: Record<Route, Route> = {
  home: 'home',
  device: 'device',
  history: 'history',
  settings: 'settings',
  setup: 'home',
  live: 'home',
  done: 'home',
};

const parse = (hash: string): Route => {
  const name = hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(name) ? name : 'home';
};

/** Hash routing: works from any static file server, including the ESP32. */
export const route = signal<Route>(typeof location === 'undefined' ? 'home' : parse(location.hash));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    route.value = parse(location.hash);
    window.scrollTo({ top: 0 });
  });
}

export const hrefFor = (r: Route) => `#/${r}`;

export function navigate(r: Route): void {
  if (typeof location === 'undefined') {
    route.value = r;
    return;
  }
  location.hash = hrefFor(r);
}
