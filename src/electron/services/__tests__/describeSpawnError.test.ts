import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn((n: string) => (n === 'userData' ? '/mock/userData' : `/mock/${n}`)) },
}));
vi.mock('../../lib/config', () => ({ loadConfig: vi.fn(() => ({ network: {}, ytdlp: { additionalArgs: [] }, timeouts: {} })) }));
vi.mock('fs', () => ({ existsSync: () => true, readFileSync: vi.fn() }));
vi.mock('child_process', () => ({ spawn: vi.fn(), execFile: vi.fn() }));

import { describeSpawnError } from '../ytdlp';

function err(code: string | undefined, errno?: number): NodeJS.ErrnoException {
  const e = new Error(code ? `${code} error` : 'Unknown system error') as NodeJS.ErrnoException;
  e.code = code;
  e.errno = errno;
  return e;
}

describe('describeSpawnError', () => {
  it('EBADMACHO（errno -88，文件损坏/没下完）提示重新下载', () => {
    // macOS 不给命名 code，只有 errno -88
    const msg = describeSpawnError('yt-dlp', '/p/yt-dlp', err('Unknown system error -88', -88));
    expect(msg).toContain('损坏');
    expect(msg).toContain('修复组件');
  });

  it('EBADARCH（errno -86，架构不符）同样提示重新下载', () => {
    const msg = describeSpawnError('yt-dlp', '/p/yt-dlp', err(undefined, -86));
    expect(msg).toContain('修复组件');
  });

  it('EACCES（缺执行权限）提示修复权限', () => {
    const msg = describeSpawnError('yt-dlp', '/p/yt-dlp', err('EACCES'));
    expect(msg).toContain('权限');
    expect(msg).toContain('chmod +x');
  });

  it('ENOENT（文件不存在）提示先下载', () => {
    const msg = describeSpawnError('yt-dlp', '/p/yt-dlp', err('ENOENT'));
    expect(msg).toContain('未找到');
  });

  it('其它错误兜底带上原始 message', () => {
    const msg = describeSpawnError('yt-dlp', '/p/yt-dlp', err('EPIPE'));
    expect(msg).toContain('无法启动');
  });
});
