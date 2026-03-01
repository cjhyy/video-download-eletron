/**
 * Store 选择器
 * 集中管理状态选择逻辑，提高复用性和性能
 */

import { useShallow } from 'zustand/react/shallow';
import { useConfigStore, type ConfigState } from './configStore';
import { useQueueStore, type QueueState } from './queueStore';
import { useDownloadPageStore, type DownloadPageState } from './downloadPageStore';
import type { DownloadTask, AppConfig } from './types';

// ============================================
// Config Store 选择器
// ============================================

/** 选择完整配置 */
export const selectConfig = (state: ConfigState) => state.config;

/** 选择配置更新函数 */
export const selectUpdateConfig = (state: ConfigState) => state.updateConfig;

/** 选择水合状态 */
export const selectConfigHydrated = (state: ConfigState) => state.hasHydrated;

/** 选择 Cookie 相关配置 */
export const selectCookieConfig = (state: ConfigState) => ({
  enabled: state.config.cookieEnabled,
  file: state.config.cookieFile,
  profiles: state.config.cookieProfiles,
  activeProfileId: state.config.activeCookieProfileId,
});

/** 选择下载相关配置 */
export const selectDownloadConfig = (state: ConfigState) => ({
  defaultPath: state.config.defaultDownloadPath,
  maxConcurrent: state.config.maxConcurrentDownloads,
});

// Config Store Hooks
export function useConfig() {
  return useConfigStore(selectConfig);
}

export function useUpdateConfig() {
  return useConfigStore(selectUpdateConfig);
}

export function useCookieConfig() {
  return useConfigStore(useShallow(selectCookieConfig));
}

export function useDownloadConfig() {
  return useConfigStore(useShallow(selectDownloadConfig));
}

// ============================================
// Queue Store 选择器
// ============================================

/** 选择所有任务 */
export const selectTasks = (state: QueueState) => state.tasks;

/** 选择队列统计 */
export const selectQueueStats = (state: QueueState) => {
  const tasks = state.tasks;
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    downloading: tasks.filter((t) => t.status === 'downloading').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
    paused: tasks.filter((t) => t.status === 'paused').length,
  };
};

/** 选择待处理任务 */
export const selectPendingTasks = (state: QueueState) =>
  state.tasks.filter((t) => t.status === 'pending');

/** 选择下载中任务 */
export const selectDownloadingTasks = (state: QueueState) =>
  state.tasks.filter((t) => t.status === 'downloading');

/** 选择失败任务 */
export const selectFailedTasks = (state: QueueState) =>
  state.tasks.filter((t) => t.status === 'failed');

/** 选择可重试的失败任务 */
export const selectRetryableTasks = (state: QueueState) =>
  state.tasks.filter((t) => t.status === 'failed' && t.retryCount < t.maxRetries);

/** 选择队列操作函数 */
export const selectQueueActions = (state: QueueState) => ({
  addTask: state.addTask,
  updateTask: state.updateTask,
  removeTask: state.removeTask,
  retryTask: state.retryTask,
  clearCompleted: state.clearCompleted,
  clearFailed: state.clearFailed,
  getTask: state.getTask,
  appendTaskLog: state.appendTaskLog,
});

// Queue Store Hooks
export function useTasks() {
  return useQueueStore(selectTasks);
}

export function useQueueStats() {
  return useQueueStore(useShallow(selectQueueStats));
}

export function usePendingTasks() {
  return useQueueStore(selectPendingTasks);
}

export function useDownloadingTasks() {
  return useQueueStore(selectDownloadingTasks);
}

export function useFailedTasks() {
  return useQueueStore(selectFailedTasks);
}

export function useRetryableTasks() {
  return useQueueStore(selectRetryableTasks);
}

export function useQueueActions() {
  return useQueueStore(useShallow(selectQueueActions));
}

// ============================================
// Download Page Store 选择器
// ============================================

/** 选择下载页面状态 */
export const selectDownloadPageState = (state: DownloadPageState) => state.downloadPageState;

/** 选择下载页面更新函数 */
export const selectUpdateDownloadPageState = (state: DownloadPageState) =>
  state.updateDownloadPageState;

/** 选择视频信息相关状态 */
export const selectVideoState = (state: DownloadPageState) => ({
  videoUrl: state.downloadPageState.videoUrl,
  videoInfo: state.downloadPageState.videoInfo,
  downloadPath: state.downloadPageState.downloadPath,
});

/** 选择格式相关状态 */
export const selectFormatState = (state: DownloadPageState) => ({
  selectedFormat: state.downloadPageState.selectedFormat,
  audioOnly: state.downloadPageState.audioOnly,
  useBestQuality: state.downloadPageState.useBestQuality,
});

/** 选择播放列表相关状态 */
export const selectPlaylistState = (state: DownloadPageState) => ({
  playlistMode: state.downloadPageState.playlistMode,
  playlistItems: state.downloadPageState.playlistItems,
  playlistEnd: state.downloadPageState.playlistEnd,
});

/** 选择后处理相关状态 */
export const selectPostProcessState = (state: DownloadPageState) => ({
  embedSubs: state.downloadPageState.embedSubs,
  writeSubs: state.downloadPageState.writeSubs,
  writeAutoSubs: state.downloadPageState.writeAutoSubs,
  subLangs: state.downloadPageState.subLangs,
  writeThumbnail: state.downloadPageState.writeThumbnail,
  addMetadata: state.downloadPageState.addMetadata,
});

// Download Page Store Hooks
export function useDownloadPageState() {
  return useDownloadPageStore(selectDownloadPageState);
}

export function useUpdateDownloadPageState() {
  return useDownloadPageStore(selectUpdateDownloadPageState);
}

export function useVideoState() {
  return useDownloadPageStore(useShallow(selectVideoState));
}

export function useFormatState() {
  return useDownloadPageStore(useShallow(selectFormatState));
}

export function usePlaylistPageState() {
  return useDownloadPageStore(useShallow(selectPlaylistState));
}

export function usePostProcessState() {
  return useDownloadPageStore(useShallow(selectPostProcessState));
}

// ============================================
// 组合选择器
// ============================================

/**
 * 获取下载任务所需的完整配置
 */
export function useDownloadTaskConfig() {
  const cookieConfig = useCookieConfig();
  const downloadConfig = useDownloadConfig();

  return {
    ...cookieConfig,
    ...downloadConfig,
  };
}

/**
 * 检查是否可以开始下载
 */
export function useCanStartDownload() {
  const stats = useQueueStats();
  const downloadConfig = useDownloadConfig();
  const maxConcurrent = downloadConfig.maxConcurrent || 3;

  return stats.downloading < maxConcurrent && stats.pending > 0;
}
