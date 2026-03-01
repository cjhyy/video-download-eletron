#!/usr/bin/env node

/**
 * 下载 yt-dlp 和 ffmpeg 二进制文件
 * 跨平台支持: macOS, Windows, Linux
 */

import { createWriteStream, mkdirSync, existsSync, chmodSync, unlinkSync, renameSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 检测操作系统
function detectOS() {
  switch (process.platform) {
    case 'darwin': return 'darwin';
    case 'win32': return 'win32';
    case 'linux': return 'linux';
    default: throw new Error(`不支持的操作系统: ${process.platform}`);
  }
}

// 下载文件（支持重定向）
function downloadFile(url, destPath, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) {
      reject(new Error('重定向次数过多'));
      return;
    }

    const protocol = url.startsWith('https') ? https : http;

    protocol.get(url, (response) => {
      // 处理重定向
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`  重定向到: ${response.headers.location}`);
        downloadFile(response.headers.location, destPath, maxRedirects - 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: HTTP ${response.statusCode}`));
        return;
      }

      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;

      const file = createWriteStream(destPath);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes) {
          const percent = ((downloadedBytes / totalBytes) * 100).toFixed(1);
          process.stdout.write(`\r  进度: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(1)} MB)`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('');
        resolve();
      });

      file.on('error', (err) => {
        unlinkSync(destPath);
        reject(err);
      });
    }).on('error', reject);
  });
}

// 解压 zip 文件
function unzip(zipPath, destDir) {
  if (process.platform === 'win32') {
    execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
  }
}

// 解压 tar.xz 文件
function untarXz(tarPath, destDir) {
  execSync(`tar -xf "${tarPath}" -C "${destDir}"`, { stdio: 'inherit' });
}

// 下载 yt-dlp
async function downloadYtDlp(os, binDir) {
  console.log('\n=== 下载 yt-dlp ===');

  const urls = {
    darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos',
    win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
  };

  const outputName = os === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
  const outputPath = join(binDir, outputName);

  console.log(`下载: ${urls[os]}`);
  await downloadFile(urls[os], outputPath);

  if (os !== 'win32') {
    chmodSync(outputPath, 0o755);
  }

  console.log(`yt-dlp 下载完成: ${outputPath}`);
}

// 下载 ffmpeg
async function downloadFfmpeg(os, binDir) {
  console.log('\n=== 下载 ffmpeg ===');

  if (os === 'darwin') {
    const url = 'https://evermeet.cx/ffmpeg/getrelease/ffmpeg/zip';
    const zipPath = join(binDir, 'ffmpeg.zip');

    console.log(`下载: ${url}`);
    await downloadFile(url, zipPath);

    console.log('解压中...');
    unzip(zipPath, binDir);
    unlinkSync(zipPath);
    chmodSync(join(binDir, 'ffmpeg'), 0o755);

  } else if (os === 'win32') {
    const url = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
    const zipPath = join(binDir, 'ffmpeg.zip');

    console.log(`下载: ${url}`);
    await downloadFile(url, zipPath);

    console.log('解压中...');
    unzip(zipPath, binDir);

    // 找到并移动 ffmpeg.exe
    const { readdirSync } = await import('fs');
    const extracted = readdirSync(binDir).find(f => f.startsWith('ffmpeg-') && !f.endsWith('.zip'));
    if (extracted) {
      const ffmpegSrc = join(binDir, extracted, 'bin', 'ffmpeg.exe');
      const ffmpegDest = join(binDir, 'ffmpeg.exe');
      if (existsSync(ffmpegSrc)) {
        renameSync(ffmpegSrc, ffmpegDest);
      }
      // 清理解压目录
      execSync(`rmdir /s /q "${join(binDir, extracted)}"`, { stdio: 'ignore' });
    }
    unlinkSync(zipPath);

  } else if (os === 'linux') {
    const url = 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
    const tarPath = join(binDir, 'ffmpeg.tar.xz');

    console.log(`下载: ${url}`);
    await downloadFile(url, tarPath);

    console.log('解压中...');
    execSync(`tar -xf "${tarPath}" -C "${binDir}" --strip-components=1 --wildcards '*/ffmpeg'`, { stdio: 'inherit' });
    unlinkSync(tarPath);
    chmodSync(join(binDir, 'ffmpeg'), 0o755);
  }

  console.log('ffmpeg 下载完成');
}

// 主函数
async function main() {
  console.log('==============================');
  console.log('Video Downloader 二进制文件下载');
  console.log('==============================');

  const os = detectOS();
  const binDir = join(rootDir, 'binaries', os);

  console.log(`操作系统: ${os}`);
  console.log(`目标目录: ${binDir}`);

  // 创建目录
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  try {
    await downloadYtDlp(os, binDir);
    await downloadFfmpeg(os, binDir);

    console.log('\n==============================');
    console.log('所有文件下载完成！');
    console.log('==============================');

    // 列出下载的文件
    const { readdirSync, statSync } = await import('fs');
    const files = readdirSync(binDir);
    console.log('\n下载的文件:');
    files.forEach(f => {
      const stats = statSync(join(binDir, f));
      console.log(`  ${f} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    });

  } catch (error) {
    console.error('\n下载失败:', error.message);
    process.exit(1);
  }
}

main();
