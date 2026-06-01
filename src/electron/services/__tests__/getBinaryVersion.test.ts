import { describe, it, expect, vi, beforeEach } from 'vitest';

// yt-dlp 的 _macos 独立二进制是 PyInstaller 打包，首次运行需解压内嵌 Python 运行时，
// 冷启动 `--version` 可能耗时 20s+。读取版本号的超时必须足够大，否则版本号会空白。

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

import { getBinaryVersion } from '../ytdlp';

describe('getBinaryVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
  });

  it('读取版本号时应给足冷启动时间（>= 30s 超时）', () => {
    execFileSyncMock.mockReturnValue('2026.03.17\n');

    const version = getBinaryVersion('/mock/userData/binaries/darwin/yt-dlp', '--version');

    expect(version).toBe('2026.03.17');
    const opts = execFileSyncMock.mock.calls[0][2] as { timeout: number };
    expect(opts.timeout).toBeGreaterThanOrEqual(30000);
  });

  it('二进制不存在时返回 undefined，且不调用 execFileSync', () => {
    existsSyncMock.mockReturnValue(false);

    const version = getBinaryVersion('/nope/yt-dlp');

    expect(version).toBeUndefined();
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('execFileSync 抛错（如超时）时返回 undefined', () => {
    execFileSyncMock.mockImplementation(() => {
      const err = new Error('ETIMEDOUT') as Error & { code: string };
      err.code = 'ETIMEDOUT';
      throw err;
    });

    expect(getBinaryVersion('/mock/yt-dlp')).toBeUndefined();
  });
});
