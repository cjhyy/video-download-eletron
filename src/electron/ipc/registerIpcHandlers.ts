import { dialog, ipcMain, shell, type BrowserWindow } from 'electron';
import * as fs from 'fs';
import { IPCChannels } from '../../shared/ipc';
import type { DownloadOptions } from '../../shared/electron';
import { clearCookieCache, copyCookieFile, loginAndGetCookies } from '../services/cookies';
import { cancelDownload, checkBinaries, downloadVideo, exportCookies, getPlaylistInfo, getVideoInfo, updateYtDlp } from '../services/ytdlp';
import { validateCookieFile, validateDownloadOptions, validatePlaylistInfoParams, validateTaskId, validateUrl, validateYtDlpArgs } from './validate';
import { toIpcError } from './ipcError';
import { loadUserSettings, saveUserSettings } from '../lib/userSettings';
import { getYtDlpAdditionalArgs, setYtDlpAdditionalArgs } from '../lib/config';
import { createTray, destroyTray } from '../window/tray';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  const safeHandle = <TArgs extends any[], TResult>(
    channel: string,
    handler: (...args: TArgs) => Promise<TResult> | TResult
  ) => {
    ipcMain.handle(channel, async (...args: TArgs) => {
      try {
        return await handler(...args);
      } catch (err) {
        const ipcErr = toIpcError(err);
        // Throwing Error keeps invoke() rejection semantics; code is available via error.name.
        throw ipcErr;
      }
    });
  };

  // 选择下载目录
  safeHandle(IPCChannels.SELECT_DOWNLOAD_DIRECTORY, async (): Promise<string | null> => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }

    return null;
  });

  // 选择Cookie文件
  safeHandle(IPCChannels.SELECT_COOKIE_FILE, async (): Promise<string | null> => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: 'Cookie文件', extensions: ['txt'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      title: '选择Cookie文件',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }

    return null;
  });

  // 选择本地视频文件（Learning 模块使用）
  safeHandle(IPCChannels.SELECT_VIDEO_FILE, async (): Promise<string | null> => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '视频文件', extensions: ['mp4', 'mkv', 'webm', 'mov', 'm4v'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      title: '选择视频文件',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // 选择字幕文件（Learning 模块使用）
  safeHandle(IPCChannels.SELECT_SUBTITLE_FILE, async (): Promise<string | null> => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: [
        { name: '字幕文件', extensions: ['srt', 'vtt'] },
        { name: '所有文件', extensions: ['*'] },
      ],
      title: '选择字幕文件',
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // 读取本地文本文件（Learning 模块解析字幕使用）
  safeHandle(IPCChannels.READ_TEXT_FILE, async (_event, filePath: string): Promise<string> => {
    if (typeof filePath !== 'string' || !filePath) throw new Error('Invalid filePath');
    return fs.readFileSync(filePath, 'utf8');
  });

  // 复制Cookie文件到本地目录
  safeHandle(IPCChannels.COPY_COOKIE_FILE, async (_event, sourcePath: string, domain: string) => {
    // Basic validation (avoid surprising types)
    if (typeof sourcePath !== 'string' || typeof domain !== 'string') throw new Error('Invalid arguments');
    return copyCookieFile(sourcePath, domain);
  });

  // 获取视频信息
  safeHandle(IPCChannels.GET_VIDEO_INFO, async (_event, url: string, useBrowserCookies?: boolean, browserPath?: string, cookieFile?: string) => {
    const validatedUrl = validateUrl(url);
    const validatedCookieFile = validateCookieFile(cookieFile);
    const validatedUseBrowserCookies = useBrowserCookies === undefined ? undefined : !!useBrowserCookies;
    const validatedBrowserPath = typeof browserPath === 'string' ? browserPath : undefined;
    return getVideoInfo({ url: validatedUrl, useBrowserCookies: validatedUseBrowserCookies, browserPath: validatedBrowserPath, cookieFile: validatedCookieFile });
  });

  // 展开播放列表/频道（flat-playlist）
  safeHandle(IPCChannels.GET_PLAYLIST_INFO, async (_event, params: unknown) => {
    const validated = validatePlaylistInfoParams(params);
    return getPlaylistInfo(validated);
  });

  // 读取 yt-dlp additionalArgs（主进程 userData 配置）
  safeHandle(IPCChannels.GET_YTDLP_ARGS, async () => {
    return getYtDlpAdditionalArgs();
  });

  // 设置 yt-dlp additionalArgs（主进程 userData 配置）
  safeHandle(IPCChannels.SET_YTDLP_ARGS, async (_event, additionalArgs: unknown) => {
    const validated = validateYtDlpArgs(additionalArgs);
    return setYtDlpAdditionalArgs(validated);
  });

  // 下载视频
  safeHandle(IPCChannels.DOWNLOAD_VIDEO, async (event, options: DownloadOptions) => {
    const validated = validateDownloadOptions(options);
    const taskId = validated.taskId ?? 'unknown';
    if (taskId === 'unknown') {
      console.warn('[download-video] Missing taskId in DownloadOptions; progress events will use taskId="unknown".');
    }
    const startedAt = new Date().toISOString();
    try {
      const result = await downloadVideo(validated, {
      onProgress: (progress) =>
        event.sender.send(IPCChannels.DOWNLOAD_PROGRESS, { taskId, ...progress }),
      onError: (error) => event.sender.send(IPCChannels.DOWNLOAD_ERROR, { taskId, error }),
      onLog: (level, message) =>
        event.sender.send(IPCChannels.DOWNLOAD_LOG, { taskId, level, message, ts: new Date().toISOString() }),
      });
      event.sender.send(IPCChannels.DOWNLOAD_DONE, { taskId, success: true, ts: new Date().toISOString(), startedAt });
      return result;
    } catch (err: any) {
      event.sender.send(IPCChannels.DOWNLOAD_DONE, {
        taskId,
        success: false,
        ts: new Date().toISOString(),
        startedAt,
        error: { code: err?.code || err?.name, message: err?.message || String(err), details: err?.details },
      });
      throw err;
    }
  });

  // 取消下载（按 taskId）
  safeHandle(IPCChannels.CANCEL_DOWNLOAD, async (_event, taskId: string) => {
    const validatedTaskId = validateTaskId(taskId);
    return cancelDownload(validatedTaskId);
  });

  // 打开文件夹
  safeHandle(IPCChannels.OPEN_FOLDER, async (_event, folderPath: string): Promise<void> => {
    await shell.openPath(folderPath);
  });

  // 检查二进制文件是否存在
  safeHandle(IPCChannels.CHECK_BINARIES, async () => {
    return checkBinaries();
  });

  // 读取用户设置（主进程启动前可读）
  safeHandle(IPCChannels.GET_USER_SETTINGS, async () => {
    return loadUserSettings();
  });

  // 更新用户设置（主进程启动前可读）
  safeHandle(IPCChannels.SET_USER_SETTINGS, async (_event, updates: { gpuCompatEnabled?: boolean; closeToTray?: boolean }) => {
    if (!updates || typeof updates !== 'object') throw new Error('Invalid arguments');
    if (updates.gpuCompatEnabled !== undefined && typeof updates.gpuCompatEnabled !== 'boolean') {
      throw new Error('Invalid gpuCompatEnabled');
    }
    if (updates.closeToTray !== undefined && typeof updates.closeToTray !== 'boolean') {
      throw new Error('Invalid closeToTray');
    }
    const next = saveUserSettings({ gpuCompatEnabled: updates.gpuCompatEnabled, closeToTray: updates.closeToTray });

    // Keep tray state consistent with settings at runtime.
    if (updates.closeToTray === true) {
      createTray(getMainWindow);
    } else if (updates.closeToTray === false) {
      destroyTray();
    }

    return next;
  });

  // 更新 yt-dlp
  safeHandle(IPCChannels.UPDATE_YT_DLP, async () => {
    return updateYtDlp();
  });

  // 导出Chrome Cookies（可传目标站点 URL，避免写死 YouTube）
  safeHandle(IPCChannels.EXPORT_COOKIES, async (_event, url?: string) => {
    const targetUrl = url ? validateUrl(url) : 'https://www.youtube.com';
    return exportCookies({ url: targetUrl });
  });

  // 登录并获取Cookies
  safeHandle(IPCChannels.LOGIN_AND_GET_COOKIES, async (_event, url: string, domain: string) => {
    if (typeof url !== 'string' || typeof domain !== 'string') throw new Error('Invalid arguments');
    return loginAndGetCookies(url, domain);
  });

  // 清除Cookie缓存
  safeHandle(IPCChannels.CLEAR_COOKIE_CACHE, async () => {
    return clearCookieCache();
  });
}


