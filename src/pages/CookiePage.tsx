import React, { useState, useEffect } from 'react';
import {
  Trash2 as DeleteIcon,
  Edit as EditIcon,
  Cookie as CookieIcon,
  Eraser as CleanIcon,
  Upload as UploadFileIcon,
  FolderOpen as FolderOpenIcon,
  Globe as GlobeIcon,
  Plus as PlusIcon,
  Loader2,
  X,
} from 'lucide-react';
import { useConfigStore } from '@/store/configStore';
import type { CookieProfile } from '@/store/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { useConfirmStore } from '@/store/confirmStore';

interface CookiePageProps {
  isEmbedded?: boolean;
}

const CookiePage: React.FC<CookiePageProps> = ({ isEmbedded }) => {
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const confirm = useConfirmStore((s) => s.confirm);
  const [cookieEnabled, setCookieEnabled] = useState(false);
  const [cookieFile, setCookieFile] = useState('');
  const [cookieExporting, setCookieExporting] = useState(false);
  const [cookieMethod, setCookieMethod] = useState<'file' | 'login'>('login');
  const [loginUrl, setLoginUrl] = useState('https://www.youtube.com');
  const [presetSite, setPresetSite] = useState<'youtube' | 'bilibili' | 'tiktok'>('youtube');

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
  const handleDeleteProfile = async (profileId: string) => {
    const isConfirmed = await confirm({
      title: '删除配置',
      description: '确定要删除此 Cookie 配置吗？',
      variant: 'destructive',
      confirmText: '删除',
    });

    if (isConfirmed) {
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
      toast.success('配置已删除');
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
      toast.success(`已切换至配置: ${profile.name}`);
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
      toast.error('请填写完整信息');
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
      toast.success('配置已更新');
    }
  };

  const handleManualEnableCookie = () => {
    if (!cookieFile.trim()) {
      toast.error('请先选择 Cookie 文件');
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
        toast.error('只支持 .txt 格式的 Cookie 文件');
      }
    }
  };

  // 清除Cookie缓存
  const handleClearCookieCache = async () => {
    const isConfirmed = await confirm({
      title: '清除缓存',
      description: '确定要清除所有 Cookie 缓存文件吗？\n\n这将删除临时目录中所有保存的 Cookie 文件，但不会影响已配置的 Cookie 配置。',
      variant: 'destructive',
      confirmText: '清除',
    });

    if (!isConfirmed) {
      return;
    }

    try {
      const result = await window.electronAPI.clearCookieCache();
      if (result.success) {
        toast.success(result.message);
      } else if ('error' in result) {
        toast.error(`清除失败: ${result.error}`);
      }
    } catch (error: any) {
      toast.error(`清除失败: ${error.message}`);
    }
  };

  // 处理创建配置对话框提交
  const handleCreateProfileSubmit = async () => {
    if (!createProfileName.trim() || !createProfileDomain.trim()) {
      toast.error('请填写完整信息');
      return;
    }

    setCreateProfileDialogOpen(false);

    if (createProfileMethod === 'manual') {
      // 手动选择文件方式，复制文件到本地目录
      try {
        const result = await window.electronAPI.copyCookieFile(pendingCookieFile, createProfileDomain.trim());
        
        if (result.success) {
          const newProfile: CookieProfile = {
            id: Date.now().toString(),
            name: createProfileName.trim(),
            domain: createProfileDomain.trim(),
            cookieFile: result.cookieFile, // 使用复制后的文件路径
            createdAt: new Date().toISOString(),
          };

          const newProfiles = [...cookieProfiles, newProfile];
          setCookieProfiles(newProfiles);
          setActiveCookieProfileId(newProfile.id);
          setCookieEnabled(true);

          updateConfig({
            ...config,
            cookieEnabled: true,
            cookieFile: result.cookieFile,
            cookieProfiles: newProfiles,
            activeCookieProfileId: newProfile.id,
          });

          toast.success(`配置创建成功: ${createProfileName.trim()}`, {
            description: 'Cookie 文件已保存到本地目录'
          });

          // 清空输入框
          setCookieFile('');
          setPendingCookieFile('');
        } else if ('error' in result) {
          toast.error(`文件复制失败: ${result.error}`);
        }
      } catch (error: any) {
        toast.error(`创建配置失败: ${error.message}`);
      }
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
          toast.error('登录网址格式不正确，请检查');
          setCookieExporting(false);
          return;
        }
        
        // 使用URL的域名作为Cookie文件名
        const result = await window.electronAPI.loginAndGetCookies(loginUrl, urlDomain);
        if (result.success) {
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

          toast.success(`Cookie 获取成功！已自动创建配置: ${createProfileName.trim()}`);
        } else if ('error' in result) {
          toast.error(`Cookie 获取失败: ${result.error}`, {
            description: '请确保已完成登录后再关闭窗口。'
          });
        }
      } catch (error: any) {
        toast.error(`Cookie 获取失败: ${error.message}`);
      } finally {
        setCookieExporting(false);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Alert variant="default" className="bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/20">
        <GlobeIcon className="h-4 w-4 text-blue-600" />
        <AlertTitle className="text-blue-800 dark:text-blue-400">使用提示</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-500/80">
          配置 Cookie 可以解决 HTTP 403 错误，下载需要登录的视频。支持多个配置，按域名分类管理。
        </AlertDescription>
      </Alert>

      {/* Cookie 全局开关 */}
      <div id="cookie-switch" className="scroll-mt-20">
        <Card className={`${cookieEnabled ? 'border-green-200 bg-green-50/30 dark:border-green-900/20 dark:bg-green-900/5' : ''}`}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${cookieEnabled ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                  <CookieIcon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Cookie 功能</h3>
                  <p className="text-sm text-muted-foreground">
                    {cookieEnabled 
                      ? '已启用 - 下载时将使用 Cookie 进行身份验证' 
                      : '已禁用 - 下载时不使用 Cookie（仅公开视频）'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2 border p-2 rounded-lg bg-background">
                <Checkbox
                  id="cookie-enabled"
                  checked={cookieEnabled}
                  onCheckedChange={(checked) => {
                    const enabled = !!checked;
                    setCookieEnabled(enabled);
                    if (!enabled) {
                      setActiveCookieProfileId(null);
                      updateConfig({
                        ...config,
                        cookieEnabled: false,
                        cookieFile: '',
                        activeCookieProfileId: null,
                      });
                      toast.info('Cookie 功能已禁用');
                    } else if (cookieProfiles.length > 0) {
                      toast.info('请在下方选择一个 Cookie 配置');
                    }
                  }}
                />
                <Label htmlFor="cookie-enabled" className="text-base font-medium cursor-pointer px-2">
                  {cookieEnabled ? '已开启' : '已关闭'}
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cookie 配置列表 */}
      <div id="cookie-list" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">已保存的配置</CardTitle>
            <CardDescription>
              点击配置选择使用，所有下载任务将使用选中的 Cookie
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {cookieProfiles.length > 0 ? (
              <div className="space-y-3">
                <RadioGroup value={activeCookieProfileId || ''} onValueChange={handleSelectProfile}>
                  <div className="grid gap-3">
                    {cookieProfiles.map((profile) => (
                      <div
                        key={profile.id}
                        className={`flex items-center justify-between p-4 rounded-lg border transition-colors cursor-pointer hover:bg-muted/50 ${
                          activeCookieProfileId === profile.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'
                        }`}
                        onClick={() => handleSelectProfile(profile.id)}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <RadioGroupItem value={profile.id} id={profile.id} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={profile.id} className="font-semibold cursor-pointer truncate">
                                {profile.name}
                              </Label>
                              <Badge variant="outline" className="bg-background">{profile.domain}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-1">
                              {profile.cookieFile}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 ml-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditDialog(profile);
                            }}
                          >
                            <EditIcon className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProfile(profile.id);
                            }}
                          >
                            <DeleteIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </RadioGroup>

                {activeCookieProfileId && (
                  <Alert className="bg-green-50/50 border-green-100 dark:bg-green-900/10 dark:border-green-900/20">
                    <CookieIcon className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-400 font-medium">
                      ✅ 当前使用: {cookieProfiles.find(p => p.id === activeCookieProfileId)?.name} ({cookieProfiles.find(p => p.id === activeCookieProfileId)?.domain})
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : (
              <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/20">
                <CookieIcon className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                <p className="text-sm text-muted-foreground">还没有 Cookie 配置，请在下方创建</p>
              </div>
            )}
            
            <Separator className="my-4" />
            
            <div className="flex items-center justify-between bg-muted/30 p-4 rounded-lg">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">清除 Cookie 缓存文件</p>
                <p className="text-xs text-muted-foreground">删除临时目录中所有 Cookie 文件，不影响已保存的配置</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 dark:hover:bg-orange-950/20"
                onClick={handleClearCookieCache}
              >
                <CleanIcon className="h-4 w-4 mr-2" />
                清除缓存
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 获取 Cookie */}
      <div id="get-cookie" className="scroll-mt-20">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">添加 Cookie 配置</CardTitle>
            <CardDescription>选择一种方式获取 Cookie 并创建配置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
              <Button
                variant={cookieMethod === 'login' ? 'secondary' : 'ghost'}
                className={`flex-1 ${cookieMethod === 'login' ? 'bg-background shadow-sm' : ''}`}
                onClick={() => setCookieMethod('login')}
              >
                <GlobeIcon className="h-4 w-4 mr-2" />
                浏览器登录 (推荐)
              </Button>
              <Button
                variant={cookieMethod === 'file' ? 'secondary' : 'ghost'}
                className={`flex-1 ${cookieMethod === 'file' ? 'bg-background shadow-sm' : ''}`}
                onClick={() => setCookieMethod('file')}
              >
                <UploadFileIcon className="h-4 w-4 mr-2" />
                手动上传文件
              </Button>
            </div>

            {cookieMethod === 'login' ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <Alert className="bg-primary/5 border-primary/20">
                  <PlusIcon className="h-4 w-4 text-primary" />
                  <AlertTitle className="font-semibold text-primary">扫码/登录方式</AlertTitle>
                  <AlertDescription className="text-sm">
                    无需关闭浏览器，支持扫码登录。
                  </AlertDescription>
                </Alert>
                
                <div className="space-y-2">
                  <Label>站点快捷模板</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={presetSite === 'youtube' ? 'secondary' : 'outline'}
                      onClick={() => {
                        setPresetSite('youtube');
                        setLoginUrl('https://www.youtube.com');
                      }}
                    >
                      YouTube
                    </Button>
                    <Button
                      type="button"
                      variant={presetSite === 'bilibili' ? 'secondary' : 'outline'}
                      onClick={() => {
                        setPresetSite('bilibili');
                        setLoginUrl('https://www.bilibili.com');
                      }}
                    >
                      Bilibili
                    </Button>
                    <Button
                      type="button"
                      variant={presetSite === 'tiktok' ? 'secondary' : 'outline'}
                      onClick={() => {
                        setPresetSite('tiktok');
                        setLoginUrl('https://www.tiktok.com');
                      }}
                    >
                      TikTok
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="login-url">登录网站 URL</Label>
                  <Input
                    id="login-url"
                    placeholder="https://www.youtube.com"
                    value={loginUrl}
                    onChange={(e) => setLoginUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">将打开此网站的登录页面，支持账号密码和扫码登录</p>
                </div>

                <div className="p-4 rounded-lg bg-muted/50 border text-sm space-y-2">
                  <p className="font-semibold">使用说明:</p>
                  <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                    <li>点击下方按钮，会打开一个浏览器窗口</li>
                    <li>在窗口中登录您的账号（支持扫码）</li>
                    <li>登录成功后 <strong>直接关闭</strong> 登录窗口</li>
                    <li>输入配置名称，Cookie 会自动保存</li>
                  </ol>
                </div>

                <Button
                  className="w-full h-12"
                  onClick={handleLoginAndGetCookies}
                  disabled={cookieExporting}
                >
                  {cookieExporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      等待登录...
                    </>
                  ) : (
                    <>
                      <GlobeIcon className="mr-2 h-4 w-4" />
                      打开登录窗口
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="p-4 rounded-lg bg-muted/50 border text-sm space-y-3">
                  <p className="font-semibold">推荐使用 Chrome 扩展:</p>
                  <p className="text-muted-foreground">
                    1. 安装 <a href="https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium inline-flex items-center gap-1">Get cookies.txt LOCALLY</a><br />
                    2. 访问网站并登录，点击扩展 → Export → Netscape 格式<br />
                    3. 保存文件并在此处选择或拖放
                  </p>
                </div>
                
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                    isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-muted-foreground/20 hover:border-primary/50 bg-muted/10'
                  }`}
                  onClick={handleSelectCookieFile}
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className={`p-3 rounded-full ${isDragging ? 'bg-primary/20 text-primary' : 'bg-background text-muted-foreground'}`}>
                      <UploadFileIcon className="h-8 w-8" />
                    </div>
                    <div>
                      <p className="font-medium">{isDragging ? '释放文件' : '点击或拖放 Cookie 文件'}</p>
                      <p className="text-xs text-muted-foreground mt-1">支持 .txt (Netscape 格式)</p>
                    </div>
                  </div>
                </div>

                {cookieFile && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/20">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded-md bg-green-100 dark:bg-green-900/30 text-green-600">
                        <UploadFileIcon className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-medium truncate">{cookieFile}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setCookieFile('')} className="h-7 w-7">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                <Button
                  className="w-full h-12"
                  onClick={handleManualEnableCookie}
                  disabled={!cookieFile.trim()}
                >
                  创建配置
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cookie 编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>编辑 Cookie 配置</DialogTitle>
            <DialogDescription>
              修改已保存的 Cookie 配置信息
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">配置名称</Label>
              <Input
                id="edit-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="例如: 我的 YouTube 账号"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-domain">适用域名</Label>
              <Input
                id="edit-domain"
                value={profileDomain}
                onChange={(e) => setProfileDomain(e.target.value)}
                placeholder="例如: youtube.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-path">Cookie 文件路径</Label>
              <Input
                id="edit-path"
                value={profileCookieFile}
                onChange={(e) => setProfileCookieFile(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveProfile}>保存修改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建 Cookie 配置对话框 */}
      <Dialog open={createProfileDialogOpen} onOpenChange={setCreateProfileDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>创建 Cookie 配置</DialogTitle>
            <DialogDescription>
              为新获取的 Cookie 设置一个名称和关联域名
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">配置名称</Label>
              <Input
                id="create-name"
                value={createProfileName}
                onChange={(e) => setCreateProfileName(e.target.value)}
                placeholder="例如: 常用账号"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-domain">适用域名</Label>
              <Input
                id="create-domain"
                value={createProfileDomain}
                onChange={(e) => setCreateProfileDomain(e.target.value)}
                placeholder="例如: bilibili.com"
              />
              <p className="text-xs text-muted-foreground">
                {createProfileMethod === 'login' ? "已自动从登录网址提取域名（可修改）" : "这个 Cookie 适用的网站域名"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateProfileDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateProfileSubmit}>确定创建</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CookiePage;
