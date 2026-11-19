/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
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
