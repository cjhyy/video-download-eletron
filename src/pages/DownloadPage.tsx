import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  LinearProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Paper,
  List,
  ListItem,
  ListItemText,
  Stack,
  Snackbar,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Info as InfoIcon,
  Folder as FolderIcon,
  Cookie as CookieIcon,
  PlaylistAdd as PlaylistAddIcon,
} from '@mui/icons-material';
import { downloadQueue } from '../utils/downloadQueue';
import { useAppConfig } from '../context/AppContext';

const DownloadPage: React.FC = () => {
  const { config, isLoaded, downloadPageState, updateDownloadPageState } = useAppConfig();
  
  // 从全局状态读取
  const videoUrl = downloadPageState.videoUrl;
  const videoInfo = downloadPageState.videoInfo;
  const downloadPath = downloadPageState.downloadPath;
  const selectedFormat = downloadPageState.selectedFormat;
  const audioOnly = downloadPageState.audioOnly;
  const useBestQuality = downloadPageState.useBestQuality;
  
  // 本地UI状态（不需要持久化）
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<Array<{ message: string; type: 'info' | 'error' | 'success' }>>([]);
  const [configLoaded, setConfigLoaded] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [useCookieForDownload, setUseCookieForDownload] = useState(true); // 控制本次下载是否使用Cookie
  
  // 辅助函数：更新全局状态
  const setVideoUrl = (value: string) => updateDownloadPageState({ videoUrl: value });
  const setVideoInfo = (value: any) => updateDownloadPageState({ videoInfo: value });
  const setDownloadPath = (value: string) => updateDownloadPageState({ downloadPath: value });
  const setSelectedFormat = (value: string) => updateDownloadPageState({ selectedFormat: value });
  const setAudioOnly = (value: boolean) => updateDownloadPageState({ audioOnly: value });
  const setUseBestQuality = (value: boolean) => updateDownloadPageState({ useBestQuality: value });

  const addLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    setLogs((prev) => [...prev, { message: `[${new Date().toLocaleTimeString()}] ${message}`, type }]);
  };

  const handleGetInfo = async () => {
    if (!videoUrl.trim()) {
      addLog('请输入视频链接', 'error');
      return;
    }

    setLoading(true);
    addLog('正在获取视频信息...', 'info');

    try {
      const shouldUseCookie = config.cookieEnabled && config.cookieFile && useCookieForDownload;
      const info = await window.electronAPI.getVideoInfo(
        videoUrl,
        false, // useBrowserCookies
        'auto',
        shouldUseCookie ? config.cookieFile : undefined
      );
      console.log('[获取视频信息] 成功获取:', {
        title: info.title,
        formats_count: info.formats?.length || 0,
        uploader: info.uploader,
        duration: info.duration
      });
      setVideoInfo(info);
      addLog('视频信息获取成功', 'success');
      if (shouldUseCookie) {
        addLog('已使用Cookie进行身份验证', 'info');
      } else if (config.cookieEnabled && !useCookieForDownload) {
        addLog('本次未使用Cookie（已手动禁用）', 'info');
      }
    } catch (error: any) {
      console.error('[获取视频信息] 失败:', error);
      addLog(`获取视频信息失败: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPath = async () => {
    const path = await window.electronAPI.selectDownloadDirectory();
    if (path) {
      setDownloadPath(path);
      addLog(`下载路径已设置: ${path}`, 'success');
    }
  };

  const handleAddToQueue = () => {
    if (!videoInfo || !downloadPath) {
      addLog('请先获取视频信息并选择下载路径', 'error');
      return;
    }

    // 根据选项决定使用的格式
    const formatToUse = useBestQuality ? 'bestvideo+bestaudio/best' : selectedFormat;

    const taskId = downloadQueue.addTask({
      url: videoUrl,
      title: videoInfo.title,
      outputPath: downloadPath,
      format: formatToUse,
      audioOnly,
    });

    const qualityHint = useBestQuality ? ' (最高质量: 4K+最佳音频)' : '';
    const formatHint = audioOnly ? ' (仅音频)' : (selectedFormat && !useBestQuality ? ` (${selectedFormat})` : '');
    const successMessage = `✅ 已添加到下载队列并自动开始下载\n${videoInfo.title}${qualityHint}${formatHint}`;
    
    addLog(`已添加到下载队列: ${videoInfo.title}${qualityHint}${formatHint}`, 'success');
    
    // 显示 Snackbar 提示
    setSnackbarMessage(successMessage);
    setSnackbarOpen(true);
    
    // 可选：清空表单
    // setVideoInfo(null);
    // setVideoUrl('');
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  // 加载默认下载路径和Cookie状态（只在配置加载完成时执行一次）
  useEffect(() => {
    if (isLoaded && !configLoaded) {
      if (config.defaultDownloadPath && !downloadPath) {
        setDownloadPath(config.defaultDownloadPath);
        addLog(`已加载默认下载路径: ${config.defaultDownloadPath}`, 'info');
      }
      
      if (config.cookieEnabled && config.cookieFile) {
        addLog('已启用Cookie身份验证', 'success');
      }
      
      setConfigLoaded(true);
    }
    }, [isLoaded, configLoaded, config.defaultDownloadPath, config.cookieEnabled, config.cookieFile, downloadPath]);

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '未知';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb > 1024) {
      return ` (${(mb / 1024).toFixed(2)} GB)`;
    }
    return ` (${mb.toFixed(2)} MB)`;
  };

  const getFormattedVideoFormats = () => {
    if (!videoInfo) {
      console.log('[格式列表] videoInfo 为空');
      return [];
    }
    
    console.log('[格式列表] 原始 formats 数量:', videoInfo.formats.length);
    console.log('[格式列表] 原始 formats 示例:', videoInfo.formats.slice(0, 5));
    
    // 过滤出有分辨率的格式（包括YouTube分离的视频流）
    let validFormats = videoInfo.formats.filter((f) => {
      // 排除 storyboard（故事板缩略图）
      if (f.format_note?.toLowerCase().includes('storyboard') || f.ext === 'mhtml') {
        return false;
      }
      // 排除同时没有音视频编码的格式
      if (f.vcodec === 'none' && f.acodec === 'none') {
        return false;
      }
      // 只保留有分辨率信息的格式（YouTube的4K等高分辨率视频流可能vcodec不为none但acodec为none）
      return f.height && f.height > 0;
    });

    console.log('[格式列表] 过滤后有分辨率的格式数量:', validFormats.length);
    
    if (validFormats.length > 0) {
      console.log('[格式列表] 包含的分辨率:', [...new Set(validFormats.map(f => f.height))].sort((a, b) => b - a));
    }

    // 如果没有分辨率信息，使用宽松条件
    if (validFormats.length === 0) {
      console.log('[格式列表] 无分辨率信息，使用宽松条件');
      validFormats = videoInfo.formats.filter((f) => {
        return f.ext && f.format_note;
      });
      console.log('[格式列表] 宽松过滤后有效格式数量:', validFormats.length);
    }

    // 如果还是没有，返回前15个
    if (validFormats.length === 0) {
      console.warn('[格式列表] 所有过滤条件都无结果，返回原始前15个格式');
      return videoInfo.formats.slice(0, 15);
    }

    // 按分辨率降序排序
    const sortedFormats = validFormats.sort((a, b) => {
      const heightA = a.height || 0;
      const heightB = b.height || 0;
      return heightB - heightA;
    });

    // 去重：对于相同分辨率和扩展名，只保留一个
    const uniqueFormats: any[] = [];
    const seenResolutions = new Set<string>();

    sortedFormats.forEach((format) => {
      const resolution = format.height ? `${format.height}p` : format.format_note || 'unknown';
      const ext = format.ext || 'unknown';
      const key = `${resolution}-${ext}`;
      
      // 优先保留有音视频合并的格式，如果没有则保留视频流
      if (!seenResolutions.has(key)) {
        seenResolutions.add(key);
        uniqueFormats.push(format);
      }
    });

    console.log('[格式列表] 去重后格式数量:', uniqueFormats.length);
    console.log('[格式列表] 最终格式列表:', uniqueFormats.map(f => ({
      format_id: f.format_id,
      height: f.height,
      width: f.width,
      ext: f.ext,
      vcodec: f.vcodec,
      acodec: f.acodec,
      format_note: f.format_note,
      filesize: f.filesize || f.filesize_approx
    })));

    return uniqueFormats;
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        视频下载
      </Typography>

      {/* URL输入区域 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <TextField
                fullWidth
                label="视频链接"
                placeholder="请输入视频URL (支持YouTube, Bilibili等平台)"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={loading}
              />
              <Button
                fullWidth
                variant="contained"
                startIcon={<InfoIcon />}
                onClick={handleGetInfo}
                disabled={loading}
              >
                {loading ? '获取中...' : '获取信息'}
              </Button>

          {/* Cookie状态显示和控制 */}
          {config.cookieEnabled && config.activeCookieProfileId && config.cookieProfiles && (
            <Box sx={{ mt: 2 }}>
              <Stack spacing={1}>
                <Alert severity="success" icon={<CookieIcon />}>
                  Cookie已配置 - 当前使用: <strong>{config.cookieProfiles.find(p => p.id === config.activeCookieProfileId)?.name}</strong>
                  {' '}({config.cookieProfiles.find(p => p.id === config.activeCookieProfileId)?.domain})
                </Alert>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useCookieForDownload}
                      onChange={(e) => setUseCookieForDownload(e.target.checked)}
                      disabled={loading}
                    />
                  }
                  label="本次下载使用Cookie（可选）"
                />
              </Stack>
            </Box>
          )}
          {config.cookieEnabled && !config.activeCookieProfileId && (
            <Box sx={{ mt: 2 }}>
              <Stack spacing={1}>
                <Alert severity="success" icon={<CookieIcon />}>
                  Cookie已配置 - 可以下载需要登录的视频
                </Alert>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={useCookieForDownload}
                      onChange={(e) => setUseCookieForDownload(e.target.checked)}
                      disabled={loading}
                    />
                  }
                  label="本次下载使用Cookie（可选）"
                />
              </Stack>
            </Box>
          )}
          {!config.cookieEnabled && (
            <Box sx={{ mt: 2 }}>
              <Alert severity="info">
                如遇到403错误，请在"Cookie配置"中配置Cookie
              </Alert>
            </Box>
          )}
          </Stack>
        </CardContent>
      </Card>

      {/* 视频信息卡片 */}
      {videoInfo && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              视频信息
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body1">
                <strong>标题:</strong> {videoInfo.title}
              </Typography>
              <Typography variant="body2">
                <strong>上传者:</strong> {videoInfo.uploader || '未知'}
              </Typography>
              <Typography variant="body2">
                <strong>时长:</strong> {formatDuration(videoInfo.duration)}
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* 下载选项 */}
      {videoInfo && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              下载选项
            </Typography>
            <Stack spacing={2}>
              <TextField
                  fullWidth
                  label="下载路径"
                  value={downloadPath}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <Button
                        startIcon={<FolderIcon />}
                        onClick={handleSelectPath}
                        disabled={loading}
                      >
                        选择目录
                      </Button>
                    ),
                  }}
                />
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={audioOnly}
                        onChange={(e) => setAudioOnly(e.target.checked)}
                        disabled={loading}
                      />
                    }
                    label="仅下载音频 (MP3)"
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={useBestQuality}
                        onChange={(e) => setUseBestQuality(e.target.checked)}
                        disabled={loading || audioOnly}
                        color="success"
                      />
                    }
                    label="⭐ 使用最高质量"
                  />
                </Stack>
                
                {useBestQuality && !audioOnly && (
                  <Alert severity="success" sx={{ py: 0.5 }}>
                    使用 <strong>--format bestvideo+bestaudio</strong> 下载最高质量（4K/8K）并自动合并（推荐）
                  </Alert>
                )}
                
                <FormControl 
                  fullWidth 
                  disabled={audioOnly || loading || useBestQuality} 
                  sx={{ flex: 1 }}
                >
                  <InputLabel>视频格式</InputLabel>
                  <Select
                    value={selectedFormat}
                    label="视频格式"
                    onChange={(e) => setSelectedFormat(e.target.value)}
                  >
                    <MenuItem value="">
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                          自动选择最佳质量
                        </Typography>
                      </Box>
                    </MenuItem>
                    {getFormattedVideoFormats().map((format) => {
                      const hasVideo = format.vcodec && format.vcodec !== 'none';
                      const hasAudio = format.acodec && format.acodec !== 'none';
                      const streamType = hasVideo && hasAudio ? '🎬' : hasVideo ? '📹' : '🎵';
                      
                      return (
                        <MenuItem key={format.format_id} value={format.format_id}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 1, alignItems: 'center' }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {format.height ? `${format.height}p` : (format.format_note || format.format_id)}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {format.ext ? format.ext.toUpperCase() : ''}
                              {format.fps && format.fps > 30 ? ` ${format.fps}fps` : ''}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {streamType}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
                              {hasVideo && format.vcodec ? format.vcodec.split('.')[0].toUpperCase() : ''}
                              {formatFileSize(format.filesize || format.filesize_approx)}
                            </Typography>
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Stack>
              <Button
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PlaylistAddIcon />}
                onClick={handleAddToQueue}
                disabled={!downloadPath || loading}
              >
                添加到下载队列
              </Button>
          </Stack>
          </CardContent>
        </Card>
      )}

      {/* 操作日志 */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            操作日志
          </Typography>
          <Paper
            sx={{
              maxHeight: 200,
              overflow: 'auto',
              bgcolor: '#f5f5f5',
              p: 1,
            }}
          >
            <List dense>
              {logs.map((log, index) => (
                <ListItem key={index}>
                  <ListItemText
                    primary={log.message}
                    sx={{
                      color:
                        log.type === 'error'
                          ? 'error.main'
                          : log.type === 'success'
                          ? 'success.main'
                          : 'text.primary',
                    }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </CardContent>
      </Card>

      {/* Toast 通知 */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity="success" 
          sx={{ width: '100%', whiteSpace: 'pre-line' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default DownloadPage;

