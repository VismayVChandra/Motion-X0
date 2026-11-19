/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [preact()],
  // Relative asset paths so the build works when served from the ESP32's LittleFS root.
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    reportCompressedSize: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
