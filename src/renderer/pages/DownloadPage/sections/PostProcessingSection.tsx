import React from 'react';
import { Label } from '@renderer/components/ui/label';
import { Switch } from '@renderer/components/ui/switch';

interface PostProcessingSectionProps {
  loading: boolean;
  writeThumbnail: boolean;
  addMetadata: boolean;
  onWriteThumbnailChange: (checked: boolean) => void;
  onAddMetadataChange: (checked: boolean) => void;
}

export const PostProcessingSection: React.FC<PostProcessingSectionProps> = ({
  loading,
  writeThumbnail,
  addMetadata,
  onWriteThumbnailChange,
  onAddMetadataChange,
}) => {
  return (
    <div className="grid gap-3 rounded-lg border p-4 bg-muted/30">
      <div className="text-sm font-medium">后处理预设（可选）</div>
      <div className="grid gap-3 sm:grid-cols-2">
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
      </div>
      <div className="text-xs text-muted-foreground">
        提示：封面会增加下载与后处理耗时；部分站点/格式可能不支持。
      </div>
    </div>
  );
};
