/**
 * IPC 适配器层
 * 封装 window.electronAPI 调用，统一参数处理和错误处理
 */

import { parseIpcError, type IpcError } from './ipcError';

export interface CookieConfig {
  enabled: boolean;
  file?: string;
}

export interface VideoInfoOptions {
  url: string;
  cookieConfig?: CookieConfig;
}

export interface PlaylistInfoOptions {
  url: string;
  cookieConfig?: CookieConfig;
  playlistEnd?: number;
}

export interface DownloadOptions {
  taskId: string;
  url: string;
  outputPath: string;
  format?: string;
  audioOnly?: boolean;
  playlistMode?: 'single' | 'playlist';
  playlistItems?: string;
  playlistEnd?: number;
  postProcess?: {
    embedSubs?: boolean;
    writeSubs?: boolean;
    writeAutoSubs?: boolean;
    subLangs?: string;
    writeThumbnail?: boolean;
    addMetadata?: boolean;
  };
  cookieConfig?: CookieConfig;
}

/**
 * 获取 Cookie 文件路径
 */
function getCookieFile(cookieConfig?: CookieConfig): string | undefined {
  if (!cookieConfig) return undefined;
  return cookieConfig.enabled && cookieConfig.file ? cookieConfig.file : undefined;
}

/**
 * 统一错误处理
 */
function handleError(error: unknown): never {
  const parsed = parseIpcError(error);
  throw parsed;
}

/**
 * 视频下载相关 API
 */
export const downloadAPI = {
  /**
   * 获取视频信息
   */
  async getVideoInfo(options: VideoInfoOptions): Promise<any> {
    try {
      return await window.electronAPI.getVideoInfo(
        options.url,
        false, // useBrowserCookies
        'auto', // browserPath
        getCookieFile(options.cookieConfig)
      );
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * 获取播放列表信息
   */
  async getPlaylistInfo(options: PlaylistInfoOptions): Promise<any> {
    try {
      return await window.electronAPI.getPlaylistInfo({
        url: options.url,
        cookieFile: getCookieFile(options.cookieConfig),
        playlistEnd: options.playlistEnd,
      });
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * 下载视频
   */
  async downloadVideo(options: DownloadOptions): Promise<void> {
    try {
      await window.electronAPI.downloadVideo({
        taskId: options.taskId,
        url: options.url,
        outputPath: options.outputPath,
        format: options.format,
        audioOnly: options.audioOnly,
        playlistMode: options.playlistMode,
        playlistItems: options.playlistItems,
        playlistEnd: options.playlistEnd,
        postProcess: options.postProcess,
        useBrowserCookies: false,
        browserPath: 'auto',
        cookieFile: getCookieFile(options.cookieConfig),
      });
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * 取消下载
   */
  async cancelDownload(taskId: string): Promise<void> {
    try {
      await window.electronAPI.cancelDownload(taskId);
    } catch (error) {
      handleError(error);
    }
  },
};

/**
 * 文件系统相关 API
 */
export const fsAPI = {
  /**
   * 选择下载目录
   */
  async selectDownloadDirectory(): Promise<string | null> {
    try {
      return await window.electronAPI.selectDownloadDirectory();
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * 选择 Cookie 文件
   */
  async selectCookieFile(): Promise<string | null> {
    try {
      return await window.electronAPI.selectCookieFile();
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * 检查文件是否存在
   */
  async fileExists(path: string): Promise<boolean> {
    try {
      return await window.electronAPI.fileExists(path);
    } catch (error) {
      return false;
    }
  },
};

/**
 * Cookie 相关 API
 */
export const cookieAPI = {
  /**
   * 从浏览器提取 Cookie
   */
  async extractCookiesFromBrowser(params: {
    browser: string;
    domain: string;
    outputPath: string;
  }): Promise<{ success: boolean; cookieCount?: number; error?: string }> {
    try {
      return await window.electronAPI.extractCookiesFromBrowser(params);
    } catch (error) {
      const parsed = parseIpcError(error);
      return { success: false, error: `[${parsed.code}] ${parsed.message}` };
    }
  },

  /**
   * 检查 Cookie 文件有效性
   */
  async checkCookieFile(path: string): Promise<{
    valid: boolean;
    cookieCount?: number;
    error?: string;
  }> {
    try {
      return await window.electronAPI.checkCookieFile(path);
    } catch (error) {
      const parsed = parseIpcError(error);
      return { valid: false, error: `[${parsed.code}] ${parsed.message}` };
    }
  },
};

/**
 * 设置相关 API
 */
export const settingsAPI = {
  /**
   * 获取用户设置
   */
  async getUserSettings(): Promise<{
    gpuCompatEnabled?: boolean;
    closeToTray?: boolean;
  }> {
    try {
      return await window.electronAPI.getUserSettings();
    } catch (error) {
      console.warn('Failed to get user settings:', error);
      return {};
    }
  },

  /**
   * 更新用户设置
   */
  async updateUserSettings(settings: {
    gpuCompatEnabled?: boolean;
    closeToTray?: boolean;
  }): Promise<void> {
    try {
      await window.electronAPI.updateUserSettings(settings);
    } catch (error) {
      handleError(error);
    }
  },

  /**
   * 获取 yt-dlp 版本
   */
  async getYtdlpVersion(): Promise<string> {
    try {
      return await window.electronAPI.getYtdlpVersion();
    } catch (error) {
      const parsed = parseIpcError(error);
      throw new Error(`获取版本失败: ${parsed.message}`);
    }
  },

  /**
   * 更新 yt-dlp
   */
  async updateYtdlp(): Promise<{ success: boolean; version?: string; error?: string }> {
    try {
      return await window.electronAPI.updateYtdlp();
    } catch (error) {
      const parsed = parseIpcError(error);
      return { success: false, error: parsed.message };
    }
  },
};

/**
 * 事件监听相关
 */
export const eventAPI = {
  onDownloadProgress: (callback: (info: any) => void) => {
    window.electronAPI.onDownloadProgress(callback);
  },
  onDownloadError: (callback: (payload: any) => void) => {
    window.electronAPI.onDownloadError(callback);
  },
  onDownloadLog: (callback: (payload: any) => void) => {
    window.electronAPI.onDownloadLog(callback);
  },
  onDownloadDone: (callback: (payload: any) => void) => {
    window.electronAPI.onDownloadDone(callback);
  },
  removeAllListeners: (channel: string) => {
    window.electronAPI.removeAllListeners(channel);
  },
};

/**
 * 创建 Cookie 配置对象的辅助函数
 */
export function createCookieConfig(
  enabled: boolean,
  file?: string,
  useCookie: boolean = true
): CookieConfig {
  return {
    enabled: enabled && useCookie,
    file,
  };
}
