import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Divider,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useAppConfig } from '../context/AppContext';

interface BinaryStatus {
  ytDlp: boolean;
  ffmpeg: boolean;
  paths: {
    ytDlp: string;
    ffmpeg: string;
  };
}

const SettingsPage: React.FC = () => {
  const { config, updateConfig } = useAppConfig();
  const [defaultDownloadPath, setDefaultDownloadPath] = useState('');
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatus | null>(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    checkBinaries();
  }, []);

  // 同步全局配置到本地状态
  useEffect(() => {
    setDefaultDownloadPath(config.defaultDownloadPath || '');
  }, [config.defaultDownloadPath]);

  const checkBinaries = async () => {
    try {
      const status = await window.electronAPI.checkBinaries();
      setBinaryStatus(status);
    } catch (error) {
      console.error('Failed to check binaries:', error);
    }
  };

  const handleSelectDefaultPath = async () => {
    const path = await window.electronAPI.selectDownloadDirectory();
    if (path) {
      setDefaultDownloadPath(path);
      updateConfig({
        ...config,
        defaultDownloadPath: path,
      });
    }
  };

  const handleUpdateYtDlp = async () => {
    setUpdating(true);
    try {
      const result = await window.electronAPI.updateYtDlp();
      if (result.success) {
        alert(`✅ ${result.message || 'yt-dlp 更新成功！'}`);
        // 更新后重新检查版本
        await checkBinaries();
      } else {
        alert(`❌ ${result.error || '更新失败'}`);
      }
    } catch (error: any) {
      alert(`❌ 更新失败: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        系统设置
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        Cookie配置已移至独立页面，请在左侧导航栏选择"Cookie配置"进行设置
      </Alert>

      {/* 系统状态 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            系统状态
          </Typography>
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body1">yt-dlp:</Typography>
                {binaryStatus?.ytDlp ? (
                  <Chip
                    label="已就绪"
                    color="success"
                    size="small"
                    icon={<CheckCircleIcon />}
                  />
                ) : (
                  <Chip
                    label="未找到"
                    color="error"
                    size="small"
                    icon={<ErrorIcon />}
                  />
                )}
              </Stack>
              {binaryStatus && (
                <Typography variant="caption" color="text.secondary">
                  {binaryStatus.paths.ytDlp}
                </Typography>
              )}
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body1">ffmpeg:</Typography>
                {binaryStatus?.ffmpeg ? (
                  <Chip
                    label="已就绪"
                    color="success"
                    size="small"
                    icon={<CheckCircleIcon />}
                  />
                ) : (
                  <Chip
                    label="未找到"
                    color="error"
                    size="small"
                    icon={<ErrorIcon />}
                  />
                )}
              </Stack>
              {binaryStatus && (
                <Typography variant="caption" color="text.secondary">
                  {binaryStatus.paths.ffmpeg}
                </Typography>
              )}
            </Box>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <Button
            variant="contained"
            color="primary"
            onClick={handleUpdateYtDlp}
            disabled={updating || !binaryStatus?.ytDlp}
            startIcon={updating ? <Typography>⏳</Typography> : <Typography>🔄</Typography>}
          >
            {updating ? '更新中...' : '更新 yt-dlp'}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            自动更新 yt-dlp 到最新版本以支持最新的网站和功能
          </Typography>
        </CardContent>
      </Card>

      {/* 下载配置 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            下载配置
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <TextField
                fullWidth
                label="默认下载路径"
                value={defaultDownloadPath}
                placeholder="选择默认下载目录"
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={handleSelectDefaultPath}
                    >
                      选择目录
                    </Button>
                  ),
                }}
                helperText="设置后，下载页面将自动使用此路径"
              />
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
