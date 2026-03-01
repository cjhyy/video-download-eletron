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

// 各网站登录状态 Cookie 特征
const LOGIN_COOKIE_PATTERNS: Record<string, { required: string[]; usernameKey?: string }> = {
  'youtube.com': {
    required: ['LOGIN_INFO', 'SID', 'HSID'],
  },
  'bilibili.com': {
    required: ['SESSDATA', 'bili_jct', 'DedeUserID'],
    usernameKey: 'DedeUserID__ckMd5', // B站用户名需要从页面获取
  },
  'twitter.com': {
    required: ['auth_token', 'ct0'],
  },
  'x.com': {
    required: ['auth_token', 'ct0'],
  },
  'instagram.com': {
    required: ['sessionid', 'ds_user_id'],
  },
  'tiktok.com': {
    required: ['sessionid', 'sid_tt'],
  },
  'weibo.com': {
    required: ['SUB', 'SUBP'],
  },
};

// 从页面获取用户名的 JS 脚本
const getUsernameScripts: Record<string, string> = {
  'youtube.com': `
    (function() {
      // 方法1: 从账号按钮获取
      const btn = document.querySelector('button#avatar-btn');
      if (btn) {
        const img = btn.querySelector('img');
        if (img && img.alt) return img.alt;
      }
      // 方法2: 从页面数据获取
      const ytInitData = window.ytInitialData;
      if (ytInitData?.responseContext?.serviceTrackingParams) {
        for (const p of ytInitData.responseContext.serviceTrackingParams) {
          if (p.params) {
            for (const param of p.params) {
              if (param.key === 'logged_in_username') return param.value;
            }
          }
        }
      }
      return null;
    })()
  `,
  'bilibili.com': `
    (function() {
      // 方法1: 从头像悬浮获取
      const nameEl = document.querySelector('.header-entry-mini .nickname') ||
                     document.querySelector('.user-name') ||
                     document.querySelector('.bili-header__username');
      if (nameEl) return nameEl.textContent?.trim();
      // 方法2: 从全局变量获取
      if (window.__INITIAL_STATE__?.user?.uname) return window.__INITIAL_STATE__.user.uname;
      return null;
    })()
  `,
  'twitter.com': `
    (function() {
      const nameEl = document.querySelector('[data-testid="UserName"]');
      if (nameEl) return nameEl.textContent?.split('@')[0]?.trim();
      return null;
    })()
  `,
  'x.com': `
    (function() {
      const nameEl = document.querySelector('[data-testid="UserName"]');
      if (nameEl) return nameEl.textContent?.split('@')[0]?.trim();
      return null;
    })()
  `,
};

// 匹配域名获取配置
function getLoginConfig(domain: string): { required: string[]; usernameKey?: string } | null {
  for (const [pattern, config] of Object.entries(LOGIN_COOKIE_PATTERNS)) {
    if (domain.includes(pattern)) {
      return config;
    }
  }
  return null;
}

// 获取用户名脚本
function getUsernameScript(domain: string): string | null {
  for (const [pattern, script] of Object.entries(getUsernameScripts)) {
    if (domain.includes(pattern)) {
      return script;
    }
  }
  return null;
}

export async function loginAndGetCookies(url: string, domainForFilename: string): Promise<LoginAndGetCookiesResult> {
  return new Promise((resolve) => {
    // 从 URL 提取目标域名
    let targetDomain: string;
    try {
      targetDomain = new URL(url).hostname;
    } catch {
      resolve({ success: false, error: '无效的URL' });
      return;
    }

    const loginConfig = getLoginConfig(targetDomain);
    let extractedUsername: string | null = null;

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
        const allCookies = await session.defaultSession.cookies.get({});

        // 只过滤目标域的 Cookie
        const targetCookies = allCookies.filter((cookie) => {
          const cookieDomain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain;
          return targetDomain === cookieDomain || targetDomain.endsWith('.' + cookieDomain);
        });

        console.log(`[${new Date().toLocaleTimeString()}] 总Cookie: ${allCookies.length}, 目标域 ${targetDomain}: ${targetCookies.length}`);

        if (targetCookies.length === 0) {
          resolve({ success: false, error: `未获取到 ${targetDomain} 的Cookie，请确保已完成登录` });
          return;
        }

        // 检查是否包含登录必需的 Cookie
        if (loginConfig) {
          const cookieNames = targetCookies.map((c) => c.name);
          const missingCookies = loginConfig.required.filter((name) => !cookieNames.includes(name));

          if (missingCookies.length > 0) {
            console.log(`[${new Date().toLocaleTimeString()}] 缺少登录Cookie: ${missingCookies.join(', ')}`);
            resolve({
              success: false,
              error: `未检测到登录状态，请先登录后再关闭窗口（缺少: ${missingCookies.join(', ')}）`
            });
            return;
          }
          console.log(`[${new Date().toLocaleTimeString()}] 登录Cookie验证通过`);
        } else {
          // 没有配置的网站，使用通用检查
          const meaningfulCookies = targetCookies.filter(
            (c) => c.value && c.value.length > 10 && !c.name.startsWith('_ga')
          );
          if (meaningfulCookies.length < 2) {
            resolve({
              success: false,
              error: `获取到 ${targetCookies.length} 个Cookie，但似乎未包含登录信息，请先登录后再关闭窗口`
            });
            return;
          }
        }

        const cookieDir = getCookieCacheDir();
        const safeDomain = domainForFilename.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
        const cookieFile = path.join(cookieDir, `${safeDomain}.txt`);

        // Netscape格式：domain flag path secure expiration name value
        let cookieContent = '# Netscape HTTP Cookie File\n';
        cookieContent += '# This is a generated file! Do not edit.\n\n';

        targetCookies.forEach((cookie) => {
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
        console.log(`[${new Date().toLocaleTimeString()}] Cookie文件已创建: ${cookieFile}, 共 ${targetCookies.length} 条`);

        // 返回结果，包含用户名（如果获取到）
        if (extractedUsername) {
          console.log(`[${new Date().toLocaleTimeString()}] 登录用户: ${extractedUsername}`);
          resolve({ success: true, cookieFile, username: extractedUsername });
        } else {
          resolve({ success: true, cookieFile });
        }
      } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Cookie提取失败:`, error);
        resolve({ success: false, error: (error as Error).message });
      }
    });

    loginWindow.webContents.on('did-finish-load', () => {
      // 添加浮动提示
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

      // 尝试获取用户名
      const usernameScript = getUsernameScript(targetDomain);
      if (usernameScript) {
        loginWindow.webContents
          .executeJavaScript(usernameScript)
          .then((username) => {
            if (username && typeof username === 'string') {
              extractedUsername = username;
              console.log(`[${new Date().toLocaleTimeString()}] 检测到用户名: ${username}`);
            }
          })
          .catch(() => {
            // 获取用户名失败，忽略
          });
      }
    });

    // 定时检查用户名（某些网站登录后不会刷新页面）
    const usernameCheckInterval = setInterval(() => {
      if (resolved || loginWindow.isDestroyed()) {
        clearInterval(usernameCheckInterval);
        return;
      }

      const usernameScript = getUsernameScript(targetDomain);
      if (usernameScript) {
        loginWindow.webContents
          .executeJavaScript(usernameScript)
          .then((username) => {
            if (username && typeof username === 'string' && !extractedUsername) {
              extractedUsername = username;
              console.log(`[${new Date().toLocaleTimeString()}] 检测到用户名: ${username}`);
            }
          })
          .catch(() => {});
      }
    }, 2000);
  });
}



