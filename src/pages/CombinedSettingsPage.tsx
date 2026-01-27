import React from 'react';
import SettingsPage from './SettingsPage';
import CookiePage from './CookiePage';

const CombinedSettingsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto py-8 space-y-12 pb-20 px-4">
      {/* 页面主标题 */}
      <div className="space-y-1.5 border-b pb-6">
        <h1 className="text-3xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground">
          管理应用偏好设置、下载引擎和身份验证。
        </p>
      </div>

      {/* 常规设置部分 */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">常规设置</h2>
          <p className="text-muted-foreground text-sm">配置应用的基本行为和默认下载参数。</p>
        </div>
        <SettingsPage hideTitle section="general" />
      </section>

      {/* 下载引擎部分 */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">下载引擎 (yt-dlp)</h2>
          <p className="text-muted-foreground text-sm">检查核心组件状态、更新版本或配置高级命令行参数。</p>
        </div>
        <SettingsPage hideTitle section="ytdlp" />
      </section>

      {/* Cookie 管理部分 */}
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Cookie 管理</h2>
          <p className="text-muted-foreground text-sm">管理用于下载的身份验证信息，解决 403 禁止访问等风控问题。</p>
        </div>
        <CookiePage isEmbedded />
      </section>
    </div>
  );
};

export default CombinedSettingsPage;

