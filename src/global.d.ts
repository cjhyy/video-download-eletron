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

interface Window {
  electronAPI: ElectronAPI;
}

