import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { DownloadOptions, SupportedBrowser } from '../../shared/electron';
import type { UserSettingsUpdateParams } from './types';
import { IpcError } from './ipcError';

/**
 * 获取允许访问的安全目录列表
 * 限制文件操作只能在这些目录下进行，防止路径遍历攻击
 */
function getSafeDirectories(): string[] {
  const home = os.homedir();
  const safeDirs = [
    home, // 用户主目录
    app.getPath('userData'), // 应用数据目录
    app.getPath('temp'), // 临时目录
    app.getPath('downloads'), // 下载目录
    app.getPath('documents'), // 文档目录
    app.getPath('desktop'), // 桌面
    app.getPath('videos'), // 视频目录
    app.getPath('music'), // 音乐目录
  ];
  return safeDirs.filter(Boolean);
}

/**
 * 验证路径是否在安全目录内
 * 防止路径遍历攻击（如 ../../etc/passwd）
 */
export function validateSafePath(filePath: unknown, fieldName: string): string {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new IpcError('VALIDATION_ERROR', `Invalid ${fieldName}: must be a non-empty string`);
  }

  // 规范化路径，解析 .. 和 . 等相对路径组件
  const normalizedPath = path.resolve(filePath);

  // 检查路径是否在安全目录内
  const safeDirs = getSafeDirectories();
  const isInSafeDir = safeDirs.some(safeDir => {
    const normalizedSafeDir = path.resolve(safeDir);
    return normalizedPath.startsWith(normalizedSafeDir + path.sep) || normalizedPath === normalizedSafeDir;
  });

  if (!isInSafeDir) {
    throw new IpcError('PERMISSION_DENIED', `Access denied: ${fieldName} is outside allowed directories`);
  }

  return normalizedPath;
}

/**
 * 验证文件路径（必须存在且在安全目录内）
 */
export function validateSafeFilePath(filePath: unknown, fieldName: string): string {
  const safePath = validateSafePath(filePath, fieldName);

  if (!fs.existsSync(safePath)) {
    throw new IpcError('NOT_FOUND', `${fieldName} does not exist`);
  }

  const stat = fs.statSync(safePath);
  if (!stat.isFile()) {
    throw new IpcError('VALIDATION_ERROR', `${fieldName} is not a file`);
  }

  return safePath;
}

/**
 * 验证目录路径（必须存在且在安全目录内）
 */
export function validateSafeDirPath(dirPath: unknown, fieldName: string): string {
  const safePath = validateSafePath(dirPath, fieldName);

  if (!fs.existsSync(safePath)) {
    throw new IpcError('NOT_FOUND', `${fieldName} does not exist`);
  }

  const stat = fs.statSync(safePath);
  if (!stat.isDirectory()) {
    throw new IpcError('VALIDATION_ERROR', `${fieldName} is not a directory`);
  }

  return safePath;
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function assertNonEmptyString(v: unknown, field: string): string {
  if (!isNonEmptyString(v)) throw new IpcError('VALIDATION_ERROR', `Invalid ${field}`);
  return v.trim();
}

function assertOptionalString(v: unknown, field: string): string | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'string') throw new IpcError('VALIDATION_ERROR', `Invalid ${field}`);
  return v;
}

function assertBoolean(v: unknown, field: string): boolean {
  if (typeof v !== 'boolean') throw new IpcError('VALIDATION_ERROR', `Invalid ${field}`);
  return v;
}

function assertOptionalNumber(v: unknown, field: string): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new IpcError('VALIDATION_ERROR', `Invalid ${field}`);
  return v;
}

function assertOptionalObject(v: unknown, field: string): Record<string, unknown> | undefined {
  if (v === undefined || v === null) return undefined;
  if (!v || typeof v !== 'object') throw new IpcError('VALIDATION_ERROR', `Invalid ${field}`);
  return v as Record<string, unknown>;
}

export function validateUrl(url: unknown): string {
  const s = assertNonEmptyString(url, 'url');
  try {
    const parsed = new URL(s);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new IpcError('VALIDATION_ERROR', 'Unsupported url protocol');
    }
    return s;
  } catch {
    throw new IpcError('VALIDATION_ERROR', 'Invalid url');
  }
}

export function validateTaskId(taskId: unknown): string {
  return assertNonEmptyString(taskId, 'taskId');
}

export function validateOutputDir(outputPath: unknown): string {
  const p = assertNonEmptyString(outputPath, 'outputPath');
  const normalized = path.normalize(p);
  if (!fs.existsSync(normalized)) throw new IpcError('NOT_FOUND', 'outputPath does not exist');
  const stat = fs.statSync(normalized);
  if (!stat.isDirectory()) throw new IpcError('VALIDATION_ERROR', 'outputPath is not a directory');
  return normalized;
}

export function validateCookieFile(cookieFile: unknown): string | undefined {
  const p = assertOptionalString(cookieFile, 'cookieFile');
  if (!p) return undefined;
  const normalized = path.normalize(p);
  // 如果 cookie 文件不存在，返回 undefined 而不是抛出错误
  // 这样可以在文件被删除后继续下载（不使用 cookie）
  if (!fs.existsSync(normalized)) {
    console.warn(`[validateCookieFile] Cookie 文件不存在，将忽略: ${normalized}`);
    return undefined;
  }
  const stat = fs.statSync(normalized);
  if (!stat.isFile()) {
    console.warn(`[validateCookieFile] Cookie 路径不是文件，将忽略: ${normalized}`);
    return undefined;
  }
  return normalized;
}

export function validateRateLimit(rateLimit: unknown): string | undefined {
  const s = assertOptionalString(rateLimit, 'rateLimit');
  if (!s) return undefined;
  const trimmed = s.trim();
  if (trimmed.length > 32) throw new IpcError('VALIDATION_ERROR', 'Invalid rateLimit');
  // yt-dlp accepts e.g. 500K / 2M / 10M
  if (!/^\d+(\.\d+)?[KMG]?$/i.test(trimmed)) throw new IpcError('VALIDATION_ERROR', 'Invalid rateLimit');
  return trimmed;
}

// ==================== Cookie 相关验证 ====================

/** 支持的浏览器列表（与 shared/electron.ts 中 SupportedBrowser 保持一致） */
const SUPPORTED_BROWSERS: readonly SupportedBrowser[] = ['chrome', 'edge', 'chromium', 'brave', 'opera', 'vivaldi'];

/**
 * 验证域名
 */
export function validateDomain(domain: unknown): string {
  return assertNonEmptyString(domain, 'domain');
}

/**
 * 验证浏览器类型
 */
export function validateBrowser(browser: unknown): SupportedBrowser {
  const s = assertNonEmptyString(browser, 'browser');
  if (!SUPPORTED_BROWSERS.includes(s as SupportedBrowser)) {
    throw new IpcError('VALIDATION_ERROR', `不支持的浏览器: ${s}`);
  }
  return s as SupportedBrowser;
}

/**
 * 验证可选域名（可为空）
 */
export function validateOptionalDomain(domain: unknown): string | undefined {
  if (domain === undefined || domain === null || domain === '') return undefined;
  if (typeof domain !== 'string') throw new IpcError('VALIDATION_ERROR', 'Invalid domain');
  return domain.trim() || undefined;
}

/**
 * 验证 Bilibili QR Key
 */
export function validateQrKey(qrKey: unknown): string {
  return assertNonEmptyString(qrKey, 'qrKey');
}

// ==================== 设置相关验证 ====================

/**
 * 验证用户设置更新参数
 */
export function validateUserSettingsUpdate(updates: unknown): UserSettingsUpdateParams {
  if (!updates || typeof updates !== 'object') {
    throw new IpcError('VALIDATION_ERROR', 'Invalid arguments');
  }
  const o = updates as Record<string, unknown>;

  const result: UserSettingsUpdateParams = {};

  if (o.gpuCompatEnabled !== undefined) {
    if (typeof o.gpuCompatEnabled !== 'boolean') {
      throw new IpcError('VALIDATION_ERROR', 'Invalid gpuCompatEnabled');
    }
    result.gpuCompatEnabled = o.gpuCompatEnabled;
  }

  if (o.closeToTray !== undefined) {
    if (typeof o.closeToTray !== 'boolean') {
      throw new IpcError('VALIDATION_ERROR', 'Invalid closeToTray');
    }
    result.closeToTray = o.closeToTray;
  }

  return result;
}

// ==================== yt-dlp 参数验证 ====================

export function validateYtDlpArgs(additionalArgs: unknown): string[] {
  if (additionalArgs === undefined || additionalArgs === null) return [];
  if (!Array.isArray(additionalArgs)) throw new IpcError('VALIDATION_ERROR', 'Invalid additionalArgs');
  const out: string[] = [];
  for (const item of additionalArgs) {
    if (typeof item !== 'string') throw new IpcError('VALIDATION_ERROR', 'Invalid additionalArgs item');
    const trimmed = item.trim();
    if (!trimmed) continue;
    if (trimmed.length > 300) throw new IpcError('VALIDATION_ERROR', 'additionalArgs item too long');
    // Basic safety: avoid accidental command injection patterns; spawn uses argv array, but keep it clean.
    if (/[;&|`]/.test(trimmed)) throw new IpcError('VALIDATION_ERROR', 'Invalid additionalArgs item');
    out.push(trimmed);
  }
  if (out.length > 100) throw new IpcError('VALIDATION_ERROR', 'Too many additionalArgs');
  return out;
}

export function validatePlaylistInfoParams(params: unknown): {
  url: string;
  cookieFile?: string;
  useBrowserCookies?: boolean;
  browserPath?: string;
  playlistEnd?: number;
} {
  if (!params || typeof params !== 'object') throw new IpcError('VALIDATION_ERROR', 'Invalid playlist params');
  const o = params as Record<string, unknown>;
  const url = validateUrl(o.url);
  const cookieFile = validateCookieFile(o.cookieFile);
  const useBrowserCookies =
    o.useBrowserCookies === undefined ? undefined : assertBoolean(o.useBrowserCookies, 'useBrowserCookies');
  const browserPath = assertOptionalString(o.browserPath, 'browserPath');
  const playlistEnd = assertOptionalNumber(o.playlistEnd, 'playlistEnd');
  if (playlistEnd !== undefined) {
    const n = Math.floor(playlistEnd);
    if (n < 1 || n > 5000) throw new IpcError('VALIDATION_ERROR', 'Invalid playlistEnd');
    return { url, cookieFile, useBrowserCookies, browserPath, playlistEnd: n };
  }
  return { url, cookieFile, useBrowserCookies, browserPath };
}

export function validateDownloadOptions(options: unknown): DownloadOptions {
  if (!options || typeof options !== 'object') throw new IpcError('VALIDATION_ERROR', 'Invalid download options');
  const o = options as Record<string, unknown>;

  const taskId = assertOptionalString(o.taskId, 'taskId');
  const url = validateUrl(o.url);
  const outputPath = validateOutputDir(o.outputPath);
  const audioOnly = assertBoolean(o.audioOnly, 'audioOnly');

  const format = assertOptionalString(o.format, 'format');
  const rateLimit = validateRateLimit(o.rateLimit);
  const useBrowserCookies = o.useBrowserCookies === undefined ? undefined : assertBoolean(o.useBrowserCookies, 'useBrowserCookies');
  const browserPath = assertOptionalString(o.browserPath, 'browserPath');
  const cookieFile = validateCookieFile(o.cookieFile);

  const playlistModeRaw = assertOptionalString(o.playlistMode, 'playlistMode');
  const playlistMode =
    playlistModeRaw === undefined ? undefined : (playlistModeRaw === 'single' || playlistModeRaw === 'playlist' ? playlistModeRaw : null);
  if (playlistModeRaw !== undefined && !playlistMode) throw new IpcError('VALIDATION_ERROR', 'Invalid playlistMode');

  const playlistItems = assertOptionalString(o.playlistItems, 'playlistItems');
  if (playlistItems && playlistItems.length > 64) throw new IpcError('VALIDATION_ERROR', 'Invalid playlistItems');
  // allow digits, comma, dash, whitespace
  if (playlistItems && !/^[0-9,\-\s]+$/.test(playlistItems)) throw new IpcError('VALIDATION_ERROR', 'Invalid playlistItems');

  const playlistEnd = assertOptionalNumber(o.playlistEnd, 'playlistEnd');
  if (playlistEnd !== undefined) {
    const n = Math.floor(playlistEnd);
    if (n < 1 || n > 10000) throw new IpcError('VALIDATION_ERROR', 'Invalid playlistEnd');
  }

  const ppObj = assertOptionalObject(o.postProcess, 'postProcess');
  const postProcess = ppObj
    ? {
        embedSubs: ppObj.embedSubs === undefined ? undefined : assertBoolean(ppObj.embedSubs, 'postProcess.embedSubs'),
        writeSubs: ppObj.writeSubs === undefined ? undefined : assertBoolean(ppObj.writeSubs, 'postProcess.writeSubs'),
        writeAutoSubs:
          ppObj.writeAutoSubs === undefined
            ? undefined
            : assertBoolean(ppObj.writeAutoSubs, 'postProcess.writeAutoSubs'),
        subLangs: assertOptionalString(ppObj.subLangs, 'postProcess.subLangs')?.trim() || undefined,
        writeThumbnail:
          ppObj.writeThumbnail === undefined ? undefined : assertBoolean(ppObj.writeThumbnail, 'postProcess.writeThumbnail'),
        addMetadata: ppObj.addMetadata === undefined ? undefined : assertBoolean(ppObj.addMetadata, 'postProcess.addMetadata'),
      }
    : undefined;

  if (postProcess?.subLangs) {
    if (postProcess.subLangs.length > 120) throw new IpcError('VALIDATION_ERROR', 'Invalid postProcess.subLangs');
    // allow letters/digits/comma/dot/star/underscore/dash and whitespace
    if (!/^[a-z0-9,.*_\-\s]+$/i.test(postProcess.subLangs)) {
      throw new IpcError('VALIDATION_ERROR', 'Invalid postProcess.subLangs');
    }
  }

  return {
    taskId,
    url,
    outputPath,
    format,
    audioOnly,
    rateLimit,
    useBrowserCookies,
    browserPath,
    cookieFile,
    playlistMode: playlistMode ?? undefined,
    playlistItems: playlistItems?.trim() || undefined,
    playlistEnd: playlistEnd !== undefined ? Math.floor(playlistEnd) : undefined,
    postProcess,
  };
}


