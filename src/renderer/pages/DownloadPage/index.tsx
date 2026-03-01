import React from 'react';
import { Badge } from '@renderer/components/ui/badge';
import { useDownloadLogic } from './hooks/useDownloadLogic';
import {
  VideoInputSection,
  VideoInfoCard,
  DownloadOptionsSection,
  LogSection,
} from './sections';

const DownloadPage: React.FC = () => {
  const logic = useDownloadLogic();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">视频下载</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>站点</span>
          <Badge variant="outline">{logic.siteInfo.displayName}</Badge>
        </div>
      </div>

      <VideoInputSection
        config={logic.config}
        videoUrl={logic.videoUrl}
        loading={logic.loading}
        useCookieForDownload={logic.useCookieForDownload}
        onVideoUrlChange={logic.setVideoUrl}
        onGetInfo={logic.handleGetInfo}
        onUseCookieChange={logic.setUseCookieForDownload}
      />

      <VideoInfoCard videoInfo={logic.videoInfo} />

      <DownloadOptionsSection
        videoUrl={logic.videoUrl}
        videoInfo={logic.videoInfo}
        downloadPath={logic.downloadPath}
        selectedFormat={logic.selectedFormat}
        audioOnly={logic.audioOnly}
        useBestQuality={logic.useBestQuality}
        loading={logic.loading}
        configLoaded={logic.configLoaded}
        formattedFormats={logic.formattedFormats}
        playlistMode={logic.playlistMode}
        playlistItems={logic.playlistItems}
        playlistEnd={logic.playlistEnd}
        playlistLoading={logic.playlistLoading}
        playlistInfo={logic.playlistInfo}
        playlistSearch={logic.playlistSearch}
        playlistSelected={logic.playlistSelected}
        visiblePlaylistEntries={logic.visiblePlaylistEntries}
        embedSubs={logic.embedSubs}
        writeSubs={logic.writeSubs}
        writeAutoSubs={logic.writeAutoSubs}
        subLangs={logic.subLangs}
        writeThumbnail={logic.writeThumbnail}
        addMetadata={logic.addMetadata}
        onSelectPath={logic.handleSelectPath}
        onSelectFormat={logic.setSelectedFormat}
        onAudioOnlyChange={logic.handleAudioOnlyChange}
        onBestQualityChange={logic.handleBestQualityChange}
        onAddToQueue={logic.handleAddToQueue}
        onPlaylistModeChange={logic.handlePlaylistModeChange}
        onPlaylistItemsChange={logic.setPlaylistItems}
        onPlaylistEndChange={logic.setPlaylistEnd}
        onExpandPlaylist={logic.handleExpandPlaylist}
        onAddSelectedEntries={logic.handleAddSelectedPlaylistEntries}
        onPlaylistSearchChange={logic.setPlaylistSearch}
        onSelectAllEntries={logic.handleSelectAllPlaylistEntries}
        onDeselectAllEntries={logic.handleDeselectAllPlaylistEntries}
        onToggleEntry={logic.handleTogglePlaylistEntry}
        onEmbedSubsChange={logic.setEmbedSubs}
        onWriteSubsChange={logic.setWriteSubs}
        onWriteAutoSubsChange={logic.setWriteAutoSubs}
        onSubLangsChange={logic.setSubLangs}
        onWriteThumbnailChange={logic.setWriteThumbnail}
        onAddMetadataChange={logic.setAddMetadata}
      />

      <LogSection logs={logic.logs} />
    </div>
  );
};

export default DownloadPage;
