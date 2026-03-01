import { useCallback, useEffect, useMemo, useState } from 'react';
import { useConfigStore } from '@renderer/store/configStore';
import { useDownloadPageStore } from '@renderer/store/downloadPageStore';
import { useQueueStore } from '@renderer/store/queueStore';
import { useLogs } from '@renderer/hooks/useLogs';
import { getFormattedVideoFormats } from '@renderer/utils/videoFormats';
import { parseIpcError } from '@renderer/utils/ipcError';
import { getSiteInfoFromUrl } from '@renderer/utils/sites';
import { findBestCookieProfileForUrl } from '@renderer/utils/cookieProfiles';
import { toast } from 'sonner';

export interface PlaylistEntry {
  id?: string;
  title?: string;
  uploader?: string;
  duration?: number;
  webpage_url?: string;
  url?: string;
  extractor?: string;
  index?: number;
}

export interface PlaylistInfo {
  id?: string;
  title?: string;
  uploader?: string;
  entries: PlaylistEntry[];
}

export function useDownloadLogic() {
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

  // 本地UI状态
  const [loading, setLoading] = useState(false);
  const { logs, addLog } = useLogs();
  const [configLoaded, setConfigLoaded] = useState(false);
  const [useCookieForDownload, setUseCookieForDownload] = useState(true);
  const [playlistLoading, setPlaylistLoading] = useState(false);
  const [playlistInfo, setPlaylistInfo] = useState<PlaylistInfo | null>(null);
  const [playlistSelected, setPlaylistSelected] = useState<Record<string, boolean>>({});
  const [playlistSearch, setPlaylistSearch] = useState('');

  // 状态更新函数
  const setVideoUrl = useCallback(
    (value: string) => updateDownloadPageState({ videoUrl: value }),
    [updateDownloadPageState]
  );
  const setVideoInfo = useCallback(
    (value: any) => updateDownloadPageState({ videoInfo: value }),
    [updateDownloadPageState]
  );
  const setDownloadPath = useCallback(
    (value: string) => updateDownloadPageState({ downloadPath: value }),
    [updateDownloadPageState]
  );
  const setSelectedFormat = useCallback(
    (value: string) => updateDownloadPageState({ selectedFormat: value }),
    [updateDownloadPageState]
  );
  const setAudioOnly = useCallback(
    (value: boolean) => updateDownloadPageState({ audioOnly: value }),
    [updateDownloadPageState]
  );
  const setUseBestQuality = useCallback(
    (value: boolean) => updateDownloadPageState({ useBestQuality: value }),
    [updateDownloadPageState]
  );
  const setPlaylistMode = useCallback(
    (value: 'single' | 'playlist') => updateDownloadPageState({ playlistMode: value }),
    [updateDownloadPageState]
  );
  const setPlaylistItems = useCallback(
    (value: string) => updateDownloadPageState({ playlistItems: value }),
    [updateDownloadPageState]
  );
  const setPlaylistEnd = useCallback(
    (value: number | undefined) => updateDownloadPageState({ playlistEnd: value }),
    [updateDownloadPageState]
  );
  const setEmbedSubs = useCallback(
    (value: boolean) => updateDownloadPageState({ embedSubs: value }),
    [updateDownloadPageState]
  );
  const setWriteSubs = useCallback(
    (value: boolean) => updateDownloadPageState({ writeSubs: value }),
    [updateDownloadPageState]
  );
  const setWriteAutoSubs = useCallback(
    (value: boolean) => updateDownloadPageState({ writeAutoSubs: value }),
    [updateDownloadPageState]
  );
  const setSubLangs = useCallback(
    (value: string) => updateDownloadPageState({ subLangs: value }),
    [updateDownloadPageState]
  );
  const setWriteThumbnail = useCallback(
    (value: boolean) => updateDownloadPageState({ writeThumbnail: value }),
    [updateDownloadPageState]
  );
  const setAddMetadata = useCallback(
    (value: boolean) => updateDownloadPageState({ addMetadata: value }),
    [updateDownloadPageState]
  );

  // 计算属性
  const formattedFormats = useMemo(() => getFormattedVideoFormats(videoInfo), [videoInfo]);
  const siteInfo = useMemo(() => getSiteInfoFromUrl(videoUrl), [videoUrl]);

  // Cookie 配置自动切换
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

  // 获取 Cookie 文件路径
  const getCookieFile = useCallback(() => {
    const shouldUseCookie = config.cookieEnabled && config.cookieFile && useCookieForDownload;
    return shouldUseCookie ? config.cookieFile : undefined;
  }, [config.cookieEnabled, config.cookieFile, useCookieForDownload]);

  // 获取视频信息
  const handleGetInfo = useCallback(async () => {
    if (!videoUrl.trim()) {
      addLog('请输入视频链接', 'error');
      toast.error('请输入视频链接');
      return;
    }

    setLoading(true);
    addLog('正在获取视频信息...', 'info');

    try {
      if (useCookieForDownload) ensureCookieProfileForUrl(videoUrl);
      const info = await window.electronAPI.getVideoInfo(
        videoUrl,
        false,
        'auto',
        getCookieFile()
      );
      setVideoInfo(info);
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
  }, [videoUrl, useCookieForDownload, ensureCookieProfileForUrl, getCookieFile, addLog, setVideoInfo]);

  // 展开播放列表
  const handleExpandPlaylist = useCallback(async () => {
    if (!videoUrl.trim()) {
      toast.error('请输入视频链接');
      return;
    }
    setPlaylistLoading(true);
    try {
      if (useCookieForDownload) ensureCookieProfileForUrl(videoUrl);
      const info = await window.electronAPI.getPlaylistInfo({
        url: videoUrl,
        cookieFile: getCookieFile(),
        playlistEnd: playlistEnd,
      });
      setPlaylistInfo(info);
      const selected: Record<string, boolean> = {};
      (info?.entries ?? []).forEach((_: any, idx: number) => {
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
  }, [videoUrl, useCookieForDownload, ensureCookieProfileForUrl, getCookieFile, playlistEnd]);

  // 构建条目 URL
  const buildEntryUrl = useCallback(
    (e: PlaylistEntry): string => {
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
    },
    [siteInfo.id]
  );

  // 可见的播放列表条目（过滤后）
  const visiblePlaylistEntries = useMemo(() => {
    const entries: PlaylistEntry[] = playlistInfo?.entries ?? [];
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

  // 批量添加选中的列表条目到队列
  const handleAddSelectedPlaylistEntries = useCallback(() => {
    const entries: PlaylistEntry[] = playlistInfo?.entries ?? [];
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
    const toAdd: { e: PlaylistEntry; idx: number }[] = [];
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
  }, [
    playlistInfo,
    downloadPath,
    useCookieForDownload,
    ensureCookieProfileForUrl,
    videoUrl,
    useBestQuality,
    selectedFormat,
    playlistSelected,
    buildEntryUrl,
    addQueueTask,
    audioOnly,
    embedSubs,
    writeSubs,
    writeAutoSubs,
    subLangs,
    writeThumbnail,
    addMetadata,
  ]);

  // 选择下载路径
  const handleSelectPath = useCallback(async () => {
    const path = await window.electronAPI.selectDownloadDirectory();
    if (path) {
      setDownloadPath(path);
      addLog(`下载路径已设置: ${path}`, 'success');
    }
  }, [setDownloadPath, addLog]);

  // 添加到下载队列
  const handleAddToQueue = useCallback(() => {
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

    const formatToUse = useBestQuality ? 'bestvideo+bestaudio/best' : selectedFormat;

    if (useCookieForDownload) ensureCookieProfileForUrl(videoUrl);

    addQueueTask({
      url: videoUrl,
      title:
        playlistMode === 'playlist'
          ? videoInfo?.title
            ? `（列表）${videoInfo.title}`
            : `（列表）${siteInfo.displayName} 下载任务`
          : videoInfo?.title || videoUrl.trim() || siteInfo.displayName,
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
    const formatHint = audioOnly
      ? ' (仅音频)'
      : selectedFormat && !useBestQuality
        ? ` (${selectedFormat})`
        : '';
    const listHint =
      playlistMode === 'playlist'
        ? `（列表模式${playlistItems.trim() ? `，选集: ${playlistItems.trim()}` : ''}${playlistEnd ? `，前 ${playlistEnd} 条` : ''}）`
        : '';

    addLog(
      `已添加到下载队列: ${videoInfo?.title || siteInfo.displayName}${listHint}${qualityHint}${formatHint}`,
      'success'
    );
    toast.success('已添加到下载队列', {
      description: (videoInfo?.title || siteInfo.displayName) + listHint + qualityHint + formatHint,
    });
  }, [
    downloadPath,
    videoUrl,
    useBestQuality,
    selectedFormat,
    useCookieForDownload,
    ensureCookieProfileForUrl,
    addQueueTask,
    playlistMode,
    videoInfo,
    siteInfo.displayName,
    audioOnly,
    playlistItems,
    playlistEnd,
    embedSubs,
    writeSubs,
    writeAutoSubs,
    subLangs,
    writeThumbnail,
    addMetadata,
    addLog,
  ]);

  // 切换播放列表模式
  const handlePlaylistModeChange = useCallback(
    (checked: boolean) => {
      const v = !!checked;
      setPlaylistMode(v ? 'playlist' : 'single');
      if (v) {
        setUseBestQuality(true);
        setSelectedFormat('');
        setVideoInfo(null);
        setPlaylistInfo(null);
        setPlaylistSelected({});
      }
    },
    [setPlaylistMode, setUseBestQuality, setSelectedFormat, setVideoInfo]
  );

  // 切换仅音频模式
  const handleAudioOnlyChange = useCallback(
    (checked: boolean) => {
      const v = !!checked;
      setAudioOnly(v);
      if (v) {
        setUseBestQuality(false);
        setSelectedFormat('');
      }
    },
    [setAudioOnly, setUseBestQuality, setSelectedFormat]
  );

  // 切换最高质量模式
  const handleBestQualityChange = useCallback(
    (checked: boolean) => {
      const v = !!checked;
      setUseBestQuality(v);
      if (v) setSelectedFormat('');
    },
    [setUseBestQuality, setSelectedFormat]
  );

  // 全选/全不选播放列表条目
  const handleSelectAllPlaylistEntries = useCallback(() => {
    const next: Record<string, boolean> = {};
    (playlistInfo?.entries ?? []).forEach((_: PlaylistEntry, idx: number) => {
      next[String(idx)] = true;
    });
    setPlaylistSelected(next);
  }, [playlistInfo]);

  const handleDeselectAllPlaylistEntries = useCallback(() => {
    setPlaylistSelected({});
  }, []);

  // 切换单个条目选中状态
  const handleTogglePlaylistEntry = useCallback((idx: number, checked: boolean) => {
    setPlaylistSelected((prev) => ({ ...prev, [String(idx)]: checked }));
  }, []);

  // 加载默认配置
  useEffect(() => {
    if (configHydrated && downloadHydrated && !configLoaded) {
      if (config.defaultDownloadPath && !downloadPath) {
        setDownloadPath(config.defaultDownloadPath);
      }
      setConfigLoaded(true);
    }
  }, [configHydrated, downloadHydrated, configLoaded, config.defaultDownloadPath, downloadPath, setDownloadPath]);

  return {
    // 状态
    config,
    videoUrl,
    videoInfo,
    downloadPath,
    selectedFormat,
    audioOnly,
    useBestQuality,
    playlistMode,
    playlistItems,
    playlistEnd,
    embedSubs,
    writeSubs,
    writeAutoSubs,
    subLangs,
    writeThumbnail,
    addMetadata,
    loading,
    logs,
    configLoaded,
    useCookieForDownload,
    playlistLoading,
    playlistInfo,
    playlistSelected,
    playlistSearch,
    formattedFormats,
    siteInfo,
    visiblePlaylistEntries,

    // 状态更新函数
    setVideoUrl,
    setDownloadPath,
    setSelectedFormat,
    setPlaylistItems,
    setPlaylistEnd,
    setEmbedSubs,
    setWriteSubs,
    setWriteAutoSubs,
    setSubLangs,
    setWriteThumbnail,
    setAddMetadata,
    setUseCookieForDownload,
    setPlaylistSearch,

    // 事件处理函数
    handleGetInfo,
    handleExpandPlaylist,
    handleAddSelectedPlaylistEntries,
    handleSelectPath,
    handleAddToQueue,
    handlePlaylistModeChange,
    handleAudioOnlyChange,
    handleBestQualityChange,
    handleSelectAllPlaylistEntries,
    handleDeselectAllPlaylistEntries,
    handleTogglePlaylistEntry,
  };
}
