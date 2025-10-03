import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  IconButton,
  LinearProgress,
  Chip,
  Button,
  Stack,
  Tooltip,
  Alert,
  Divider,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Clear as ClearIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Download as DownloadingIcon,
  Refresh as RetryIcon,
} from '@mui/icons-material';
import { downloadQueue, DownloadTask } from '../utils/downloadQueue';
import { useAppConfig } from '../context/AppContext';

const QueuePage: React.FC = () => {
  const { config } = useAppConfig();
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [currentDownloading, setCurrentDownloading] = useState<string | null>(null);

  // 定义 processQueue 函数（必须在使用它的 useEffect 之前）
  const processQueue = useCallback(async () => {
    if (currentDownloading) return; // 已有任务在下载

    const pendingTasks = downloadQueue.getPendingTasks();
    if (pendingTasks.length === 0) return;

    const task = pendingTasks[0];
    setCurrentDownloading(task.id);
    downloadQueue.updateTask(task.id, { status: 'downloading' });
    downloadQueue.setCurrentDownload(task.id);

    try {
      await window.electronAPI.downloadVideo({
        url: task.url,
        outputPath: task.outputPath,
        format: task.format,
        audioOnly: task.audioOnly,
        useBrowserCookies: false,
        browserPath: 'auto',
        cookieFile: config.cookieEnabled && config.cookieFile ? config.cookieFile : undefined,
      });

      downloadQueue.updateTask(task.id, {
        status: 'completed',
        progress: 100,
        completedAt: new Date(),
      });
    } catch (error: any) {
      downloadQueue.updateTask(task.id, {
        status: 'failed',
        error: error.message,
      });
    } finally {
      setCurrentDownloading(null);
      downloadQueue.setCurrentDownload(null);
      // 处理下一个任务
      setTimeout(() => processQueue(), 1000);
    }
  }, [currentDownloading, config.cookieEnabled, config.cookieFile]);

  // 订阅任务更新和注册自动启动回调
  useEffect(() => {
    // 订阅任务更新
    const unsubscribe = downloadQueue.subscribe((updatedTasks) => {
      setTasks(updatedTasks);
    });

    // 初始加载
    setTasks(downloadQueue.getAllTasks());

    // 注册自动启动回调
    downloadQueue.setAutoStartCallback(() => {
      processQueue();
    });

    return () => {
      unsubscribe();
      downloadQueue.setAutoStartCallback(null);
    };
  }, [processQueue]);

  // 监听下载进度和错误
  useEffect(() => {
    // 监听下载进度
    const handleProgress = (progressInfo: any) => {
      const currentId = downloadQueue.getCurrentDownload();
      if (currentId && progressInfo.percent !== undefined) {
        downloadQueue.updateTask(currentId, {
          progress: progressInfo.percent,
        });
      }
    };

    const handleError = (error: string) => {
      const currentId = downloadQueue.getCurrentDownload();
      if (currentId) {
        downloadQueue.updateTask(currentId, {
          status: 'failed',
          error,
        });
        setCurrentDownloading(null);
        downloadQueue.setCurrentDownload(null);
        // 继续处理下一个任务
        setTimeout(() => processQueue(), 1000);
      }
    };

    window.electronAPI.onDownloadProgress(handleProgress);
    window.electronAPI.onDownloadError(handleError);

    return () => {
      window.electronAPI.removeAllListeners('download-progress');
      window.electronAPI.removeAllListeners('download-error');
    };
  }, [processQueue]);

  const handleStartQueue = () => {
    processQueue();
  };

  const handlePauseQueue = () => {
    // TODO: 实现暂停功能
    setCurrentDownloading(null);
  };

  const handleRemoveTask = (id: string) => {
    downloadQueue.removeTask(id);
  };

  const handleRetryTask = (id: string) => {
    downloadQueue.retryTask(id);
    // 如果没有任务在下载，立即开始处理队列
    if (!currentDownloading) {
      processQueue();
    }
  };

  const handleClearCompleted = () => {
    downloadQueue.clearCompleted();
  };

  const handleClearFailed = () => {
    downloadQueue.clearFailed();
  };

  const handleRetryAllFailed = () => {
    const failedTasks = tasks.filter(
      (task) => task.status === 'failed' && task.retryCount < task.maxRetries
    );
    failedTasks.forEach((task) => {
      downloadQueue.retryTask(task.id);
    });
    // 如果没有任务在下载，立即开始处理队列
    if (!currentDownloading && failedTasks.length > 0) {
      processQueue();
    }
  };

  const getStatusIcon = (status: DownloadTask['status']) => {
    switch (status) {
      case 'pending':
        return <PendingIcon color="action" />;
      case 'downloading':
        return <DownloadingIcon color="primary" />;
      case 'completed':
        return <CheckCircleIcon color="success" />;
      case 'failed':
        return <ErrorIcon color="error" />;
      case 'paused':
        return <PauseIcon color="warning" />;
    }
  };

  const getStatusColor = (status: DownloadTask['status']) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'downloading':
        return 'primary';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'paused':
        return 'warning';
    }
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

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'pending').length,
    downloading: tasks.filter((t) => t.status === 'downloading').length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    failed: tasks.filter((t) => t.status === 'failed').length,
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        下载队列
      </Typography>

      {/* Cookie状态提示 */}
      {config.cookieEnabled && config.activeCookieProfileId && config.cookieProfiles && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          Cookie已启用 - 当前使用: <strong>{config.cookieProfiles.find(p => p.id === config.activeCookieProfileId)?.name}</strong>
          {' '}({config.cookieProfiles.find(p => p.id === config.activeCookieProfileId)?.domain}) - 队列中的所有任务将使用此Cookie下载
        </Alert>
      )}
      {config.cookieEnabled && !config.activeCookieProfileId && (
        <Alert severity="success" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
          Cookie已启用 - 队列中的所有任务将使用Cookie进行下载
        </Alert>
      )}

      {/* 统计信息 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <Chip label={`总计: ${stats.total}`} />
            <Chip label={`等待: ${stats.pending}`} color="default" />
            <Chip label={`下载中: ${stats.downloading}`} color="primary" />
            <Chip label={`已完成: ${stats.completed}`} color="success" />
            <Chip label={`失败: ${stats.failed}`} color="error" />
          </Stack>

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={handleStartQueue}
              disabled={stats.pending === 0 || currentDownloading !== null}
            >
              开始下载
            </Button>
            <Button
              variant="outlined"
              startIcon={<PauseIcon />}
              onClick={handlePauseQueue}
              disabled={!currentDownloading}
            >
              暂停队列
            </Button>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<RetryIcon />}
              onClick={handleRetryAllFailed}
              disabled={stats.failed === 0}
            >
              重试失败任务
            </Button>
            <Button
              variant="outlined"
              color="success"
              onClick={handleClearCompleted}
              disabled={stats.completed === 0}
            >
              清除已完成
            </Button>
            <Button
              variant="outlined"
              color="error"
              onClick={handleClearFailed}
              disabled={stats.failed === 0}
            >
              清除失败
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* 任务列表 */}
      {tasks.length === 0 ? (
        <Alert severity="info">队列为空，请在下载页面添加任务</Alert>
      ) : (
        <Card>
          <CardContent>
            <List>
              {tasks.map((task, index) => (
                <React.Fragment key={task.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'stretch',
                      py: 2,
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        mb: 1,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                        {getStatusIcon(task.status)}
                        <Box sx={{ ml: 2, flex: 1 }}>
                          <Typography variant="subtitle1" noWrap>
                            {task.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {task.url}
                          </Typography>
                        </Box>
                      </Box>

                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip
                          label={getStatusText(task.status)}
                          color={getStatusColor(task.status)}
                          size="small"
                        />
                        {task.status === 'failed' && task.retryCount < task.maxRetries && (
                          <Tooltip title={`重试 (${task.retryCount}/${task.maxRetries})`}>
                            <IconButton
                              size="small"
                              onClick={() => handleRetryTask(task.id)}
                              color="warning"
                            >
                              <RetryIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                        {task.status !== 'completed' && (
                          <Tooltip title="删除任务">
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveTask(task.id)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Stack>
                    </Box>

                    {/* 进度条 */}
                    {(task.status === 'downloading' || task.status === 'completed') && (
                      <Box sx={{ width: '100%' }}>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            mb: 0.5,
                          }}
                        >
                          <Typography variant="caption">
                            进度: {task.progress.toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={task.progress}
                          color={task.status === 'completed' ? 'success' : 'primary'}
                        />
                      </Box>
                    )}

                    {/* 错误信息 */}
                    {task.status === 'failed' && task.error && (
                      <Alert 
                        severity="error" 
                        sx={{ mt: 1 }}
                        action={
                          task.retryCount < task.maxRetries && (
                            <Button
                              color="inherit"
                              size="small"
                              startIcon={<RetryIcon />}
                              onClick={() => handleRetryTask(task.id)}
                            >
                              重试 ({task.retryCount}/{task.maxRetries})
                            </Button>
                          )
                        }
                      >
                        {task.error}
                        {task.retryCount >= task.maxRetries && (
                          <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                            已达到最大重试次数
                          </Typography>
                        )}
                      </Alert>
                    )}

                    {/* 完成时间 */}
                    {task.status === 'completed' && task.completedAt && (
                      <Typography variant="caption" color="success.main" sx={{ mt: 1 }}>
                        完成于: {new Date(task.completedAt).toLocaleString()}
                      </Typography>
                    )}
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default QueuePage;

