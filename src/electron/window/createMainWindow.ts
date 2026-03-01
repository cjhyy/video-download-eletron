import { BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { loadUserSettings } from '../lib/userSettings';

/**
 * 解析 preload 脚本路径
 * 开发环境和生产环境都使用相同路径，因为 Vite 将 main.js 和 preload.js 输出到同一目录
 */
function resolvePreloadPath(): string {
  // __dirname 在开发和生产环境都指向 dist-electron 目录
  const preloadPath = path.join(__dirname, 'preload.js');

  // 添加路径存在性检查，便于调试
  if (!fs.existsSync(preloadPath)) {
    console.error(`[createMainWindow] Preload script not found at: ${preloadPath}`);
    console.error(`[createMainWindow] __dirname: ${__dirname}`);
    console.error(`[createMainWindow] app.isPackaged: ${app.isPackaged}`);
  }

  return preloadPath;
}

/**
 * 解析渲染进程 HTML 文件路径
 */
function resolveRendererPath(): string {
  // 生产环境：从 dist-electron/../dist/index.html 加载
  // 相当于 <app>/dist/index.html
  return path.join(__dirname, '../dist/index.html');
}

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
  const preloadPath = resolvePreloadPath();

  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true, // 隐藏菜单栏，按下 Alt 键可显示（如果 Menu 不为 null）
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
    icon: resolveWindowIconPath(),
    show: false,
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    const htmlPath = resolveRendererPath();
    console.log(`[createMainWindow] Loading renderer from: ${htmlPath}`);
    win.loadFile(htmlPath);
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



