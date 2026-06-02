import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';

// Mock Electron app
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => (name === 'userData' ? '/mock/userData' : `/mock/${name}`)),
  },
}));

// Mock child_process so findInSystemPath never hits the real system
const execFileSyncMock = vi.fn();
vi.mock('child_process', () => ({
  execSync: vi.fn(() => {
    throw new Error('not found');
  }),
  execFileSync: (...a: unknown[]) => execFileSyncMock(...a),
}));

// fs.existsSync is controlled per-test.
// statSync/chmodSync back ensureExecutable: statSync reports a non-executable mode
// by default so we can assert getBinaryPath repairs the exec bit before returning.
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  statSync: vi.fn(() => ({ mode: 0o644 })),
  chmodSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

import * as fs from 'fs';
import { getBinaryPath, removeBinariesQuarantine, sweepCorruptUserDataBinaries } from '../binaries';

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

  it('返回缺少执行位的二进制前，应补齐可执行权限（修复 EACCES）', () => {
    if (PLATFORM === 'win32') return; // Windows 不涉及执行位
    vi.mocked(fs.existsSync).mockImplementation((p) => p === userDataPath);
    vi.mocked(fs.statSync).mockReturnValue({ mode: 0o644 } as unknown as fs.Stats);

    expect(getBinaryPath('yt-dlp')).toBe(userDataPath);
    // 补上 owner/group/other 执行位
    expect(fs.chmodSync).toHaveBeenCalledWith(userDataPath, 0o644 | 0o755);
  });

  it('二进制已可执行时不应重复 chmod', () => {
    if (PLATFORM === 'win32') return;
    vi.mocked(fs.existsSync).mockImplementation((p) => p === userDataPath);
    vi.mocked(fs.statSync).mockReturnValue({ mode: 0o755 } as unknown as fs.Stats);

    expect(getBinaryPath('yt-dlp')).toBe(userDataPath);
    expect(fs.chmodSync).not.toHaveBeenCalled();
  });
});

describe('removeBinariesQuarantine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('macOS 上对存在的内置 binaries 目录执行 xattr -dr com.apple.quarantine', () => {
    // 内置目录存在时应处理它
    const bundledDir = path.join(RESOURCES_PATH, 'binaries');
    vi.mocked(fs.existsSync).mockImplementation((p) => p === bundledDir);

    removeBinariesQuarantine('darwin');

    expect(execFileSyncMock).toHaveBeenCalled();
    const [cmd, args] = execFileSyncMock.mock.calls[0];
    expect(cmd).toBe('xattr');
    expect(args).toContain('-dr');
    expect(args).toContain('com.apple.quarantine');
    expect(args).toContain(bundledDir);
  });

  it('非 macOS 平台直接跳过，不调用 xattr', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    removeBinariesQuarantine('win32');

    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('目录不存在时不报错也不调用 xattr', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    expect(() => removeBinariesQuarantine('darwin')).not.toThrow();
    expect(execFileSyncMock).not.toHaveBeenCalled();
  });

  it('xattr 抛错时被吞掉，不影响启动', () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    execFileSyncMock.mockImplementation(() => {
      throw new Error('xattr failed');
    });

    expect(() => removeBinariesQuarantine('darwin')).not.toThrow();
  });
});

describe('sweepCorruptUserDataBinaries', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const userDataBinDir = path.join('/mock/userData', 'binaries', PLATFORM);
  const ytDlpUserData = path.join(userDataBinDir, 'yt-dlp' + EXT);

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'production'; // sweep 仅在非开发模式生效
    vi.mocked(fs.statSync).mockReturnValue({ mode: 0o755 } as unknown as fs.Stats);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('下载版二进制损坏（自检抛错）时删除它，使其回退内置版', () => {
    // userData 目录与 yt-dlp 存在；ffmpeg 不存在
    vi.mocked(fs.existsSync).mockImplementation((p) => p === userDataBinDir || p === ytDlpUserData);
    execFileSyncMock.mockImplementation(() => {
      throw new Error('spawn EBADMACHO'); // 自检失败 = 文件损坏
    });

    sweepCorruptUserDataBinaries();

    expect(fs.unlinkSync).toHaveBeenCalledWith(ytDlpUserData);
  });

  it('下载版二进制可执行（自检通过）时保留，不删除', () => {
    vi.mocked(fs.existsSync).mockImplementation((p) => p === userDataBinDir || p === ytDlpUserData);
    execFileSyncMock.mockReturnValue(Buffer.from('2024.01.01')); // 自检成功

    sweepCorruptUserDataBinaries();

    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  it('userData 目录不存在时直接返回，不自检不删除', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    sweepCorruptUserDataBinaries();

    expect(execFileSyncMock).not.toHaveBeenCalled();
    expect(fs.unlinkSync).not.toHaveBeenCalled();
  });

  it('开发模式下直接跳过', () => {
    process.env.NODE_ENV = 'development';
    vi.mocked(fs.existsSync).mockReturnValue(true);

    sweepCorruptUserDataBinaries();

    expect(execFileSyncMock).not.toHaveBeenCalled();
  });
});
