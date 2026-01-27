import { app, BrowserWindow, Menu } from 'electron';
import { configureGpuWorkarounds, registerAppLifecycle } from './appLifecycle';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import { createMainWindow } from './window/createMainWindow';
import { createTray } from './window/tray';
import { configureAppPaths } from './paths';
import { loadUserSettings } from './lib/userSettings';

let mainWindow: BrowserWindow | null = null;

const getMainWindow = () => mainWindow;

// Ensure cache/userData paths are writable before anything reads userData.
configureAppPaths();

// Prevent multiple instances from racing on the same cache/userData directory (common cause of 0x5).
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function createWindow(): void {
  // 去掉默认菜单栏 (File, Edit, View 等)
  Menu.setApplicationMenu(null);

  mainWindow = createMainWindow();

  // 初始化托盘（仅当“关闭到托盘”开启时）
  const settings = loadUserSettings();
  if (settings.closeToTray) {
    createTray(getMainWindow);
  }

  // 当窗口被关闭时，取消引用窗口对象
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

configureGpuWorkarounds();
registerAppLifecycle(createWindow);
registerIpcHandlers(getMainWindow);
