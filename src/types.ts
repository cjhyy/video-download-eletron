// 视频信息接口
export interface VideoInfo {
  title: string;
  duration?: number;
  uploader?: string;
  formats: VideoFormat[];
}

// 视频格式接口
export interface VideoFormat {
  format_id: string;
  ext: string;
  quality?: string | number;
  filesize?: number;
  format_note?: string;
}

// 下载选项接口
export interface DownloadOptions {
  url: string;
  outputPath: string;
  format?: string;
  audioOnly: boolean;
}

// 下载进度接口
export interface DownloadProgress {
  percent: number;
  size?: string;
  speed?: string;
  status?: 'downloading' | 'completed' | 'error';
}

// 二进制文件状态接口
export interface BinaryStatus {
  ytDlp: boolean;
  ffmpeg: boolean;
  paths: {
    ytDlp: string;
    ffmpeg: string;
  };
}

// IPC 通道名称
export enum IPCChannels {
  SELECT_DOWNLOAD_DIRECTORY = 'select-download-directory',
  GET_VIDEO_INFO = 'get-video-info',
  DOWNLOAD_VIDEO = 'download-video',
  OPEN_FOLDER = 'open-folder',
  CHECK_BINARIES = 'check-binaries',
  DOWNLOAD_PROGRESS = 'download-progress',
  DOWNLOAD_ERROR = 'download-error'
}

// Electron API 接口
export interface ElectronAPI {
  selectDownloadDirectory: () => Promise<string | null>;
  getVideoInfo: (url: string) => Promise<VideoInfo>;
  downloadVideo: (options: DownloadOptions) => Promise<{ success: boolean }>;
  openFolder: (folderPath: string) => Promise<void>;
  checkBinaries: () => Promise<BinaryStatus>;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onDownloadError: (callback: (error: string) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// 全局 Window 接口扩展
declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
