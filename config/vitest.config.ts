import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// 项目根目录（config 目录的上一级）
const rootDir = resolve(__dirname, '..');

export default defineConfig({
  test: {
    root: rootDir,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', 'dist-electron'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/electron/**/*.ts'],
      exclude: ['src/electron/**/*.test.ts', 'src/electron/preload.ts', 'src/electron/main.ts'],
    },
    // Mock Electron 模块
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
});
