import React from 'react';
import { Info as InfoIcon, Cookie as CookieIcon, Loader2 } from 'lucide-react';
import { Button } from '@renderer/components/ui/button';
import { Input } from '@renderer/components/ui/input';
import { Card, CardContent } from '@renderer/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@renderer/components/ui/alert';
import { Label } from '@renderer/components/ui/label';
import { Switch } from '@renderer/components/ui/switch';
import type { AppConfig } from '@renderer/store/types';

interface VideoInputSectionProps {
  config: AppConfig;
  videoUrl: string;
  loading: boolean;
  useCookieForDownload: boolean;
  onVideoUrlChange: (value: string) => void;
  onGetInfo: () => void;
  onUseCookieChange: (checked: boolean) => void;
}

export const VideoInputSection: React.FC<VideoInputSectionProps> = ({
  config,
  videoUrl,
  loading,
  useCookieForDownload,
  onVideoUrlChange,
  onGetInfo,
  onUseCookieChange,
}) => {
  const activeCookieProfile = config.cookieProfiles?.find(
    (p) => p.id === config.activeCookieProfileId
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="请输入视频 URL (支持 YouTube, Bilibili 等平台)"
              value={videoUrl}
              onChange={(e) => onVideoUrlChange(e.target.value)}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={onGetInfo} disabled={loading} className="w-32">
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <InfoIcon className="mr-2 h-4 w-4" />
              )}
              {loading ? '获取中...' : '获取信息'}
            </Button>
          </div>

          {config.cookieEnabled ? (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/20">
              <CookieIcon className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-800 dark:text-green-400">Cookie 已启用</AlertTitle>
              <AlertDescription className="flex flex-col space-y-2">
                <span className="text-green-700 dark:text-green-500/80">
                  当前使用: <strong>{activeCookieProfile?.name || '默认配置'}</strong>
                </span>
                <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
                  <Label htmlFor="use-cookie" className="text-sm font-medium cursor-pointer">
                    本次下载使用 Cookie（可选）
                  </Label>
                  <Switch
                    id="use-cookie"
                    checked={useCookieForDownload}
                    onCheckedChange={(checked) => onUseCookieChange(!!checked)}
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
  );
};
