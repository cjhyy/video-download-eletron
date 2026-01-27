import React, { useEffect, useState } from 'react';
import { CheckCircle2, FolderOpen, RefreshCcw, XCircle, Plus as PlusIcon, Minus as MinusIcon } from 'lucide-react';
import { useConfigStore } from '@/store/configStore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface BinaryStatus {
  ytDlp: boolean;
  ffmpeg: boolean;
  paths: { ytDlp: string; ffmpeg: string };
}

interface SettingsPageProps {
  hideTitle?: boolean;
  section?: 'general' | 'ytdlp';
}

const SettingsPage: React.FC<SettingsPageProps> = ({ hideTitle, section }) => {
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const [defaultDownloadPath, setDefaultDownloadPath] = useState('');
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] = useState(3);
  const [binaryStatus, setBinaryStatus] = useState<BinaryStatus | null>(null);
  const [updating, setUpdating] = useState(false);
  const [ytdlpArgsText, setYtdlpArgsText] = useState<string>('');
  const [ytdlpArgsLoading, setYtdlpArgsLoading] = useState<boolean>(false);

  useEffect(() => {
    void checkBinaries();
  }, []);

  useEffect(() => {
    setDefaultDownloadPath(config.defaultDownloadPath || '');
    setMaxConcurrentDownloads(config.maxConcurrentDownloads || 3);
  }, [config.defaultDownloadPath, config.maxConcurrentDownloads]);

  useEffect(() => {
    // Load yt-dlp additionalArgs from main process (userData)
    (async () => {
      try {
        setYtdlpArgsLoading(true);
        const args = await window.electronAPI.getYtDlpArgs();
        setYtdlpArgsText((args ?? []).join('\n'));
      } catch (e: any) {
        console.warn('Failed to load yt-dlp args:', e?.message);
      } finally {
        setYtdlpArgsLoading(false);
      }
    })();
  }, []);

  const tokenizeArgs = (input: string): string[] => {
    // Minimal shell-like tokenizer (supports quotes). Intended for yt-dlp argv array.
    const s = input.trim();
    if (!s) return [];
    const out: string[] = [];
    let cur = '';
    let quote: '"' | "'" | null = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quote) {
        if (ch === quote) {
          quote = null;
        } else if (ch === '\\' && quote === '"' && i + 1 < s.length) {
          // allow simple escapes inside double quotes
          i++;
          cur += s[i];
        } else {
          cur += ch;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch as any;
        continue;
      }
      if (/\s/.test(ch)) {
        if (cur) {
          out.push(cur);
          cur = '';
        }
        continue;
      }
      cur += ch;
    }
    if (cur) out.push(cur);
    return out.filter(Boolean);
  };

  const handleSaveYtdlpArgs = async () => {
    try {
      setYtdlpArgsLoading(true);
      const parsed = tokenizeArgs(ytdlpArgsText.replace(/\r/g, '\n').split('\n').join(' '));
      const saved = await window.electronAPI.setYtDlpArgs(parsed);
      setYtdlpArgsText((saved ?? []).join('\n'));
      toast.success('已保存 yt-dlp 高级参数');
    } catch (e: any) {
      toast.error(`保存失败: ${e?.message || '未知错误'}`);
    } finally {
      setYtdlpArgsLoading(false);
    }
  };

  const handleResetYtdlpArgs = async () => {
    try {
      setYtdlpArgsLoading(true);
      const saved = await window.electronAPI.setYtDlpArgs([]);
      setYtdlpArgsText((saved ?? []).join('\n'));
      toast.success('已恢复默认（清空 additionalArgs）');
    } catch (e: any) {
      toast.error(`恢复失败: ${e?.message || '未知错误'}`);
    } finally {
      setYtdlpArgsLoading(false);
    }
  };

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
      updateConfig({ ...config, defaultDownloadPath: path });
    }
  };

  const handleUpdateYtDlp = async () => {
    setUpdating(true);
    try {
      const result = await window.electronAPI.updateYtDlp();
      if (result.success) {
        toast.success(result.message);
        await checkBinaries();
      } else {
        toast.error('error' in result ? result.error : '更新失败');
      }
    } catch (error: any) {
      toast.error(`更新失败: ${error.message}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleGpuCompat = async (enabled: boolean) => {
    updateConfig({ gpuCompatEnabled: enabled });
    try {
      await window.electronAPI.setUserSettings({ gpuCompatEnabled: enabled });
      toast.success('已保存 GPU 兼容模式设置（重启后生效）');
    } catch (e: any) {
      toast.error(`保存失败: ${e?.message || '未知错误'}`);
    }
  };

  const handleToggleCloseToTray = async (enabled: boolean) => {
    updateConfig({ closeToTray: enabled });
    try {
      await window.electronAPI.setUserSettings({ closeToTray: enabled });
      toast.success(enabled ? '已开启关闭时隐藏到托盘' : '已关闭托盘隐藏，点击关闭将直接退出');
    } catch (e: any) {
      toast.error(`保存失败: ${e?.message || '未知错误'}`);
    }
  };

  const StatusBadge = ({ ok }: { ok?: boolean }) =>
    ok ? (
      <Badge className="gap-1" variant="secondary">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        已就绪
      </Badge>
    ) : (
      <Badge className="gap-1" variant="destructive">
        <XCircle className="h-3.5 w-3.5" />
        未找到
      </Badge>
    );

  return (
    <div className="space-y-6">
      {!hideTitle && (
        <div className="space-y-1">
          <div className="text-2xl font-semibold tracking-tight">系统设置</div>
          <div className="text-sm text-muted-foreground">检查依赖、设置默认下载路径。</div>
        </div>
      )}

      {(section === 'general' || !section) && (
        <div id="general-settings" className="space-y-4">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">关闭时隐藏到托盘</div>
                  <div className="text-xs text-muted-foreground">
                    开启后点击关闭按钮将应用隐藏到任务栏托盘，而不是彻底退出。
                  </div>
                </div>
                <Switch checked={!!config.closeToTray} onCheckedChange={handleToggleCloseToTray} />
              </div>

              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">GPU 兼容模式</div>
                  <div className="text-xs text-muted-foreground">
                    用于少数机器的 GPU/驱动崩溃问题；开启后可能降低性能。<span className="font-medium">重启后生效</span>。
                  </div>
                </div>
                <Switch checked={!!config.gpuCompatEnabled} onCheckedChange={handleToggleGpuCompat} />
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium">默认保存路径</div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input readOnly value={defaultDownloadPath} placeholder="未设置" className="bg-muted" />
                    <Button variant="outline" onClick={handleSelectDefaultPath} className="gap-2 shrink-0">
                      <FolderOpen className="h-4 w-4" />
                      选择目录
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">下载的文件将默认保存在此目录下。</div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium">最大并发下载数</div>
                    <div className="text-xs text-muted-foreground">
                      同时进行的下载任务数量。推荐设置为 3-5。
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8"
                      disabled={maxConcurrentDownloads <= 1}
                      onClick={() => {
                        const val = Math.max(1, maxConcurrentDownloads - 1);
                        setMaxConcurrentDownloads(val);
                        updateConfig({ maxConcurrentDownloads: val });
                      }}
                    >
                      <MinusIcon className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-bold w-4 text-center">{maxConcurrentDownloads}</span>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      className="h-8 w-8"
                      disabled={maxConcurrentDownloads >= 10}
                      onClick={() => {
                        const val = Math.min(10, maxConcurrentDownloads + 1);
                        setMaxConcurrentDownloads(val);
                        updateConfig({ maxConcurrentDownloads: val });
                      }}
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(section === 'ytdlp' || !section) && (
        <div id="ytdlp-settings" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">组件状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col justify-between gap-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">yt-dlp 状态</span>
                    <StatusBadge ok={binaryStatus?.ytDlp} />
                  </div>
                  <div className="mt-1 break-all text-xs font-mono text-muted-foreground">
                    {binaryStatus?.paths.ytDlp || '未检测到路径'}
                  </div>
                </div>

                <div className="flex flex-col justify-between gap-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">ffmpeg 状态</span>
                    <StatusBadge ok={binaryStatus?.ffmpeg} />
                  </div>
                  <div className="mt-1 break-all text-xs font-mono text-muted-foreground">
                    {binaryStatus?.paths.ffmpeg || '未检测到路径'}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleUpdateYtDlp}
                    disabled={updating || !binaryStatus?.ytDlp}
                    className="gap-2"
                  >
                    <RefreshCcw className={cn("h-4 w-4", updating && "animate-spin")} />
                    {updating ? '正在检查更新...' : '更新 yt-dlp'}
                  </Button>
                  <Button variant="outline" onClick={checkBinaries}>
                    重新检查
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
                  提示：如果遇到某些网站无法下载，尝试更新 yt-dlp。
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">高级参数</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={ytdlpArgsText}
                onChange={(e) => setYtdlpArgsText(e.target.value)}
                placeholder={`示例：\n--proxy 127.0.0.1:7890\n--no-check-certificate\n--referer https://example.com`}
                rows={6}
                className="font-mono text-sm"
                disabled={ytdlpArgsLoading}
              />
              <div className="flex items-center gap-2">
                <Button onClick={handleSaveYtdlpArgs} disabled={ytdlpArgsLoading} className="px-8">
                  保存参数
                </Button>
                <Button variant="ghost" onClick={handleResetYtdlpArgs} disabled={ytdlpArgsLoading}>
                  重置
                </Button>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  注意：这些参数将直接传递给 yt-dlp 命令行。错误或冲突的参数可能会导致下载失败。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
