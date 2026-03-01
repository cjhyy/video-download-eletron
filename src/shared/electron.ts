import type { IPCChannel } from './ipc';

export interface VideoFormat {
  format_id: string;
  ext: string;
  quality?: string | number;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
  width?: number;
  height?: number;
  fps?: number;
  vcodec?: string;
  acodec?: string;
  tbr?: number;
  vbr?: number;
  abr?: number;
}

export interface VideoInfo {
  title: string;
  duration?: number;
  uploader?: string;
  formats: VideoFormat[];
}

export type PlaylistMode = 'single' | 'playlist';

export interface DownloadPostProcessOptions {
  embedSubs?: boolean;
  /**
   * Download subtitles as sidecar files (e.g. .srt).
   */
  writeSubs?: boolean;
  /**
   * Include auto-generated subtitles when available.
   */
  writeAutoSubs?: boolean;
  /**
   * yt-dlp --sub-langs value. Supports comma-separated langs and patterns (e.g. "en.*,zh.*").
   */
  subLangs?: string;
  writeThumbnail?: boolean;
  addMetadata?: boolean;
}

export interface PlaylistEntryInfo {
  /**
   * 1-based index in the playlist, when available.
   */
  index?: number;
  id?: string;
  title?: string;
  duration?: number;
  uploader?: string;
  /**
   * Prefer using this URL for downloading a single item.
   */
  webpage_url?: string;
  /**
   * Sometimes yt-dlp returns id-like url in flat-playlist mode.
   */
  url?: string;
  extractor?: string;
}

export interface PlaylistInfo {
  title?: string;
  uploader?: string;
  webpage_url?: string;
  entries: PlaylistEntryInfo[];
}

export interface DownloadOptions {
  /**
   * Optional task identifier provided by the renderer.
   * When present, main process will include it in progress/error events so the
   * renderer can safely support concurrent downloads.
   */
  taskId?: string;
  url: string;
  outputPath: string;
  format?: string;
  audioOnly: boolean;
  rateLimit?: string;
  useBrowserCookies?: boolean;
  browserPath?: string;
  cookieFile?: string;
  /**
   * Controls whether yt-dlp should treat URL as a single video or allow playlist/channel expansion.
   * Default: 'single' (matches current behavior: --no-playlist + YouTube list param stripping).
   */
  playlistMode?: PlaylistMode;
  /**
   * yt-dlp --playlist-items spec, e.g. "1-10,13,15".
   */
  playlistItems?: string;
  /**
   * yt-dlp --playlist-end N (download first N items).
   */
  playlistEnd?: number;
  /**
   * Common post-processing toggles.
   */
  postProcess?: DownloadPostProcessOptions;
}

export interface DownloadProgress {
  percent: number;
  size?: string;
  speed?: string;
  eta?: string;
  status?: 'downloading' | 'completed' | 'error';
}

export type DownloadProgressEvent = DownloadProgress & {
  taskId: string;
};

export interface DownloadErrorEvent {
  taskId: string;
  error: string;
}

export type DownloadLogLevel = 'info' | 'warn' | 'error';

export interface DownloadLogEvent {
  taskId: string;
  level: DownloadLogLevel;
  message: string;
  ts: string; // ISO time
}

export interface DownloadDoneEvent {
  taskId: string;
  success: boolean;
  error?: { code?: string; message: string; details?: unknown };
  startedAt?: string;
  ts: string; // ISO time
}

export type CancelDownloadResult = { success: true } | { success: false; error: string };

export interface BinaryStatus {
  ytDlp: boolean;
  ffmpeg: boolean;
  paths: {
    ytDlp: string;
    ffmpeg: string;
  };
  /** 是否使用内置（完整版）的二进制文件 */
  bundled?: {
    ytDlp: boolean;
    ffmpeg: boolean;
  };
}

export type BinaryName = 'yt-dlp' | 'ffmpeg';

export interface DownloadBinaryProgress {
  binary: BinaryName;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export type DownloadBinaryResult =
  | { success: true; path: string }
  | { success: false; error: string };

export type CopyCookieFileResult =
  | { success: true; cookieFile: string }
  | { success: false; error: string };

export type UpdateYtDlpResult =
  | { success: true; message: string }
  | { success: false; error: string };

export type ExportCookiesResult =
  | { success: true; cookieFile: string }
  | { success: false; error: string };

export type LoginAndGetCookiesResult =
  | { success: true; cookieFile: string }
  | { success: false; error: string };

export type ClearCookieCacheResult =
  | { success: true; message: string }
  | { success: false; error: string };

// Chrome Cookie 提取
export type SupportedBrowser = 'chrome' | 'edge' | 'chromium' | 'brave' | 'opera' | 'vivaldi';

export type ExtractBrowserCookiesResult =
  | { success: true; cookieFile: string; cookieCount: number }
  | { success: false; error: string };

// Bilibili 扫码登录
export interface BilibiliQRCodeResult {
  success: boolean;
  qrUrl?: string;      // 二维码内容 URL
  qrKey?: string;      // 用于轮询状态的 key
  error?: string;
}

export interface BilibiliQRStatusResult {
  success: boolean;
  status?: 'waiting' | 'scanned' | 'confirmed' | 'expired';
  cookieFile?: string;  // 登录成功时返回
  error?: string;
}

export interface ElectronAPI {
  selectDownloadDirectory: () => Promise<string | null>;
  selectCookieFile: () => Promise<string | null>;
  selectVideoFile: () => Promise<string | null>;
  selectSubtitleFile: () => Promise<string | null>;
  readTextFile: (filePath: string) => Promise<string>;
  copyCookieFile: (sourcePath: string, domain: string) => Promise<CopyCookieFileResult>;
  getVideoInfo: (
    url: string,
    useBrowserCookies?: boolean,
    browserPath?: string,
    cookieFile?: string
  ) => Promise<VideoInfo>;
  getPlaylistInfo: (params: {
    url: string;
    cookieFile?: string;
    useBrowserCookies?: boolean;
    browserPath?: string;
    playlistEnd?: number;
  }) => Promise<PlaylistInfo>;
  getYtDlpArgs: () => Promise<string[]>;
  setYtDlpArgs: (additionalArgs: string[]) => Promise<string[]>;
  downloadVideo: (options: DownloadOptions) => Promise<{ success: boolean }>;
  cancelDownload: (taskId: string) => Promise<CancelDownloadResult>;
  openFolder: (folderPath: string) => Promise<void>;
  checkBinaries: () => Promise<BinaryStatus>;
  updateYtDlp: () => Promise<UpdateYtDlpResult>;
  exportCookies: (url?: string) => Promise<ExportCookiesResult>;
  loginAndGetCookies: (url: string, domain: string) => Promise<LoginAndGetCookiesResult>;
  clearCookieCache: () => Promise<ClearCookieCacheResult>;
  onDownloadProgress: (callback: (progress: DownloadProgressEvent) => void) => void;
  onDownloadError: (callback: (payload: DownloadErrorEvent) => void) => void;
  onDownloadLog: (callback: (payload: DownloadLogEvent) => void) => void;
  onDownloadDone: (callback: (payload: DownloadDoneEvent) => void) => void;
  getUserSettings: () => Promise<{ gpuCompatEnabled: boolean; closeToTray: boolean }>;
  setUserSettings: (updates: { gpuCompatEnabled?: boolean; closeToTray?: boolean }) => Promise<{ gpuCompatEnabled: boolean; closeToTray: boolean }>;
  removeAllListeners: (channel: IPCChannel | string) => void;
  // Chrome Cookie 提取
  extractBrowserCookies: (browser: SupportedBrowser, domain?: string) => Promise<ExtractBrowserCookiesResult>;
  detectInstalledBrowsers: () => Promise<SupportedBrowser[]>;
  // Bilibili 扫码登录
  bilibiliGetQRCode: () => Promise<BilibiliQRCodeResult>;
  bilibiliCheckQRStatus: (qrKey: string) => Promise<BilibiliQRStatusResult>;
  // 下载二进制文件（精简版）
  downloadBinary: (binaryName: BinaryName) => Promise<DownloadBinaryResult>;
  onDownloadBinaryProgress: (callback: (progress: DownloadBinaryProgress) => void) => void;
}


