import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const assetsDir = fileURLToPath(new URL('./assets', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@theme': assetsDir,
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['assets/**/*.js'],
      exclude: [
        // Third-party vendored QR code generator library ("QRCode for Javascript library" by
        // davidshimjs / Kazuhiko Arase, MIT licensed, see file header). Not authored or maintained
        // by this project, so it is excluded the same way a vendored dependency would be.
        'assets/qr-code-generator.js',
        // Vendored popover-attribute polyfill for older Safari (see https://popover.oddbird.net/).
        // Ships as compiled/minified-style third-party output (`@ts-nocheck`, no readable source
        // mapping), so it is excluded the same way a vendored dependency would be.
        'assets/popover-polyfill.js',
        // Type-only declaration file, contains no executable code.
        'assets/global.d.ts',
      ],
    },
  },
});
