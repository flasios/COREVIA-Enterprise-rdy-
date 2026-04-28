import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const webRoot = path.resolve(__dirname, './apps/web');
const packagesRoot = path.resolve(__dirname, './packages');
const webSetupFile = path.resolve(webRoot, 'test/setup.ts');

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['apps/web/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'apps/api'],
    environment: 'jsdom',
    globals: true,
    root: '.',
    testTimeout: 10000,
    setupFiles: [webSetupFile],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'lcov', 'json-summary'],
      reportsDirectory: './coverage/client',
      include: ['apps/web/**/*.{ts,tsx}'],
      exclude: [
        'apps/web/**/*.{test,spec}.{ts,tsx}',
        'apps/web/**/test/**',
        'apps/web/dist/**',
        'apps/web/index.html',
      ],
      thresholds: {
        lines: 5,
        functions: 5,
        branches: 5,
        statements: 5,
      },
    },
  },
  resolve: {
    alias: {
      '@/contexts': path.resolve(webRoot, 'app/contexts'),
      '@/pages': path.resolve(webRoot, 'app/pages'),
      '@/lib': path.resolve(webRoot, 'shared/lib'),
      '@/api': path.resolve(webRoot, 'services/api'),
      '@/features': path.resolve(webRoot, 'modules'),
      '@': webRoot,
      '@web': webRoot,
      '@shared': packagesRoot,
      '@packages': packagesRoot,
    },
  },
});
