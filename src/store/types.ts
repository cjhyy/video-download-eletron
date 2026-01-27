import type { VideoInfo } from '@/shared/electron';

export interface CookieProfile {
  id: string;
  name: string;
  domain: string;
  cookieFile: string;
  createdAt: string;
}

export interface AppConfig {
  defaultDownloadPath: string;
  cookieEnabled: boolean;
  cookieFile: string; // 保留用于向后兼容
  cookieProfiles: CookieProfile[];
  activeCookieProfileId: string | null;
  gpuCompatEnabled?: boolean;
  closeToTray?: boolean;
  maxConcurrentDownloads: number;
}

export interface DownloadPageState {
  videoUrl: string;
  videoInfo: VideoInfo | null;
  downloadPath: string;
  selectedFormat: string;
  audioOnly: boolean;
  useBestQuality: boolean;
  playlistMode: 'single' | 'playlist';
  playlistItems: string;
  playlistEnd?: number;
  embedSubs: boolean;
  writeSubs: boolean;
  writeAutoSubs: boolean;
  subLangs: string;
  writeThumbnail: boolean;
  addMetadata: boolean;
}

export type DownloadTaskStatus = 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';

/**
 * Serializable task model (safe for zustand persist).
 * Dates are stored as ISO strings.
 */
export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  status: DownloadTaskStatus;
  progress: number;
  size?: string;
  speed?: string;
  eta?: string;
  outputPath: string;
  format?: string;
  audioOnly: boolean;
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
  error?: string;
  addedAt: string; // ISO
  completedAt?: string; // ISO
  retryCount: number;
  maxRetries: number;
  logs?: DownloadTaskLogEntry[];
}

export interface DownloadTaskLogEntry {
  ts: string; // ISO
  level: 'info' | 'warn' | 'error';
  message: string;
}


