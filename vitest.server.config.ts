import { defineConfig } from 'vitest/config';
import path from 'node:path';

const apiRoot = path.resolve(__dirname, './apps/api');
const packagesRoot = path.resolve(__dirname, './packages');
const brainRoot = path.resolve(__dirname, './brain');
const domainsRoot = path.resolve(__dirname, './domains');
const platformRoot = path.resolve(__dirname, './platform');
const interfacesRoot = path.resolve(__dirname, './interfaces');

export default defineConfig({
  test: {
    include: [
      'apps/api/**/*.{test,spec}.ts',
      'brain/**/*.{test,spec}.ts',
      'domains/**/*.{test,spec}.ts',
      'platform/**/*.{test,spec}.ts',
      'interfaces/**/*.{test,spec}.ts',

    ],
    exclude: ['node_modules', 'dist', 'client', 'apps/web'],
    environment: 'node',
    globals: true,
    root: '.',
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      reportsDirectory: './coverage/server',
      include: [
        'apps/api/**/*.ts',
        'brain/**/*.ts',
        'domains/**/*.ts',
        'interfaces/**/*.ts',
        'platform/**/*.ts',
        'packages/**/*.ts',
      ],
      exclude: [
        'apps/api/**/*.{test,spec}.ts',
        'brain/**/*.{test,spec}.ts',
        'domains/**/*.{test,spec}.ts',
        'platform/**/*.{test,spec}.ts',
        'interfaces/**/*.{test,spec}.ts',

        'interfaces/**/__tests__/**',
        'platform/**/__tests__/**',
        'brain/**/__tests__/**',
        'domains/**/__tests__/**',
        'interfaces/types/**',
        'interfaces/**/index.ts',
        'platform/**/index.ts',
        'brain/**/index.ts',
        'domains/**/index.ts',
        'interfaces/vite.ts',
      ],
      thresholds: {
        lines: 15,
        functions: 12,
        branches: 35,
        statements: 15,
      },
    },
  },
  resolve: {
    alias: {
      '@server': apiRoot,
      '@api': apiRoot,
      '@': apiRoot,
      '@shared': packagesRoot,
      '@packages': packagesRoot,
      '@brain': brainRoot,
      '@domains': domainsRoot,
      '@platform': platformRoot,
      '@interfaces': interfacesRoot,
    },
  },
});
