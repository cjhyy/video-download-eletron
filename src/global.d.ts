import type { ElectronAPI } from './shared/electron';

export {};

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

