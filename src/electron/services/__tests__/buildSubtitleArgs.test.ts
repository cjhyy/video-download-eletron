import { describe, it, expect, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn((n: string) => (n === 'userData' ? '/mock/userData' : `/mock/${n}`)) },
}));
vi.mock('../../lib/config', () => ({ loadConfig: vi.fn(() => ({ network: {}, ytdlp: { additionalArgs: [] }, timeouts: {} })) }));
vi.mock('fs', () => ({ existsSync: () => true, readFileSync: vi.fn() }));
vi.mock('child_process', () => ({ spawn: vi.fn(), execFile: vi.fn() }));

import { buildSubtitleArgs } from '../ytdlp';

describe('buildSubtitleArgs', () => {
  it('不请求字幕时返回空数组', () => {
    expect(buildSubtitleArgs(undefined)).toEqual([]);
    expect(buildSubtitleArgs({})).toEqual([]);
  });

  it('请求字幕时包含 --write-subs 和语言', () => {
    const args = buildSubtitleArgs({ writeSubs: true, subLangs: 'en.*' });
    expect(args).toContain('--write-subs');
    expect(args).toContain('--sub-langs');
    expect(args[args.indexOf('--sub-langs') + 1]).toBe('en.*');
  });

  it('请求字幕时加 --ignore-errors，使字幕失败（如 429）不连带整个视频失败', () => {
    const args = buildSubtitleArgs({ writeSubs: true });
    expect(args).toContain('--ignore-errors');
  });

  it('writeAutoSubs / embedSubs 分别加对应参数', () => {
    const args = buildSubtitleArgs({ writeAutoSubs: true, embedSubs: true });
    expect(args).toContain('--write-auto-subs');
    expect(args).toContain('--embed-subs');
  });

  it('未指定语言时默认 en.*', () => {
    const args = buildSubtitleArgs({ writeSubs: true });
    expect(args[args.indexOf('--sub-langs') + 1]).toBe('en.*');
  });
});
