import { useCallback, useEffect, useRef, useState } from 'react';
import { useConfigStore } from '@renderer/store/configStore';
import { useQueueStore } from '@renderer/store/queueStore';
import { QUEUE_CONFIG } from '@renderer/constants';
import type { DownloadTask } from '@renderer/store/types';

interface QueueSchedulerReturn {
  // 状态
  queuePaused: boolean;
  activeCount: number;

  // 队列操作
  startQueue: () => void;
  pauseQueue: () => void;
  scheduleDownloads: () => void;

  // 单任务操作
  pauseTask: (id: string) => Promise<void>;
  resumeTask: (id: string) => void;
  removeTask: (id: string) => Promise<void>;
  retryTask: (id: string) => void;

  // 批量操作
  retryAllFailed: () => void;
  clearCompleted: () => void;
  clearFailed: () => void;
}

export function useQueueScheduler(): QueueSchedulerReturn {
  const config = useConfigStore((s) => s.config);
  const tasks = useQueueStore((s) => s.tasks);
  const updateTask = useQueueStore((s) => s.updateTask);
  const appendTaskLog = useQueueStore((s) => s.appendTaskLog);
  const removeTaskFromStore = useQueueStore((s) => s.removeTask);
  const retryTaskInStore = useQueueStore((s) => s.retryTask);
  const clearCompletedInStore = useQueueStore((s) => s.clearCompleted);
  const clearFailedInStore = useQueueStore((s) => s.clearFailed);
  const getTask = useQueueStore((s) => s.getTask);

  const [queuePaused, setQueuePaused] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  const activeDownloadIdsRef = useRef<Set<string>>(new Set());
  const cancelReasonRef = useRef<Map<string, 'pause' | 'remove'>>(new Map());
  const isSchedulingRef = useRef(false);

  const MAX_CONCURRENT_DOWNLOADS = config.maxConcurrentDownloads || QUEUE_CONFIG.DEFAULT_MAX_CONCURRENT;

  // 调度下载任务
  const scheduleDownloads = useCallback(() => {
    if (isSchedulingRef.current) return;
    if (queuePaused) return;

    const activeIds = activeDownloadIdsRef.current;
    if (activeIds.size >= MAX_CONCURRENT_DOWNLOADS) return;

    const pendingTasks = tasks
      .slice()
      .filter((t) => t.status === 'pending')
      .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));

    if (pendingTasks.length === 0) return;

    isSchedulingRef.current = true;

    try {
      while (activeIds.size < MAX_CONCURRENT_DOWNLOADS && pendingTasks.length > 0 && !queuePaused) {
        const task = pendingTasks.shift();
        if (!task) break;

        if (activeIds.has(task.id)) {
          continue;
        }

        activeIds.add(task.id);
        setActiveCount(activeIds.size);

        updateTask(task.id, { status: 'downloading' });

        window.electronAPI
          .downloadVideo({
            taskId: task.id,
            url: task.url,
            outputPath: task.outputPath,
            format: task.format,
            audioOnly: task.audioOnly,
            playlistMode: task.playlistMode,
            playlistItems: task.playlistItems,
            playlistEnd: task.playlistEnd,
            postProcess: task.postProcess,
            useBrowserCookies: false,
            browserPath: 'auto',
            cookieFile: config.cookieEnabled && config.cookieFile ? config.cookieFile : undefined,
          })
          .then(() => {
            updateTask(task.id, {
              status: 'completed',
              progress: 100,
              completedAt: new Date().toISOString(),
            });
          })
          .catch((error: any) => {
            const reason = cancelReasonRef.current.get(task.id);
            if (reason === 'pause' || reason === 'remove') {
              return;
            }
            const tail = error?.details?.stderrTail;
            const tailText =
              Array.isArray(tail) && tail.length > 0 ? `\n\n---- stderrTail ----\n${tail.join('\n')}` : '';
            updateTask(task.id, {
              status: 'failed',
              error: (error?.message || String(error)) + tailText,
            });
          })
          .finally(() => {
            cancelReasonRef.current.delete(task.id);
            activeIds.delete(task.id);
            setActiveCount(activeIds.size);
            setTimeout(() => scheduleDownloads(), QUEUE_CONFIG.SCHEDULE_DELAY_MS);
          });
      }
    } finally {
      isSchedulingRef.current = false;
    }
  }, [queuePaused, tasks, updateTask, config.cookieEnabled, config.cookieFile, MAX_CONCURRENT_DOWNLOADS]);

  // 监听 IPC 事件
  useEffect(() => {
    const handleProgress = (progressInfo: any) => {
      if (!progressInfo?.taskId) return;
      const updates: Partial<DownloadTask> = {};
      if (progressInfo.percent !== undefined) updates.progress = progressInfo.percent;
      if (progressInfo.speed !== undefined) updates.speed = progressInfo.speed;
      if (progressInfo.eta !== undefined) updates.eta = progressInfo.eta;
      if (progressInfo.size !== undefined) updates.size = progressInfo.size;

      if (Object.keys(updates).length > 0) {
        updateTask(progressInfo.taskId, updates);
      }
    };

    const handleError = (payload: any) => {
      if (!payload?.taskId) return;
      updateTask(payload.taskId, { error: payload.error });
    };

    const handleLog = (payload: any) => {
      if (!payload?.taskId || !payload?.message || !payload?.ts) return;
      appendTaskLog(payload.taskId, {
        ts: payload.ts,
        level: payload.level || 'info',
        message: payload.message,
      });

      if (typeof payload.message === 'string' && payload.message.includes('yt-dlp exited with code 0')) {
        const t = getTask(payload.taskId);
        if (t && t.status === 'downloading') {
          updateTask(payload.taskId, {
            status: 'completed',
            progress: 100,
            completedAt: new Date().toISOString(),
          });
        }
      }
    };

    const handleDone = (payload: any) => {
      if (!payload?.taskId) return;
      if (payload.success) {
        updateTask(payload.taskId, {
          status: 'completed',
          progress: 100,
          completedAt: new Date(payload.ts || Date.now()).toISOString(),
          error: undefined,
        });
      } else {
        const errMsg = payload?.error?.message || '下载失败';
        const tail = payload?.error?.details?.stderrTail;
        const tailText =
          Array.isArray(tail) && tail.length > 0 ? `\n\n---- stderrTail ----\n${tail.join('\n')}` : '';
        updateTask(payload.taskId, {
          status: 'failed',
          error: errMsg + tailText,
        });
      }
    };

    window.electronAPI.onDownloadProgress(handleProgress);
    window.electronAPI.onDownloadError(handleError);
    window.electronAPI.onDownloadLog(handleLog);
    window.electronAPI.onDownloadDone(handleDone);

    return () => {
      window.electronAPI.removeAllListeners('download-progress');
      window.electronAPI.removeAllListeners('download-error');
      window.electronAPI.removeAllListeners('download-log');
      window.electronAPI.removeAllListeners('download-done');
    };
  }, [appendTaskLog, updateTask, getTask]);

  // 自动调度
  useEffect(() => {
    if (queuePaused) return;
    if (tasks.some((t) => t.status === 'pending')) {
      scheduleDownloads();
    }
  }, [tasks, queuePaused, scheduleDownloads]);

  // 队列控制
  const startQueue = useCallback(() => {
    setQueuePaused(false);
    scheduleDownloads();
  }, [scheduleDownloads]);

  const pauseQueue = useCallback(() => {
    setQueuePaused(true);
  }, []);

  // 单任务操作
  const pauseTask = useCallback(
    async (id: string) => {
      const task = getTask(id);
      if (!task || task.status !== 'downloading') return;

      cancelReasonRef.current.set(id, 'pause');
      updateTask(id, { status: 'paused' });
      await window.electronAPI.cancelDownload(id);
    },
    [getTask, updateTask]
  );

  const resumeTask = useCallback(
    (id: string) => {
      const task = getTask(id);
      if (!task || task.status !== 'paused') return;

      updateTask(id, { status: 'pending', error: undefined });
      scheduleDownloads();
    },
    [getTask, updateTask, scheduleDownloads]
  );

  const removeTask = useCallback(
    async (id: string) => {
      const task = getTask(id);
      if (task?.status === 'downloading') {
        cancelReasonRef.current.set(id, 'remove');
        await window.electronAPI.cancelDownload(id);
      }
      removeTaskFromStore(id);
    },
    [getTask, removeTaskFromStore]
  );

  const retryTask = useCallback(
    (id: string) => {
      retryTaskInStore(id);
      scheduleDownloads();
    },
    [retryTaskInStore, scheduleDownloads]
  );

  // 批量操作
  const retryAllFailed = useCallback(() => {
    const failedTasks = tasks.filter((task) => task.status === 'failed' && task.retryCount < task.maxRetries);
    failedTasks.forEach((task) => {
      retryTaskInStore(task.id);
    });
    if (failedTasks.length > 0) scheduleDownloads();
  }, [tasks, retryTaskInStore, scheduleDownloads]);

  const clearCompleted = useCallback(() => {
    clearCompletedInStore();
  }, [clearCompletedInStore]);

  const clearFailed = useCallback(() => {
    clearFailedInStore();
  }, [clearFailedInStore]);

  return {
    queuePaused,
    activeCount,
    startQueue,
    pauseQueue,
    scheduleDownloads,
    pauseTask,
    resumeTask,
    removeTask,
    retryTask,
    retryAllFailed,
    clearCompleted,
    clearFailed,
  };
}
