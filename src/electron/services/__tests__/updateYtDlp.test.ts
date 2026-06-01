import { describe, it, expect, vi, beforeEach } from 'vitest';

// updateYtDlp 现在应通过 binaryDownloader 把最新版下载到用户数据目录，
// 而不是调用 `yt-dlp -U`（在打包后的只读目录中会因权限/签名失败）。

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? '/mock/userData' : `/mock/${name}`)),
  },
}));

vi.mock('../../lib/config', () => ({
  loadConfig: vi.fn(() => ({ network: {}, ytdlp: { additionalArgs: [] }, timeouts: {} })),
}));

const downloadBinaryMock = vi.fn();
vi.mock('../binaryDownloader', () => ({
  downloadBinary: (...args: unknown[]) => downloadBinaryMock(...args),
}));

// spawn must never be called by updateYtDlp anymore.
const spawnMock = vi.fn();
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawnMock(...args),
}));

import { updateYtDlp } from '../ytdlp';

describe('updateYtDlp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应调用 downloadBinary 下载最新版 yt-dlp，而不是 spawn yt-dlp -U', async () => {
    downloadBinaryMock.mockResolvedValue({ success: true, path: '/mock/userData/binaries/darwin/yt-dlp' });

    const result = await updateYtDlp();

    expect(downloadBinaryMock).toHaveBeenCalledWith('yt-dlp', expect.anything());
    expect(spawnMock).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('下载失败时应返回 success:false 并带上错误信息', async () => {
    downloadBinaryMock.mockResolvedValue({ success: false, error: 'Download failed with status 500' });

    const result = await updateYtDlp();

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('500');
  });

  it('GitHub 限流(403)时应给出友好的稍后再试提示', async () => {
    downloadBinaryMock.mockResolvedValue({ success: false, error: 'HTTP 403' });

    const result = await updateYtDlp();

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain('稍后再试');
  });

  it('downloadBinary 抛异常时应被捕获并返回 success:false', async () => {
    downloadBinaryMock.mockRejectedValue(new Error('network down'));

    const result = await updateYtDlp();

    expect(result.success).toBe(false);
  });
});
