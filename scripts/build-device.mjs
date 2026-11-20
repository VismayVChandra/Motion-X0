// Build the web app for the ESP32 and gzip it into firmware/motionx/data/ (the LittleFS image).
//
//   npm run build:device
//
// - Demo mode is OFF by default in this build (the app is opened from the device itself).
// - Every file is stored as <name>.gz only; the firmware serves it with Content-Encoding: gzip.
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist-device');
const dataDir = join(root, 'firmware', 'motionx', 'data');
const LITTLEFS_NAME_MAX = 31; // LittleFS default max path length on ESP32
const BUDGET_BYTES = 300 * 1024;

process.env.VITE_DEVICE_BUILD = '1';
await build({ root, logLevel: 'warn', build: { outDir, emptyOutDir: true } });

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

const files = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });

let raw = 0;
let gz = 0;
const rows = [];
for (const file of files(outDir)) {
  const rel = relative(outDir, file).replaceAll('\\', '/');
  const target = `/${rel}.gz`;
  if (target.length > LITTLEFS_NAME_MAX) throw new Error(`Path too long for LittleFS (${target.length} > 31): ${target}`);
  const input = readFileSync(file);
  const output = gzipSync(input, { level: 9 });
  mkdirSync(dirname(join(dataDir, `${rel}.gz`)), { recursive: true });
  writeFileSync(join(dataDir, `${rel}.gz`), output);
  raw += input.length;
  gz += output.length;
  rows.push(`  ${target.padEnd(32)} ${(output.length / 1024).toFixed(1).padStart(7)} KB`);
}

console.log(`\nfirmware/motionx/data (LittleFS image contents):\n${rows.join('\n')}`);
console.log(`\nTotal: ${(raw / 1024).toFixed(1)} KB raw -> ${(gz / 1024).toFixed(1)} KB gzipped (budget 300 KB)`);
if (gz > BUDGET_BYTES) {
  console.error('Over the 300 KB budget!');
  process.exit(1);
}
console.log('Next: cd firmware && pio run -t uploadfs   (or see docs/firmware.md for Arduino IDE)');
