export type DownloadTaskStatus = 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';

export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  status: DownloadTaskStatus;
  progress: number;
  outputPath: string;
  format?: string;
  audioOnly: boolean;
  error?: string;
  addedAt: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
}




