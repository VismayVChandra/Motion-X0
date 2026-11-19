import { computed } from '@preact/signals';
import { settingsStore } from '../store/settings';

/**
 * Translations. Every `locales/*.json` file is picked up automatically: to add Kannada,
 * copy en.json to kn.json, translate the values and fill in `_meta`. No code changes.
 */
export interface LocaleMeta {
  /** Name shown in the language picker, in that language (e.g. "हिन्दी"). */
  name: string;
  /** BCP 47 tag for dates and numbers (e.g. "hi-IN"). */
  locale: string;
  /** Language for voice prompts (e.g. "hi-IN"). */
  speech: string;
}

export type Dict = Record<string, string>;

interface Locale {
  meta: LocaleMeta;
  dict: Dict;
}

/** Nested JSON → flat "a.b.c" keys. `_meta` is kept apart. */
export function flatten(obj: Record<string, unknown>, prefix = '', out: Dict = {}): Dict {
  for (const [k, v] of Object.entries(obj)) {
    if (!prefix && k === '_meta') continue;
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v as Record<string, unknown>, key, out);
    else if (typeof v === 'string') out[key] = v;
  }
  return out;
}

const modules = import.meta.glob('./locales/*.json', { eager: true, import: 'default' }) as Record<
  string,
  Record<string, unknown>
>;

export const LOCALES: Record<string, Locale> = {};
for (const [path, json] of Object.entries(modules)) {
  const code = path.replace(/^.*\/([\w-]+)\.json$/, '$1');
  const meta = (json._meta ?? {}) as Partial<LocaleMeta>;
  LOCALES[code] = {
    meta: { name: meta.name ?? code, locale: meta.locale ?? code, speech: meta.speech ?? meta.locale ?? code },
    dict: flatten(json),
  };
}

export const DEFAULT_LANG = 'en';

/** Available languages, English first. */
export const LANGUAGES = Object.entries(LOCALES)
  .map(([code, l]) => ({ code, name: l.meta.name }))
  .sort((a, b) => (a.code === DEFAULT_LANG ? -1 : b.code === DEFAULT_LANG ? 1 : a.name.localeCompare(b.name)));

/** Active language code (falls back to English if the saved one has no locale file). */
export const lang = computed(() => {
  const want = settingsStore.settings.value.language;
  return LOCALES[want] ? want : DEFAULT_LANG;
});

export const meta = computed(() => LOCALES[lang.value].meta);

export type Params = Record<string, string | number>;

export function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/** Translate a key. Missing keys fall back to English, then to the key itself. */
export function t(key: string, params?: Params): string {
  const s = LOCALES[lang.value]?.dict[key] ?? LOCALES[DEFAULT_LANG]?.dict[key] ?? key;
  return interpolate(s, params);
}

/** Plural-aware translate: looks up `key.one` / `key.other` (CLDR rules). `{n}` is the count. */
export function tn(key: string, n: number, params?: Params): string {
  const rule = new Intl.PluralRules(meta.value.locale).select(n);
  const dict = LOCALES[lang.value]?.dict ?? {};
  const k = `${key}.${rule}` in dict || `${key}.${rule}` in LOCALES[DEFAULT_LANG].dict ? `${key}.${rule}` : `${key}.other`;
  return t(k, { n, ...params });
}
