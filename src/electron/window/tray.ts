import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

let tray: Tray | null = null;

function resolveTrayIconPath(): string | null {
  // Prefer platform-friendly formats (Windows: .ico; others: .png)
  const candidates = app.isPackaged
    ? [
        path.join(process.resourcesPath, 'assets', 'tray.ico'),
        path.join(process.resourcesPath, 'assets', 'icon.ico'),
        path.join(process.resourcesPath, 'assets', 'tray.png'),
        path.join(process.resourcesPath, 'assets', 'icon.png'),
      ]
    : [
        path.join(process.cwd(), 'assets', 'tray.ico'),
        path.join(process.cwd(), 'assets', 'icon.ico'),
        path.join(process.cwd(), 'assets', 'tray.png'),
        path.join(process.cwd(), 'assets', 'icon.png'),
      ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      // ignore
    }
  }
  return null;
}

export function createTray(getMainWindow: () => BrowserWindow | null): Tray {
  if (tray) return tray;

  // Create tray ASAP; set image after we resolve icon.
  tray = new Tray(nativeImage.createEmpty());

  const iconPath = resolveTrayIconPath();
  if (iconPath) {
    const img = nativeImage.createFromPath(iconPath);
    if (!img.isEmpty()) {
      tray.setImage(img);
    } else {
      console.warn('Tray icon is empty at:', iconPath);
    }
  } else {
    // Fallback: use OS/exe icon (works even if we ship no assets)
    void app
      .getFileIcon(process.execPath, { size: 'small' })
      .then((img) => tray?.setImage(img))
      .catch((e) => console.warn('Failed to getFileIcon for tray fallback:', e?.message || e));
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        const win = getMainWindow();
        if (win) {
          win.show();
          win.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: '退出应用',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setToolTip('Video Downloader');
  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    const win = getMainWindow();
    if (win) {
      if (win.isVisible()) {
        win.hide();
      } else {
        win.show();
        win.focus();
      }
    }
  });

  return tray;
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

