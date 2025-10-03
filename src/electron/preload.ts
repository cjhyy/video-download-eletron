import { contextBridge, ipcRenderer } from 'electron';

// 内联类型定义，避免模块导入问题
interface VideoInfo {
  title: string;
  duration?: number;
  uploader?: string;
  formats: VideoFormat[];
}

interface VideoFormat {
  format_id: string;
  ext: string;
  quality?: string | number;
  filesize?: number;
  format_note?: string;
}

interface DownloadOptions {
  url: string;
  outputPath: string;
  format?: string;
  audioOnly: boolean;
  rateLimit?: string;
  useBrowserCookies?: boolean;
  browserPath?: string;
  cookieFile?: string;
}

interface DownloadProgress {
  percent: number;
  size?: string;
  speed?: string;
  status?: 'downloading' | 'completed' | 'error';
}

interface BinaryStatus {
  ytDlp: boolean;
  ffmpeg: boolean;
  paths: {
    ytDlp: string;
    ffmpeg: string;
  };
}

interface ElectronAPI {
  selectDownloadDirectory: () => Promise<string | null>;
  selectCookieFile: () => Promise<string | null>;
  copyCookieFile: (sourcePath: string, domain: string) => Promise<{ success: boolean; cookieFile?: string; error?: string }>;
  getVideoInfo: (url: string, useBrowserCookies?: boolean, browserPath?: string, cookieFile?: string) => Promise<VideoInfo>;
  downloadVideo: (options: DownloadOptions) => Promise<{ success: boolean }>;
  openFolder: (folderPath: string) => Promise<void>;
  checkBinaries: () => Promise<BinaryStatus>;
  updateYtDlp: () => Promise<{ success: boolean; message?: string; error?: string }>;
  exportCookies: () => Promise<{ success: boolean; cookieFile?: string; error?: string }>;
  loginAndGetCookies: (url: string, domain: string) => Promise<{ success: boolean; cookieFile?: string; error?: string }>;
  clearCookieCache: () => Promise<{ success: boolean; message?: string; error?: string }>;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onDownloadError: (callback: (error: string) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// IPC 通道名称常量
const IPCChannels = {
  SELECT_DOWNLOAD_DIRECTORY: 'select-download-directory',
  SELECT_COOKIE_FILE: 'select-cookie-file',
  COPY_COOKIE_FILE: 'copy-cookie-file',
  GET_VIDEO_INFO: 'get-video-info',
  DOWNLOAD_VIDEO: 'download-video',
  OPEN_FOLDER: 'open-folder',
  CHECK_BINARIES: 'check-binaries',
  UPDATE_YT_DLP: 'update-yt-dlp',
  DOWNLOAD_PROGRESS: 'download-progress',
  DOWNLOAD_ERROR: 'download-error',
  EXPORT_COOKIES: 'export-cookies',
  LOGIN_AND_GET_COOKIES: 'login-and-get-cookies',
  CLEAR_COOKIE_CACHE: 'clear-cookie-cache'
} as const;

// 暴露受保护的方法给渲染进程
const electronAPI: ElectronAPI = {
  // 选择下载目录
  selectDownloadDirectory: (): Promise<string | null> => 
    ipcRenderer.invoke(IPCChannels.SELECT_DOWNLOAD_DIRECTORY),
  
  // 选择Cookie文件
  selectCookieFile: (): Promise<string | null> => 
    ipcRenderer.invoke(IPCChannels.SELECT_COOKIE_FILE),
  
  // 复制Cookie文件到本地目录
  copyCookieFile: (sourcePath: string, domain: string): Promise<{ success: boolean; cookieFile?: string; error?: string }> => 
    ipcRenderer.invoke(IPCChannels.COPY_COOKIE_FILE, sourcePath, domain),
  
  // 获取视频信息
  getVideoInfo: (url: string, useBrowserCookies?: boolean, browserPath?: string, cookieFile?: string): Promise<VideoInfo> => 
    ipcRenderer.invoke(IPCChannels.GET_VIDEO_INFO, url, useBrowserCookies, browserPath, cookieFile),
  
  // 下载视频
  downloadVideo: (options: DownloadOptions): Promise<{ success: boolean }> => 
    ipcRenderer.invoke(IPCChannels.DOWNLOAD_VIDEO, options),
  
  // 打开文件夹
  openFolder: (folderPath: string): Promise<void> => 
    ipcRenderer.invoke(IPCChannels.OPEN_FOLDER, folderPath),
  
  // 检查二进制文件
  checkBinaries: (): Promise<BinaryStatus> => 
    ipcRenderer.invoke(IPCChannels.CHECK_BINARIES),
  
  // 更新 yt-dlp
  updateYtDlp: (): Promise<{ success: boolean; message?: string; error?: string }> => 
    ipcRenderer.invoke(IPCChannels.UPDATE_YT_DLP),
  
  // 导出Cookies
  exportCookies: (): Promise<{ success: boolean; cookieFile?: string; error?: string }> => 
    ipcRenderer.invoke(IPCChannels.EXPORT_COOKIES),
  
  // 登录并获取Cookies
  loginAndGetCookies: (url: string, domain: string): Promise<{ success: boolean; cookieFile?: string; error?: string }> => 
    ipcRenderer.invoke(IPCChannels.LOGIN_AND_GET_COOKIES, url, domain),
  
  // 清除Cookie缓存
  clearCookieCache: (): Promise<{ success: boolean; message?: string; error?: string }> => 
    ipcRenderer.invoke(IPCChannels.CLEAR_COOKIE_CACHE),
  
  // 监听下载进度
  onDownloadProgress: (callback: (progress: DownloadProgress) => void): void => {
    ipcRenderer.on(IPCChannels.DOWNLOAD_PROGRESS, (_event, progress: DownloadProgress) => 
      callback(progress)
    );
  },
  
  // 监听下载错误
  onDownloadError: (callback: (error: string) => void): void => {
    ipcRenderer.on(IPCChannels.DOWNLOAD_ERROR, (_event, error: string) => 
      callback(error)
    );
  },
  
  // 移除监听器
  removeAllListeners: (channel: string): void => {
    ipcRenderer.removeAllListeners(channel);
  }
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
