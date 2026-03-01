export type { DownloadTask, DownloadTaskStatus } from './types';
export { DownloadQueueManager } from './DownloadQueueManager';

import { DownloadQueueManager } from './DownloadQueueManager';

// 单例
export const downloadQueue = new DownloadQueueManager();




