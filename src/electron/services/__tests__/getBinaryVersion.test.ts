import { describe, it, expect, vi, beforeEach } from 'vitest';

// getBinaryVersion 必须是异步、非阻塞的：它在主进程里被 checkBinaries 调用，
// 若用同步 execFileSync（30s 超时）+ PyInstaller 冷启动（~24s），会卡死整个 UI。
// 因此改用非阻塞 execFile（callback 风格），这里以 callback 形式 mock。

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

// execFile(cmd, args, opts, callback) —— 异步、非阻塞。
// 源码用 util.promisify(execFile)，Node 会通过 promisify.custom 把它解析成
// 返回 { stdout, stderr } 的 Promise。mock 需带上该 custom 符号以保真。
import { promisify } from 'util';
const execFileMock = vi.fn();
const execFileSyncMock = vi.fn(); // 不应再被调用
vi.mock('child_process', () => {
  const execFile = (cmd: string, args: string[], opts: unknown, cb: (e: Error | null, stdout: string) => void) =>
    execFileMock(cmd, args, opts, cb);
  // promisify(execFile) → 返回 { stdout, stderr }
  (execFile as unknown as Record<symbol, unknown>)[promisify.custom] = (cmd: string, args: string[], opts: unknown) =>
    new Promise((resolve, reject) => {
      execFileMock(cmd, args, opts, (err: Error | null, stdout: string) => {
        if (err) reject(err);
        else resolve({ stdout, stderr: '' });
      });
    });
  return {
    spawn: vi.fn(),
    execFile,
    execFileSync: (...a: unknown[]) => execFileSyncMock(...a),
  };
});

import { getBinaryVersion } from '../ytdlp';

describe('getBinaryVersion (async, 非阻塞)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);
  });

  it('返回 Promise，且用异步 execFile 而非同步 execFileSync（避免卡死主进程）', async () => {
    execFileMock.mockImplementation((_c, _a, _o, cb) => cb(null, '2026.03.17\n'));

    const result = getBinaryVersion('/mock/userData/binaries/darwin/yt-dlp', '--version');
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe('2026.03.17');
    expect(execFileSyncMock).not.toHaveBeenCalled(); // 关键：不得用同步阻塞调用
  });

  it('读取版本号时应给足冷启动时间（>= 30s 超时）', async () => {
    execFileMock.mockImplementation((_c, _a, _o, cb) => cb(null, '2026.03.17\n'));

    await getBinaryVersion('/mock/yt-dlp', '--version');

    const opts = execFileMock.mock.calls[0][2] as { timeout: number };
    expect(opts.timeout).toBeGreaterThanOrEqual(30000);
  });

  it('ffmpeg 版本号解析', async () => {
    execFileMock.mockImplementation((_c, _a, _o, cb) => cb(null, 'ffmpeg version 6.1 Copyright ...\n'));
    expect(await getBinaryVersion('/mock/ffmpeg', '-version')).toBe('6.1');
  });

  it('二进制不存在时返回 undefined，且不调用 execFile', async () => {
    existsSyncMock.mockReturnValue(false);
    expect(await getBinaryVersion('/nope/yt-dlp')).toBeUndefined();
    expect(execFileMock).not.toHaveBeenCalled();
  });

  it('execFile 出错（如超时）时返回 undefined，不抛出', async () => {
    execFileMock.mockImplementation((_c, _a, _o, cb) => {
      const err = new Error('ETIMEDOUT') as Error & { code: string };
      err.code = 'ETIMEDOUT';
      cb(err, '');
    });
    expect(await getBinaryVersion('/mock/yt-dlp')).toBeUndefined();
  });
});
