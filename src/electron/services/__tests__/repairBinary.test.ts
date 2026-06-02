import { describe, it, expect, vi, beforeEach } from 'vitest';

// repairBinary 策略（先 chmod，不行再重下）：
//  1. 文件不存在 → 转为下载（method:'redownload'）
//  2. 文件存在 → chmod 后自检通过 → method:'chmod'，不重下
//  3. 自检失败（损坏/半成品）→ 回退重新下载 → method:'redownload'
//
// downloadBinary 与 repairBinary 同模块，无法用 vi.mock 替换；
// 因此在更底层 mock：getBinaryPath（决定路径）、fs（存在性/chmod）、
// child_process.execFile（自检）、https（让 downloadBinary 的网络下载可控）。

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? '/mock/userData' : `/mock/${name}`)),
  },
}));

const getBinaryPathMock = vi.fn();
vi.mock('../../lib/binaries', () => ({
  getBinaryPath: (...args: unknown[]) => getBinaryPathMock(...args),
}));

const existsSyncMock = vi.fn();
const chmodSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();
const unlinkSyncMock = vi.fn();
const statSyncMock = vi.fn();
vi.mock('fs', () => ({
  existsSync: (...a: unknown[]) => existsSyncMock(...a),
  chmodSync: (...a: unknown[]) => chmodSyncMock(...a),
  mkdirSync: (...a: unknown[]) => mkdirSyncMock(...a),
  unlinkSync: (...a: unknown[]) => unlinkSyncMock(...a),
  renameSync: vi.fn(),
  statSync: (...a: unknown[]) => statSyncMock(...a),
  createWriteStream: vi.fn(),
  createReadStream: vi.fn(),
}));

// 自检 execFile：用 canExecutePass 控制成功/失败。
let canExecutePass = true;
const execFileMock = vi.fn((_path: string, _args: string[], _opts: unknown, cb: (err: Error | null) => void) => {
  cb(canExecutePass ? null : new Error('exec format error'));
});
vi.mock('child_process', () => ({
  execFile: (...a: unknown[]) => (execFileMock as any)(...a),
}));

// 让 downloadBinary 的网络层可控：followRedirects + get 都走 mock，
// 直接触发 200 响应、流式 finish/close，模拟一次成功下载。
const httpsGetImpl = vi.fn();
vi.mock('https', () => ({
  get: (...a: unknown[]) => (httpsGetImpl as any)(...a),
}));

import { repairBinary } from '../binaryDownloader';

const TARGET = '/mock/userData/binaries/darwin/yt-dlp';

// 构造一次成功的 https 下载：followRedirects 命中 200，随后 get 推数据并结束。
function wireSuccessfulDownload() {
  const fakeWriteStream = {
    on: (event: string, cb: (...args: unknown[]) => void) => {
      // downloadFile 在 finish 里调 close()，再在 close 里 resolve。
      if (event === 'finish' || event === 'close') {
        setImmediate(() => cb());
      }
      return fakeWriteStream;
    },
    close: vi.fn(),
  };
  // createWriteStream 返回上面的假流
  return import('fs').then((fsMod) => {
    (fsMod.createWriteStream as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fakeWriteStream);

    httpsGetImpl.mockImplementation((_url: unknown, _opts: unknown, cb?: (res: unknown) => void) => {
      const res = {
        statusCode: 200,
        headers: { 'content-length': '4' },
        on: (event: string, handler: (chunk?: Buffer) => void) => {
          if (event === 'data') setImmediate(() => handler(Buffer.from('test')));
          return res;
        },
        pipe: () => undefined,
      };
      // followRedirects 与 downloadFile 都用 https.get；两处都直接给 200。
      if (cb) setImmediate(() => cb(res));
      return { on: () => ({ on: () => undefined }) };
    });
  });
}

describe('repairBinary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    canExecutePass = true;
    getBinaryPathMock.mockReturnValue(TARGET);
    statSyncMock.mockReturnValue({ mode: 0o644 });
  });

  it('文件不存在时转为下载，method 为 redownload', async () => {
    existsSyncMock.mockReturnValue(false); // 目标文件 + 下载落地检查都返回不存在
    await wireSuccessfulDownload();

    const result = await repairBinary('yt-dlp');

    expect(result.success).toBe(true);
    expect(result.success && result.method).toBe('redownload');
    expect(chmodSyncMock).toHaveBeenCalled(); // setExecutable 在下载后 chmod
  });

  it('文件存在且 chmod 后自检通过：method 为 chmod，不重新下载', async () => {
    existsSyncMock.mockReturnValue(true);
    canExecutePass = true;

    const result = await repairBinary('yt-dlp');

    expect(result.success).toBe(true);
    expect(result.success && result.method).toBe('chmod');
    expect(chmodSyncMock).toHaveBeenCalledWith(TARGET, 0o755);
    expect(httpsGetImpl).not.toHaveBeenCalled(); // 未触发下载
  });

  it('文件存在但自检失败：回退重新下载，method 为 redownload', async () => {
    // 目标文件存在；自检失败 → 走 downloadBinary（下载成功）
    existsSyncMock.mockImplementation((p: string) => p === TARGET);
    canExecutePass = false;
    await wireSuccessfulDownload();

    const result = await repairBinary('yt-dlp');

    expect(result.success).toBe(true);
    expect(result.success && result.method).toBe('redownload');
    expect(httpsGetImpl).toHaveBeenCalled(); // 触发了重新下载
  });
});
