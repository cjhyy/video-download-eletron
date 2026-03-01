import type { BrowserWindow } from 'electron';
import { IPCChannels } from '../../shared/ipc';
import type { BinaryName, DownloadOptions } from '../../shared/electron';
import type { GetPlaylistInfoParams } from './types';
import { ipcRegistry } from './IpcRegistry';
import { FileHandlers, VideoHandlers, CookieHandlers, SettingsHandlers } from './handlers';

/**
 * 注册所有 IPC 处理器
 * 使用 IpcRegistry 提供统一的超时、日志和错误处理
 * 使用 Handler 类分离业务逻辑
 */
export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // 初始化 Handler 实例
  const fileHandlers = new FileHandlers(getMainWindow);
  const videoHandlers = new VideoHandlers();
  const cookieHandlers = new CookieHandlers();
  const settingsHandlers = new SettingsHandlers(getMainWindow);

  // ==================== 文件操作 ====================

  ipcRegistry.register(IPCChannels.SELECT_DOWNLOAD_DIRECTORY, async () => {
    return fileHandlers.selectDownloadDirectory();
  });

  ipcRegistry.register(IPCChannels.SELECT_COOKIE_FILE, async () => {
    return fileHandlers.selectCookieFile();
  });

  ipcRegistry.register(IPCChannels.SELECT_VIDEO_FILE, async () => {
    return fileHandlers.selectVideoFile();
  });

  ipcRegistry.register(IPCChannels.SELECT_SUBTITLE_FILE, async () => {
    return fileHandlers.selectSubtitleFile();
  });

  ipcRegistry.register(IPCChannels.READ_TEXT_FILE, async (_event, filePath) => {
    return fileHandlers.readTextFile(filePath as string);
  });

  ipcRegistry.register(IPCChannels.OPEN_FOLDER, async (_event, folderPath) => {
    return fileHandlers.openFolder(folderPath as string);
  });

  // ==================== 视频操作 ====================

  ipcRegistry.register(IPCChannels.GET_VIDEO_INFO, async (_event, url, useBrowserCookies, browserPath, cookieFile) => {
    return videoHandlers.getVideoInfo({
      url: url as string,
      useBrowserCookies: useBrowserCookies as boolean | undefined,
      browserPath: browserPath as string | undefined,
      cookieFile: cookieFile as string | undefined,
    });
  }, { timeout: 60000 }); // 获取视频信息可能需要更长时间

  ipcRegistry.register(IPCChannels.GET_PLAYLIST_INFO, async (_event, params) => {
    return videoHandlers.getPlaylistInfo(params as GetPlaylistInfoParams);
  }, { timeout: 120000 }); // 播放列表展开可能很长

  ipcRegistry.register(IPCChannels.DOWNLOAD_VIDEO, async (event, options) => {
    const opts = options as DownloadOptions;
    const taskId = opts.taskId ?? 'unknown';
    if (taskId === 'unknown') {
      console.warn('[download-video] Missing taskId in DownloadOptions');
    }
    const startedAt = new Date().toISOString();

    try {
      const result = await videoHandlers.downloadVideo(opts, {
        onProgress: (progress) =>
          event.sender.send(IPCChannels.DOWNLOAD_PROGRESS, { taskId, ...progress }),
        onError: (error) =>
          event.sender.send(IPCChannels.DOWNLOAD_ERROR, { taskId, error }),
        onLog: (level, message) =>
          event.sender.send(IPCChannels.DOWNLOAD_LOG, { taskId, level, message, ts: new Date().toISOString() }),
      });

      event.sender.send(IPCChannels.DOWNLOAD_DONE, {
        taskId,
        success: true,
        ts: new Date().toISOString(),
        startedAt,
      });
      return result;
    } catch (err: unknown) {
      const error = err as { code?: string; name?: string; message?: string; details?: unknown };
      event.sender.send(IPCChannels.DOWNLOAD_DONE, {
        taskId,
        success: false,
        ts: new Date().toISOString(),
        startedAt,
        error: {
          code: error?.code || error?.name,
          message: error?.message || String(err),
          details: error?.details,
        },
      });
      throw err;
    }
  }, { timeout: 600000 }); // 下载超时 10 分钟

  ipcRegistry.register(IPCChannels.CANCEL_DOWNLOAD, async (_event, taskId) => {
    return videoHandlers.cancelDownload(taskId as string);
  });

  ipcRegistry.register(IPCChannels.CHECK_BINARIES, async () => {
    return videoHandlers.checkBinaries();
  });

  ipcRegistry.register(IPCChannels.UPDATE_YT_DLP, async () => {
    return videoHandlers.updateYtDlp();
  }, { timeout: 120000 }); // 更新可能需要较长时间

  ipcRegistry.register(IPCChannels.EXPORT_COOKIES, async (_event, url) => {
    return videoHandlers.exportCookies(url as string | undefined);
  });

  // ==================== Cookie 操作 ====================

  ipcRegistry.register(IPCChannels.COPY_COOKIE_FILE, async (_event, sourcePath, domain) => {
    return cookieHandlers.copyCookieFile(sourcePath as string, domain as string);
  });

  ipcRegistry.register(IPCChannels.LOGIN_AND_GET_COOKIES, async (_event, url, domain) => {
    return cookieHandlers.loginAndGetCookies(url as string, domain as string);
  }, { timeout: 300000 }); // 登录可能需要用户操作

  ipcRegistry.register(IPCChannels.CLEAR_COOKIE_CACHE, async () => {
    return cookieHandlers.clearCookieCache();
  });

  ipcRegistry.register(IPCChannels.EXTRACT_BROWSER_COOKIES, async (_event, browser, domain) => {
    return cookieHandlers.extractBrowserCookies(browser as string, domain as string | undefined);
  });

  ipcRegistry.register(IPCChannels.DETECT_INSTALLED_BROWSERS, async () => {
    return cookieHandlers.detectInstalledBrowsers();
  });

  ipcRegistry.register(IPCChannels.BILIBILI_GET_QR_CODE, async () => {
    return cookieHandlers.bilibiliGetQRCode();
  });

  ipcRegistry.register(IPCChannels.BILIBILI_CHECK_QR_STATUS, async (_event, qrKey) => {
    return cookieHandlers.bilibiliCheckQRStatus(qrKey as string);
  });

  // ==================== 设置操作 ====================

  ipcRegistry.register(IPCChannels.GET_USER_SETTINGS, async () => {
    return settingsHandlers.getUserSettings();
  });

  ipcRegistry.register(IPCChannels.SET_USER_SETTINGS, async (_event, updates) => {
    return settingsHandlers.setUserSettings(updates as { gpuCompatEnabled?: boolean; closeToTray?: boolean });
  });

  ipcRegistry.register(IPCChannels.GET_YTDLP_ARGS, async () => {
    return settingsHandlers.getYtDlpArgs();
  });

  ipcRegistry.register(IPCChannels.SET_YTDLP_ARGS, async (_event, additionalArgs) => {
    return settingsHandlers.setYtDlpArgs(additionalArgs);
  });

  // ==================== 二进制文件下载（精简版） ====================

  ipcRegistry.register(IPCChannels.DOWNLOAD_BINARY, async (event, binaryName) => {
    return videoHandlers.downloadBinary(binaryName as BinaryName, (progress) => {
      event.sender.send(IPCChannels.DOWNLOAD_BINARY_PROGRESS, progress);
    });
  }, { timeout: 300000 }); // 下载超时 5 分钟

  console.log(`[IPC] Registered ${ipcRegistry.getAllChannels().length} handlers`);
}
