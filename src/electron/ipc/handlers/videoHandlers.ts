import type {
  BinaryName,
  BinaryStatus,
  DownloadBinaryProgress,
  DownloadBinaryResult,
  DownloadOptions,
  DownloadProgress,
  ExportCookiesResult,
  PlaylistInfo,
  UpdateYtDlpResult,
  CheckYtDlpUpdateResult,
  VideoInfo,
} from '../../../shared/electron';
import type { GetVideoInfoParams, GetPlaylistInfoParams } from '../types';
import {
  validateUrl,
  validateCookieFile,
  validateDownloadOptions,
  validatePlaylistInfoParams,
  validateTaskId,
} from '../validate';
import {
  getVideoInfo as ytdlpGetVideoInfo,
  getPlaylistInfo as ytdlpGetPlaylistInfo,
  downloadVideo as ytdlpDownloadVideo,
  cancelDownload as ytdlpCancelDownload,
  checkBinaries as ytdlpCheckBinaries,
  updateYtDlp as ytdlpUpdateYtDlp,
  checkYtDlpUpdate as ytdlpCheckYtDlpUpdate,
  exportCookies as ytdlpExportCookies,
} from '../../services/ytdlp';
import { downloadBinary } from '../../services/binaryDownloader';
import { isBundledBinary } from '../../lib/binaries';

/**
 * 视频操作相关的 IPC 处理器
 * 独立于 IPC 层，便于单元测试
 */
export class VideoHandlers {
  /** 获取视频信息 */
  async getVideoInfo(params: GetVideoInfoParams): Promise<VideoInfo> {
    const validatedUrl = validateUrl(params.url);
    const validatedCookieFile = validateCookieFile(params.cookieFile);
    const validatedUseBrowserCookies =
      params.useBrowserCookies === undefined ? undefined : !!params.useBrowserCookies;
    const validatedBrowserPath =
      typeof params.browserPath === 'string' ? params.browserPath : undefined;

    return ytdlpGetVideoInfo({
      url: validatedUrl,
      useBrowserCookies: validatedUseBrowserCookies,
      browserPath: validatedBrowserPath,
      cookieFile: validatedCookieFile,
    });
  }

  /** 获取播放列表信息 */
  async getPlaylistInfo(params: GetPlaylistInfoParams): Promise<PlaylistInfo> {
    const validated = validatePlaylistInfoParams(params);
    return ytdlpGetPlaylistInfo(validated);
  }

  /** 下载视频 */
  async downloadVideo(
    options: DownloadOptions,
    callbacks: {
      onProgress: (progress: DownloadProgress) => void;
      onError: (error: string) => void;
      onLog?: (level: string, message: string) => void;
    }
  ): Promise<{ success: boolean; filePath?: string; fileSize?: string }> {
    const validated = validateDownloadOptions(options);
    return ytdlpDownloadVideo(validated, callbacks);
  }

  /** 取消下载 */
  cancelDownload(taskId: string): { success: boolean; error?: string } {
    if (typeof taskId !== 'string' || !taskId.trim()) {
      return { success: false, error: 'Invalid taskId' };
    }
    const validatedTaskId = validateTaskId(taskId);
    return ytdlpCancelDownload(validatedTaskId);
  }

  /** 检查二进制文件 */
  async checkBinaries(): Promise<BinaryStatus> {
    const status = await ytdlpCheckBinaries();
    // 添加是否使用内置版本的信息
    return {
      ...status,
      bundled: {
        ytDlp: isBundledBinary('yt-dlp'),
        ffmpeg: isBundledBinary('ffmpeg'),
      },
    };
  }

  /** 下载二进制文件（精简版支持） */
  async downloadBinary(
    binaryName: BinaryName,
    onProgress?: (progress: DownloadBinaryProgress) => void
  ): Promise<DownloadBinaryResult> {
    if (binaryName !== 'yt-dlp' && binaryName !== 'ffmpeg') {
      return { success: false, error: `Unknown binary: ${binaryName}` };
    }
    return downloadBinary(binaryName, onProgress);
  }

  /** 更新 yt-dlp */
  async updateYtDlp(): Promise<UpdateYtDlpResult> {
    return ytdlpUpdateYtDlp();
  }

  /** 检查 yt-dlp 是否有更新（与 GitHub 最新版本比对） */
  async checkYtDlpUpdate(): Promise<CheckYtDlpUpdateResult> {
    return ytdlpCheckYtDlpUpdate();
  }

  /** 导出 Cookies */
  async exportCookies(url?: string): Promise<ExportCookiesResult> {
    const targetUrl = url ? validateUrl(url) : 'https://www.youtube.com';
    return ytdlpExportCookies({ url: targetUrl });
  }
}

// 导出单例
export const videoHandlers = new VideoHandlers();
