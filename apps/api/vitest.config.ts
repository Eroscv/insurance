import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.spec.ts'],
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
  plugins: [swc.vite({ module: { type: 'es6' }, jsc: { transform: { decoratorMetadata: true, legacyDecorator: true } } })],
});
