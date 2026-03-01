import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import electronRenderer from 'vite-plugin-electron-renderer';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ESM 环境下获取 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 项目根目录（config 目录的上一级）
const rootDir = resolve(__dirname, '..');

export default defineConfig({
  root: rootDir,
  plugins: [
    react(),
    electron([
      {
        entry: 'src/electron/main.ts',
        onstart(options) {
          // 启动Electron
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      },
      {
        entry: 'src/electron/preload.ts',
        onstart(options) {
          // 重新加载渲染进程
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron'
          }
        }
      }
    ]),
    electronRenderer()
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
      '@renderer': resolve(rootDir, 'src/renderer')
    }
  },
  css: {
    postcss: resolve(__dirname, 'postcss.config.js')
  },
  server: {
    port: 5173
  }
});

