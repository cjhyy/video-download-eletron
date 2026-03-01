import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IpcError } from '../ipcError';

// Mock Electron app 模块
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      const paths: Record<string, string> = {
        userData: '/mock/userData',
        temp: '/tmp',
        downloads: '/mock/downloads',
        documents: '/mock/documents',
        desktop: '/mock/desktop',
        videos: '/mock/videos',
        music: '/mock/music',
      };
      return paths[name] || `/mock/${name}`;
    }),
  },
}));

// Mock os 模块
vi.mock('os', () => ({
  homedir: vi.fn(() => '/mock/home'),
}));

// Mock fs 模块
vi.mock('fs', () => ({
  existsSync: vi.fn((path: string) => {
    // 模拟某些路径存在
    const existingPaths = [
      '/mock/home/test.txt',
      '/mock/downloads/video.mp4',
      '/mock/documents/cookies.txt',
      '/mock/downloads',
    ];
    return existingPaths.some(p => path.startsWith(p) || path === p);
  }),
  statSync: vi.fn((path: string) => ({
    isFile: () => path.includes('.'),
    isDirectory: () => !path.includes('.') || path.endsWith('/'),
  })),
}));

// 现在导入被测试的模块
import {
  validateUrl,
  validateTaskId,
  validateOutputDir,
  validateCookieFile,
  validateRateLimit,
  validateYtDlpArgs,
  validateSafePath,
  validateSafeFilePath,
  validateSafeDirPath,
} from '../validate';

describe('validate.ts', () => {
  describe('validateUrl', () => {
    it('should accept valid http URL', () => {
      const result = validateUrl('http://example.com/video');
      expect(result).toBe('http://example.com/video');
    });

    it('should accept valid https URL', () => {
      const result = validateUrl('https://youtube.com/watch?v=abc123');
      expect(result).toBe('https://youtube.com/watch?v=abc123');
    });

    it('should reject empty string', () => {
      expect(() => validateUrl('')).toThrow(IpcError);
    });

    it('should reject non-string input', () => {
      expect(() => validateUrl(123)).toThrow(IpcError);
      expect(() => validateUrl(null)).toThrow(IpcError);
      expect(() => validateUrl(undefined)).toThrow(IpcError);
    });

    it('should reject invalid URL format', () => {
      expect(() => validateUrl('not-a-url')).toThrow(IpcError);
    });

    it('should reject unsupported protocols', () => {
      expect(() => validateUrl('ftp://example.com/file')).toThrow(IpcError);
      expect(() => validateUrl('file:///local/file')).toThrow(IpcError);
    });
  });

  describe('validateTaskId', () => {
    it('should accept valid task ID', () => {
      const result = validateTaskId('download-12345');
      expect(result).toBe('download-12345');
    });

    it('should trim whitespace', () => {
      const result = validateTaskId('  task-id  ');
      expect(result).toBe('task-id');
    });

    it('should reject empty string', () => {
      expect(() => validateTaskId('')).toThrow(IpcError);
      expect(() => validateTaskId('   ')).toThrow(IpcError);
    });

    it('should reject non-string input', () => {
      expect(() => validateTaskId(123)).toThrow(IpcError);
    });
  });

  describe('validateRateLimit', () => {
    it('should accept valid rate limits', () => {
      expect(validateRateLimit('500K')).toBe('500K');
      expect(validateRateLimit('2M')).toBe('2M');
      expect(validateRateLimit('10G')).toBe('10G');
      expect(validateRateLimit('1.5M')).toBe('1.5M');
    });

    it('should return undefined for empty/null values', () => {
      expect(validateRateLimit(undefined)).toBeUndefined();
      expect(validateRateLimit(null)).toBeUndefined();
      expect(validateRateLimit('')).toBeUndefined();
    });

    it('should reject invalid rate limit format', () => {
      expect(() => validateRateLimit('abc')).toThrow(IpcError);
      expect(() => validateRateLimit('10X')).toThrow(IpcError);
    });

    it('should reject too long rate limit', () => {
      expect(() => validateRateLimit('a'.repeat(50))).toThrow(IpcError);
    });
  });

  describe('validateYtDlpArgs', () => {
    it('should accept valid arguments array', () => {
      const result = validateYtDlpArgs(['--no-check-certificate', '--prefer-insecure']);
      expect(result).toEqual(['--no-check-certificate', '--prefer-insecure']);
    });

    it('should return empty array for undefined/null', () => {
      expect(validateYtDlpArgs(undefined)).toEqual([]);
      expect(validateYtDlpArgs(null)).toEqual([]);
    });

    it('should filter out empty strings', () => {
      const result = validateYtDlpArgs(['--flag', '', '  ', '--another']);
      expect(result).toEqual(['--flag', '--another']);
    });

    it('should reject non-array input', () => {
      expect(() => validateYtDlpArgs('not-an-array')).toThrow(IpcError);
      expect(() => validateYtDlpArgs({})).toThrow(IpcError);
    });

    it('should reject array with non-string items', () => {
      expect(() => validateYtDlpArgs([123, '--flag'])).toThrow(IpcError);
    });

    it('should reject too long arguments', () => {
      expect(() => validateYtDlpArgs(['a'.repeat(400)])).toThrow(IpcError);
    });

    it('should reject shell injection patterns', () => {
      expect(() => validateYtDlpArgs(['--flag; rm -rf /'])).toThrow(IpcError);
      expect(() => validateYtDlpArgs(['--flag && echo'])).toThrow(IpcError);
      expect(() => validateYtDlpArgs(['--flag | cat'])).toThrow(IpcError);
      expect(() => validateYtDlpArgs(['`whoami`'])).toThrow(IpcError);
    });

    it('should reject too many arguments', () => {
      const manyArgs = Array(150).fill('--flag');
      expect(() => validateYtDlpArgs(manyArgs)).toThrow(IpcError);
    });
  });

  describe('validateSafePath', () => {
    it('should accept paths within safe directories', () => {
      const result = validateSafePath('/mock/home/test.txt', 'testPath');
      expect(result).toBe('/mock/home/test.txt');
    });

    it('should reject empty paths', () => {
      expect(() => validateSafePath('', 'testPath')).toThrow(IpcError);
      expect(() => validateSafePath('   ', 'testPath')).toThrow(IpcError);
    });

    it('should reject non-string paths', () => {
      expect(() => validateSafePath(123, 'testPath')).toThrow(IpcError);
      expect(() => validateSafePath(null, 'testPath')).toThrow(IpcError);
    });

    it('should reject paths outside safe directories', () => {
      expect(() => validateSafePath('/etc/passwd', 'testPath')).toThrow(IpcError);
      expect(() => validateSafePath('/var/log/system.log', 'testPath')).toThrow(IpcError);
    });

    it('should prevent path traversal attacks', () => {
      // 路径遍历尝试应该被解析后检查
      expect(() => validateSafePath('/mock/home/../../../etc/passwd', 'testPath')).toThrow(IpcError);
    });
  });
});
