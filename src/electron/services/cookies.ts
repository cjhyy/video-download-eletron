import { BrowserWindow, app, session } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import type {
  ClearCookieCacheResult,
  CopyCookieFileResult,
  LoginAndGetCookiesResult,
} from '../../shared/electron';

// 获取Cookie缓存目录
export function getCookieCacheDir(): string {
  const tempDir = app.getPath('temp');
  const cookieDir = path.join(tempDir, 'yt-dlp-cookie');

  // 确保目录存在
  if (!fs.existsSync(cookieDir)) {
    fs.mkdirSync(cookieDir, { recursive: true });
  }

  return cookieDir;
}

export function copyCookieFile(sourcePath: string, domain: string): CopyCookieFileResult {
  try {
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '源文件不存在' };
    }

    if (!sourcePath.toLowerCase().endsWith('.txt')) {
      return { success: false, error: '只支持.txt格式的Cookie文件' };
    }

    const cookieDir = getCookieCacheDir();
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
    const targetPath = path.join(cookieDir, `${safeDomain}.txt`);

    fs.copyFileSync(sourcePath, targetPath);
    console.log(`[${new Date().toLocaleTimeString()}] Cookie文件已复制: ${sourcePath} -> ${targetPath}`);

    return { success: true, cookieFile: targetPath };
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] 复制Cookie文件失败:`, error);
    return { success: false, error: (error as Error).message };
  }
}

export async function clearCookieCache(): Promise<ClearCookieCacheResult> {
  try {
    const cookieDir = getCookieCacheDir();

    if (!fs.existsSync(cookieDir)) {
      return { success: true, message: 'Cookie缓存目录不存在，无需清理' };
    }

    const files = fs.readdirSync(cookieDir);
    let deletedCount = 0;

    for (const file of files) {
      if (file.endsWith('.txt')) {
        const filePath = path.join(cookieDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`[${new Date().toLocaleTimeString()}] 已删除Cookie文件: ${file}`);
        } catch (err) {
          console.error(`[${new Date().toLocaleTimeString()}] 删除文件失败: ${file}`, err);
        }
      }
    }

    const message = deletedCount > 0 ? `成功清除 ${deletedCount} 个Cookie缓存文件` : 'Cookie缓存目录为空';
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);

    return { success: true, message };
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] 清除Cookie缓存失败:`, error);
    return { success: false, error: (error as Error).message };
  }
}

export async function loginAndGetCookies(url: string, domainForFilename: string): Promise<LoginAndGetCookiesResult> {
  return new Promise((resolve) => {
    const loginWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      backgroundColor: '#ffffff',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: session.defaultSession,
      },
      title: '登录以获取Cookie - 登录成功后请关闭此窗口',
      autoHideMenuBar: true,
    });

    loginWindow.loadURL(url);

    let resolved = false;

    // If the window is blank, it is often GPU/render process crash or navigation failure.
    loginWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      console.error(
        `[${new Date().toLocaleTimeString()}] 登录窗口加载失败: ${errorCode} ${errorDescription} (${validatedURL})`
      );
    });

    loginWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[${new Date().toLocaleTimeString()}] 登录窗口渲染进程异常:`, details);
      if (resolved) return;
      resolved = true;
      resolve({
        success: false,
        error:
          '登录窗口渲染失败（常见原因：GPU/驱动崩溃导致白屏）。请在“设置”开启 GPU 兼容模式并重启应用后重试。',
      });
      try {
        loginWindow.close();
      } catch {
        // ignore
      }
    });

    loginWindow.on('closed', async () => {
      if (resolved) return;
      resolved = true;

      try {
        const cookies = await session.defaultSession.cookies.get({});

        console.log(`[${new Date().toLocaleTimeString()}] 获取到 ${cookies.length} 个Cookie`);

        if (cookies.length === 0) {
          resolve({ success: false, error: '未获取到Cookie，请确保已完成登录' });
          return;
        }

        const cookieDir = getCookieCacheDir();
        const safeDomain = domainForFilename.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
        const cookieFile = path.join(cookieDir, `${safeDomain}.txt`);

        // Netscape格式：domain flag path secure expiration name value
        let cookieContent = '# Netscape HTTP Cookie File\n';
        cookieContent += '# This is a generated file! Do not edit.\n\n';

        cookies.forEach((cookie) => {
          const domain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;
          const flag = 'TRUE';
          const cookiePath = cookie.path || '/';
          const secure = cookie.secure ? 'TRUE' : 'FALSE';
          const expiration = cookie.expirationDate ? Math.floor(cookie.expirationDate) : '0';
          const name = cookie.name;
          const value = cookie.value;

          cookieContent += `${domain}\t${flag}\t${cookiePath}\t${secure}\t${expiration}\t${name}\t${value}\n`;
        });

        fs.writeFileSync(cookieFile, cookieContent, 'utf8');
        console.log(`[${new Date().toLocaleTimeString()}] Cookie文件已创建: ${cookieFile}`);
        console.log(`[${new Date().toLocaleTimeString()}] Cookie内容长度: ${cookieContent.length} 字符`);

        resolve({ success: true, cookieFile });
      } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Cookie提取失败:`, error);
        resolve({ success: false, error: (error as Error).message });
      }
    });

    loginWindow.webContents.on('did-finish-load', () => {
      loginWindow.webContents
        .executeJavaScript(
          `
        // 添加一个浮动提示
        const hint = document.createElement('div');
        hint.innerHTML = '<div style="position:fixed;top:10px;right:10px;background:#4caf50;color:white;padding:15px 20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:999999;font-family:Arial;font-size:14px;">✅ 登录成功后请关闭此窗口以保存Cookie</div>';
        document.body.appendChild(hint);
      `
        )
        .catch(() => {
          // 某些页面可能不允许执行脚本，忽略错误
        });
    });
  });
}



