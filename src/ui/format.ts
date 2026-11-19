import { meta, t } from '../i18n';

/** 6:42 style countdown (rounds up so the timer reads 0:00 only at the very end). */
export function mmss(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Human duration: "45 s", "4 min", "4 min 30 s" (translated). */
export function duration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return t('fmt.sec', { n: s });
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? t('fmt.minSec', { m, s: r }) : t('fmt.min', { n: m });
}

const DAY = 86_400_000;
const startOfDay = (ts: number) => {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const time = (ts: number) => new Date(ts).toLocaleTimeString(meta.value.locale, { hour: 'numeric', minute: '2-digit' });
export const shortDate = (ts: number) =>
  new Date(ts).toLocaleDateString(meta.value.locale, { day: 'numeric', month: 'short' });
export const longDate = (ts: number) =>
  new Date(ts).toLocaleDateString(meta.value.locale, { weekday: 'long', day: 'numeric', month: 'long' });
export const fullDate = (ts: number) =>
  new Date(ts).toLocaleDateString(meta.value.locale, { day: 'numeric', month: 'long', year: 'numeric' });

/** "Today · 9:10", "Yesterday · 18:05", "18 Nov · 17:40" (translated). */
export function when(ts: number, now = Date.now()): string {
  const diffDays = Math.round((startOfDay(now) - startOfDay(ts)) / DAY);
  if (diffDays === 0) return t('fmt.today', { time: time(ts) });
  if (diffDays === 1) return t('fmt.yesterday', { time: time(ts) });
  return t('fmt.dateTime', { date: shortDate(ts), time: time(ts) });
}

/** One-letter weekday in the active language (chart labels). */
export const weekdayNarrow = (ts: number) => new Date(ts).toLocaleDateString(meta.value.locale, { weekday: 'narrow' });
