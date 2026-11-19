import { signal } from '@preact/signals';

export type Route = 'home' | 'device' | 'history' | 'settings';
export const ROUTES: readonly Route[] = ['home', 'device', 'history', 'settings'];

const parse = (hash: string): Route => {
  const name = hash.replace(/^#\/?/, '') as Route;
  return ROUTES.includes(name) ? name : 'home';
};

/** Hash routing: works from any static file server, including the ESP32. */
export const route = signal<Route>(typeof location === 'undefined' ? 'home' : parse(location.hash));

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => (route.value = parse(location.hash)));
}

export const hrefFor = (r: Route) => `#/${r}`;
