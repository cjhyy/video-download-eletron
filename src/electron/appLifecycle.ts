import { app, BrowserWindow } from 'electron';
import { loadUserSettings } from './lib/userSettings';

export function configureGpuWorkarounds(): void {
  /**
   * Security-first defaults:
   * - Do NOT disable sandbox by default
   * - Do NOT disable GPU by default
   *
   * If you hit GPU/driver issues on some machines, enable compatibility mode via:
   * - env: LISTENBD_GPU_COMPAT=1
   * - or CLI: --gpu-compat
   */
  const gpuCompatEnabled =
    process.env.LISTENBD_GPU_COMPAT === '1' ||
    process.argv.includes('--gpu-compat') ||
    loadUserSettings().gpuCompatEnabled;

  if (!gpuCompatEnabled) return;

  // Compatibility mode (may reduce performance, but helps avoid GPU crashes)
  app.disableHardwareAcceleration();

  // NOTE: Intentionally NOT setting '--no-sandbox' here (security risk).
  app.commandLine.appendSwitch('--disable-gpu-sandbox');
  app.commandLine.appendSwitch('--disable-software-rasterizer');
  app.commandLine.appendSwitch('--disable-gpu');
  app.commandLine.appendSwitch('--disable-gpu-compositing');
  app.commandLine.appendSwitch('--disable-accelerated-2d-canvas');
  app.commandLine.appendSwitch('--disable-accelerated-video-decode');
  app.commandLine.appendSwitch('--use-gl', 'swiftshader');
  app.commandLine.appendSwitch('--ignore-gpu-blacklist');
  app.commandLine.appendSwitch('--disable-dev-shm-usage');
  app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
  app.commandLine.appendSwitch('--disable-gpu-memory-buffer-compositor-resources');
  app.commandLine.appendSwitch('--disable-gpu-memory-buffer-video-frames');
  app.commandLine.appendSwitch('--disable-background-timer-throttling');
  app.commandLine.appendSwitch('--disable-renderer-backgrounding');
  app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
  app.commandLine.appendSwitch('--disable-ipc-flooding-protection');
}

export function registerAppLifecycle(createWindow: () => void): void {
  // Electron 初始化完成并准备创建浏览器窗口
  app.whenReady().then(createWindow);

  // 标记是否正在退出，用于托盘逻辑
  app.on('before-quit', () => {
    (app as any).isQuitting = true;
  });

  // 当所有窗口都关闭时退出应用
  app.on('window-all-closed', () => {
    if (process.platform === 'darwin') return;

    // If "close to tray" is enabled and user isn't explicitly quitting, keep running in tray.
    const settings = loadUserSettings();
    if (settings.closeToTray && !(app as any).isQuitting) return;

    // Otherwise, exit normally.
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}



