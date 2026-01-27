import { BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { loadUserSettings } from '../lib/userSettings';

function resolveWindowIconPath(): string | undefined {
  // BrowserWindow icon works best with .ico on Windows, .png elsewhere. We'll try common names.
  const candidates = process.env.VITE_DEV_SERVER_URL
    ? [
        path.join(process.cwd(), 'assets', 'icon.ico'),
        path.join(process.cwd(), 'assets', 'icon.png'),
      ]
    : [
        path.join(process.resourcesPath, 'assets', 'icon.ico'),
        path.join(process.resourcesPath, 'assets', 'icon.png'),
      ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return undefined;
}

export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true, // 隐藏菜单栏，按下 Alt 键可显示（如果 Menu 不为 null）
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: resolveWindowIconPath(),
    show: false,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  // 处理窗口关闭事件：根据设置决定隐藏还是退出
  win.on('close', (event) => {
    const settings = loadUserSettings();
    if (!(app as any).isQuitting && settings.closeToTray) {
      event.preventDefault();
      win.hide();
    }
    return false;
  });

  return win;
}



