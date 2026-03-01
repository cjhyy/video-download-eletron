import React from 'react';
import { Input } from '@renderer/components/ui/input';
import { Label } from '@renderer/components/ui/label';
import { Switch } from '@renderer/components/ui/switch';

interface PostProcessingSectionProps {
  loading: boolean;
  audioOnly: boolean;
  embedSubs: boolean;
  writeSubs: boolean;
  writeAutoSubs: boolean;
  subLangs: string;
  writeThumbnail: boolean;
  addMetadata: boolean;
  onEmbedSubsChange: (checked: boolean) => void;
  onWriteSubsChange: (checked: boolean) => void;
  onWriteAutoSubsChange: (checked: boolean) => void;
  onSubLangsChange: (value: string) => void;
  onWriteThumbnailChange: (checked: boolean) => void;
  onAddMetadataChange: (checked: boolean) => void;
}

export const PostProcessingSection: React.FC<PostProcessingSectionProps> = ({
  loading,
  audioOnly,
  embedSubs,
  writeSubs,
  writeAutoSubs,
  subLangs,
  writeThumbnail,
  addMetadata,
  onEmbedSubsChange,
  onWriteSubsChange,
  onWriteAutoSubsChange,
  onSubLangsChange,
  onWriteThumbnailChange,
  onAddMetadataChange,
}) => {
  return (
    <div className="grid gap-3 rounded-lg border p-4 bg-muted/30">
      <div className="text-sm font-medium">后处理预设（可选）</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
          <Label htmlFor="pp-metadata" className="text-sm font-medium cursor-pointer">
            元信息
          </Label>
          <Switch
            id="pp-metadata"
            checked={addMetadata}
            onCheckedChange={(checked) => onAddMetadataChange(!!checked)}
            disabled={loading}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
          <Label htmlFor="pp-thumb" className="text-sm font-medium cursor-pointer">
            封面
          </Label>
          <Switch
            id="pp-thumb"
            checked={writeThumbnail}
            onCheckedChange={(checked) => onWriteThumbnailChange(!!checked)}
            disabled={loading}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
          <Label htmlFor="pp-write-subs" className="text-sm font-medium cursor-pointer">
            下载字幕（.srt）
          </Label>
          <Switch
            id="pp-write-subs"
            checked={writeSubs}
            onCheckedChange={(checked) => onWriteSubsChange(!!checked)}
            disabled={loading}
          />
        </div>
      </div>

      {writeSubs && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
            <Label htmlFor="pp-auto-subs" className="text-sm font-medium cursor-pointer">
              包含自动字幕
            </Label>
            <Switch
              id="pp-auto-subs"
              checked={writeAutoSubs}
              onCheckedChange={(checked) => onWriteAutoSubsChange(!!checked)}
              disabled={loading}
            />
          </div>
          <div className="space-y-2 rounded-lg border bg-background/50 p-3">
            <Label htmlFor="pp-sub-langs" className="text-sm font-medium cursor-pointer">
              字幕语言
            </Label>
            <Input
              id="pp-sub-langs"
              value={subLangs}
              onChange={(e) => onSubLangsChange(e.target.value)}
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
        <Label htmlFor="pp-embed-subs" className="text-sm font-medium cursor-pointer">
          嵌入字幕到视频（可选）
        </Label>
        <Switch
          id="pp-embed-subs"
          checked={embedSubs}
          onCheckedChange={(checked) => onEmbedSubsChange(!!checked)}
          disabled={loading || audioOnly || !writeSubs}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        提示：字幕/封面会增加下载与后处理耗时；部分站点/格式可能不支持。字幕会自动转换为 .srt（便于英语训练）。
      </div>
    </div>
  );
};
