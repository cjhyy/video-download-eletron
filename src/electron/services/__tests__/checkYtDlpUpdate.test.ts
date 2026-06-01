import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn((n: string) => (n === 'userData' ? '/mock/userData' : `/mock/${n}`)) },
}));

vi.mock('../../lib/config', () => ({
  loadConfig: vi.fn(() => ({ network: {}, ytdlp: { additionalArgs: [] }, timeouts: {} })),
}));

const existsSyncMock = vi.fn((_p?: string) => true);
vi.mock('fs', () => ({
  existsSync: (p: string) => existsSyncMock(p),
  readFileSync: vi.fn(),
}));

const execFileSyncMock = vi.fn();
vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execFileSync: (cmd: string, args: string[], opts: unknown) => execFileSyncMock(cmd, args, opts),
}));

const getLatestYtDlpVersionMock = vi.fn();
vi.mock('../binaryDownloader', () => ({
  downloadBinary: vi.fn(),
  getLatestYtDlpVersion: () => getLatestYtDlpVersionMock(),
}));

import { checkYtDlpUpdate } from '../ytdlp';

// 非打包运行时 process.resourcesPath 为 undefined，getBinaryPath 会用到它；这里固定一下。
(process as { resourcesPath?: string }).resourcesPath = '/mock/resources';

describe('checkYtDlpUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
  });

  it('本地版本等于远端最新版 → up-to-date', async () => {
    execFileSyncMock.mockReturnValue('2026.03.17\n');
    getLatestYtDlpVersionMock.mockResolvedValue('2026.03.17');

    const r = await checkYtDlpUpdate();

    expect(r.status).toBe('up-to-date');
    expect((r as { current: string }).current).toBe('2026.03.17');
    expect((r as { latest: string }).latest).toBe('2026.03.17');
  });

  it('本地版本落后于远端 → update-available', async () => {
    execFileSyncMock.mockReturnValue('2026.02.21\n');
    getLatestYtDlpVersionMock.mockResolvedValue('2026.03.17');

    const r = await checkYtDlpUpdate();

    expect(r.status).toBe('update-available');
    expect((r as { current: string }).current).toBe('2026.02.21');
    expect((r as { latest: string }).latest).toBe('2026.03.17');
  });

  it('本地未安装 yt-dlp → not-installed', async () => {
    existsSyncMock.mockReturnValue(false);
    getLatestYtDlpVersionMock.mockResolvedValue('2026.03.17');

    const r = await checkYtDlpUpdate();

    expect(r.status).toBe('not-installed');
  });

  it('远端查询失败(403)→ check-failed，但仍带上本地版本，不抛错', async () => {
    execFileSyncMock.mockReturnValue('2026.02.21\n');
    getLatestYtDlpVersionMock.mockRejectedValue(new Error('HTTP 403'));

    const r = await checkYtDlpUpdate();

    expect(r.status).toBe('check-failed');
    expect((r as { current: string }).current).toBe('2026.02.21');
  });
});
