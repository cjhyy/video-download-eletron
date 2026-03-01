import React from 'react';
import { Download as DownloadIcon, Folder as FolderIcon, Info as InfoIcon, Plus as PlaylistAddIcon } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { Alert, AlertDescription } from '@renderer/components/ui/alert';
import { Label } from '@renderer/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@renderer/components/ui/select';
import { Switch } from '@renderer/components/ui/switch';
import { formatFileSize } from '@renderer/utils/format';
import { PlaylistSection } from './PlaylistSection';
import { PostProcessingSection } from './PostProcessingSection';
import type { PlaylistInfo, PlaylistEntry } from '../hooks/useDownloadLogic';

interface VideoFormat {
  format_id: string;
  height?: number;
  ext?: string;
  format_note?: string;
  vcodec?: string;
  acodec?: string;
  filesize?: number;
  filesize_approx?: number;
}

interface DownloadOptionsSectionProps {
  // 基础状态
  videoUrl: string;
  videoInfo: any;
  downloadPath: string;
  selectedFormat: string;
  audioOnly: boolean;
  useBestQuality: boolean;
  loading: boolean;
  configLoaded: boolean;
  formattedFormats: VideoFormat[];

  // 播放列表相关
  playlistMode: 'single' | 'playlist';
  playlistItems: string;
  playlistEnd: number | undefined;
  playlistLoading: boolean;
  playlistInfo: PlaylistInfo | null;
  playlistSearch: string;
  playlistSelected: Record<string, boolean>;
  visiblePlaylistEntries: { e: PlaylistEntry; i: number }[];

  // 后处理相关
  embedSubs: boolean;
  writeSubs: boolean;
  writeAutoSubs: boolean;
  subLangs: string;
  writeThumbnail: boolean;
  addMetadata: boolean;

  // 事件处理
  onSelectPath: () => void;
  onSelectFormat: (value: string) => void;
  onAudioOnlyChange: (checked: boolean) => void;
  onBestQualityChange: (checked: boolean) => void;
  onAddToQueue: () => void;

  // 播放列表事件
  onPlaylistModeChange: (checked: boolean) => void;
  onPlaylistItemsChange: (value: string) => void;
  onPlaylistEndChange: (value: number | undefined) => void;
  onExpandPlaylist: () => void;
  onAddSelectedEntries: () => void;
  onPlaylistSearchChange: (value: string) => void;
  onSelectAllEntries: () => void;
  onDeselectAllEntries: () => void;
  onToggleEntry: (idx: number, checked: boolean) => void;

  // 后处理事件
  onEmbedSubsChange: (checked: boolean) => void;
  onWriteSubsChange: (checked: boolean) => void;
  onWriteAutoSubsChange: (checked: boolean) => void;
  onSubLangsChange: (value: string) => void;
  onWriteThumbnailChange: (checked: boolean) => void;
  onAddMetadataChange: (checked: boolean) => void;
}

export const DownloadOptionsSection: React.FC<DownloadOptionsSectionProps> = ({
  videoUrl,
  videoInfo,
  downloadPath,
  selectedFormat,
  audioOnly,
  useBestQuality,
  loading,
  configLoaded,
  formattedFormats,
  playlistMode,
  playlistItems,
  playlistEnd,
  playlistLoading,
  playlistInfo,
  playlistSearch,
  playlistSelected,
  visiblePlaylistEntries,
  embedSubs,
  writeSubs,
  writeAutoSubs,
  subLangs,
  writeThumbnail,
  addMetadata,
  onSelectPath,
  onSelectFormat,
  onAudioOnlyChange,
  onBestQualityChange,
  onAddToQueue,
  onPlaylistModeChange,
  onPlaylistItemsChange,
  onPlaylistEndChange,
  onExpandPlaylist,
  onAddSelectedEntries,
  onPlaylistSearchChange,
  onSelectAllEntries,
  onDeselectAllEntries,
  onToggleEntry,
  onEmbedSubsChange,
  onWriteSubsChange,
  onWriteAutoSubsChange,
  onSubLangsChange,
  onWriteThumbnailChange,
  onAddMetadataChange,
}) => {
  const showOptions = videoInfo || (videoUrl.trim().length > 0 && configLoaded);
  if (!showOptions) return null;

  const showFormatSelector = !audioOnly && !useBestQuality && playlistMode !== 'playlist' && videoInfo;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <DownloadIcon className="h-5 w-5" />
          下载设置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 播放列表模式 */}
        <PlaylistSection
          playlistMode={playlistMode}
          playlistItems={playlistItems}
          playlistEnd={playlistEnd}
          playlistLoading={playlistLoading}
          loading={loading}
          playlistInfo={playlistInfo}
          playlistSearch={playlistSearch}
          playlistSelected={playlistSelected}
          visiblePlaylistEntries={visiblePlaylistEntries}
          onPlaylistModeChange={onPlaylistModeChange}
          onPlaylistItemsChange={onPlaylistItemsChange}
          onPlaylistEndChange={onPlaylistEndChange}
          onExpandPlaylist={onExpandPlaylist}
          onAddSelectedEntries={onAddSelectedEntries}
          onSearchChange={onPlaylistSearchChange}
          onSelectAll={onSelectAllEntries}
          onDeselectAll={onDeselectAllEntries}
          onToggleEntry={onToggleEntry}
        />

        {/* 下载路径 */}
        <div className="space-y-2">
          <Label>下载路径</Label>
          <div className="flex gap-2">
            <Input readOnly value={downloadPath} className="bg-muted" />
            <Button variant="outline" onClick={onSelectPath} disabled={loading}>
              <FolderIcon className="mr-2 h-4 w-4" />
              选择目录
            </Button>
          </div>
        </div>

        {/* 音频/质量选项 */}
        <div className="grid gap-3 rounded-lg border p-4 bg-muted/30">
          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="audio-only" className="cursor-pointer">
                仅下载音频 (MP3)
              </Label>
              <div className="text-xs text-muted-foreground">将自动提取音频并转换为 MP3</div>
            </div>
            <Switch
              id="audio-only"
              checked={audioOnly}
              onCheckedChange={onAudioOnlyChange}
              disabled={loading}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="space-y-0.5">
              <Label htmlFor="best-quality" className="cursor-pointer font-semibold text-primary">
                ⭐ 使用最高质量 (4K/8K)
              </Label>
              <div className="text-xs text-muted-foreground">
                bestvideo+bestaudio 自动合并（推荐）
              </div>
            </div>
            <Switch
              id="best-quality"
              checked={useBestQuality}
              onCheckedChange={onBestQualityChange}
              disabled={loading || audioOnly}
            />
          </div>
        </div>

        {/* 格式选择器 */}
        {showFormatSelector && (
          <div className="space-y-2">
            <Label>手动选择视频格式</Label>
            <Select
              value={selectedFormat || undefined}
              onValueChange={(v) => {
                if (v === '__auto__') {
                  onSelectFormat('');
                  return;
                }
                onSelectFormat(v);
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
                        <span className="font-medium">
                          {format.height
                            ? `${format.height}p`
                            : format.format_note || format.format_id}
                        </span>
                        <span className="text-muted-foreground uppercase">{format.ext}</span>
                        <span>{streamType}</span>
                        <span className="ml-auto text-xs opacity-70">
                          {formatFileSize(format.filesize || format.filesize_approx)}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* 最高质量提示 */}
        {useBestQuality && !audioOnly && (
          <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:border-blue-900/20">
            <InfoIcon className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              使用 <strong>bestvideo+bestaudio</strong> 下载并自动合并。
            </AlertDescription>
          </Alert>
        )}

        {/* 后处理选项 */}
        <PostProcessingSection
          loading={loading}
          audioOnly={audioOnly}
          embedSubs={embedSubs}
          writeSubs={writeSubs}
          writeAutoSubs={writeAutoSubs}
          subLangs={subLangs}
          writeThumbnail={writeThumbnail}
          addMetadata={addMetadata}
          onEmbedSubsChange={onEmbedSubsChange}
          onWriteSubsChange={onWriteSubsChange}
          onWriteAutoSubsChange={onWriteAutoSubsChange}
          onSubLangsChange={onSubLangsChange}
          onWriteThumbnailChange={onWriteThumbnailChange}
          onAddMetadataChange={onAddMetadataChange}
        />

        {/* 添加到队列按钮 */}
        <Button
          onClick={onAddToQueue}
          disabled={!videoUrl.trim() || !downloadPath || loading}
          className="w-full h-12 text-lg font-semibold shadow-lg"
          size="lg"
        >
          <PlaylistAddIcon className="mr-2 h-5 w-5" />
          添加到下载队列
        </Button>
      </CardContent>
    </Card>
  );
};
