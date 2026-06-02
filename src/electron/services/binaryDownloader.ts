import { app } from 'electron';
import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { execFile } from 'child_process';
import { getBinaryPath } from '../lib/binaries';

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

export type RepairBinaryResult =
  | { success: true; path: string; method: 'chmod' | 'redownload' }
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
    return path.join(__dirname, '..', 'binaries', platform);
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

        // 连接在传输途中断开（response 流自身报错）：必须显式处理。
        // 否则 pipe 提前结束只触发 file 的 'finish'/'close'，半截文件会被当成功返回，
        // 落地一个被截断的二进制 —— spawn 时报 EBADMACHO（errno 88）。
        response.on('error', (err) => {
          file.destroy();
          if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
          }
          reject(err);
        });

        response.pipe(file);

        // 'finish' 仅表示数据已交给内核，文件描述符可能尚未真正关闭。
        // 必须等 'close' 再 resolve，否则随后的 chmodSync 与 fd 关闭存在竞态，
        // 可能导致执行位漏设、spawn 报 EACCES（本次修复的根因之一）。
        file.on('finish', () => {
          file.close();
        });

        file.on('close', () => {
          // 完整性校验：服务器声明了 Content-Length 时，落地字节数必须一致。
          // 不一致 = 下载被截断（连接中途断开 / 服务器提前 EOF），文件是损坏的
          // 半成品，决不能当成功返回 —— 删掉并报错，交由上层重试 / 提示用户。
          // 这是 spawn 报 EBADMACHO（errno 88，「Mach-O 文件损坏」）的根因。
          if (totalBytes > 0 && downloadedBytes !== totalBytes) {
            if (fs.existsSync(outputPath)) {
              fs.unlinkSync(outputPath);
            }
            reject(
              new Error(
                `下载不完整：预期 ${totalBytes} 字节，实际收到 ${downloadedBytes} 字节（连接可能中断，请重试）`
              )
            );
            return;
          }
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
 * 设置文件为可执行。
 *
 * 用 fs.chmodSync 直接设权限（不经过 shell，避免路径含空格/特殊字符时拼接出错），
 * 失败时抛出而非吞掉：可执行位漏设会导致后续 spawn 报 EACCES，
 * 与其报告「下载成功」却留下一个不可用的二进制，不如让下载整体失败、提示用户重试。
 */
function setExecutable(filePath: string): void {
  if (process.platform === 'win32') return;
  fs.chmodSync(filePath, 0o755);
  console.log(`[binaryDownloader] Set executable: ${filePath}`);
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

  // 原子写入：全程只操作临时文件，最后一步才 rename 到 outputPath。
  // 这样下载/解压途中 outputPath 始终是「旧的可用文件」或不存在，
  // 绝不会暴露半成品 —— 即便用户在下载中途点「重新检查」spawn 该文件，
  // 拿到的也是完整旧版而非截断的坏文件（spawn 截断文件会报 -88/EBADMACHO）。
  const isGzip = url.endsWith('.gz');
  const tmpPath = outputPath + '.download';      // 最终产物的临时名（rename 来源）
  const gzPath = tmpPath + '.gz';                // gzip 下载的中转文件
  const downloadPath = isGzip ? gzPath : tmpPath;

  const cleanupTemps = () => {
    for (const p of [gzPath, tmpPath]) {
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch { /* 清理失败无害，忽略 */ }
      }
    }
  };

  try {
    console.log(`[binaryDownloader] Downloading ${binaryName} from ${url}`);
    console.log(`[binaryDownloader] Save to: ${outputPath}`);

    // 起步先清掉可能残留的上次失败临时文件，避免脏数据。
    cleanupTemps();

    await downloadFile(url, downloadPath, (progress) => {
      onProgress?.({
        binary: binaryName,
        ...progress,
      });
    });

    // 解压 gzip：gz → tmpPath
    if (isGzip) {
      console.log(`[binaryDownloader] Extracting ${downloadPath}`);
      await extractGzip(downloadPath, tmpPath);
    }

    // 先给临时文件设可执行权限，再原子替换 —— rename 后 outputPath 立即可用。
    setExecutable(tmpPath);
    fs.renameSync(tmpPath, outputPath);
    cleanupTemps(); // 清掉残留的 .gz 中转文件

    console.log(`[binaryDownloader] Successfully downloaded ${binaryName}`);
    return { success: true, path: outputPath };
  } catch (error) {
    console.error(`[binaryDownloader] Failed to download ${binaryName}:`, error);
    // 只清理临时文件，绝不删 outputPath：
    // 更新失败时必须保留既有可用版本，否则一次失败的更新会把好文件也删掉。
    cleanupTemps();
    return { success: false, error: (error as Error).message };
  }
}

/**
 * 实际执行一次二进制自检：spawn 该文件跑版本参数，能正常退出才算「真正可用」。
 *
 * 仅 chmod 成功并不代表文件可用——更新中断留下的半成品文件 chmod 也会成功，
 * 但执行时仍会失败。因此修复后必须真跑一次，据此决定是否回退到重新下载。
 */
function canExecute(binaryName: BinaryName, filePath: string): Promise<boolean> {
  return new Promise((resolve) => {
    const versionArg = binaryName === 'yt-dlp' ? '--version' : '-version';
    execFile(filePath, [versionArg], { timeout: 10000 }, (error) => {
      resolve(!error);
    });
  });
}

/**
 * 修复二进制：优先补可执行权限，补不好（文件损坏/半成品）再回退重新下载。
 *
 * 触发场景：更新/下载把文件落到 userData（getBinaryPath 中优先级高于内置版），
 * 若该文件丢失执行位（更新中断、旧版本 chmod 失败遗留、卷权限被重置等），
 * spawn 时报 EACCES，对用户表现为「获取信息失败 / 无法启动」且无自助入口。
 *
 * 策略（先 chmod，不行再重下）：
 *  1. 文件不存在 → 无可修，直接走 downloadBinary（等价于安装）。
 *  2. 文件存在 → chmod 0o755，再 spawn 自检。自检通过 → method:'chmod'。
 *  3. 自检失败（损坏/半成品）→ 回退 downloadBinary → method:'redownload'。
 */
export async function repairBinary(
  binaryName: BinaryName,
  onProgress?: (progress: DownloadBinaryProgress) => void
): Promise<RepairBinaryResult> {
  const filePath = getBinaryPath(binaryName);

  // 回退重新下载，并把 DownloadBinaryResult 映射为 RepairBinaryResult。
  // strictNullChecks 关闭，判别式联合不会自动收窄，显式取出 error 字段（与 updateYtDlp 一致）。
  const redownload = async (): Promise<RepairBinaryResult> => {
    const result = await downloadBinary(binaryName, onProgress);
    if (result.success) {
      return { success: true, path: result.path, method: 'redownload' };
    }
    return { success: false, error: (result as { error: string }).error };
  };

  // 文件不存在：没有可修的对象，直接下载安装。
  if (!fs.existsSync(filePath)) {
    console.log(`[binaryDownloader] repair: ${binaryName} 不存在，转为下载: ${filePath}`);
    return redownload();
  }

  // 先尝试补可执行权限。
  try {
    setExecutable(filePath);
  } catch (error) {
    // chmod 本身失败（只读卷 / 权限不足等）：记录后继续走自检，
    // 自检大概率失败从而回退重下，由下载落到可写的 userData 目录。
    console.warn(`[binaryDownloader] repair: chmod 失败，将尝试重新下载: ${filePath}`, (error as Error).message);
  }

  // 自检：chmod 成功 ≠ 文件可用，必须真跑一次。
  if (await canExecute(binaryName, filePath)) {
    console.log(`[binaryDownloader] repair: ${binaryName} 补权限后可用: ${filePath}`);
    return { success: true, path: filePath, method: 'chmod' };
  }

  // 自检失败：文件损坏或半成品，回退重新下载。
  console.warn(`[binaryDownloader] repair: ${binaryName} 自检失败，回退重新下载`);
  return redownload();
}

/**
 * 查询 GitHub 上 yt-dlp 的最新发布版本号（tag_name）。
 * 注意：这是唯一会调用 GitHub API 的地方，匿名请求每小时限 60 次，
 * 触发限流会抛 "HTTP 403"，由调用方降级处理（提示稍后再试，不阻塞）。
 */
export function getLatestYtDlpVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      'https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest',
      { headers: { 'User-Agent': 'video-downloader-app', Accept: 'application/vnd.github+json' } },
      (response) => {
        if (response.statusCode !== 200) {
          // 读完并丢弃响应体，避免 socket 挂起
          response.resume();
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          body += chunk;
        });
        response.on('end', () => {
          try {
            const tag = JSON.parse(body)?.tag_name;
            if (typeof tag === 'string' && tag.length > 0) {
              resolve(tag);
            } else {
              reject(new Error('无法解析最新版本号'));
            }
          } catch (e) {
            reject(new Error(`解析版本信息失败: ${(e as Error).message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy(new Error('查询最新版本超时'));
    });
  });
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
