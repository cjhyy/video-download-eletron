import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Loader2, Pause, Play, RefreshCcw, Trash2 } from 'lucide-react';
import { useConfigStore } from '@/store/configStore';
import { useQueueStore } from '@/store/queueStore';
import type { DownloadTask } from '@/store/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const QueuePage: React.FC = () => {
  const config = useConfigStore((s) => s.config);
  const tasks = useQueueStore((s) => s.tasks);
  const updateTask = useQueueStore((s) => s.updateTask);
  const appendTaskLog = useQueueStore((s) => s.appendTaskLog);
  const removeTask = useQueueStore((s) => s.removeTask);
  const retryTask = useQueueStore((s) => s.retryTask);
  const clearCompleted = useQueueStore((s) => s.clearCompleted);
  const clearFailed = useQueueStore((s) => s.clearFailed);
  const getTask = useQueueStore((s) => s.getTask);
  const [queuePaused, setQueuePaused] = useState(false);
  const [activeCount, setActiveCount] = useState(0);
  const activeDownloadIdsRef = useRef<Set<string>>(new Set());
  const cancelReasonRef = useRef<Map<string, 'pause' | 'remove'>>(new Map());

  // 使用全局配置中的并发限制
  const MAX_CONCURRENT_DOWNLOADS = config.maxConcurrentDownloads || 3;

  const scheduleDownloads = useCallback(() => {
    if (queuePaused) return;

    const activeIds = activeDownloadIdsRef.current;
    if (activeIds.size >= MAX_CONCURRENT_DOWNLOADS) return;

    const pendingTasks = tasks
      .slice()
      .filter((t) => t.status === 'pending')
      .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
    if (pendingTasks.length === 0) return;

    while (activeIds.size < MAX_CONCURRENT_DOWNLOADS && pendingTasks.length > 0 && !queuePaused) {
      const task = pendingTasks.shift();
      if (!task) break;

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
          if (reason === 'pause') {
            // 被用户暂停：保持 paused 状态即可
            return;
          }
          if (reason === 'remove') {
            // 被用户停止并移除：忽略即可
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
          // 补齐并发槽位
          setTimeout(() => scheduleDownloads(), 200);
        });
    }
  }, [queuePaused, tasks, updateTask, config.cookieEnabled, config.cookieFile]);

  // 监听下载进度和错误
  useEffect(() => {
    // 监听下载进度
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
      // 不在这里强制置为 failed：以 downloadVideo Promise 的最终结果为准，避免边界误判
      updateTask(payload.taskId, {
        error: payload.error,
      });
    };

    const handleLog = (payload: any) => {
      if (!payload?.taskId || !payload?.message || !payload?.ts) return;
      appendTaskLog(payload.taskId, {
        ts: payload.ts,
        level: payload.level || 'info',
        message: payload.message,
      });

      // Fallback: if we see explicit exit code 0 in logs, ensure UI state isn't stuck.
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
      // 主进程最终态：这是最可靠的“完成/失败”信号（页面刷新也能恢复）
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
  }, [appendTaskLog, updateTask]);

  // 自动开始：当有 pending 且未暂停时，尝试补齐并发槽位
  useEffect(() => {
    if (queuePaused) return;
    if (tasks.some((t) => t.status === 'pending')) {
      scheduleDownloads();
    }
  }, [tasks, queuePaused, scheduleDownloads]);

  const handleStartQueue = () => {
    setQueuePaused(false);
    scheduleDownloads();
  };

  const handlePauseQueue = () => {
    // 暂停调度：不再启动新任务（不会中断正在下载的任务）
    setQueuePaused(true);
  };

  const handlePauseTask = async (id: string) => {
    const task = getTask(id);
    if (!task || task.status !== 'downloading') return;

    cancelReasonRef.current.set(id, 'pause');
    updateTask(id, { status: 'paused' });
    await window.electronAPI.cancelDownload(id);
  };

  const handleResumeTask = (id: string) => {
    const task = getTask(id);
    if (!task || task.status !== 'paused') return;

    updateTask(id, { status: 'pending', error: undefined });
    scheduleDownloads();
  };

  const handleRemoveTask = async (id: string) => {
    const task = getTask(id);
    if (task?.status === 'downloading') {
      cancelReasonRef.current.set(id, 'remove');
      await window.electronAPI.cancelDownload(id);
    }

    removeTask(id);
  };

  const handleRetryTask = (id: string) => {
    retryTask(id);
    scheduleDownloads();
  };

  const handleClearCompleted = () => {
    clearCompleted();
  };

  const handleClearFailed = () => {
    clearFailed();
  };

  const handleRetryAllFailed = () => {
    const failedTasks = tasks.filter(
      (task) => task.status === 'failed' && task.retryCount < task.maxRetries
    );
    failedTasks.forEach((task) => {
      retryTask(task.id);
    });
    if (failedTasks.length > 0) scheduleDownloads();
  };

  const getStatusText = (status: DownloadTask['status']) => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'downloading':
        return '下载中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      case 'paused':
        return '已暂停';
    }
  };

  const stats = useMemo(() => {
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'pending').length,
      downloading: tasks.filter((t) => t.status === 'downloading').length,
      completed: tasks.filter((t) => t.status === 'completed').length,
      failed: tasks.filter((t) => t.status === 'failed').length,
      paused: tasks.filter((t) => t.status === 'paused').length,
    };
  }, [tasks]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">下载队列</div>
          <div className="text-sm text-muted-foreground">
            支持并发下载、单任务暂停/继续、停止并移除。
          </div>
        </div>

        {config.cookieEnabled && (
          <Alert>
            <AlertTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              Cookie 已启用
            </AlertTitle>
            <AlertDescription>
              {config.activeCookieProfileId && config.cookieProfiles ? (
                <span>
                  当前使用：
                  <span className="font-medium">
                    {config.cookieProfiles.find((p) => p.id === config.activeCookieProfileId)?.name}
                  </span>
                  （{config.cookieProfiles.find((p) => p.id === config.activeCookieProfileId)?.domain}）
                </span>
              ) : (
                <span>队列中的任务将使用 Cookie 下载（适用于需要登录的视频）。</span>
              )}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">队列概览</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">总计 {stats.total}</Badge>
              <Badge variant="outline">等待 {stats.pending}</Badge>
              <Badge>下载中 {stats.downloading}</Badge>
              <Badge variant="secondary">暂停 {stats.paused}</Badge>
              <Badge className="bg-green-600 text-white hover:bg-green-600/90">已完成 {stats.completed}</Badge>
              <Badge variant="destructive">失败 {stats.failed}</Badge>
              <Badge variant="outline">
                并发 {activeCount}/{MAX_CONCURRENT_DOWNLOADS}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleStartQueue} disabled={stats.pending === 0} className="gap-2">
                <Play className="h-4 w-4" />
                {queuePaused ? '继续下载' : '开始下载'}
              </Button>
              <Button variant="outline" onClick={handlePauseQueue} disabled={queuePaused} className="gap-2">
                <Pause className="h-4 w-4" />
                暂停队列
              </Button>
              <Button variant="outline" onClick={handleRetryAllFailed} disabled={stats.failed === 0} className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                重试失败任务
              </Button>
              <Button variant="outline" onClick={handleClearCompleted} disabled={stats.completed === 0}>
                清除已完成
              </Button>
              <Button variant="destructive" onClick={handleClearFailed} disabled={stats.failed === 0}>
                清除失败
              </Button>
            </div>
          </CardContent>
        </Card>

        {tasks.length === 0 ? (
          <Alert>
            <AlertTitle>队列为空</AlertTitle>
            <AlertDescription>请在“视频下载”页面添加任务。</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <Card key={task.id}>
                <CardContent className="space-y-3 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="truncate font-medium">{task.title}</div>
                      <div className="truncate text-xs text-muted-foreground">{task.url}</div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          task.status === 'failed'
                            ? 'destructive'
                            : task.status === 'completed'
                              ? 'secondary'
                              : 'outline'
                        }
                      >
                        {getStatusText(task.status)}
                      </Badge>

                      {task.status === 'downloading' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handlePauseTask(task.id)}
                              aria-label="暂停任务"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>暂停任务（可继续）</TooltipContent>
                        </Tooltip>
                      )}

                      {task.status === 'paused' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleResumeTask(task.id)}
                              aria-label="继续任务"
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>继续任务</TooltipContent>
                        </Tooltip>
                      )}

                      {task.status === 'failed' && task.retryCount < task.maxRetries && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleRetryTask(task.id)}
                              aria-label="重试任务"
                            >
                              <RefreshCcw className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            重试（{task.retryCount}/{task.maxRetries}）
                          </TooltipContent>
                        </Tooltip>
                      )}

                      {task.status !== 'completed' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleRemoveTask(task.id)}
                              aria-label="删除任务"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {task.status === 'downloading' ? '停止并移除任务' : '删除任务'}
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>

                  {(task.status === 'downloading' || task.status === 'completed') && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span>进度 {task.progress.toFixed(1)}%</span>
                          {task.status === 'downloading' && task.speed && (
                            <span className="text-primary font-medium">⚡ {task.speed}</span>
                          )}
                          {task.status === 'downloading' && task.eta && (
                            <span>⏳ 剩余 {task.eta}</span>
                          )}
                        </div>
                        {task.size && <span>{task.size}</span>}
                      </div>
                      <Progress value={task.progress} />
                    </div>
                  )}

                  {task.status === 'failed' && task.error && (
                    <Alert variant="destructive">
                      <AlertTitle className="flex items-center gap-2">
                        <CircleAlert className="h-4 w-4" />
                        下载失败
                      </AlertTitle>
                      <AlertDescription className="whitespace-pre-wrap break-words">
                        {task.error}
                      </AlertDescription>
                    </Alert>
                  )}

                  {task.status === 'completed' && task.completedAt && (
                    <div className="text-xs text-muted-foreground">
                      完成于：{new Date(task.completedAt).toLocaleString()}
                    </div>
                  )}

                  {task.status === 'downloading' && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      下载中…
                    </div>
                  )}

                  <Separator />
                  <div className="text-xs text-muted-foreground">任务 ID：{task.id}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default QueuePage;

