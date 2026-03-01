import type { SupportedBrowser } from '../../../shared/electron';
import { clearCookieCache, copyCookieFile, loginAndGetCookies } from '../../services/cookies';
import { extractChromeCookies, detectInstalledBrowsers } from '../../services/chromeCookies';
import { bilibiliGetQRCode, bilibiliCheckQRStatus } from '../../services/bilibiliLogin';
import {
  validateSafeFilePath,
  validateUrl,
  validateDomain,
  validateBrowser,
  validateOptionalDomain,
  validateQrKey,
} from '../validate';

/**
 * Cookie 相关操作的 IPC 处理器
 * 独立于 IPC 层，便于单元测试
 */
export class CookieHandlers {
  /** 复制 Cookie 文件到本地目录 */
  async copyCookieFile(sourcePath: string, domain: string): Promise<{ success: boolean; path?: string; error?: string }> {
    const safePath = validateSafeFilePath(sourcePath, 'sourcePath');
    const validDomain = validateDomain(domain);
    return copyCookieFile(safePath, validDomain);
  }

  /** 登录并获取 Cookies */
  async loginAndGetCookies(url: string, domain: string): Promise<{ success: boolean; cookieFile?: string; error?: string }> {
    const validUrl = validateUrl(url);
    const validDomain = validateDomain(domain);
    return loginAndGetCookies(validUrl, validDomain);
  }

  /** 清除 Cookie 缓存 */
  async clearCookieCache(): Promise<{ success: boolean }> {
    return clearCookieCache();
  }

  /** 从浏览器提取 Cookie */
  async extractBrowserCookies(browser: string, domain?: string): Promise<{ success: boolean; cookieFile?: string; cookieCount?: number; error?: string }> {
    const validBrowser = validateBrowser(browser);
    const validDomain = validateOptionalDomain(domain);
    return extractChromeCookies(validBrowser, validDomain);
  }

  /** 检测已安装的浏览器 */
  async detectInstalledBrowsers(): Promise<SupportedBrowser[]> {
    return detectInstalledBrowsers();
  }

  /** Bilibili 扫码登录 - 获取二维码 */
  async bilibiliGetQRCode(): Promise<{ success: boolean; url?: string; qrKey?: string; error?: string }> {
    return bilibiliGetQRCode();
  }

  /** Bilibili 扫码登录 - 检查扫码状态 */
  async bilibiliCheckQRStatus(qrKey: string): Promise<{ success: boolean; status?: string; cookieFile?: string; error?: string }> {
    const validQrKey = validateQrKey(qrKey);
    return bilibiliCheckQRStatus(validQrKey);
  }
}

// 导出单例
export const cookieHandlers = new CookieHandlers();
