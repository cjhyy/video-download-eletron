import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { formatDuration } from '@renderer/utils/format';

interface VideoInfoCardProps {
  videoInfo: {
    title?: string;
    uploader?: string;
    duration?: number;
  } | null;
}

export const VideoInfoCard: React.FC<VideoInfoCardProps> = ({ videoInfo }) => {
  if (!videoInfo) return null;

  return (
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
  );
};
