/**
 * Chrome Cookie 提取服务
 * 通过复制 Chrome 数据库文件（避免锁冲突）+ 解密实现全平台无感知读取
 */

import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { execSync, spawnSync } from 'child_process';
import { getCookieCacheDir } from './cookies';

// ============================================================================
// 类型定义
// ============================================================================

interface RawCookie {
  host_key: string;
  name: string;
  encrypted_value: Buffer;
  path: string;
  expires_utc: number;
  is_secure: number;
  is_httponly: number;
}

interface DecryptedCookie {
  domain: string;
  name: string;
  value: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
}

export interface ExtractCookiesResult {
  success: boolean;
  cookieFile?: string;
  cookieCount?: number;
  error?: string;
}

export type SupportedBrowser = 'chrome' | 'edge' | 'chromium' | 'brave' | 'opera' | 'vivaldi';

// ============================================================================
// 浏览器路径配置
// ============================================================================

function getBrowserPaths(browser: SupportedBrowser): { cookiePath: string; localStatePath: string } | null {
  const platform = process.platform;
  const home = os.homedir();

  const paths: Record<string, Record<SupportedBrowser, { cookies: string; localState: string } | null>> = {
    win32: {
      chrome: {
        cookies: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Default', 'Network', 'Cookies'),
        localState: path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'User Data', 'Local State'),
      },
      edge: {
        cookies: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Default', 'Network', 'Cookies'),
        localState: path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'Edge', 'User Data', 'Local State'),
      },
      chromium: {
        cookies: path.join(process.env.LOCALAPPDATA || '', 'Chromium', 'User Data', 'Default', 'Network', 'Cookies'),
        localState: path.join(process.env.LOCALAPPDATA || '', 'Chromium', 'User Data', 'Local State'),
      },
      brave: {
        cookies: path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Network', 'Cookies'),
        localState: path.join(process.env.LOCALAPPDATA || '', 'BraveSoftware', 'Brave-Browser', 'User Data', 'Local State'),
      },
      opera: {
        cookies: path.join(process.env.APPDATA || '', 'Opera Software', 'Opera Stable', 'Network', 'Cookies'),
        localState: path.join(process.env.APPDATA || '', 'Opera Software', 'Opera Stable', 'Local State'),
      },
      vivaldi: {
        cookies: path.join(process.env.LOCALAPPDATA || '', 'Vivaldi', 'User Data', 'Default', 'Network', 'Cookies'),
        localState: path.join(process.env.LOCALAPPDATA || '', 'Vivaldi', 'User Data', 'Local State'),
      },
    },
    darwin: {
      chrome: {
        cookies: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Cookies'),
        localState: path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Local State'),
      },
      edge: {
        cookies: path.join(home, 'Library', 'Application Support', 'Microsoft Edge', 'Default', 'Cookies'),
        localState: path.join(home, 'Library', 'Application Support', 'Microsoft Edge', 'Local State'),
      },
      chromium: {
        cookies: path.join(home, 'Library', 'Application Support', 'Chromium', 'Default', 'Cookies'),
        localState: path.join(home, 'Library', 'Application Support', 'Chromium', 'Local State'),
      },
      brave: {
        cookies: path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'Default', 'Cookies'),
        localState: path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'Local State'),
      },
      opera: {
        cookies: path.join(home, 'Library', 'Application Support', 'com.operasoftware.Opera', 'Cookies'),
        localState: path.join(home, 'Library', 'Application Support', 'com.operasoftware.Opera', 'Local State'),
      },
      vivaldi: {
        cookies: path.join(home, 'Library', 'Application Support', 'Vivaldi', 'Default', 'Cookies'),
        localState: path.join(home, 'Library', 'Application Support', 'Vivaldi', 'Local State'),
      },
    },
    linux: {
      chrome: {
        cookies: path.join(home, '.config', 'google-chrome', 'Default', 'Cookies'),
        localState: path.join(home, '.config', 'google-chrome', 'Local State'),
      },
      edge: {
        cookies: path.join(home, '.config', 'microsoft-edge', 'Default', 'Cookies'),
        localState: path.join(home, '.config', 'microsoft-edge', 'Local State'),
      },
      chromium: {
        cookies: path.join(home, '.config', 'chromium', 'Default', 'Cookies'),
        localState: path.join(home, '.config', 'chromium', 'Local State'),
      },
      brave: {
        cookies: path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'Default', 'Cookies'),
        localState: path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'Local State'),
      },
      opera: {
        cookies: path.join(home, '.config', 'opera', 'Cookies'),
        localState: path.join(home, '.config', 'opera', 'Local State'),
      },
      vivaldi: {
        cookies: path.join(home, '.config', 'vivaldi', 'Default', 'Cookies'),
        localState: path.join(home, '.config', 'vivaldi', 'Local State'),
      },
    },
  };

  const platformPaths = paths[platform];
  if (!platformPaths) return null;

  const browserPaths = platformPaths[browser];
  if (!browserPaths) return null;

  return {
    cookiePath: browserPaths.cookies,
    localStatePath: browserPaths.localState,
  };
}

// ============================================================================
// 数据库复制（避免锁冲突）
// ============================================================================

function copyDatabaseFiles(sourcePath: string, destDir: string): string {
  const destPath = path.join(destDir, 'Cookies_copy');

  // 复制主文件
  fs.copyFileSync(sourcePath, destPath);

  // 复制 WAL 文件（如存在）- 确保获取最新未提交的数据
  const walPath = sourcePath + '-wal';
  if (fs.existsSync(walPath)) {
    fs.copyFileSync(walPath, destPath + '-wal');
  }

  // 复制 SHM 文件（如存在）
  const shmPath = sourcePath + '-shm';
  if (fs.existsSync(shmPath)) {
    fs.copyFileSync(shmPath, destPath + '-shm');
  }

  return destPath;
}

// ============================================================================
// 解密函数 - Windows (DPAPI + AES-256-GCM)
// ============================================================================

function getWindowsDecryptionKey(localStatePath: string): Buffer | null {
  try {
    if (!fs.existsSync(localStatePath)) {
      console.error('[ChromeCookies] Local State 文件不存在:', localStatePath);
      return null;
    }

    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf8'));
    const encryptedKeyBase64 = localState?.os_crypt?.encrypted_key;

    if (!encryptedKeyBase64) {
      console.error('[ChromeCookies] 未找到加密密钥');
      return null;
    }

    // Base64 解码
    const encryptedKey = Buffer.from(encryptedKeyBase64, 'base64');

    // 去掉 "DPAPI" 前缀 (5 bytes)
    const encryptedKeyWithoutPrefix = encryptedKey.slice(5);

    // 使用 PowerShell 调用 DPAPI 解密
    const psScript = `
      Add-Type -AssemblyName System.Security
      $encryptedBytes = [Convert]::FromBase64String('${encryptedKeyWithoutPrefix.toString('base64')}')
      $decryptedBytes = [System.Security.Cryptography.ProtectedData]::Unprotect($encryptedBytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
      [Convert]::ToBase64String($decryptedBytes)
    `;

    const result = spawnSync('powershell', ['-Command', psScript], {
      encoding: 'utf8',
      windowsHide: true,
    });

    if (result.error || result.status !== 0) {
      console.error('[ChromeCookies] DPAPI 解密失败:', result.stderr);
      return null;
    }

    const decryptedKeyBase64 = result.stdout.trim();
    return Buffer.from(decryptedKeyBase64, 'base64');
  } catch (error) {
    console.error('[ChromeCookies] 获取 Windows 解密密钥失败:', error);
    return null;
  }
}

function decryptWindowsCookie(encryptedValue: Buffer, key: Buffer): string {
  try {
    // Chrome 80+ 使用 v10/v11 前缀 + AES-256-GCM
    const prefix = encryptedValue.slice(0, 3).toString();

    if (prefix === 'v10' || prefix === 'v11') {
      // v10/v11: 3字节前缀 + 12字节 nonce + 密文 + 16字节 auth tag
      const nonce = encryptedValue.slice(3, 15);
      const ciphertext = encryptedValue.slice(15, -16);
      const authTag = encryptedValue.slice(-16);

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    }

    // 旧版本可能没有加密
    return encryptedValue.toString('utf8');
  } catch (error) {
    console.error('[ChromeCookies] 解密 Cookie 失败:', error);
    return '';
  }
}

// ============================================================================
// 解密函数 - macOS (Keychain + AES-128-CBC)
// ============================================================================

function getMacOSDecryptionKey(browser: SupportedBrowser): Buffer | null {
  try {
    // 从 Keychain 获取密钥
    // Chrome 使用 "Chrome Safe Storage"，其他浏览器使用对应的名称
    const serviceNames: Record<SupportedBrowser, string> = {
      chrome: 'Chrome Safe Storage',
      edge: 'Microsoft Edge Safe Storage',
      chromium: 'Chromium Safe Storage',
      brave: 'Brave Safe Storage',
      opera: 'Opera Safe Storage',
      vivaldi: 'Vivaldi Safe Storage',
    };

    const serviceName = serviceNames[browser];

    const result = spawnSync('security', ['find-generic-password', '-s', serviceName, '-w'], {
      encoding: 'utf8',
    });

    if (result.error || result.status !== 0) {
      console.error('[ChromeCookies] 从 Keychain 获取密钥失败:', result.stderr);
      return null;
    }

    const password = result.stdout.trim();

    // 使用 PBKDF2 派生密钥
    // Chrome 使用 1003 次迭代，16字节盐 "saltysalt"
    const salt = Buffer.from('saltysalt');
    const key = crypto.pbkdf2Sync(password, salt, 1003, 16, 'sha1');

    return key;
  } catch (error) {
    console.error('[ChromeCookies] 获取 macOS 解密密钥失败:', error);
    return null;
  }
}

function decryptMacOSCookie(encryptedValue: Buffer, key: Buffer): string {
  try {
    // macOS Chrome 使用 v10 前缀 + AES-128-CBC
    const prefix = encryptedValue.slice(0, 3).toString();

    if (prefix === 'v10') {
      // v10: 3字节前缀 + 16字节 IV (全 0x20) + 密文
      const iv = Buffer.alloc(16, 0x20); // ' ' (space)
      const ciphertext = encryptedValue.slice(3);

      const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      decipher.setAutoPadding(true);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    }

    return encryptedValue.toString('utf8');
  } catch (error) {
    console.error('[ChromeCookies] 解密 macOS Cookie 失败:', error);
    return '';
  }
}

// ============================================================================
// 解密函数 - Linux (Secret Service / GNOME Keyring + AES-128-CBC)
// ============================================================================

function getLinuxDecryptionKey(browser: SupportedBrowser): Buffer | null {
  try {
    // 尝试使用 secret-tool 从 GNOME Keyring 获取密钥
    const applicationNames: Record<SupportedBrowser, string> = {
      chrome: 'chrome',
      edge: 'microsoft-edge',
      chromium: 'chromium',
      brave: 'brave',
      opera: 'opera',
      vivaldi: 'vivaldi',
    };

    const appName = applicationNames[browser];

    // 尝试从 Secret Service 获取
    const result = spawnSync(
      'secret-tool',
      ['lookup', 'application', appName],
      { encoding: 'utf8' }
    );

    let password = 'peanuts'; // 默认密码（当没有找到 keyring 条目时）

    if (!result.error && result.status === 0 && result.stdout.trim()) {
      password = result.stdout.trim();
    }

    // 使用 PBKDF2 派生密钥（与 macOS 相同参数）
    const salt = Buffer.from('saltysalt');
    const key = crypto.pbkdf2Sync(password, salt, 1, 16, 'sha1');

    return key;
  } catch (error) {
    console.error('[ChromeCookies] 获取 Linux 解密密钥失败:', error);
    // 使用默认密码
    const salt = Buffer.from('saltysalt');
    return crypto.pbkdf2Sync('peanuts', salt, 1, 16, 'sha1');
  }
}

function decryptLinuxCookie(encryptedValue: Buffer, key: Buffer): string {
  try {
    const prefix = encryptedValue.slice(0, 3).toString();

    if (prefix === 'v10' || prefix === 'v11') {
      const iv = Buffer.alloc(16, 0x20);
      const ciphertext = encryptedValue.slice(3);

      const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
      decipher.setAutoPadding(true);

      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return decrypted.toString('utf8');
    }

    return encryptedValue.toString('utf8');
  } catch (error) {
    console.error('[ChromeCookies] 解密 Linux Cookie 失败:', error);
    return '';
  }
}

// ============================================================================
// SQLite 读取（使用 sql.js 避免原生依赖）
// ============================================================================

async function readCookiesFromDatabase(dbPath: string, domain?: string): Promise<RawCookie[]> {
  // 动态导入 sql.js（纯 JS 实现的 SQLite）
  // 注意：需要先安装 sql.js: npm install sql.js
  try {
    // 使用 Electron 内置的 sqlite3 或者读取文件后用 better-sqlite3
    // 这里使用简单的方案：调用系统 sqlite3 命令行工具
    const query = domain
      ? `SELECT host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly FROM cookies WHERE host_key LIKE '%${domain}%'`
      : `SELECT host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly FROM cookies`;

    // 尝试使用系统 sqlite3
    const result = spawnSync('sqlite3', ['-json', dbPath, query], {
      encoding: 'buffer',
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });

    if (result.error) {
      throw new Error('sqlite3 命令执行失败: ' + result.error.message);
    }

    if (result.status !== 0) {
      // sqlite3 -json 不可用，尝试使用其他方式
      throw new Error('sqlite3 返回错误');
    }

    const jsonStr = result.stdout.toString('utf8');
    if (!jsonStr.trim()) return [];

    const rows = JSON.parse(jsonStr);
    return rows.map((row: Record<string, unknown>) => ({
      host_key: row.host_key as string,
      name: row.name as string,
      encrypted_value: Buffer.from(row.encrypted_value as string, 'base64'),
      path: row.path as string,
      expires_utc: row.expires_utc as number,
      is_secure: row.is_secure as number,
      is_httponly: row.is_httponly as number,
    }));
  } catch {
    // 降级方案：使用 Node.js 读取二进制文件（需要 better-sqlite3 或 sql.js）
    console.warn('[ChromeCookies] sqlite3 CLI 不可用，尝试使用备用方案');
    return readCookiesWithBuiltinSqlite(dbPath, domain);
  }
}

// 备用方案：使用简单的二进制解析或调用其他工具
async function readCookiesWithBuiltinSqlite(dbPath: string, domain?: string): Promise<RawCookie[]> {
  // 这里可以使用 better-sqlite3（需要编译）或 sql.js（纯JS）
  // 为了避免原生模块编译问题，我们使用命令行工具的另一种方式

  const platform = process.platform;

  if (platform === 'darwin' || platform === 'linux') {
    // macOS/Linux 通常有 sqlite3
    const query = domain
      ? `SELECT hex(host_key), hex(name), hex(encrypted_value), hex(path), expires_utc, is_secure, is_httponly FROM cookies WHERE host_key LIKE '%${domain}%'`
      : `SELECT hex(host_key), hex(name), hex(encrypted_value), hex(path), expires_utc, is_secure, is_httponly FROM cookies`;

    const result = spawnSync('sqlite3', ['-separator', '|||', dbPath, query], {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    });

    if (result.error || result.status !== 0) {
      console.error('[ChromeCookies] sqlite3 执行失败:', result.stderr);
      return [];
    }

    const lines = result.stdout.trim().split('\n').filter(Boolean);
    return lines.map((line) => {
      const parts = line.split('|||');
      return {
        host_key: Buffer.from(parts[0], 'hex').toString('utf8'),
        name: Buffer.from(parts[1], 'hex').toString('utf8'),
        encrypted_value: Buffer.from(parts[2], 'hex'),
        path: Buffer.from(parts[3], 'hex').toString('utf8'),
        expires_utc: parseInt(parts[4]) || 0,
        is_secure: parseInt(parts[5]) || 0,
        is_httponly: parseInt(parts[6]) || 0,
      };
    });
  }

  // Windows: 尝试使用 PowerShell + System.Data.SQLite
  if (platform === 'win32') {
    return readCookiesWithPowerShell(dbPath, domain);
  }

  return [];
}

function readCookiesWithPowerShell(dbPath: string, domain?: string): RawCookie[] {
  const whereClause = domain ? `WHERE host_key LIKE '%${domain}%'` : '';
  const psScript = `
    Add-Type -Path "$env:USERPROFILE\\.nuget\\packages\\system.data.sqlite.core\\*\\lib\\net46\\System.Data.SQLite.dll" -ErrorAction SilentlyContinue

    $connString = "Data Source=${dbPath.replace(/\\/g, '\\\\')};Version=3;Read Only=True;"
    $conn = New-Object System.Data.SQLite.SQLiteConnection($connString)
    $conn.Open()

    $cmd = $conn.CreateCommand()
    $cmd.CommandText = "SELECT host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly FROM cookies ${whereClause}"

    $reader = $cmd.ExecuteReader()
    $results = @()

    while ($reader.Read()) {
      $encValue = $reader.GetValue(2)
      $results += @{
        host_key = $reader.GetString(0)
        name = $reader.GetString(1)
        encrypted_value = [Convert]::ToBase64String($encValue)
        path = $reader.GetString(3)
        expires_utc = $reader.GetInt64(4)
        is_secure = $reader.GetInt32(5)
        is_httponly = $reader.GetInt32(6)
      }
    }

    $reader.Close()
    $conn.Close()

    $results | ConvertTo-Json -Compress
  `;

  try {
    const result = spawnSync('powershell', ['-Command', psScript], {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 50 * 1024 * 1024,
    });

    if (result.error || result.status !== 0) {
      console.error('[ChromeCookies] PowerShell 读取失败:', result.stderr);
      return [];
    }

    const jsonStr = result.stdout.trim();
    if (!jsonStr || jsonStr === 'null') return [];

    const data = JSON.parse(jsonStr);
    const rows = Array.isArray(data) ? data : [data];

    return rows.map((row: Record<string, unknown>) => ({
      host_key: row.host_key as string,
      name: row.name as string,
      encrypted_value: Buffer.from(row.encrypted_value as string, 'base64'),
      path: row.path as string,
      expires_utc: row.expires_utc as number,
      is_secure: row.is_secure as number,
      is_httponly: row.is_httponly as number,
    }));
  } catch (error) {
    console.error('[ChromeCookies] PowerShell 解析失败:', error);
    return [];
  }
}

// ============================================================================
// 转换为 Netscape 格式
// ============================================================================

function toNetscapeFormat(cookies: DecryptedCookie[]): string {
  let content = '# Netscape HTTP Cookie File\n';
  content += '# Generated by video-downloader-app\n';
  content += '# https://curl.haxx.se/docs/http-cookies.html\n\n';

  for (const cookie of cookies) {
    if (!cookie.value) continue; // 跳过解密失败的

    const domain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;
    const flag = 'TRUE'; // domain 是否适用于所有子域
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expiry = cookie.expires > 0 ? cookie.expires : 0;

    content += `${domain}\t${flag}\t${cookie.path}\t${secure}\t${expiry}\t${cookie.name}\t${cookie.value}\n`;
  }

  return content;
}

// ============================================================================
// Chrome 时间戳转换
// ============================================================================

function chromeTimestampToUnix(chromeTimestamp: number): number {
  // Chrome 使用从 1601-01-01 开始的微秒时间戳
  // Unix 使用从 1970-01-01 开始的秒时间戳
  // 差值: 11644473600 秒
  if (chromeTimestamp === 0) return 0;
  return Math.floor(chromeTimestamp / 1000000) - 11644473600;
}

// ============================================================================
// 主函数：提取 Chrome Cookie
// ============================================================================

export async function extractChromeCookies(
  browser: SupportedBrowser = 'chrome',
  domain?: string
): Promise<ExtractCookiesResult> {
  const platform = process.platform;
  const timestamp = new Date().toLocaleTimeString();

  console.log(`[${timestamp}] 开始提取 ${browser} Cookie (平台: ${platform}, 域名: ${domain || '全部'})`);

  try {
    // 1. 获取浏览器路径
    const browserPaths = getBrowserPaths(browser);
    if (!browserPaths) {
      return { success: false, error: `不支持的平台或浏览器: ${platform}/${browser}` };
    }

    const { cookiePath, localStatePath } = browserPaths;

    if (!fs.existsSync(cookiePath)) {
      return { success: false, error: `Cookie 数据库不存在: ${cookiePath}` };
    }

    // 2. 复制数据库文件（避免锁冲突）
    const tempDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'chrome-cookies-'));
    const dbCopy = copyDatabaseFiles(cookiePath, tempDir);

    console.log(`[${timestamp}] 已复制数据库到: ${dbCopy}`);

    // 3. 获取解密密钥
    let decryptionKey: Buffer | null = null;

    if (platform === 'win32') {
      decryptionKey = getWindowsDecryptionKey(localStatePath);
    } else if (platform === 'darwin') {
      decryptionKey = getMacOSDecryptionKey(browser);
    } else if (platform === 'linux') {
      decryptionKey = getLinuxDecryptionKey(browser);
    }

    if (!decryptionKey) {
      // 清理临时文件
      fs.rmSync(tempDir, { recursive: true, force: true });
      return { success: false, error: '无法获取解密密钥' };
    }

    console.log(`[${timestamp}] 已获取解密密钥`);

    // 4. 读取 Cookie 数据库
    const rawCookies = await readCookiesFromDatabase(dbCopy, domain);

    console.log(`[${timestamp}] 读取到 ${rawCookies.length} 条 Cookie`);

    // 5. 解密 Cookie
    const decryptedCookies: DecryptedCookie[] = [];

    for (const cookie of rawCookies) {
      let value = '';

      if (platform === 'win32') {
        value = decryptWindowsCookie(cookie.encrypted_value, decryptionKey);
      } else if (platform === 'darwin') {
        value = decryptMacOSCookie(cookie.encrypted_value, decryptionKey);
      } else if (platform === 'linux') {
        value = decryptLinuxCookie(cookie.encrypted_value, decryptionKey);
      }

      if (value) {
        decryptedCookies.push({
          domain: cookie.host_key,
          name: cookie.name,
          value,
          path: cookie.path,
          expires: chromeTimestampToUnix(cookie.expires_utc),
          secure: cookie.is_secure === 1,
          httpOnly: cookie.is_httponly === 1,
        });
      }
    }

    console.log(`[${timestamp}] 成功解密 ${decryptedCookies.length} 条 Cookie`);

    // 6. 转换为 Netscape 格式并保存
    const netscapeContent = toNetscapeFormat(decryptedCookies);

    const cookieDir = getCookieCacheDir();
    const safeDomain = (domain || 'all').replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
    const cookieFile = path.join(cookieDir, `${browser}-${safeDomain}.txt`);

    fs.writeFileSync(cookieFile, netscapeContent, 'utf8');

    console.log(`[${timestamp}] Cookie 文件已保存: ${cookieFile}`);

    // 7. 清理临时文件
    fs.rmSync(tempDir, { recursive: true, force: true });

    return {
      success: true,
      cookieFile,
      cookieCount: decryptedCookies.length,
    };
  } catch (error) {
    console.error(`[${timestamp}] 提取 Cookie 失败:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// ============================================================================
// 检测已安装的浏览器
// ============================================================================

export function detectInstalledBrowsers(): SupportedBrowser[] {
  const browsers: SupportedBrowser[] = ['chrome', 'edge', 'chromium', 'brave', 'opera', 'vivaldi'];
  const installed: SupportedBrowser[] = [];

  for (const browser of browsers) {
    const paths = getBrowserPaths(browser);
    if (paths && fs.existsSync(paths.cookiePath)) {
      installed.push(browser);
    }
  }

  return installed;
}
