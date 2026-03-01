import { app } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import type {
  BinaryStatus,
  DownloadOptions,
  DownloadLogLevel,
  DownloadProgress,
  ExportCookiesResult,
  UpdateYtDlpResult,
  VideoInfo,
  PlaylistInfo,
} from '../../shared/electron';
import { getBinaryPath } from '../lib/binaries';
import { loadConfig } from '../lib/config';
import { IpcError } from '../ipc/ipcError';

// Track active yt-dlp child processes so we can cancel per taskId (required for concurrent downloads).
const activeDownloads = new Map<string, ChildProcess>();

export type CancelDownloadResult = { success: true } | { success: false; error: string };

function killProcessTree(child: ChildProcess): void {
  if (!child.pid) return;

  // On Windows, kill the entire process tree (yt-dlp may spawn ffmpeg).
  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
    } catch {
      // ignore
    }
    return;
  }

  try {
    child.kill('SIGTERM');
  } catch {
    // ignore
  }

  setTimeout(() => {
    try {
      child.kill('SIGKILL');
    } catch {
      // ignore
    }
  }, 1500);
}

export function cancelDownload(taskId: string): CancelDownloadResult {
  const child = activeDownloads.get(taskId);
  if (!child) return { success: false, error: 'task not running' };

  // Best-effort cancellation; we also remove immediately to unblock new cancels.
  activeDownloads.delete(taskId);
  killProcessTree(child);
  return { success: true };
}

function sanitizeMediaUrl(input: string, opts?: { playlistMode?: 'single' | 'playlist' }): string {
  const raw = input.trim();
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const isYouTube =
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtu.be';

    // If user pasted a watch URL with playlist params, default to single-video mode.
    // If playlist mode is enabled, keep params to allow playlist downloading.
    const playlistMode = opts?.playlistMode;
    if (isYouTube && playlistMode !== 'playlist') {
      // youtu.be doesn't carry list params normally, but keep logic safe
      if (u.searchParams.has('list') && u.searchParams.has('v')) {
        u.searchParams.delete('list');
        u.searchParams.delete('index');
        u.searchParams.delete('start_radio');
        u.searchParams.delete('pp');
        u.searchParams.delete('si');
      }
    }
    return u.toString();
  } catch {
    return raw;
  }
}

function tailPush(buf: string[], lines: string[], max: number) {
  for (const line of lines) {
    if (!line) continue;
    buf.push(line);
    if (buf.length > max) buf.shift();
  }
}

function inferErrorCode(stderr: string): 'PERMISSION_DENIED' | 'NOT_FOUND' | 'INTERNAL_ERROR' {
  const s = stderr.toLowerCase();
  if (s.includes('http error 403') || s.includes('403 forbidden') || s.includes('sign in') || s.includes('login')) {
    return 'PERMISSION_DENIED';
  }
  if (s.includes('http error 404') || s.includes('404 not found')) return 'NOT_FOUND';
  return 'INTERNAL_ERROR';
}

function buildDownloadFailureMessage(stderrTail: string[], exitCode: number | null): { code: 'PERMISSION_DENIED' | 'NOT_FOUND' | 'CONFLICT' | 'INTERNAL_ERROR'; message: string } {
  const tail = stderrTail.join('\n');
  const s = tail.toLowerCase();

  // Permission / 403
  if (s.includes('http error 403') || s.includes('403 forbidden')) {
    return {
      code: 'PERMISSION_DENIED',
      message:
        'YouTube 返回 403（被风控/需要登录）。建议：开启对应站点 Cookie；更新 yt-dlp；如使用代理请尝试换节点或关闭代理后重试。',
    };
  }

  // SABR / missing url experiment
  if (s.includes('sabr') && s.includes('missing a url')) {
    return {
      code: 'PERMISSION_DENIED',
      message:
        'YouTube 可能启用了 SABR/广告实验（部分格式缺少 url）。建议：更新 yt-dlp 到最新；开启 Cookie；必要时更换网络/代理节点。',
    };
  }

  // File IO / part fragment missing / locking unsupported
  if (
    s.includes('lockingunsupportederror') ||
    (s.includes('no such file or directory') && s.includes('.part-frag'))
  ) {
    return {
      code: 'CONFLICT',
      message:
        '写入分片临时文件失败（.part-Frag 丢失/文件锁不支持）。建议：更换下载目录到本地磁盘普通目录（避免桌面/同步盘）；降低并发；关闭杀毒/同步后重试。',
    };
  }

  if (s.includes('http error 404') || s.includes('404 not found')) {
    return { code: 'NOT_FOUND', message: '资源不存在（404）。请检查链接是否有效，或视频是否已删除/不可用。' };
  }

  return { code: 'INTERNAL_ERROR', message: `下载失败（exitCode=${exitCode ?? 'null'}）。请查看任务日志中的 stderrTail。` };
}

// 获取二进制文件版本号
function getBinaryVersion(binaryPath: string, versionArg: string = '--version'): string | undefined {
  try {
    if (!fs.existsSync(binaryPath)) return undefined;

    const { execFileSync } = require('child_process');
    const output = execFileSync(binaryPath, [versionArg], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    }).trim();

    // yt-dlp 输出格式: "2024.01.01" 或 "2024.01.01.post1"
    // ffmpeg 输出格式: "ffmpeg version 6.1 ..." 或 "ffmpeg version N-xxxxx-..."
    if (output.includes('ffmpeg version')) {
      const match = output.match(/ffmpeg version (\S+)/);
      return match ? match[1] : output.split('\n')[0];
    }

    // yt-dlp 直接返回版本号
    return output.split('\n')[0];
  } catch (error) {
    console.error(`获取版本号失败: ${binaryPath}`, error);
    return undefined;
  }
}

export function checkBinaries(): BinaryStatus {
  const ytDlpPath = getBinaryPath('yt-dlp');
  const ffmpegPath = getBinaryPath('ffmpeg');

  const ytDlpExists = fs.existsSync(ytDlpPath);
  const ffmpegExists = fs.existsSync(ffmpegPath);

  // 获取版本号
  const versions: { ytDlp?: string; ffmpeg?: string } = {};
  if (ytDlpExists) {
    versions.ytDlp = getBinaryVersion(ytDlpPath, '--version');
  }
  if (ffmpegExists) {
    versions.ffmpeg = getBinaryVersion(ffmpegPath, '-version');
  }

  return {
    ytDlp: ytDlpExists,
    ffmpeg: ffmpegExists,
    paths: { ytDlp: ytDlpPath, ffmpeg: ffmpegPath },
    versions,
  };
}

export async function getVideoInfo(params: {
  url: string;
  useBrowserCookies?: boolean;
  browserPath?: string;
  cookieFile?: string;
}): Promise<VideoInfo> {
  const { url, useBrowserCookies, browserPath, cookieFile } = params;
  const sanitizedUrl = sanitizeMediaUrl(url, { playlistMode: 'single' });

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    console.log(`[${new Date().toLocaleTimeString()}] 开始获取视频信息: ${url}`);

    const ytDlpPath = getBinaryPath('yt-dlp');
    console.log(`[${new Date().toLocaleTimeString()}] yt-dlp路径: ${ytDlpPath}`);

    if (!fs.existsSync(ytDlpPath)) {
      const error = `yt-dlp binary not found at: ${ytDlpPath}`;
      console.error(`[${new Date().toLocaleTimeString()}] ${error}`);
      reject(new Error(error));
      return;
    }

    const config = loadConfig();
    const args = [
      '-v',
      // Ensure deterministic behavior (ignore user/global yt-dlp config files).
      '--ignore-config',
      '--dump-json',
      '--no-playlist',
      '--socket-timeout',
      config.network.socketTimeout.toString(),
      '--retries',
      config.network.retries.toString(),
      '--fragment-retries',
      config.network.retries.toString(),
      '--retry-sleep',
      config.network.retryDelay.toString(),
      '--ignore-errors',
      '--no-warnings',
      '--user-agent',
      config.network.userAgent,
      ...config.ytdlp.additionalArgs,
    ];

    if (config.network.proxy) {
      args.push('--proxy', config.network.proxy);
      console.log(`[${new Date().toLocaleTimeString()}] 使用代理: ${config.network.proxy}`);
    }

    if (cookieFile && fs.existsSync(cookieFile)) {
      args.push('--cookies', cookieFile);
      console.log(`[${new Date().toLocaleTimeString()}] 使用Cookie文件: ${cookieFile}`);
    } else if (useBrowserCookies && browserPath) {
      args.push('--cookies-from-browser', 'chrome');
      console.log(`[${new Date().toLocaleTimeString()}] 从Chrome浏览器读取Cookie (使用默认配置)`);
      console.log(`[${new Date().toLocaleTimeString()}] 如果Chrome正在运行，yt-dlp会尝试使用容器访问Cookie`);
    }

    args.push(sanitizedUrl);

    console.log(`[${new Date().toLocaleTimeString()}] 执行命令: ${ytDlpPath} ${args.join(' ')}`);

    const childProcess: ChildProcess = spawn(ytDlpPath, args);
    let stdout = '';
    let stderr = '';
    const stderrTail: string[] = [];

    childProcess.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(
        `[${new Date().toLocaleTimeString()}] yt-dlp stdout: ${chunk.slice(0, 200)}${chunk.length > 200 ? '...' : ''}`
      );
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      tailPush(stderrTail, chunk.split(/\r?\n/), 50);

      if (
        chunk.includes('WARNING') &&
        (chunk.includes('SABR') || chunk.includes('Some tv client') || chunk.includes('have been skipped'))
      ) {
        console.log(`[${new Date().toLocaleTimeString()}] yt-dlp警告(已过滤): ${chunk.trim()}`);
      } else {
        console.log(`[${new Date().toLocaleTimeString()}] yt-dlp stderr: ${chunk}`);
      }
    });

    childProcess.on('close', (code: number | null) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[${new Date().toLocaleTimeString()}] yt-dlp进程结束，退出码: ${code}，耗时: ${duration}ms`);

      if (code === 0) {
        try {
          console.log(`[${new Date().toLocaleTimeString()}] 开始解析JSON数据，长度: ${stdout.length}`);
          const videoInfo = JSON.parse(stdout);
          console.log(`[${new Date().toLocaleTimeString()}] JSON解析成功，视频标题: ${videoInfo.title}`);

          const result: VideoInfo = {
            title: videoInfo.title,
            duration: videoInfo.duration,
            uploader: videoInfo.uploader,
            formats:
              videoInfo.formats?.map((f: any) => ({
                format_id: f.format_id,
                ext: f.ext,
                quality: f.quality,
                filesize: f.filesize,
                filesize_approx: f.filesize_approx,
                format_note: f.format_note,
                width: f.width,
                height: f.height,
                fps: f.fps,
                vcodec: f.vcodec,
                acodec: f.acodec,
                tbr: f.tbr,
                vbr: f.vbr,
                abr: f.abr,
              })) || [],
          };

          console.log(`[${new Date().toLocaleTimeString()}] 视频信息处理完成，格式数量: ${result.formats.length}`);
          if (result.formats.length > 0) {
            console.log(`[${new Date().toLocaleTimeString()}] 格式示例:`, result.formats[0]);
          }
          resolve(result);
        } catch (e) {
          const error = `Failed to parse video info: ${(e as Error).message}`;
          console.error(`[${new Date().toLocaleTimeString()}] ${error}`);
          reject(new Error(error));
        }
      } else {
        let errorMessage = `yt-dlp failed with code ${code}`;

        if (stderr.includes('ConnectionResetError') || stderr.includes('Connection aborted')) {
          errorMessage = '网络连接不稳定，请检查网络连接或稍后重试。如果问题持续，可能需要配置代理。';
        } else if (stderr.includes('Unable to download webpage')) {
          errorMessage = '无法访问视频页面，请检查链接是否正确或网络是否正常。';
        } else if (stderr.includes('Video unavailable')) {
          errorMessage = '视频不可用，可能已被删除或设为私密。';
        } else if (stderr.includes('Sign in to confirm your age')) {
          errorMessage = '该视频需要年龄验证，请使用其他视频链接。';
        } else if (stderr.includes('Private video')) {
          errorMessage = '这是私密视频，无法访问。';
        } else if (stderr.includes('This video is not available')) {
          errorMessage = '视频在您的地区不可用。';
        } else {
          errorMessage = `获取视频信息失败: ${stderr.split('\n')[0] || '未知错误'}`;
        }

        console.error(`[${new Date().toLocaleTimeString()}] ${errorMessage}`);
        console.error(`[${new Date().toLocaleTimeString()}] 完整错误信息: ${stderr}`);
        reject(
          new IpcError(
            inferErrorCode(stderrTail.join('\n')),
            errorMessage,
            { exitCode: code, stderrTail }
          )
        );
      }
    });

    childProcess.on('error', (error: Error) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMsg = `Failed to start yt-dlp after ${duration}ms: ${error.message}`;
      console.error(`[${new Date().toLocaleTimeString()}] ${errorMsg}`);
      reject(new Error(errorMsg));
    });

    const timeoutMs = (config.timeouts?.getVideoInfo ?? 30) * 1000;
    const timeout = setTimeout(() => {
      console.warn(`[${new Date().toLocaleTimeString()}] yt-dlp进程超时（${timeoutMs / 1000}秒），正在终止...`);
      childProcess.kill('SIGKILL');
      reject(new Error(`获取视频信息超时（${timeoutMs / 1000}秒）`));
    }, timeoutMs);

    childProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

export async function downloadVideo(
  options: DownloadOptions,
  callbacks: {
    onProgress: (progress: DownloadProgress) => void;
    onError: (error: string) => void;
    onLog?: (level: DownloadLogLevel, message: string) => void;
  }
): Promise<{ success: boolean }> {
  return new Promise((resolve, reject) => {
    const { taskId, url, outputPath, format, audioOnly, rateLimit, useBrowserCookies, browserPath, cookieFile } =
      options;
    const playlistMode = options.playlistMode ?? 'single';
    const sanitizedUrl = sanitizeMediaUrl(url, { playlistMode });
    const ytDlpPath = getBinaryPath('yt-dlp');
    const ffmpegPath = getBinaryPath('ffmpeg');

    if (!fs.existsSync(ytDlpPath)) {
      reject(new Error(`yt-dlp binary not found at: ${ytDlpPath}`));
      return;
    }

    if (!fs.existsSync(ffmpegPath)) {
      reject(new Error(`ffmpeg binary not found at: ${ffmpegPath}`));
      return;
    }

    const config = loadConfig();
    // Avoid filename collisions (esp. playlist/series) and keep Windows paths safe-ish.
    // Using id guarantees uniqueness; limiting title reduces path/filename edge cases.
    const outputTemplate = path.join(outputPath, '%(title).150B_%(id)s.%(ext)s');
    const args = [
      '-v',
      // Ensure deterministic behavior (ignore user/global yt-dlp config files).
      '--ignore-config',
      // allow resuming partial downloads (used for "pause/continue" UX)
      '--continue',
      '--ffmpeg-location',
      path.dirname(ffmpegPath),
      '--output',
      outputTemplate,
      ...(playlistMode === 'single' ? ['--no-playlist'] : []),
      '--socket-timeout',
      config.network.socketTimeout.toString(),
      '--retries',
      config.network.retries.toString(),
      '--fragment-retries',
      config.network.retries.toString(),
      '--retry-sleep',
      // 支持指数退避：如果启用，使用 exp=baseDelay:maxDelay 格式
      // 例如 exp=1:30 表示从1秒开始，每次翻倍，最大30秒
      config.network.exponentialBackoff
        ? `exp=${config.network.retryDelay}:${Math.min(config.network.retryDelay * Math.pow(2, config.network.retries), 30)}`
        : config.network.retryDelay.toString(),
      '--user-agent',
      config.network.userAgent,
      '--no-overwrites',
      ...config.ytdlp.additionalArgs,
    ];

    if (config.network.proxy) {
      args.push('--proxy', config.network.proxy);
    }

    if (rateLimit) {
      args.push('--limit-rate', rateLimit);
    }

    // Playlist/channel options
    if (playlistMode === 'playlist') {
      if (options.playlistItems) {
        args.push('--playlist-items', options.playlistItems);
      }
      if (options.playlistEnd) {
        args.push('--playlist-end', String(options.playlistEnd));
      }
    }

    if (cookieFile && fs.existsSync(cookieFile)) {
      args.push('--cookies', cookieFile);
      console.log(`[${new Date().toLocaleTimeString()}] 使用Cookie文件: ${cookieFile}`);
    } else if (useBrowserCookies && browserPath) {
      args.push('--cookies-from-browser', 'chrome');
      console.log(`[${new Date().toLocaleTimeString()}] 从Chrome浏览器读取Cookie (使用默认配置)`);
      console.log(`[${new Date().toLocaleTimeString()}] 如果Chrome正在运行，yt-dlp会尝试使用容器访问Cookie`);
    }

    if (audioOnly) {
      args.push('--extract-audio', '--audio-format', 'mp3');
    } else if (format) {
      args.push('--format', format);
      // 强制合并为 mp4 格式，避免 webm 合并时的 AV1 编码兼容性问题
      args.push('--merge-output-format', 'mp4');
    }

    // Post-processing options
    const pp = options.postProcess;
    if (pp?.addMetadata) {
      args.push('--add-metadata');
    }
    if (pp?.writeThumbnail) {
      args.push('--write-thumbnail', '--embed-thumbnail');
    }
    // Subtitle options (sidecar download)
    if (pp?.writeSubs || pp?.writeAutoSubs || pp?.embedSubs) {
      // Ensure subs are written if embedding or converting
      args.push('--write-subs');
      if (pp?.writeAutoSubs) args.push('--write-auto-subs');

      // Prefer srt for downstream learning workflows
      args.push('--sub-format', 'vtt', '--convert-subs', 'srt');

      const langs = (pp?.subLangs || '').trim();
      args.push('--sub-langs', langs || 'en.*');

      if (pp?.embedSubs) {
        args.push('--embed-subs');
      }
    }

    args.push('--newline');
    args.push(sanitizedUrl);

    const childProcess: ChildProcess = spawn(ytDlpPath, args);

    // Register child process for cancellation if taskId is provided.
    if (taskId && taskId !== 'unknown') {
      activeDownloads.set(taskId, childProcess);
    }
    callbacks.onLog?.('info', `yt-dlp started`);
    callbacks.onLog?.('info', `url: ${sanitizedUrl}`);
    callbacks.onLog?.('info', `args: ${args.join(' ')}`);
    let lastProgress: { percent?: number } = {};
    const stderrTail: string[] = [];
    const hints = {
      shown403: false,
      shownSabr: false,
      shownLock: false,
      shownUpdate: false,
    };

    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      // Persist some stdout lines for diagnostics (trim noisy progress spam later).
      const lines = output.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        // Skip pure progress lines to reduce log volume (we already report percent separately)
        if (line.startsWith('[download]')) continue;
        callbacks.onLog?.('info', line);
      }

      const progressMatch = output.match(
        /\[download\]\s+(\d+\.?\d*)%\s+of\s+~?\s*(\d+\.?\d*\w+)\s+at\s+(\d+\.?\d*\w+\/s)\s+ETA\s+(\d+:\d+(?::\d+)?)/
      );
      if (progressMatch) {
        const progress: DownloadProgress = {
          percent: parseFloat(progressMatch[1]),
          size: progressMatch[2],
          speed: progressMatch[3],
          eta: progressMatch[4],
        };

        if (progress.percent !== lastProgress.percent) {
          callbacks.onProgress(progress);
          lastProgress = progress;
        }
      }

      if (output.includes('[download] 100%') || output.includes('has already been downloaded')) {
        callbacks.onProgress({ percent: 100, status: 'completed' });
      }
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      const lines = error.split(/\r?\n/).filter(Boolean);
      tailPush(stderrTail, lines, 50);
      for (const line of lines) {
        const level: DownloadLogLevel =
          line.includes('ERROR') ? 'error' : line.includes('WARNING') ? 'warn' : 'info';
        callbacks.onLog?.(level, line);
      }

      const joined = lines.join('\n');
      const lower = joined.toLowerCase();
      // One-time hints to guide user quickly (avoid spamming)
      if (!hints.shownUpdate && lower.includes('older than') && lower.includes('90 days')) {
        hints.shownUpdate = true;
        callbacks.onLog?.('warn', '提示：yt-dlp 版本较旧，建议在“设置”页更新 yt-dlp（可能影响 YouTube 可用性）。');
      }
      if (!hints.shown403 && (lower.includes('http error 403') || lower.includes('403 forbidden'))) {
        hints.shown403 = true;
        callbacks.onLog?.('warn', '提示：遇到 403，通常需要启用 Cookie 或更换/关闭代理节点。');
      }
      if (!hints.shownSabr && lower.includes('sabr') && lower.includes('missing a url')) {
        hints.shownSabr = true;
        callbacks.onLog?.('warn', '提示：YouTube SABR/广告实验可能导致部分格式不可用；尝试更新 yt-dlp + 开启 Cookie。');
      }
      if (
        !hints.shownLock &&
        (lower.includes('lockingunsupportederror') ||
          (lower.includes('no such file or directory') && lower.includes('.part-frag')))
      ) {
        hints.shownLock = true;
        callbacks.onLog?.(
          'warn',
          '提示：疑似文件锁/临时分片写入失败；建议更换下载目录（避免桌面/同步盘）并降低并发。'
        );
      }

      if (
        error.includes('WARNING') &&
        (error.includes('SABR') || error.includes('Some tv client') || error.includes('have been skipped'))
      ) {
        console.log(`[${new Date().toLocaleTimeString()}] yt-dlp警告: ${error.trim()}`);
        return;
      }

      if (error.includes('ERROR')) {
        callbacks.onError(error);
      }
    });

    childProcess.on('close', (code: number | null) => {
      if (taskId) activeDownloads.delete(taskId);
      callbacks.onLog?.('info', `yt-dlp exited with code ${code ?? 'null'}`);
      if (code === 0) {
        resolve({ success: true });
      } else {
        const tail = stderrTail.join('\n');
        const mapped = buildDownloadFailureMessage(stderrTail, code);
        reject(new IpcError(mapped.code, mapped.message, { exitCode: code, stderrTail }));
      }
    });

    childProcess.on('error', (error: Error) => {
      if (taskId) activeDownloads.delete(taskId);
      callbacks.onLog?.('error', `yt-dlp spawn error: ${error.message}`);
      reject(new Error(`Failed to start download: ${error.message}`));
    });
  });
}

export async function updateYtDlp(): Promise<UpdateYtDlpResult> {
  return new Promise((resolve) => {
    const ytDlpPath = getBinaryPath('yt-dlp');

    if (!fs.existsSync(ytDlpPath)) {
      resolve({ success: false, error: 'yt-dlp 未找到' });
      return;
    }

    console.log(`[${new Date().toLocaleTimeString()}] 开始更新 yt-dlp...`);
    console.log(`[${new Date().toLocaleTimeString()}] yt-dlp 路径: ${ytDlpPath}`);

    const args = ['-v', '-U'];
    const childProcess = spawn(ytDlpPath, args);

    let stdout = '';
    let stderr = '';

    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      stdout += output;
      console.log(`[${new Date().toLocaleTimeString()}] yt-dlp 更新输出: ${output.trim()}`);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      stderr += output;
      console.log(`[${new Date().toLocaleTimeString()}] yt-dlp 更新错误: ${output.trim()}`);
    });

    childProcess.on('close', (code: number | null) => {
      console.log(`[${new Date().toLocaleTimeString()}] yt-dlp 更新进程结束，退出码: ${code}`);

      if (code === 0) {
        if (stdout.includes('already up to date') || stdout.includes('已是最新版本')) {
          resolve({ success: true, message: 'yt-dlp 已经是最新版本' });
        } else if (stdout.includes('Updated') || stdout.includes('更新成功')) {
          resolve({ success: true, message: 'yt-dlp 更新成功！' });
        } else {
          resolve({ success: true, message: stdout.trim() || 'yt-dlp 更新完成' });
        }
      } else {
        const errorMsg = stderr || stdout || '更新失败';
        console.error(`[${new Date().toLocaleTimeString()}] yt-dlp 更新失败: ${errorMsg}`);

        if (errorMsg.includes('Permission denied') || errorMsg.includes('权限')) {
          resolve({ success: false, error: '更新失败：权限不足。请尝试以管理员身份运行应用。' });
        } else {
          resolve({ success: false, error: `更新失败: ${errorMsg}` });
        }
      }
    });

    childProcess.on('error', (error: Error) => {
      console.error(`[${new Date().toLocaleTimeString()}] yt-dlp 更新进程错误:`, error);
      resolve({ success: false, error: `更新进程错误: ${error.message}` });
    });
  });
}

export async function exportCookies(params?: { url?: string }): Promise<ExportCookiesResult> {
  return new Promise((resolve) => {
    const ytDlpPath = getBinaryPath('yt-dlp');

    if (!fs.existsSync(ytDlpPath)) {
      resolve({ success: false, error: 'yt-dlp未找到' });
      return;
    }

    const config = loadConfig();
    const tempDir = app.getPath('temp');
    const cookieFile = path.join(tempDir, 'yt-dlp-cookies.txt');

    console.log(`[${new Date().toLocaleTimeString()}] 开始导出Chrome Cookies到: ${cookieFile}`);

    const targetUrl = params?.url?.trim() || 'https://www.youtube.com';
    const args = [
      '-v',
      '--cookies-from-browser',
      'chrome',
      '--cookies',
      cookieFile,
      '--print',
      'cookies_exported',
      targetUrl,
    ];

    const childProcess: ChildProcess = spawn(ytDlpPath, args);
    let stderr = '';

    childProcess.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code: number | null) => {
      console.log(`[${new Date().toLocaleTimeString()}] Cookie导出进程结束，退出码: ${code}`);

      if (code === 0 && fs.existsSync(cookieFile)) {
        console.log(`[${new Date().toLocaleTimeString()}] Cookie文件已创建: ${cookieFile}`);
        resolve({ success: true, cookieFile });
      } else {
        const errorMsg = stderr || 'Cookie导出失败';
        console.error(`[${new Date().toLocaleTimeString()}] Cookie导出失败: ${errorMsg}`);
        resolve({ success: false, error: errorMsg });
      }
    });

    childProcess.on('error', (error: Error) => {
      console.error(`[${new Date().toLocaleTimeString()}] Cookie导出进程错误: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    const timeoutMs = (config.timeouts?.exportCookies ?? 30) * 1000;
    setTimeout(() => {
      childProcess.kill('SIGKILL');
      resolve({ success: false, error: `Cookie导出超时（${timeoutMs / 1000}秒）` });
    }, timeoutMs);
  });
}

export async function getPlaylistInfo(params: {
  url: string;
  cookieFile?: string;
  useBrowserCookies?: boolean;
  browserPath?: string;
  playlistEnd?: number;
}): Promise<PlaylistInfo> {
  const { url, useBrowserCookies, browserPath, cookieFile, playlistEnd } = params;
  // For playlist expansion we want to keep playlist params intact.
  const sanitizedUrl = sanitizeMediaUrl(url, { playlistMode: 'playlist' });

  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const ytDlpPath = getBinaryPath('yt-dlp');
    if (!fs.existsSync(ytDlpPath)) {
      reject(new Error(`yt-dlp binary not found at: ${ytDlpPath}`));
      return;
    }

    const config = loadConfig();
    const args = [
      '-v',
      '--ignore-config',
      // keep output smaller and parseable
      '--no-warnings',
      '--dump-single-json',
      '--flat-playlist',
      '--socket-timeout',
      config.network.socketTimeout.toString(),
      '--retries',
      config.network.retries.toString(),
      '--fragment-retries',
      config.network.retries.toString(),
      '--retry-sleep',
      // 支持指数退避
      config.network.exponentialBackoff
        ? `exp=${config.network.retryDelay}:${Math.min(config.network.retryDelay * Math.pow(2, config.network.retries), 30)}`
        : config.network.retryDelay.toString(),
      '--user-agent',
      config.network.userAgent,
      ...config.ytdlp.additionalArgs,
    ];

    if (playlistEnd) {
      args.push('--playlist-end', String(playlistEnd));
    }

    if (config.network.proxy) {
      args.push('--proxy', config.network.proxy);
    }

    if (cookieFile && fs.existsSync(cookieFile)) {
      args.push('--cookies', cookieFile);
    } else if (useBrowserCookies && browserPath) {
      args.push('--cookies-from-browser', 'chrome');
    }

    args.push(sanitizedUrl);

    const childProcess: ChildProcess = spawn(ytDlpPath, args);
    let stdout = '';
    const stderrTail: string[] = [];

    childProcess.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      tailPush(stderrTail, data.toString().split(/\r?\n/), 50);
    });

    const timeoutMs = (config.timeouts?.getPlaylistInfo ?? 30) * 1000;
    const timeout = setTimeout(() => {
      killProcessTree(childProcess);
      reject(new Error(`展开列表超时（${timeoutMs / 1000}秒）`));
    }, timeoutMs);

    childProcess.on('close', (code: number | null) => {
      clearTimeout(timeout);
      const duration = Date.now() - startTime;
      if (code !== 0) {
        const mapped = buildDownloadFailureMessage(stderrTail, code);
        reject(new IpcError(mapped.code, `展开列表失败（${duration}ms）：${mapped.message}`, { exitCode: code, stderrTail }));
        return;
      }

      try {
        const obj = JSON.parse(stdout) as any;
        const entriesRaw = Array.isArray(obj?.entries) ? obj.entries : [];
        const entries = entriesRaw
          .map((e: any) => ({
            index: typeof e?.playlist_index === 'number' ? e.playlist_index : typeof e?.index === 'number' ? e.index : undefined,
            id: typeof e?.id === 'string' ? e.id : undefined,
            title: typeof e?.title === 'string' ? e.title : undefined,
            duration: typeof e?.duration === 'number' ? e.duration : undefined,
            uploader: typeof e?.uploader === 'string' ? e.uploader : undefined,
            webpage_url: typeof e?.webpage_url === 'string' ? e.webpage_url : undefined,
            url: typeof e?.url === 'string' ? e.url : undefined,
            extractor: typeof e?.extractor === 'string' ? e.extractor : undefined,
          }))
          .filter((e: any) => e.title || e.webpage_url || e.url || e.id);

        resolve({
          title: typeof obj?.title === 'string' ? obj.title : undefined,
          uploader: typeof obj?.uploader === 'string' ? obj.uploader : undefined,
          webpage_url: typeof obj?.webpage_url === 'string' ? obj.webpage_url : undefined,
          entries,
        });
      } catch (e) {
        reject(new IpcError('INTERNAL_ERROR', `展开列表解析失败：${(e as Error).message}`, { stderrTail }));
      }
    });

    childProcess.on('error', (error: Error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to start yt-dlp: ${error.message}`));
    });
  });
}


