// Gzipped size of the production build vs the 300 KB budget (the ESP32 serves it from flash).
//   npm run size        (run `npm run build` first)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const dir = process.argv[2] ?? 'dist';
const BUDGET = 300 * 1024;
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

let total = 0;
const rows = walk(dir)
  .map((f) => {
    const gz = gzipSync(readFileSync(f), { level: 9 }).length;
    total += gz;
    return [relative(dir, f).split(sep).join('/'), gz];
  })
  .sort((a, b) => b[1] - a[1]);

for (const [name, gz] of rows) console.log(`  ${name.padEnd(36)} ${(gz / 1024).toFixed(1).padStart(7)} KB`);
console.log(`\nTotal gzipped: ${(total / 1024).toFixed(1)} KB of ${BUDGET / 1024} KB budget (${Math.round((total / BUDGET) * 100)} %)`);
if (total > BUDGET) {
  console.error('Over budget!');
  process.exit(1);
}
