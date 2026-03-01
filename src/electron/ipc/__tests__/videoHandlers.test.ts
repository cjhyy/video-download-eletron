import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpcError } from '../ipcError';

// Mock Electron app 模块
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/mock/userData',
        temp: '/tmp',
        downloads: '/mock/downloads',
        documents: '/mock/documents',
        desktop: '/mock/desktop',
        videos: '/mock/videos',
        music: '/mock/music',
      };
      return paths[name] || `/mock/${name}`;
    }),
  },
}));

// Mock os 模块
vi.mock('os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

// Mock fs 模块
vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => {
    // 模拟某些路径存在
    const existingPaths = ['/mock/downloads', '/mock/home', '/mock/documents'];
    return existingPaths.some(p => path.startsWith(p) || path === p);
  }),
  statSync: vi.fn((path: string) => ({
    isFile: () => path.includes('.'),
    isDirectory: () => !path.includes('.') || path.endsWith('/'),
  })),
}));

// Mock ytdlp service
vi.mock('../../services/ytdlp', () => ({
  getVideoInfo: vi.fn(),
  getPlaylistInfo: vi.fn(),
  downloadVideo: vi.fn(),
  cancelDownload: vi.fn(),
  checkBinaries: vi.fn(),
  updateYtDlp: vi.fn(),
}));

// Mock binaries lib
vi.mock('../../lib/binaries', () => ({
  getBinaryPath: vi.fn((name: string) => `/mock/binaries/${name}`),
  isBundledBinary: vi.fn(() => false),
}));

// Mock binaryDownloader service
vi.mock('../../services/binaryDownloader', () => ({
  downloadBinary: vi.fn(),
}));

// 动态导入 mock 后的模块
import * as ytdlp from '../../services/ytdlp';
import { VideoHandlers } from '../handlers/videoHandlers';

describe('VideoHandlers', () => {
  let handlers: VideoHandlers;

  beforeEach(() => {
    handlers = new VideoHandlers();
    vi.clearAllMocks();
  });

  describe('getVideoInfo', () => {
    it('should call ytdlp service with validated params', async () => {
      const mockInfo = {
        id: 'abc123',
        title: 'Test Video',
        duration: 120,
        thumbnail: 'https://example.com/thumb.jpg',
        formats: [],
      };
      vi.mocked(ytdlp.getVideoInfo).mockResolvedValue(mockInfo);

      const result = await handlers.getVideoInfo({
        url: 'https://youtube.com/watch?v=abc123',
      });

      expect(ytdlp.getVideoInfo).toHaveBeenCalledWith({
        url: 'https://youtube.com/watch?v=abc123',
        useBrowserCookies: undefined,
        browserPath: undefined,
        cookieFile: undefined,
      });
      expect(result).toEqual(mockInfo);
    });

    it('should pass through cookie options', async () => {
      vi.mocked(ytdlp.getVideoInfo).mockResolvedValue({} as any);

      await handlers.getVideoInfo({
        url: 'https://youtube.com/watch?v=abc123',
        useBrowserCookies: true,
        browserPath: '/path/to/browser',
      });

      expect(ytdlp.getVideoInfo).toHaveBeenCalledWith({
        url: 'https://youtube.com/watch?v=abc123',
        useBrowserCookies: true,
        browserPath: '/path/to/browser',
        cookieFile: undefined,
      });
    });

    it('should throw IpcError for invalid URL', async () => {
      await expect(handlers.getVideoInfo({ url: '' })).rejects.toThrow(IpcError);
      await expect(handlers.getVideoInfo({ url: 'not-a-url' })).rejects.toThrow(IpcError);
    });

    it('should throw IpcError for non-http(s) protocols', async () => {
      await expect(handlers.getVideoInfo({ url: 'ftp://example.com' })).rejects.toThrow(IpcError);
    });
  });

  describe('getPlaylistInfo', () => {
    it('should call ytdlp service with validated params', async () => {
      const mockInfo = {
        id: 'playlist123',
        title: 'Test Playlist',
        entries: [],
        entryCount: 0,
      };
      vi.mocked(ytdlp.getPlaylistInfo).mockResolvedValue(mockInfo);

      const result = await handlers.getPlaylistInfo({
        url: 'https://youtube.com/playlist?list=abc123',
      });

      expect(ytdlp.getPlaylistInfo).toHaveBeenCalled();
      expect(result).toEqual(mockInfo);
    });

    it('should throw IpcError for invalid URL', async () => {
      await expect(handlers.getPlaylistInfo({ url: '' })).rejects.toThrow(IpcError);
    });
  });

  describe('downloadVideo', () => {
    it('should call ytdlp service with validated options', async () => {
      vi.mocked(ytdlp.downloadVideo).mockResolvedValue({ success: true });

      const callbacks = {
        onProgress: vi.fn(),
        onError: vi.fn(),
      };

      const result = await handlers.downloadVideo(
        {
          url: 'https://youtube.com/watch?v=abc123',
          taskId: 'task-1',
          outputPath: '/mock/downloads',
          audioOnly: false,
        },
        callbacks
      );

      expect(ytdlp.downloadVideo).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it('should throw IpcError for missing required fields', async () => {
      const callbacks = { onProgress: vi.fn(), onError: vi.fn() };

      await expect(
        handlers.downloadVideo({ url: '', taskId: 'task-1', outputPath: '/mock/downloads', audioOnly: false }, callbacks)
      ).rejects.toThrow(IpcError);
    });
  });

  describe('cancelDownload', () => {
    it('should call ytdlp cancel with valid taskId', () => {
      vi.mocked(ytdlp.cancelDownload).mockReturnValue({ success: true });

      const result = handlers.cancelDownload('task-123');

      expect(ytdlp.cancelDownload).toHaveBeenCalledWith('task-123');
      expect(result).toEqual({ success: true });
    });

    it('should return error for invalid taskId', () => {
      const result = handlers.cancelDownload('');
      expect(result).toEqual({ success: false, error: 'Invalid taskId' });
      expect(ytdlp.cancelDownload).not.toHaveBeenCalled();
    });

    it('should return error for non-string taskId', () => {
      const result = handlers.cancelDownload(123 as any);
      expect(result).toEqual({ success: false, error: 'Invalid taskId' });
    });
  });

  describe('checkBinaries', () => {
    it('should return binary status with bundled info', () => {
      const mockStatus = {
        ytDlp: true,
        ffmpeg: true,
        paths: {
          ytDlp: '/usr/local/bin/yt-dlp',
          ffmpeg: '/usr/local/bin/ffmpeg',
        },
      };
      vi.mocked(ytdlp.checkBinaries).mockReturnValue(mockStatus);

      const result = handlers.checkBinaries();

      expect(ytdlp.checkBinaries).toHaveBeenCalled();
      expect(result).toMatchObject(mockStatus);
      // 应该包含 bundled 字段
      expect(result).toHaveProperty('bundled');
      expect(result.bundled).toHaveProperty('ytDlp');
      expect(result.bundled).toHaveProperty('ffmpeg');
    });
  });

  describe('updateYtDlp', () => {
    it('should call ytdlp update', async () => {
      const mockResult = { success: true, version: '2024.01.02' };
      vi.mocked(ytdlp.updateYtDlp).mockResolvedValue(mockResult);

      const result = await handlers.updateYtDlp();

      expect(ytdlp.updateYtDlp).toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });
});
