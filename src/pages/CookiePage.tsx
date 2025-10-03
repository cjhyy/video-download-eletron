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
  Stack,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Radio,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Cookie as CookieIcon,
  CleaningServices as CleanIcon,
  UploadFile as UploadFileIcon,
  FolderOpen as FolderOpenIcon,
} from '@mui/icons-material';
import { useAppConfig, CookieProfile } from '../context/AppContext';

const CookiePage: React.FC = () => {
  const { config, updateConfig } = useAppConfig();
  const [cookieEnabled, setCookieEnabled] = useState(false);
  const [cookieFile, setCookieFile] = useState('');
  const [cookieExporting, setCookieExporting] = useState(false);
  const [cookieMethod, setCookieMethod] = useState<'file' | 'login'>('login');
  const [loginUrl, setLoginUrl] = useState('https://www.youtube.com');

  // 多Cookie配置相关状态
  const [cookieProfiles, setCookieProfiles] = useState<CookieProfile[]>([]);
  const [activeCookieProfileId, setActiveCookieProfileId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CookieProfile | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileDomain, setProfileDomain] = useState('');
  const [profileCookieFile, setProfileCookieFile] = useState('');
  
  // 创建配置对话框状态
  const [createProfileDialogOpen, setCreateProfileDialogOpen] = useState(false);
  const [createProfileName, setCreateProfileName] = useState('');
  const [createProfileDomain, setCreateProfileDomain] = useState('');
  const [pendingCookieFile, setPendingCookieFile] = useState<string>('');
  const [createProfileMethod, setCreateProfileMethod] = useState<'manual' | 'login'>('manual');
  
  // 拖放状态
  const [isDragging, setIsDragging] = useState(false);

  // 同步全局配置到本地状态
  useEffect(() => {
    setCookieEnabled(config.cookieEnabled || false);
    setCookieFile(config.cookieFile || '');
    setCookieProfiles(config.cookieProfiles || []);
    setActiveCookieProfileId(config.activeCookieProfileId || null);
  }, [config.cookieEnabled, config.cookieFile, config.cookieProfiles, config.activeCookieProfileId]);

  // 删除Cookie配置
  const handleDeleteProfile = (profileId: string) => {
    if (confirm('确定要删除此Cookie配置吗？')) {
      const newProfiles = cookieProfiles.filter(p => p.id !== profileId);
      setCookieProfiles(newProfiles);

      // 如果删除的是当前激活的配置，取消激活
      const newActiveId = activeCookieProfileId === profileId ? null : activeCookieProfileId;
      setActiveCookieProfileId(newActiveId);

      updateConfig({
        ...config,
        cookieProfiles: newProfiles,
        activeCookieProfileId: newActiveId,
        cookieEnabled: newActiveId !== null,
        cookieFile: newActiveId ? newProfiles.find(p => p.id === newActiveId)?.cookieFile || '' : '',
      });
    }
  };

  // 切换激活的Cookie配置
  const handleSelectProfile = (profileId: string) => {
    setActiveCookieProfileId(profileId);
    const profile = cookieProfiles.find(p => p.id === profileId);

    if (profile) {
      setCookieEnabled(true);
      setCookieFile(profile.cookieFile);
      updateConfig({
        ...config,
        activeCookieProfileId: profileId,
        cookieEnabled: true,
        cookieFile: profile.cookieFile,
      });
    }
  };

  // 打开编辑对话框
  const handleOpenEditDialog = (profile: CookieProfile) => {
    setEditingProfile(profile);
    setProfileName(profile.name);
    setProfileDomain(profile.domain);
    setProfileCookieFile(profile.cookieFile);
    setDialogOpen(true);
  };

  // 保存编辑的配置
  const handleSaveProfile = () => {
    if (!profileName.trim() || !profileDomain.trim() || !profileCookieFile.trim()) {
      alert('请填写完整信息');
      return;
    }

    if (editingProfile) {
      // 编辑现有配置
      const newProfiles = cookieProfiles.map(p =>
        p.id === editingProfile.id
          ? { ...p, name: profileName, domain: profileDomain, cookieFile: profileCookieFile }
          : p
      );

      setCookieProfiles(newProfiles);
      updateConfig({
        ...config,
        cookieProfiles: newProfiles,
      });

      setDialogOpen(false);
      setEditingProfile(null);
      setProfileName('');
      setProfileDomain('');
      setProfileCookieFile('');
    }
  };

  const handleManualEnableCookie = () => {
    if (!cookieFile.trim()) {
      alert('请先选择Cookie文件');
      return;
    }

    // 打开对话框让用户输入配置信息
    setPendingCookieFile(cookieFile.trim());
    setCreateProfileMethod('manual');
    setCreateProfileName('');
    setCreateProfileDomain('');
    setCreateProfileDialogOpen(true);
  };

  const handleLoginAndGetCookies = async () => {
    // 从登录URL中提取域名并预填充
    let extractedDomain = '';
    try {
      const parsedUrl = new URL(loginUrl);
      extractedDomain = parsedUrl.hostname;
    } catch (e) {
      console.warn('无法从URL提取域名:', loginUrl);
    }
    
    // 打开对话框让用户输入配置信息
    setCreateProfileMethod('login');
    setCreateProfileName('');
    setCreateProfileDomain(extractedDomain);
    setCreateProfileDialogOpen(true);
  };

  // 选择Cookie文件
  const handleSelectCookieFile = async () => {
    const filePath = await window.electronAPI.selectCookieFile();
    if (filePath) {
      setCookieFile(filePath);
    }
  };

  // 处理拖放
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.path.toLowerCase().endsWith('.txt')) {
        setCookieFile(file.path);
      } else {
        alert('只支持.txt格式的Cookie文件');
      }
    }
  };

  // 清除Cookie缓存
  const handleClearCookieCache = async () => {
    if (!confirm('确定要清除所有Cookie缓存文件吗？\n\n这将删除临时目录中所有保存的Cookie文件，但不会影响已配置的Cookie配置。')) {
      return;
    }

    try {
      const result = await window.electronAPI.clearCookieCache();
      if (result.success) {
        alert(result.message || '清除成功');
      } else {
        alert(`清除失败: ${result.error || '未知错误'}`);
      }
    } catch (error: any) {
      alert(`清除失败: ${error.message}`);
    }
  };

  // 处理创建配置对话框提交
  const handleCreateProfileSubmit = async () => {
    if (!createProfileName.trim() || !createProfileDomain.trim()) {
      alert('请填写完整信息');
      return;
    }

    setCreateProfileDialogOpen(false);

    if (createProfileMethod === 'manual') {
      // 手动选择文件方式，复制文件到本地目录
      (async () => {
        try {
          const result = await window.electronAPI.copyCookieFile(pendingCookieFile, createProfileDomain.trim());
          
          if (!result.success) {
            alert(`文件复制失败: ${result.error || '未知错误'}`);
            return;
          }

          const newProfile: CookieProfile = {
            id: Date.now().toString(),
            name: createProfileName.trim(),
            domain: createProfileDomain.trim(),
            cookieFile: result.cookieFile!, // 使用复制后的文件路径
            createdAt: new Date().toISOString(),
          };

          const newProfiles = [...cookieProfiles, newProfile];
          setCookieProfiles(newProfiles);
          setActiveCookieProfileId(newProfile.id);
          setCookieEnabled(true);

          updateConfig({
            ...config,
            cookieEnabled: true,
            cookieFile: result.cookieFile!,
            cookieProfiles: newProfiles,
            activeCookieProfileId: newProfile.id,
          });

          alert(`配置创建成功: ${createProfileName.trim()}\nCookie文件已保存到本地目录`);

          // 清空输入框
          setCookieFile('');
          setPendingCookieFile('');
        } catch (error: any) {
          alert(`创建配置失败: ${error.message}`);
        }
      })();
    } else if (createProfileMethod === 'login') {
      // 浏览器登录方式
      setCookieExporting(true);
      try {
        // 从登录URL提取域名用于Cookie文件命名
        let urlDomain = '';
        try {
          const parsedUrl = new URL(loginUrl);
          urlDomain = parsedUrl.hostname; // 例如: www.youtube.com
        } catch (e) {
          console.error('无法解析URL:', loginUrl);
          alert('登录网址格式不正确，请检查');
          setCookieExporting(false);
          return;
        }
        
        // 使用URL的域名作为Cookie文件名
        const result = await window.electronAPI.loginAndGetCookies(loginUrl, urlDomain);
        if (result.success && result.cookieFile) {
          // 创建新的Cookie配置
          const newProfile: CookieProfile = {
            id: Date.now().toString(),
            name: createProfileName.trim(),
            domain: createProfileDomain.trim(),
            cookieFile: result.cookieFile,
            createdAt: new Date().toISOString(),
          };

          const newProfiles = [...cookieProfiles, newProfile];
          setCookieProfiles(newProfiles);
          setActiveCookieProfileId(newProfile.id);
          setCookieEnabled(true);
          setCookieFile(result.cookieFile);

          // 保存到全局状态
          updateConfig({
            ...config,
            cookieEnabled: true,
            cookieFile: result.cookieFile,
            cookieProfiles: newProfiles,
            activeCookieProfileId: newProfile.id,
          });

          alert(`Cookie获取成功！已自动创建配置: ${createProfileName.trim()}`);
        } else {
          alert(`Cookie获取失败: ${result.error || '未知错误'}\n\n请确保已完成登录后再关闭窗口。`);
        }
      } catch (error: any) {
        alert(`Cookie获取失败: ${error.message}`);
      } finally {
        setCookieExporting(false);
      }
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cookie配置管理
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        配置Cookie可以解决HTTP 403错误，下载需要登录的视频。支持多个配置，按域名分类管理。
      </Alert>

      {/* Cookie全局开关 */}
      <Card sx={{ mb: 2, bgcolor: cookieEnabled ? '#e8f5e9' : '#fafafa' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" alignItems="center" spacing={2}>
              <CookieIcon color={cookieEnabled ? 'success' : 'disabled'} />
              <Box>
                <Typography variant="h6">
                  Cookie功能
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {cookieEnabled 
                    ? '已启用 - 下载时将使用Cookie进行身份验证' 
                    : '已禁用 - 下载时不使用Cookie（公开视频）'}
                </Typography>
              </Box>
            </Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={cookieEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked;
                    setCookieEnabled(enabled);
                    if (!enabled) {
                      // 禁用Cookie时，取消激活的配置
                      setActiveCookieProfileId(null);
                      updateConfig({
                        ...config,
                        cookieEnabled: false,
                        cookieFile: '',
                        activeCookieProfileId: null,
                      });
                    } else if (cookieProfiles.length > 0) {
                      // 启用Cookie时，如果有配置但没有激活的，提示用户选择
                      alert('请在下方选择一个Cookie配置');
                    }
                  }}
                  color="success"
                  size="medium"
                />
              }
              label={<Typography variant="body1" fontWeight="medium">{cookieEnabled ? '启用' : '禁用'}</Typography>}
              labelPlacement="start"
            />
          </Stack>
        </CardContent>
      </Card>

      {/* Cookie配置列表 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            已保存的配置
          </Typography>
          <Divider sx={{ mb: 2 }} />

          {cookieProfiles.length > 0 ? (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                点击配置选择使用，所有下载任务将使用选中的Cookie
              </Typography>
              <List sx={{ bgcolor: '#f5f5f5', borderRadius: 1, p: 0 }}>
                {cookieProfiles.map((profile) => (
                  <ListItem
                    key={profile.id}
                    sx={{
                      borderBottom: '1px solid #e0e0e0',
                      '&:last-child': { borderBottom: 'none' },
                      cursor: 'pointer',
                      bgcolor: activeCookieProfileId === profile.id ? '#e3f2fd' : 'transparent',
                      '&:hover': { bgcolor: activeCookieProfileId === profile.id ? '#e3f2fd' : '#eeeeee' },
                    }}
                    onClick={() => handleSelectProfile(profile.id)}
                  >
                    <Radio
                      checked={activeCookieProfileId === profile.id}
                      value={profile.id}
                      size="small"
                    />
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1">{profile.name}</Typography>
                          <Chip label={profile.domain} size="small" color="primary" variant="outlined" />
                        </Stack>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
                          Cookie文件: {profile.cookieFile}
                        </Typography>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditDialog(profile);
                        }}
                        sx={{ mr: 1 }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteProfile(profile.id);
                        }}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>

              {activeCookieProfileId && (
                <Alert severity="success" sx={{ mt: 2 }} icon={<CookieIcon />}>
                  ✅ 当前使用: <strong>{cookieProfiles.find(p => p.id === activeCookieProfileId)?.name}</strong>
                  {' '}({cookieProfiles.find(p => p.id === activeCookieProfileId)?.domain})
                </Alert>
              )}
            </Box>
          ) : (
            <Alert severity="info">
              还没有Cookie配置，请使用下方"获取Cookie"创建配置
            </Alert>
          )}
          
          <Divider sx={{ my: 2 }} />
          
          {/* 清除缓存按钮 */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                清除Cookie缓存文件
              </Typography>
              <Typography variant="caption" color="text.secondary">
                删除临时目录中所有Cookie文件，不影响配置
              </Typography>
            </Box>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<CleanIcon />}
              onClick={handleClearCookieCache}
              size="small"
            >
              清除缓存
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* 获取Cookie */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            获取Cookie
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
            <Button
              variant={cookieMethod === 'login' ? 'contained' : 'outlined'}
              onClick={() => setCookieMethod('login')}
            >
              🌐 浏览器登录（推荐）
            </Button>
            <Button
              variant={cookieMethod === 'file' ? 'contained' : 'outlined'}
              onClick={() => setCookieMethod('file')}
            >
              📁 手动选择Cookie文件
            </Button>
          </Stack>

          {cookieMethod === 'login' ? (
            <Box sx={{ width: '100%' }}>
              <Alert severity="success" sx={{ mb: 2 }}>
                ✨ <strong>推荐方式：</strong>无需关闭浏览器，支持扫码登录
              </Alert>
              <TextField
                fullWidth
                label="登录网站"
                value={loginUrl}
                onChange={(e) => setLoginUrl(e.target.value)}
                sx={{ mb: 2 }}
                helperText="将打开此网站的登录页面，支持账号密码登录和扫码登录"
              />
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>使用说明：</strong>
                <br />
                1. 点击下方按钮，会打开一个浏览器窗口
                <br />
                2. 在窗口中登录您的账号（支持扫码登录）
                <br />
                3. 登录成功后<strong>关闭登录窗口</strong>
                <br />
                4. 输入配置名称和域名
                <br />
                5. Cookie会自动保存并创建配置
              </Alert>
              <Button
                variant="contained"
                color="primary"
                onClick={handleLoginAndGetCookies}
                disabled={cookieExporting}
                startIcon={cookieExporting ? <Typography>⏳</Typography> : <Typography>🌐</Typography>}
                size="large"
              >
                {cookieExporting ? '等待登录...' : '打开登录窗口'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ width: '100%' }}>
              <Alert severity="info" sx={{ mb: 2 }}>
                <strong>推荐使用Chrome扩展：</strong>
                <br />
                1. 安装{' '}
                <a
                  href="https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#1976d2', textDecoration: 'underline' }}
                >
                  Get cookies.txt LOCALLY
                </a>
                <br />
                2. 访问视频网站并登录
                <br />
                3. 点击扩展 → Export → Netscape HTTP Cookie File
                <br />
                4. 保存cookies.txt到本地
                <br />
                5. 使用下方按钮选择文件或直接拖放Cookie文件
              </Alert>
              
              {/* 拖放区域 */}
              <Box
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                sx={{
                  border: isDragging ? '2px dashed #1976d2' : '2px dashed #ccc',
                  borderRadius: 2,
                  p: 3,
                  mb: 2,
                  textAlign: 'center',
                  bgcolor: isDragging ? '#e3f2fd' : '#fafafa',
                  transition: 'all 0.3s',
                  cursor: 'pointer',
                }}
              >
                <UploadFileIcon sx={{ fontSize: 48, color: isDragging ? '#1976d2' : '#999', mb: 1 }} />
                <Typography variant="body1" gutterBottom>
                  {isDragging ? '释放文件以上传' : '拖放Cookie文件到这里'}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                  或
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<FolderOpenIcon />}
                  onClick={handleSelectCookieFile}
                >
                  选择Cookie文件
                </Button>
              </Box>

              {cookieFile && (
                <Alert severity="success" sx={{ mb: 2 }} icon={<UploadFileIcon />}>
                  已选择文件: <strong>{cookieFile}</strong>
                </Alert>
              )}

              <Button
                variant="contained"
                color="primary"
                onClick={handleManualEnableCookie}
                disabled={!cookieFile.trim()}
                size="large"
                fullWidth
              >
                创建配置
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Cookie编辑对话框（仅用于编辑） */}
      {editingProfile && (
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>编辑Cookie配置</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                fullWidth
                label="配置名称"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="例如: YouTube账号1"
                helperText="给这个Cookie配置起个名字"
              />
              <TextField
                fullWidth
                label="域名"
                value={profileDomain}
                onChange={(e) => setProfileDomain(e.target.value)}
                placeholder="例如: youtube.com, bilibili.com"
                helperText="这个Cookie适用的网站域名"
              />
              <TextField
                fullWidth
                label="Cookie文件路径"
                value={profileCookieFile}
                onChange={(e) => setProfileCookieFile(e.target.value)}
                placeholder="例如: D:\cookies\youtube.txt"
                helperText="Netscape格式的Cookie文件完整路径"
                multiline
                rows={2}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveProfile} variant="contained" color="primary">
              保存
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* 创建Cookie配置对话框 */}
      <Dialog open={createProfileDialogOpen} onClose={() => setCreateProfileDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>创建Cookie配置</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="配置名称"
              value={createProfileName}
              onChange={(e) => setCreateProfileName(e.target.value)}
              placeholder="例如: YouTube账号1"
              helperText="给这个Cookie配置起个名字"
              autoFocus
            />
            <TextField
              fullWidth
              label="域名"
              value={createProfileDomain}
              onChange={(e) => setCreateProfileDomain(e.target.value)}
              placeholder="例如: youtube.com, bilibili.com"
              helperText={createProfileMethod === 'login' ? "已自动从登录网址提取域名（可修改）" : "这个Cookie适用的网站域名"}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateProfileDialogOpen(false)}>取消</Button>
          <Button onClick={handleCreateProfileSubmit} variant="contained" color="primary">
            确定
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CookiePage;

