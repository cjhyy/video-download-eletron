import { app } from 'electron';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export type BinaryName = 'yt-dlp' | 'ffmpeg';

export interface DownloadBinaryProgress {
  binary: BinaryName;
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
}

export type DownloadBinaryResult =
  | { success: true; path: string }
  | { success: false; error: string };

// GitHub 下载 URL 配置
const BINARY_URLS: Record<BinaryName, Record<string, string>> = {
  'yt-dlp': {
    win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
    linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
  },
  ffmpeg: {
    // ffmpeg-static 提供的预编译版本
    win32: 'https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-win32-x64.gz',
    darwin: 'https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-x64.gz',
    'darwin-arm64': 'https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-darwin-arm64.gz',
    linux: 'https://github.com/eugeneware/ffmpeg-static/releases/latest/download/ffmpeg-linux-x64.gz',
  },
};

/**
 * 获取二进制文件的存储目录
 */
function getBinariesDir(): string {
  const platform = process.platform;

  // 开发模式：项目根目录下的 binaries
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    return path.join(__dirname, '..', '..', '..', 'binaries', platform);
  }

  // 生产模式：用户数据目录（精简版）
  return path.join(app.getPath('userData'), 'binaries', platform);
}

/**
 * 确保目录存在
 */
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 跟随重定向获取最终 URL
 */
function followRedirects(url: string, maxRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const protocol = url.startsWith('https') ? https : require('http');

    protocol.get(url, { headers: { 'User-Agent': 'video-downloader-app' } }, (response: any) => {
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307) {
        const location = response.headers.location;
        if (location) {
          // 处理相对 URL
          const nextUrl = location.startsWith('http') ? location : new URL(location, url).toString();
          followRedirects(nextUrl, maxRedirects - 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error('Redirect without location header'));
        }
      } else if (response.statusCode === 200) {
        resolve(url);
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

/**
 * 下载文件
 */
function downloadFile(
  url: string,
  outputPath: string,
  onProgress?: (progress: { percent: number; downloadedBytes: number; totalBytes: number }) => void
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // 先获取最终 URL（跟随重定向）
      const finalUrl = await followRedirects(url);

      const file = fs.createWriteStream(outputPath);

      https.get(finalUrl, { headers: { 'User-Agent': 'video-downloader-app' } }, (response) => {
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(outputPath);
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedBytes = 0;

        response.on('data', (chunk: Buffer) => {
          downloadedBytes += chunk.length;
          if (onProgress && totalBytes > 0) {
            onProgress({
              percent: Math.round((downloadedBytes / totalBytes) * 100),
              downloadedBytes,
              totalBytes,
            });
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });

        file.on('error', (err) => {
          file.close();
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          reject(err);
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(outputPath)) {
          fs.unlinkSync(outputPath);
        }
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 解压 gzip 文件
 */
async function extractGzip(gzPath: string, outputPath: string): Promise<void> {
  const zlib = require('zlib');

  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip();
    const input = fs.createReadStream(gzPath);
    const output = fs.createWriteStream(outputPath);

    input
      .pipe(gunzip)
      .pipe(output)
      .on('finish', () => {
        // 删除 gz 文件
        fs.unlinkSync(gzPath);
        resolve();
      })
      .on('error', reject);
  });
}

/**
 * 设置文件为可执行
 */
function setExecutable(filePath: string): void {
  if (process.platform !== 'win32') {
    try {
      execSync(`chmod +x "${filePath}"`);
      console.log(`[binaryDownloader] Set executable: ${filePath}`);
    } catch (error) {
      console.warn(`[binaryDownloader] Failed to set executable: ${(error as Error).message}`);
    }
  }
}

/**
 * 下载二进制文件
 */
export async function downloadBinary(
  binaryName: BinaryName,
  onProgress?: (progress: DownloadBinaryProgress) => void
): Promise<DownloadBinaryResult> {
  const platform = process.platform;
  const arch = process.arch;

  // 获取下载 URL
  let urlKey = platform;
  if (binaryName === 'ffmpeg' && platform === 'darwin' && arch === 'arm64') {
    urlKey = 'darwin-arm64';
  }

  const url = BINARY_URLS[binaryName][urlKey];
  if (!url) {
    return { success: false, error: `Unsupported platform: ${platform}` };
  }

  const binariesDir = getBinariesDir();
  ensureDir(binariesDir);

  const extension = platform === 'win32' ? '.exe' : '';
  const outputPath = path.join(binariesDir, binaryName + extension);

  // 检查是否需要解压
  const isGzip = url.endsWith('.gz');
  const downloadPath = isGzip ? outputPath + '.gz' : outputPath;

  try {
    console.log(`[binaryDownloader] Downloading ${binaryName} from ${url}`);
    console.log(`[binaryDownloader] Save to: ${outputPath}`);

    await downloadFile(downloadPath, downloadPath, (progress) => {
      onProgress?.({
        binary: binaryName,
        ...progress,
      });
    });

    // 解压 gzip
    if (isGzip) {
      console.log(`[binaryDownloader] Extracting ${downloadPath}`);
      await extractGzip(downloadPath, outputPath);
    }

    // 设置可执行权限
    setExecutable(outputPath);

    console.log(`[binaryDownloader] Successfully downloaded ${binaryName}`);
    return { success: true, path: outputPath };
  } catch (error) {
    console.error(`[binaryDownloader] Failed to download ${binaryName}:`, error);
    // 清理失败的下载
    if (fs.existsSync(downloadPath)) {
      fs.unlinkSync(downloadPath);
    }
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 检查二进制文件是否需要下载（不存在于内置或系统路径）
 */
export function needsDownload(binaryName: BinaryName): boolean {
  const { getBinaryPath } = require('../lib/binaries');
  const binaryPath = getBinaryPath(binaryName);
  return !fs.existsSync(binaryPath);
}

/**
 * 检查是否使用内置二进制文件
 */
export function isUsingBundled(binaryName: BinaryName): boolean {
  const { isBundledBinary } = require('../lib/binaries');
  return isBundledBinary(binaryName);
}
