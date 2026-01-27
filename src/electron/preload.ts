import { contextBridge, ipcRenderer } from 'electron';
import { IPCChannels } from '../shared/ipc';
import type {
  DownloadDoneEvent,
  DownloadErrorEvent,
  DownloadOptions,
  DownloadLogEvent,
  DownloadProgressEvent,
  ElectronAPI,
  VideoInfo,
  BinaryStatus,
} from '../shared/electron';

// 暴露受保护的方法给渲染进程
const electronAPI: ElectronAPI = {
  // 选择下载目录
  selectDownloadDirectory: (): Promise<string | null> => 
    ipcRenderer.invoke(IPCChannels.SELECT_DOWNLOAD_DIRECTORY),
  
  // 选择Cookie文件
  selectCookieFile: (): Promise<string | null> => 
    ipcRenderer.invoke(IPCChannels.SELECT_COOKIE_FILE),

  // 选择本地视频文件（Learning）
  selectVideoFile: (): Promise<string | null> => ipcRenderer.invoke(IPCChannels.SELECT_VIDEO_FILE),

  // 选择字幕文件（Learning）
  selectSubtitleFile: (): Promise<string | null> => ipcRenderer.invoke(IPCChannels.SELECT_SUBTITLE_FILE),

  // 读取本地文本文件（Learning 解析字幕）
  readTextFile: (filePath: string): Promise<string> => ipcRenderer.invoke(IPCChannels.READ_TEXT_FILE, filePath),
  
  // 复制Cookie文件到本地目录
  copyCookieFile: (sourcePath: string, domain: string) =>
    ipcRenderer.invoke(IPCChannels.COPY_COOKIE_FILE, sourcePath, domain),
  
  // 获取视频信息
  getVideoInfo: (url: string, useBrowserCookies?: boolean, browserPath?: string, cookieFile?: string): Promise<VideoInfo> => 
    ipcRenderer.invoke(IPCChannels.GET_VIDEO_INFO, url, useBrowserCookies, browserPath, cookieFile),

  // 展开播放列表/频道（flat-playlist）
  getPlaylistInfo: (params) => ipcRenderer.invoke(IPCChannels.GET_PLAYLIST_INFO, params),

  // 读取/设置 yt-dlp additionalArgs（主进程持久化到 userData）
  getYtDlpArgs: (): Promise<string[]> => ipcRenderer.invoke(IPCChannels.GET_YTDLP_ARGS),
  setYtDlpArgs: (additionalArgs: string[]): Promise<string[]> =>
    ipcRenderer.invoke(IPCChannels.SET_YTDLP_ARGS, additionalArgs),
  
  // 下载视频
  downloadVideo: (options: DownloadOptions): Promise<{ success: boolean }> => 
    ipcRenderer.invoke(IPCChannels.DOWNLOAD_VIDEO, options),

  // 取消下载（按 taskId）
  cancelDownload: (taskId: string) => ipcRenderer.invoke(IPCChannels.CANCEL_DOWNLOAD, taskId),
  
  // 打开文件夹
  openFolder: (folderPath: string): Promise<void> => 
    ipcRenderer.invoke(IPCChannels.OPEN_FOLDER, folderPath),
  
  // 检查二进制文件
  checkBinaries: (): Promise<BinaryStatus> => 
    ipcRenderer.invoke(IPCChannels.CHECK_BINARIES),
  
  // 更新 yt-dlp
  updateYtDlp: () => ipcRenderer.invoke(IPCChannels.UPDATE_YT_DLP),
  
  // 导出Cookies
  exportCookies: (url?: string) => ipcRenderer.invoke(IPCChannels.EXPORT_COOKIES, url),
  
  // 登录并获取Cookies
  loginAndGetCookies: (url: string, domain: string) =>
    ipcRenderer.invoke(IPCChannels.LOGIN_AND_GET_COOKIES, url, domain),
  
  // 清除Cookie缓存
  clearCookieCache: () => ipcRenderer.invoke(IPCChannels.CLEAR_COOKIE_CACHE),
  
  // 监听下载进度
  onDownloadProgress: (callback: (progress: DownloadProgressEvent) => void): void => {
    ipcRenderer.on(IPCChannels.DOWNLOAD_PROGRESS, (_event, progress: DownloadProgressEvent) =>
      callback(progress)
    );
  },
  
  // 监听下载错误
  onDownloadError: (callback: (payload: DownloadErrorEvent) => void): void => {
    ipcRenderer.on(IPCChannels.DOWNLOAD_ERROR, (_event, payload: DownloadErrorEvent) =>
      callback(payload)
    );
  },

  // 监听下载日志（可持久化到任务）
  onDownloadLog: (callback: (payload: DownloadLogEvent) => void): void => {
    ipcRenderer.on(IPCChannels.DOWNLOAD_LOG, (_event, payload: DownloadLogEvent) => callback(payload));
  },

  // 监听下载完成/失败（避免页面刷新导致 invoke 回调丢失）
  onDownloadDone: (callback: (payload: DownloadDoneEvent) => void): void => {
    ipcRenderer.on(IPCChannels.DOWNLOAD_DONE, (_event, payload: DownloadDoneEvent) => callback(payload));
  },

  // 用户设置（主进程启动前可读）
  getUserSettings: () => ipcRenderer.invoke(IPCChannels.GET_USER_SETTINGS),
  setUserSettings: (updates: { gpuCompatEnabled?: boolean; closeToTray?: boolean }) =>
    ipcRenderer.invoke(IPCChannels.SET_USER_SETTINGS, updates),
  
  // 移除监听器
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
