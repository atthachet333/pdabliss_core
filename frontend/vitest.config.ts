import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      // Role queries over a full Control Center shell are CPU-bound in jsdom;
      // under machine load the 5 s default timed out tests that pass in
      // ~150 ms when idle (EP27 investigation, reproduced on the EP26
      // baseline). A hang still fails — later.
      testTimeout: 15_000,
    },
  }),
);
