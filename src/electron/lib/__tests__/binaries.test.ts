import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

// Mock Electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? '/mock/userData' : `/mock/${name}`)),
  },
}));

// Mock child_process so findInSystemPath never hits the real system
vi.mock('child_process', () => ({
  execSync: vi.fn(() => {
    throw new Error('not found');
  }),
}));

// fs.existsSync is controlled per-test
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
}));

import * as fs from 'fs';
import { getBinaryPath } from '../binaries';

const PLATFORM = process.platform;
const EXT = PLATFORM === 'win32' ? '.exe' : '';

// In a non-packaged runtime process.resourcesPath is undefined; pin it for the test.
const RESOURCES_PATH = '/mock/resources';
(process as { resourcesPath?: string }).resourcesPath = RESOURCES_PATH;

const bundledPath = path.join(RESOURCES_PATH, 'binaries', PLATFORM, 'yt-dlp' + EXT);
const userDataPath = path.join('/mock/userData', 'binaries', PLATFORM, 'yt-dlp' + EXT);

describe('getBinaryPath (生产模式)', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('当用户数据目录存在更新后的二进制时，应优先使用它而非包内旧版', () => {
    // 关键回归：更新会把新版下载到 userData，必须盖过包内 bundled 旧版
    vi.mocked(fs.existsSync).mockImplementation((p) => p === userDataPath || p === bundledPath);

    expect(getBinaryPath('yt-dlp')).toBe(userDataPath);
  });

  it('当用户数据目录没有二进制时，应回退到包内 bundled 版本', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => p === bundledPath);

    expect(getBinaryPath('yt-dlp')).toBe(bundledPath);
  });

  it('当两者都不存在时，应返回用户数据目录路径（供下载落地）', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(getBinaryPath('yt-dlp')).toBe(userDataPath);
  });
});
