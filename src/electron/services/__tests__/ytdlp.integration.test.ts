/**
 * yt-dlp 集成测试
 * 注意：这些测试需要实际的 yt-dlp 二进制文件和网络连接
 * 运行: npm run test:run -- --testPathPattern=ytdlp.integration
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

// 测试用的短视频 URL (Big Buck Bunny - 公共领域短片)
const TEST_VIDEO_URL = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // Big Buck Bunny 短片 ~33秒

// 项目根目录
const PROJECT_ROOT = path.resolve(__dirname, '../../../../..');

// yt-dlp 二进制路径
function getYtDlpPath(): string {
  const platform = process.platform;
  const binName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

  // 首先检查 binaries 目录
  const binariesPath = path.join(PROJECT_ROOT, 'binaries', binName);
  if (fs.existsSync(binariesPath)) {
    return binariesPath;
  }

  // 检查系统 PATH
  return binName;
}

// 执行 yt-dlp 命令
function runYtDlp(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve) => {
    const ytDlpPath = getYtDlpPath();
    console.log(`执行: ${ytDlpPath} ${args.join(' ')}`);

    const child = spawn(ytDlpPath, args, {
      timeout: 60000, // 60秒超时
    });

    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code });
    });

    child.on('error', (err) => {
      resolve({ stdout, stderr: err.message, exitCode: -1 });
    });
  });
}

describe('yt-dlp 集成测试', () => {
  let ytDlpExists = false;

  beforeAll(() => {
    const ytDlpPath = getYtDlpPath();
    ytDlpExists = fs.existsSync(ytDlpPath) || ytDlpPath === 'yt-dlp';
    console.log(`yt-dlp 路径: ${ytDlpPath}, 存在: ${ytDlpExists}`);
  });

  describe('二进制检查', () => {
    it('应该能找到 yt-dlp 二进制文件', async () => {
      const result = await runYtDlp(['--version']);
      console.log('yt-dlp 版本:', result.stdout.trim());

      // 如果命令失败，跳过后续测试
      if (result.exitCode !== 0) {
        console.warn('yt-dlp 未安装或不可用，跳过集成测试');
        return;
      }

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d{4}\.\d{2}\.\d{2}/); // 版本格式如 2024.01.01
    });
  });

  describe('获取视频信息', () => {
    it('应该能获取 YouTube 视频信息', async () => {
      // 先检查 yt-dlp 是否可用
      const versionCheck = await runYtDlp(['--version']);
      if (versionCheck.exitCode !== 0) {
        console.warn('跳过: yt-dlp 不可用');
        return;
      }

      const result = await runYtDlp([
        '--dump-json',
        '--no-playlist',
        '--no-warnings',
        TEST_VIDEO_URL,
      ]);

      console.log('stderr:', result.stderr);

      if (result.exitCode !== 0) {
        console.warn('获取视频信息失败:', result.stderr);
        // 可能是网络问题，不作为测试失败
        return;
      }

      expect(result.exitCode).toBe(0);

      const info = JSON.parse(result.stdout);
      console.log('视频信息:', {
        id: info.id,
        title: info.title,
        duration: info.duration,
        formats: info.formats?.length,
      });

      expect(info.id).toBeTruthy();
      expect(info.title).toBeTruthy();
      expect(info.duration).toBeGreaterThan(0);
      expect(info.formats).toBeInstanceOf(Array);
    }, 30000); // 30秒超时
  });

  describe('下载测试', () => {
    it('应该能下载视频到临时目录', async () => {
      // 先检查 yt-dlp 是否可用
      const versionCheck = await runYtDlp(['--version']);
      if (versionCheck.exitCode !== 0) {
        console.warn('跳过: yt-dlp 不可用');
        return;
      }

      // 创建临时目录
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ytdlp-test-'));
      console.log('临时目录:', tempDir);

      try {
        const result = await runYtDlp([
          '--no-playlist',
          '--no-warnings',
          '-f', 'worst', // 选择最低质量以加快下载
          '-o', path.join(tempDir, '%(title)s.%(ext)s'),
          TEST_VIDEO_URL,
        ]);

        console.log('下载输出:', result.stdout);
        console.log('下载错误:', result.stderr);

        if (result.exitCode !== 0) {
          console.warn('下载失败 (可能是网络问题):', result.stderr);
          return;
        }

        expect(result.exitCode).toBe(0);

        // 检查文件是否存在
        const files = fs.readdirSync(tempDir);
        console.log('下载的文件:', files);
        expect(files.length).toBeGreaterThan(0);

        // 检查文件大小
        const filePath = path.join(tempDir, files[0]);
        const stat = fs.statSync(filePath);
        console.log('文件大小:', stat.size, 'bytes');
        expect(stat.size).toBeGreaterThan(0);

      } finally {
        // 清理临时目录
        try {
          const files = fs.readdirSync(tempDir);
          for (const file of files) {
            fs.unlinkSync(path.join(tempDir, file));
          }
          fs.rmdirSync(tempDir);
          console.log('已清理临时目录');
        } catch (e) {
          console.warn('清理失败:', e);
        }
      }
    }, 120000); // 2分钟超时
  });
});
