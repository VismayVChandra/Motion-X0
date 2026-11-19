import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flatten, interpolate, LANGUAGES, LOCALES } from './index';

const SRC = join(__dirname, '..');
const en = LOCALES.en.dict;
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

/** All .ts/.tsx source files (excluding tests). */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [p] : [];
  });
}

/** Keys built at runtime from known values. */
const DYNAMIC_KEYS = [
  ...['mixed_content', 'invalid_address', 'timeout', 'unreachable', 'busy', 'cancelled'].map((c) => `connect.error.${c}`),
  ...['constant', 'warmup', 'intervals'].flatMap((p) => ['label', 'short', 'desc'].map((f) => `pattern.${p}.${f}`)),
  ...['steady', 'warmup', 'hold', 'cooldown', 'busy', 'rest'].map((p) => `phase.${p}`),
  ...['completed', 'ended_early', 'estop'].map((r) => `end.${r}`),
  'level.name1',
  'level.name2',
  'level.name3',
  ...['morning', 'afternoon', 'evening'].flatMap((g) => [`home.${g}`, `home.${g}Name`]),
  ...['test', 'started', 'resumed', 'paused', 'connectionLost', 'slowDown', 'speedUp', 'oneMinute', 'finished', 'ended', 'estop'].map(
    (v) => `voice.${v}`,
  ),
  ...['nav.home', 'nav.device', 'nav.history', 'nav.settings'],
];

describe('locale files', () => {
  it('English and Hindi are both installed, English first', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(['en', 'hi']);
    expect(LOCALES.hi.meta).toMatchObject({ name: 'हिन्दी', locale: 'hi-IN' });
  });

  it.each(Object.keys(LOCALES).filter((c) => c !== 'en'))('%s has exactly the same keys as English', (code) => {
    const dict = LOCALES[code].dict;
    expect(Object.keys(dict).filter((k) => !(k in en))).toEqual([]);
    expect(Object.keys(en).filter((k) => !(k in dict))).toEqual([]);
  });

  it.each(Object.keys(LOCALES).filter((c) => c !== 'en'))('%s keeps the same {placeholders} as English', (code) => {
    const dict = LOCALES[code].dict;
    const bad = Object.keys(en).filter((k) => k in dict && placeholders(en[k]).join() !== placeholders(dict[k]).join());
    expect(bad).toEqual([]);
  });

  it('no string is left empty', () => {
    for (const { dict } of Object.values(LOCALES)) expect(Object.entries(dict).filter(([, v]) => !v.trim())).toEqual([]);
  });

  it('every key used in the code exists in English', () => {
    const used = new Set(DYNAMIC_KEYS);
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1]);
      for (const m of text.matchAll(/\btn\(\s*'([\w.]+)'/g)) {
        used.add(`${m[1]}.one`);
        used.add(`${m[1]}.other`);
      }
    }
    expect([...used].filter((k) => !(k in en)).sort()).toEqual([]);
  });

  it('wording never claims diagnosis, treatment or cure', () => {
    const banned = /\b(diagnos\w*|treat(s|ment|ing)?|cure[sd]?|heal(s|ing)?|therapy outcome)\b/i;
    const offenders = Object.entries(en).filter(([, v]) => banned.test(v));
    expect(offenders).toEqual([]);
    const hiBanned = /(इलाज|उपचार|निदान|ठीक कर)/;
    expect(Object.entries(LOCALES.hi.dict).filter(([, v]) => hiBanned.test(v))).toEqual([]);
  });
});

describe('helpers', () => {
  it('flatten turns nested objects into dotted keys and skips _meta', () => {
    expect(flatten({ _meta: { name: 'x' }, a: { b: 'c', d: { e: 'f' } }, g: 'h' })).toEqual({ 'a.b': 'c', 'a.d.e': 'f', g: 'h' });
  });
  it('interpolate fills {placeholders} and leaves unknown ones', () => {
    expect(interpolate('{a} of {b} {c}', { a: 1, b: 'two' })).toBe('1 of two {c}');
  });
});
