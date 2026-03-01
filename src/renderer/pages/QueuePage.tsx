import React, { useMemo } from 'react';
import { CheckCircle2, CircleAlert, Cookie, FolderOpen, Loader2, Music, Pause, Play, RefreshCcw, Trash2, Video } from 'lucide-react';
import { useConfigStore } from '@renderer/store/configStore';
import { useQueueStore } from '@renderer/store/queueStore';
import { useQueueScheduler } from '@renderer/hooks/useQueueScheduler';
import type { DownloadTask } from '@renderer/store/types';
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert';
import { Badge } from '@renderer/components/ui/badge';
import { Button } from '@renderer/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Progress } from '@renderer/components/ui/progress';
import { Separator } from '@renderer/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@renderer/components/ui/tooltip';

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

const QueuePage: React.FC = () => {
  const config = useConfigStore((s) => s.config);
  const tasks = useQueueStore((s) => s.tasks);

  const scheduler = useQueueScheduler();
  const MAX_CONCURRENT_DOWNLOADS = config.maxConcurrentDownloads || 3;

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
                并发 {scheduler.activeCount}/{MAX_CONCURRENT_DOWNLOADS}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={scheduler.startQueue} disabled={stats.pending === 0} className="gap-2">
                <Play className="h-4 w-4" />
                {scheduler.queuePaused ? '继续下载' : '开始下载'}
              </Button>
              <Button
                variant="outline"
                onClick={scheduler.pauseQueue}
                disabled={scheduler.queuePaused}
                className="gap-2"
              >
                <Pause className="h-4 w-4" />
                暂停队列
              </Button>
              <Button
                variant="outline"
                onClick={scheduler.retryAllFailed}
                disabled={stats.failed === 0}
                className="gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                重试失败任务
              </Button>
              <Button variant="outline" onClick={scheduler.clearCompleted} disabled={stats.completed === 0}>
                清除已完成
              </Button>
              <Button variant="destructive" onClick={scheduler.clearFailed} disabled={stats.failed === 0}>
                清除失败
              </Button>
            </div>
          </CardContent>
        </Card>

        {tasks.length === 0 ? (
          <Alert>
            <AlertTitle>队列为空</AlertTitle>
            <AlertDescription>请在"视频下载"页面添加任务。</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onPause={scheduler.pauseTask}
                onResume={scheduler.resumeTask}
                onRemove={scheduler.removeTask}
                onRetry={scheduler.retryTask}
              />
            ))}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

interface TaskCardProps {
  task: DownloadTask;
  onPause: (id: string) => Promise<void>;
  onResume: (id: string) => void;
  onRemove: (id: string) => Promise<void>;
  onRetry: (id: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onPause, onResume, onRemove, onRetry }) => {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="truncate font-medium">{task.title}</div>
            <div className="truncate text-xs text-muted-foreground">{task.url}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {task.cookieFile ? (
                <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground">
                  <Cookie className="h-3 w-3" />
                  {task.cookieFile.replace(/^.*[\\/]/, '')}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground">
                  无 Cookie
                </Badge>
              )}
              <Badge variant="outline" className="gap-1 text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground">
                {task.audioOnly ? (
                  <><Music className="h-3 w-3" />仅音频 MP3</>
                ) : task.format ? (
                  <><Video className="h-3 w-3" />{task.format}</>
                ) : (
                  '默认格式'
                )}
              </Badge>
              {task.playlistMode === 'playlist' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-normal text-muted-foreground">
                  列表模式
                </Badge>
              )}
            </div>
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
                    onClick={() => onPause(task.id)}
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
                    onClick={() => onResume(task.id)}
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
                    onClick={() => onRetry(task.id)}
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
                    onClick={() => onRemove(task.id)}
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
                {task.status === 'downloading' && task.eta && <span>⏳ 剩余 {task.eta}</span>}
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
            <AlertDescription className="whitespace-pre-wrap break-words">{task.error}</AlertDescription>
          </Alert>
        )}

        {task.status === 'completed' && (
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {task.completedAt && <>完成于：{new Date(task.completedAt).toLocaleString()}</>}
              {task.size && <> · {task.size}</>}
            </div>
            {task.filePath && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-7 text-xs"
                onClick={() => window.electronAPI.showItemInFolder(task.filePath!)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                打开文件
              </Button>
            )}
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
  );
};

export default QueuePage;
