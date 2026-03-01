import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download as DownloadIcon,
  Info as InfoIcon,
  Folder as FolderIcon,
  Cookie as CookieIcon,
  Plus as PlaylistAddIcon,
  ListChecks,
  Loader2,
} from 'lucide-react';
import { useConfigStore } from '@renderer/store/configStore';
import { useDownloadPageStore } from '@renderer/store/downloadPageStore';
import { useQueueStore } from '@renderer/store/queueStore';
import { useLogs } from '../hooks/useLogs';
import { formatDuration, formatFileSize } from '../utils/format';
import { getFormattedVideoFormats } from '../utils/videoFormats';
import { parseIpcError } from '@renderer/utils/ipcError';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert';
import { Label } from '@renderer/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { ScrollArea } from '@renderer/components/ui/scroll-area';
import { toast } from 'sonner';
import { Badge } from '@renderer/components/ui/badge';
import { Switch } from '@renderer/components/ui/switch';
import { getSiteInfoFromUrl } from '@renderer/utils/sites';
import { findBestCookieProfileForUrl } from '@renderer/utils/cookieProfiles';
import { Checkbox } from '@renderer/components/ui/checkbox';

const DownloadPage: React.FC = () => {
  const config = useConfigStore((s) => s.config);
  const configHydrated = useConfigStore((s) => s.hasHydrated);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const downloadPageState = useDownloadPageStore((s) => s.downloadPageState);
  const downloadHydrated = useDownloadPageStore((s) => s.hasHydrated);
  const updateDownloadPageState = useDownloadPageStore((s) => s.updateDownloadPageState);
  const addQueueTask = useQueueStore((s) => s.addTask);
  
  // 从全局状态读取
  const videoUrl = downloadPageState.videoUrl;
  const videoInfo = downloadPageState.videoInfo;
  const downloadPath = downloadPageState.downloadPath;
  const selectedFormat = downloadPageState.selectedFormat;
  const audioOnly = downloadPageState.audioOnly;
  const useBestQuality = downloadPageState.useBestQuality;
  const playlistMode = downloadPageState.playlistMode;
  const playlistItems = downloadPageState.playlistItems;
  const playlistEnd = downloadPageState.playlistEnd;
  const embedSubs = downloadPageState.embedSubs;
  const writeSubs = downloadPageState.writeSubs;
  const writeAutoSubs = downloadPageState.writeAutoSubs;
  const subLangs = downloadPageState.subLangs;
  const writeThumbnail = downloadPageState.writeThumbnail;
  const addMetadata = downloadPageState.addMetadata;
  
  // 本地UI状态（不需要持久化）
  const [loading, setLoading] = useState(false);
  const { logs, addLog } = useLogs();
  const [configLoaded, setConfigLoaded] = useState(false);
  const [useCookieForDownload, setUseCookieForDownload] = useState(true); // 控制本次下载是否使用Cookie
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistInfo, setPlaylistInfo] = useState<any>(null);
  const [playlistSelected, setPlaylistSelected] = useState<Record<string, boolean>>({});
  const [playlistSearch, setPlaylistSearch] = useState('');
  
  // 辅助函数：更新全局状态
  const setVideoUrl = (value: string) => updateDownloadPageState({ videoUrl: value });
  const setVideoInfo = (value: any) => updateDownloadPageState({ videoInfo: value });
  const setDownloadPath = (value: string) => updateDownloadPageState({ downloadPath: value });
  const setSelectedFormat = (value: string) => updateDownloadPageState({ selectedFormat: value });
  const setAudioOnly = (value: boolean) => updateDownloadPageState({ audioOnly: value });
  const setUseBestQuality = (value: boolean) => updateDownloadPageState({ useBestQuality: value });
  const setPlaylistMode = (value: 'single' | 'playlist') => updateDownloadPageState({ playlistMode: value });
  const setPlaylistItems = (value: string) => updateDownloadPageState({ playlistItems: value });
  const setPlaylistEnd = (value: number | undefined) => updateDownloadPageState({ playlistEnd: value });
  const setEmbedSubs = (value: boolean) => updateDownloadPageState({ embedSubs: value });
  const setWriteSubs = (value: boolean) => updateDownloadPageState({ writeSubs: value });
  const setWriteAutoSubs = (value: boolean) => updateDownloadPageState({ writeAutoSubs: value });
  const setSubLangs = (value: string) => updateDownloadPageState({ subLangs: value });
  const setWriteThumbnail = (value: boolean) => updateDownloadPageState({ writeThumbnail: value });
  const setAddMetadata = (value: boolean) => updateDownloadPageState({ addMetadata: value });

  const formattedFormats = useMemo(() => getFormattedVideoFormats(videoInfo), [videoInfo]);
  const siteInfo = useMemo(() => getSiteInfoFromUrl(videoUrl), [videoUrl]);

  const ensureCookieProfileForUrl = useCallback(
    (url: string) => {
      if (!config.cookieProfiles || config.cookieProfiles.length === 0) return;
      const best = findBestCookieProfileForUrl(url, config.cookieProfiles);
      if (!best) return;

      if (config.activeCookieProfileId !== best.id) {
        updateConfig({
          cookieEnabled: true,
          activeCookieProfileId: best.id,
          cookieFile: best.cookieFile,
        });
        toast.message(`已自动选择 Cookie：${best.name}（${best.domain}）`);
      }
    },
    [config.activeCookieProfileId, config.cookieProfiles, updateConfig]
  );

  const handleGetInfo = async () => {
    if (!videoUrl.trim()) {
      addLog('请输入视频链接', 'error');
      toast.error('请输入视频链接');
      return;
    }

    setLoading(true);
    addLog('正在获取视频信息...', 'info');

    try {
      if (useCookieForDownload) ensureCookieProfileForUrl(videoUrl);
      const shouldUseCookie = config.cookieEnabled && config.cookieFile && useCookieForDownload;
      const info = await window.electronAPI.getVideoInfo(
        videoUrl,
        false, // useBrowserCookies
        'auto',
        shouldUseCookie ? config.cookieFile : undefined
      );
      setVideoInfo(info);
      // reset playlist view if user re-fetches info
      setPlaylistInfo(null);
      setPlaylistSelected({});
      addLog('视频信息获取成功', 'success');
      toast.success('视频信息获取成功');
    } catch (error: any) {
      console.error('[获取视频信息] 失败:', error);
      const parsed = parseIpcError(error);
      addLog(`获取视频信息失败 [${parsed.code}]: ${parsed.message}`, 'error');
      toast.error(`获取信息失败 [${parsed.code}]: ${parsed.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleExpandPlaylist = async () => {
    if (!videoUrl.trim()) {
      toast.error('请输入视频链接');
      return;
    }
    setPlaylistLoading(true);
    try {
      if (useCookieForDownload) ensureCookieProfileForUrl(videoUrl);
      const shouldUseCookie = config.cookieEnabled && config.cookieFile && useCookieForDownload;
      const info = await window.electronAPI.getPlaylistInfo({
        url: videoUrl,
        cookieFile: shouldUseCookie ? config.cookieFile : undefined,
        playlistEnd: playlistEnd,
      });
      setPlaylistInfo(info);
      const selected: Record<string, boolean> = {};
      (info?.entries ?? []).forEach((e: any, idx: number) => {
        // default select all
        selected[String(idx)] = true;
      });
      setPlaylistSelected(selected);
      toast.success('列表已展开');
    } catch (e: any) {
      const parsed = parseIpcError(e);
      toast.error(`展开失败 [${parsed.code}]: ${parsed.message}`);
    } finally {
      setPlaylistLoading(false);
    }
  };

  const buildEntryUrl = (e: any): string => {
    const webpage = typeof e?.webpage_url === 'string' ? e.webpage_url : '';
    if (webpage) return webpage;
    const u = typeof e?.url === 'string' ? e.url : '';
    if (u && /^https?:\/\//i.test(u)) return u;
    const id = typeof e?.id === 'string' ? e.id : '';
    const extractor = typeof e?.extractor === 'string' ? e.extractor : '';
    if (id && (extractor.includes('youtube') || siteInfo.id === 'youtube')) {
      return `https://www.youtube.com/watch?v=${id}`;
    }
    return webpage || u || id || '';
  };

  const visiblePlaylistEntries = useMemo(() => {
    const entries: any[] = playlistInfo?.entries ?? [];
    const q = playlistSearch.trim().toLowerCase();
    if (!q) return entries.map((e, i) => ({ e, i }));
    return entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => {
        const t = (e?.title || '').toString().toLowerCase();
        const u = (e?.uploader || '').toString().toLowerCase();
        return t.includes(q) || u.includes(q);
      });
  }, [playlistInfo, playlistSearch]);

  const handleAddSelectedPlaylistEntries = () => {
    const entries: any[] = playlistInfo?.entries ?? [];
    if (!entries.length) {
      toast.error('请先展开列表');
      return;
    }
    if (!downloadPath) {
      toast.error('请先选择下载路径');
      return;
    }
    if (useCookieForDownload) ensureCookieProfileForUrl(videoUrl);

    const formatToUse = useBestQuality ? 'bestvideo+bestaudio/best' : selectedFormat;
    const toAdd: any[] = [];
    entries.forEach((e, idx) => {
      if (playlistSelected[String(idx)]) toAdd.push({ e, idx });
    });
    if (toAdd.length === 0) {
      toast.error('请至少选择一个条目');
      return;
    }
    for (const { e } of toAdd) {
      const url = buildEntryUrl(e);
      if (!url) continue;
      const title = e?.title || url;
      addQueueTask({
        url,
        title,
        outputPath: downloadPath,
        format: formatToUse,
        audioOnly,
        playlistMode: 'single',
        postProcess: { embedSubs, writeSubs, writeAutoSubs, subLangs, writeThumbnail, addMetadata },
      });
    }
    toast.success(`已加入队列：${toAdd.length} 个条目`);
  };

  const handleSelectPath = async () => {
    const path = await window.electronAPI.selectDownloadDirectory();
    if (path) {
      setDownloadPath(path);
      addLog(`下载路径已设置: ${path}`, 'success');
    }
  };

  const handleAddToQueue = () => {
    if (!downloadPath) {
      addLog('请先选择下载路径', 'error');
      toast.error('请先选择下载路径');
      return;
    }
    if (!videoUrl.trim()) {
      addLog('请输入视频链接', 'error');
      toast.error('请输入视频链接');
      return;
    }

    // 根据选项决定使用的格式
    const formatToUse = useBestQuality ? 'bestvideo+bestaudio/best' : selectedFormat;

    if (useCookieForDownload) ensureCookieProfileForUrl(videoUrl);

    addQueueTask({
      url: videoUrl,
      title:
        playlistMode === 'playlist'
          ? (videoInfo?.title ? `（列表）${videoInfo.title}` : `（列表）${siteInfo.displayName} 下载任务`)
          : (videoInfo?.title || videoUrl.trim() || siteInfo.displayName),
      outputPath: downloadPath,
      format: formatToUse,
      audioOnly,
      playlistMode,
      playlistItems: playlistMode === 'playlist' ? playlistItems.trim() || undefined : undefined,
      playlistEnd: playlistMode === 'playlist' ? playlistEnd : undefined,
      postProcess: {
        embedSubs,
        writeSubs,
        writeAutoSubs,
        subLangs,
        writeThumbnail,
        addMetadata,
      },
    });

    const qualityHint = useBestQuality ? ' (最高质量: 4K+最佳音频)' : '';
    const formatHint = audioOnly ? ' (仅音频)' : (selectedFormat && !useBestQuality ? ` (${selectedFormat})` : '');
    const listHint =
      playlistMode === 'playlist'
        ? `（列表模式${playlistItems.trim() ? `，选集: ${playlistItems.trim()}` : ''}${playlistEnd ? `，前 ${playlistEnd} 条` : ''}）`
        : '';
    
    addLog(`已添加到下载队列: ${(videoInfo?.title || siteInfo.displayName)}${listHint}${qualityHint}${formatHint}`, 'success');
    toast.success('已添加到下载队列', {
      description: (videoInfo?.title || siteInfo.displayName) + listHint + qualityHint + formatHint
    });
  };

  // 加载默认下载路径和Cookie状态
  useEffect(() => {
    if (configHydrated && downloadHydrated && !configLoaded) {
      if (config.defaultDownloadPath && !downloadPath) {
        setDownloadPath(config.defaultDownloadPath);
      }
      setConfigLoaded(true);
    }
  }, [configHydrated, downloadHydrated, configLoaded, config.defaultDownloadPath, downloadPath]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">视频下载</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>站点</span>
          <Badge variant="outline">{siteInfo.displayName}</Badge>
        </div>
      </div>

      {/* URL输入区域 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="请输入视频 URL (支持 YouTube, Bilibili 等平台)"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                disabled={loading}
                className="flex-1"
              />
              <Button onClick={handleGetInfo} disabled={loading} className="w-32">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <InfoIcon className="mr-2 h-4 w-4" />}
                {loading ? '获取中...' : '获取信息'}
              </Button>
            </div>

            {/* Cookie状态 */}
            {config.cookieEnabled ? (
              <Alert className="bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/20">
                <CookieIcon className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800 dark:text-green-400">Cookie 已启用</AlertTitle>
                <AlertDescription className="flex flex-col space-y-2">
                  <span className="text-green-700 dark:text-green-500/80">
                    当前使用: <strong>{config.cookieProfiles?.find(p => p.id === config.activeCookieProfileId)?.name || '默认配置'}</strong>
                  </span>
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
                    <Label htmlFor="use-cookie" className="text-sm font-medium cursor-pointer">
                      本次下载使用 Cookie（可选）
                    </Label>
                    <Switch
                      id="use-cookie"
                      checked={useCookieForDownload}
                      onCheckedChange={(checked) => setUseCookieForDownload(!!checked)}
                      disabled={loading}
                    />
                  </div>
                </AlertDescription>
              </Alert>
            ) : (
              <Alert variant="default">
                <InfoIcon className="h-4 w-4" />
                <AlertTitle>提示</AlertTitle>
                <AlertDescription>
                  如遇到 403 错误，请在 "Cookie 配置" 中配置 Cookie。
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 视频信息卡片 */}
      {videoInfo && (
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">视频信息</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">标题</p>
                <p className="text-base font-semibold line-clamp-2">{videoInfo.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">上传者</p>
                  <p className="text-sm">{videoInfo.uploader || '未知'}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">时长</p>
                  <p className="text-sm">{formatDuration(videoInfo.duration)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 下载选项 */}
      {(videoInfo || (videoUrl.trim().length > 0 && configLoaded)) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <DownloadIcon className="h-5 w-5" />
              下载设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="playlist-mode" className="cursor-pointer">列表/合集/频道模式（YouTube 优化）</Label>
                  <div className="text-xs text-muted-foreground">
                    关闭：单视频（会自动去掉 YouTube 的 list 参数）。开启：允许下载播放列表/频道，并支持“选集/前N条”。
                  </div>
                </div>
                <Switch
                  id="playlist-mode"
                  checked={playlistMode === 'playlist'}
                  onCheckedChange={(checked) => {
                    const v = !!checked;
                    setPlaylistMode(v ? 'playlist' : 'single');
                    // 列表模式下不建议手动选 format（不同视频格式差异大）
                    if (v) {
                      setUseBestQuality(true);
                      setSelectedFormat('');
                      setVideoInfo(null);
                      setPlaylistInfo(null);
                      setPlaylistSelected({});
                    }
                  }}
                  disabled={loading}
                />
              </div>

              {playlistMode === 'playlist' && (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="playlist-items">选集（可选）</Label>
                    <Input
                      id="playlist-items"
                      placeholder="例如: 1-10,13,15"
                      value={playlistItems}
                      onChange={(e) => setPlaylistItems(e.target.value)}
                      disabled={loading}
                    />
                    <div className="text-xs text-muted-foreground">对应 yt-dlp 的 <code>--playlist-items</code></div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="playlist-end">前 N 条（可选）</Label>
                    <Input
                      id="playlist-end"
                      placeholder="例如: 20"
                      value={playlistEnd ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (!raw) return setPlaylistEnd(undefined);
                        const n = Number(raw);
                        if (!Number.isFinite(n)) return;
                        setPlaylistEnd(Math.max(1, Math.floor(n)));
                      }}
                      disabled={loading}
                    />
                    <div className="text-xs text-muted-foreground">对应 yt-dlp 的 <code>--playlist-end</code>（建议配合使用防止一次拉取过多）</div>
                  </div>
                </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={handleExpandPlaylist}
                      disabled={playlistLoading || loading}
                      className="gap-2"
                      variant="secondary"
                    >
                      {playlistLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                      展开列表
                    </Button>
                    <Button
                      onClick={handleAddSelectedPlaylistEntries}
                      disabled={!playlistInfo || playlistLoading || loading}
                    >
                      批量加入队列（按条目）
                    </Button>
                  </div>

                  {playlistInfo && (
                    <div className="space-y-3 rounded-lg border bg-background/50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-0.5">
                          <div className="text-sm font-medium">
                            {playlistInfo?.title || '列表条目'}{' '}
                            <span className="text-xs text-muted-foreground">（{(playlistInfo?.entries ?? []).length}）</span>
                          </div>
                          {playlistInfo?.uploader && (
                            <div className="text-xs text-muted-foreground">来源：{playlistInfo.uploader}</div>
                          )}
                        </div>
                        <Input
                          placeholder="搜索标题/上传者"
                          value={playlistSearch}
                          onChange={(e) => setPlaylistSearch(e.target.value)}
                          className="sm:w-64"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const next: Record<string, boolean> = {};
                            (playlistInfo?.entries ?? []).forEach((_e: any, idx: number) => {
                              next[String(idx)] = true;
                            });
                            setPlaylistSelected(next);
                          }}
                        >
                          全选
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPlaylistSelected({})}
                        >
                          全不选
                        </Button>
                      </div>

                      <ScrollArea className="h-72 w-full rounded-md border bg-muted/10 p-2">
                        <div className="space-y-2">
                          {visiblePlaylistEntries.map(({ e, i }) => {
                            const title = e?.title || '(无标题)';
                            const uploader = e?.uploader || '';
                            const idxLabel = e?.index ?? (i + 1);
                            const checked = !!playlistSelected[String(i)];
                            return (
                              <div key={String(i)} className="flex items-start gap-3 rounded-md border bg-background p-3">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    setPlaylistSelected((prev) => ({ ...prev, [String(i)]: !!v }));
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">#{idxLabel}</Badge>
                                    <div className="truncate font-medium">{title}</div>
                                  </div>
                                  {(uploader || e?.duration) && (
                                    <div className="mt-1 text-xs text-muted-foreground truncate">
                                      {uploader ? uploader : ''}
                                      {uploader && e?.duration ? ' · ' : ''}
                                      {typeof e?.duration === 'number' ? `${Math.floor(e.duration / 60)}:${String(Math.floor(e.duration % 60)).padStart(2, '0')}` : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {visiblePlaylistEntries.length === 0 && (
                            <div className="p-6 text-center text-sm text-muted-foreground">无匹配条目</div>
                          )}
                        </div>
                      </ScrollArea>
                      <div className="text-xs text-muted-foreground">
                        提示：这里“按条目加入队列”会把每个选中视频作为独立任务下载（更易暂停/重试/并发）。
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>下载路径</Label>
              <div className="flex gap-2">
                <Input readOnly value={downloadPath} className="bg-muted" />
                <Button variant="outline" onClick={handleSelectPath} disabled={loading}>
                  <FolderIcon className="mr-2 h-4 w-4" />
                  选择目录
                </Button>
              </div>
            </div>

            <div className="grid gap-3 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="audio-only" className="cursor-pointer">仅下载音频 (MP3)</Label>
                  <div className="text-xs text-muted-foreground">将自动提取音频并转换为 MP3</div>
                </div>
                <Switch
                  id="audio-only"
                  checked={audioOnly}
                  onCheckedChange={(checked) => {
                    const v = !!checked;
                    setAudioOnly(v);
                    if (v) {
                      setUseBestQuality(false);
                      setSelectedFormat('');
                    }
                  }}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor="best-quality" className="cursor-pointer font-semibold text-primary">
                    ⭐ 使用最高质量 (4K/8K)
                  </Label>
                  <div className="text-xs text-muted-foreground">bestvideo+bestaudio 自动合并（推荐）</div>
                </div>
                <Switch
                  id="best-quality"
                  checked={useBestQuality}
                  onCheckedChange={(checked) => {
                    const v = !!checked;
                    setUseBestQuality(v);
                    if (v) setSelectedFormat('');
                  }}
                  disabled={loading || audioOnly}
                />
              </div>
            </div>

            {!audioOnly && !useBestQuality && playlistMode !== 'playlist' && videoInfo && (
              <div className="space-y-2">
                <Label>手动选择视频格式</Label>
                <Select
                  value={selectedFormat || undefined}
                  onValueChange={(v) => {
                    if (v === '__auto__') {
                      setSelectedFormat('');
                      return;
                    }
                    setSelectedFormat(v);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="自动选择最佳质量" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__auto__">自动选择最佳质量</SelectItem>
                    {formattedFormats.map((format) => {
                      const hasVideo = format.vcodec && format.vcodec !== 'none';
                      const hasAudio = format.acodec && format.acodec !== 'none';
                      const streamType = hasVideo && hasAudio ? '🎬' : hasVideo ? '📹' : '🎵';
                      
                      return (
                        <SelectItem key={format.format_id} value={format.format_id}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span className="font-medium">{format.height ? `${format.height}p` : (format.format_note || format.format_id)}</span>
                            <span className="text-muted-foreground uppercase">{format.ext}</span>
                            <span>{streamType}</span>
                            <span className="ml-auto text-xs opacity-70">{formatFileSize(format.filesize || format.filesize_approx)}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {useBestQuality && !audioOnly && (
              <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/20">
                <InfoIcon className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-700 dark:text-blue-400">
                  使用 <strong>bestvideo+bestaudio</strong> 下载并自动合并。
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 rounded-lg border p-4 bg-muted/30">
              <div className="text-sm font-medium">后处理预设（可选）</div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
                  <Label htmlFor="pp-metadata" className="text-sm font-medium cursor-pointer">元信息</Label>
                  <Switch
                    id="pp-metadata"
                    checked={addMetadata}
                    onCheckedChange={(checked) => setAddMetadata(!!checked)}
                    disabled={loading}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
                  <Label htmlFor="pp-thumb" className="text-sm font-medium cursor-pointer">封面</Label>
                  <Switch
                    id="pp-thumb"
                    checked={writeThumbnail}
                    onCheckedChange={(checked) => setWriteThumbnail(!!checked)}
                    disabled={loading}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
                  <Label htmlFor="pp-write-subs" className="text-sm font-medium cursor-pointer">下载字幕（.srt）</Label>
                  <Switch
                    id="pp-write-subs"
                    checked={writeSubs}
                    onCheckedChange={(checked) => setWriteSubs(!!checked)}
                    disabled={loading}
                  />
                </div>
              </div>
              {writeSubs && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
                    <Label htmlFor="pp-auto-subs" className="text-sm font-medium cursor-pointer">包含自动字幕</Label>
                    <Switch
                      id="pp-auto-subs"
                      checked={writeAutoSubs}
                      onCheckedChange={(checked) => setWriteAutoSubs(!!checked)}
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2 rounded-lg border bg-background/50 p-3">
                    <Label htmlFor="pp-sub-langs" className="text-sm font-medium cursor-pointer">字幕语言</Label>
                    <Input
                      id="pp-sub-langs"
                      value={subLangs}
                      onChange={(e) => setSubLangs(e.target.value)}
                      placeholder="例如: en.*,zh.*"
                      disabled={loading}
                    />
                    <div className="text-xs text-muted-foreground">
                      支持逗号分隔与通配符（yt-dlp 的 <code>--sub-langs</code>）。默认：<code>en.*</code>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
                <Label htmlFor="pp-embed-subs" className="text-sm font-medium cursor-pointer">嵌入字幕到视频（可选）</Label>
                <Switch
                  id="pp-embed-subs"
                  checked={embedSubs}
                  onCheckedChange={(checked) => setEmbedSubs(!!checked)}
                  disabled={loading || audioOnly || !writeSubs}
                />
              </div>
              <div className="text-xs text-muted-foreground">
                提示：字幕/封面会增加下载与后处理耗时；部分站点/格式可能不支持。字幕会自动转换为 .srt（便于英语训练）。
              </div>
            </div>

            <Button
              onClick={handleAddToQueue}
              disabled={!videoUrl.trim() || !downloadPath || loading}
              className="w-full h-12 text-lg font-semibold shadow-lg"
              size="lg"
            >
              <PlaylistAddIcon className="mr-2 h-5 w-5" />
              添加到下载队列
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 操作日志 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">操作日志</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-40 w-full rounded-md border bg-muted/20 p-4">
            <div className="space-y-1">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-10">暂无日志</p>
              ) : (
                logs.map((log, index) => (
                  <div
                    key={index}
                    className={`text-sm ${
                      log.type === 'error'
                        ? 'text-destructive'
                        : log.type === 'success'
                        ? 'text-green-600 dark:text-green-500'
                        : 'text-foreground'
                    }`}
                  >
                    <span className="mr-2 opacity-50">[{new Date().toLocaleTimeString()}]</span>
                    {log.message}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default DownloadPage;

