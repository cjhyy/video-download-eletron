import React, { memo, useCallback } from 'react';
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';
import { ListChecks, Loader2 } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Switch } from '@renderer/components/ui/switch';
import { Badge } from '@renderer/components/ui/badge';
import { Checkbox } from '@renderer/components/ui/checkbox';
import { PLAYLIST_CONFIG } from '@renderer/constants';
import type { PlaylistInfo, PlaylistEntry } from '../hooks/useDownloadLogic';

const { ITEM_HEIGHT, LIST_HEIGHT } = PLAYLIST_CONFIG;

interface PlaylistSectionProps {
  playlistMode: 'single' | 'playlist';
  playlistItems: string;
  playlistEnd: number | undefined;
  playlistLoading: boolean;
  loading: boolean;
  playlistInfo: PlaylistInfo | null;
  playlistSearch: string;
  playlistSelected: Record<string, boolean>;
  visiblePlaylistEntries: { e: PlaylistEntry; i: number }[];
  onPlaylistModeChange: (checked: boolean) => void;
  onPlaylistItemsChange: (value: string) => void;
  onPlaylistEndChange: (value: number | undefined) => void;
  onExpandPlaylist: () => void;
  onAddSelectedEntries: () => void;
  onSearchChange: (value: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleEntry: (idx: number, checked: boolean) => void;
}

export const PlaylistSection: React.FC<PlaylistSectionProps> = ({
  playlistMode,
  playlistItems,
  playlistEnd,
  playlistLoading,
  loading,
  playlistInfo,
  playlistSearch,
  playlistSelected,
  visiblePlaylistEntries,
  onPlaylistModeChange,
  onPlaylistItemsChange,
  onPlaylistEndChange,
  onExpandPlaylist,
  onAddSelectedEntries,
  onSearchChange,
  onSelectAll,
  onDeselectAll,
  onToggleEntry,
}) => {
  return (
    <div className="grid gap-3 rounded-lg border p-4 bg-muted/30">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-0.5">
          <Label htmlFor="playlist-mode" className="cursor-pointer">
            列表/合集/频道模式（YouTube 优化）
          </Label>
          <div className="text-xs text-muted-foreground">
            关闭：单视频（会自动去掉 YouTube 的 list 参数）。开启：允许下载播放列表/频道，并支持"选集/前N条"。
          </div>
        </div>
        <Switch
          id="playlist-mode"
          checked={playlistMode === 'playlist'}
          onCheckedChange={onPlaylistModeChange}
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
                onChange={(e) => onPlaylistItemsChange(e.target.value)}
                disabled={loading}
              />
              <div className="text-xs text-muted-foreground">
                对应 yt-dlp 的 <code>--playlist-items</code>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="playlist-end">前 N 条（可选）</Label>
              <Input
                id="playlist-end"
                placeholder="例如: 20"
                value={playlistEnd ?? ''}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (!raw) return onPlaylistEndChange(undefined);
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  onPlaylistEndChange(Math.max(1, Math.floor(n)));
                }}
                disabled={loading}
              />
              <div className="text-xs text-muted-foreground">
                对应 yt-dlp 的 <code>--playlist-end</code>（建议配合使用防止一次拉取过多）
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={onExpandPlaylist}
              disabled={playlistLoading || loading}
              className="gap-2"
              variant="secondary"
            >
              {playlistLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ListChecks className="h-4 w-4" />
              )}
              展开列表
            </Button>
            <Button
              onClick={onAddSelectedEntries}
              disabled={!playlistInfo || playlistLoading || loading}
            >
              批量加入队列（按条目）
            </Button>
          </div>

          {playlistInfo && (
            <PlaylistEntries
              playlistInfo={playlistInfo}
              playlistSearch={playlistSearch}
              playlistSelected={playlistSelected}
              visiblePlaylistEntries={visiblePlaylistEntries}
              onSearchChange={onSearchChange}
              onSelectAll={onSelectAll}
              onDeselectAll={onDeselectAll}
              onToggleEntry={onToggleEntry}
            />
          )}
        </div>
      )}
    </div>
  );
};

interface PlaylistEntriesProps {
  playlistInfo: PlaylistInfo;
  playlistSearch: string;
  playlistSelected: Record<string, boolean>;
  visiblePlaylistEntries: { e: PlaylistEntry; i: number }[];
  onSearchChange: (value: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onToggleEntry: (idx: number, checked: boolean) => void;
}

// 单个条目组件 - 使用 memo 避免不必要的重渲染
interface PlaylistEntryItemProps {
  entry: PlaylistEntry;
  originalIndex: number;
  checked: boolean;
  onToggle: (idx: number, checked: boolean) => void;
  style: React.CSSProperties;
}

const PlaylistEntryItem = memo<PlaylistEntryItemProps>(
  ({ entry, originalIndex, checked, onToggle, style }) => {
    const title = entry?.title || '(无标题)';
    const uploader = entry?.uploader || '';
    const idxLabel = entry?.index ?? originalIndex + 1;

    const handleChange = useCallback(
      (v: boolean | 'indeterminate') => {
        onToggle(originalIndex, !!v);
      },
      [originalIndex, onToggle]
    );

    return (
      <div style={style} className="px-2 py-1">
        <div className="flex items-start gap-3 rounded-md border bg-background p-3 h-[64px]">
          <Checkbox checked={checked} onCheckedChange={handleChange} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">#{idxLabel}</Badge>
              <div className="truncate font-medium">{title}</div>
            </div>
            {(uploader || entry?.duration) && (
              <div className="mt-1 text-xs text-muted-foreground truncate">
                {uploader ? uploader : ''}
                {uploader && entry?.duration ? ' · ' : ''}
                {typeof entry?.duration === 'number'
                  ? `${Math.floor(entry.duration / 60)}:${String(Math.floor(entry.duration % 60)).padStart(2, '0')}`
                  : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

PlaylistEntryItem.displayName = 'PlaylistEntryItem';

const PlaylistEntries: React.FC<PlaylistEntriesProps> = ({
  playlistInfo,
  playlistSearch,
  playlistSelected,
  visiblePlaylistEntries,
  onSearchChange,
  onSelectAll,
  onDeselectAll,
  onToggleEntry,
}) => {
  // 虚拟化列表的行渲染函数
  const Row = useCallback(
    ({ index, style }: ListChildComponentProps) => {
      const { e, i } = visiblePlaylistEntries[index];
      const checked = !!playlistSelected[String(i)];
      return (
        <PlaylistEntryItem
          entry={e}
          originalIndex={i}
          checked={checked}
          onToggle={onToggleEntry}
          style={style}
        />
      );
    },
    [visiblePlaylistEntries, playlistSelected, onToggleEntry]
  );

  return (
    <div className="space-y-3 rounded-lg border bg-background/50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5">
          <div className="text-sm font-medium">
            {playlistInfo?.title || '列表条目'}{' '}
            <span className="text-xs text-muted-foreground">
              （{(playlistInfo?.entries ?? []).length}）
            </span>
          </div>
          {playlistInfo?.uploader && (
            <div className="text-xs text-muted-foreground">来源：{playlistInfo.uploader}</div>
          )}
        </div>
        <Input
          placeholder="搜索标题/上传者"
          value={playlistSearch}
          onChange={(e) => onSearchChange(e.target.value)}
          className="sm:w-64"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onSelectAll}>
          全选
        </Button>
        <Button variant="outline" size="sm" onClick={onDeselectAll}>
          全不选
        </Button>
      </div>

      <div className="rounded-md border bg-muted/10">
        {visiblePlaylistEntries.length > 0 ? (
          <List
            height={LIST_HEIGHT}
            itemCount={visiblePlaylistEntries.length}
            itemSize={ITEM_HEIGHT}
            width="100%"
            className="scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent"
          >
            {Row}
          </List>
        ) : (
          <div className="p-6 text-center text-sm text-muted-foreground">无匹配条目</div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        提示：这里"按条目加入队列"会把每个选中视频作为独立任务下载（更易暂停/重试/并发）。
      </div>
    </div>
  );
};
