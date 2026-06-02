import { describe, it, expect, vi, beforeEach } from 'vitest';

// 下载完整性校验回归测试：
// 截断的下载（实际收到字节数 < Content-Length）必须失败并删除半成品，
// 否则会落地一个损坏的二进制，spawn 时报 EBADMACHO（errno 88）。
//
// downloadFile 是私有函数，通过导出的 downloadBinary 间接测试。
// 在 https / fs 层 mock：精确控制「服务器声明多少字节、实际推多少字节」。

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? '/mock/userData' : `/mock/${name}`)),
  },
}));

const existsSyncMock = vi.fn();
const unlinkSyncMock = vi.fn();
vi.mock('fs', () => ({
  existsSync: (...a: unknown[]) => existsSyncMock(...a),
  unlinkSync: (...a: unknown[]) => unlinkSyncMock(...a),
  chmodSync: vi.fn(),
  mkdirSync: vi.fn(),
  statSync: vi.fn(() => ({ mode: 0o644 })),
  createWriteStream: vi.fn(),
  createReadStream: vi.fn(),
}));

const httpsGetImpl = vi.fn();
vi.mock('https', () => ({
  get: (...a: unknown[]) => (httpsGetImpl as any)(...a),
}));

vi.mock('child_process', () => ({
  execFile: vi.fn(),
}));

import { downloadBinary } from '../binaryDownloader';
import * as fs from 'fs';

/**
 * 构造一次 https 下载：服务器声明 declaredBytes，实际推 deliveredBytes 字节。
 * declaredBytes !== deliveredBytes 即模拟「下载被截断」。
 */
function wireDownload(declaredBytes: number, deliveredBytes: number) {
  const fakeWriteStream = {
    on: (event: string, cb: (...args: unknown[]) => void) => {
      // downloadFile 在 finish 里 close()，再在 close 里做完整性校验。
      if (event === 'finish' || event === 'close') {
        setImmediate(() => cb());
      }
      return fakeWriteStream;
    },
    close: vi.fn(),
    destroy: vi.fn(),
  };
  (fs.createWriteStream as unknown as ReturnType<typeof vi.fn>).mockReturnValue(fakeWriteStream);

  httpsGetImpl.mockImplementation((_url: unknown, _opts: unknown, cb?: (res: unknown) => void) => {
    const res = {
      statusCode: 200,
      headers: { 'content-length': String(declaredBytes) },
      on: (event: string, handler: (chunk?: Buffer) => void) => {
        if (event === 'data') setImmediate(() => handler(Buffer.alloc(deliveredBytes)));
        return res;
      },
      pipe: () => undefined,
    };
    if (cb) setImmediate(() => cb(res));
    return { on: () => ({ on: () => undefined }) };
  });
}

describe('downloadBinary 完整性校验', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true); // 让删除半成品的 existsSync 命中
  });

  it('实际字节数 < Content-Length（下载被截断）时应失败，并删除半成品', async () => {
    wireDownload(100, 40); // 声明 100，实际只到 40

    const result = await downloadBinary('yt-dlp');

    expect(result.success).toBe(false);
    expect(result.success === false && result.error).toContain('下载不完整');
    expect(unlinkSyncMock).toHaveBeenCalled(); // 截断的文件被清理
  });

  it('实际字节数 === Content-Length 时下载成功', async () => {
    wireDownload(100, 100);

    const result = await downloadBinary('yt-dlp');

    expect(result.success).toBe(true);
  });
});
