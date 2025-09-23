import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// 二进制文件下载配置
interface BinaryConfig {
  [key: string]: {
    [platform: string]: string;
  };
}

const BINARIES: BinaryConfig = {
  'yt-dlp': {
    win32: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
    darwin: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp',
    linux: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'
  }
};

// 支持的平台
const PLATFORMS = ['win32', 'darwin', 'linux'] as const;

// 创建目录
function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 下载文件
function downloadFile(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`正在下载: ${url}`);
    console.log(`保存到: ${outputPath}`);
    
    const file = fs.createWriteStream(outputPath);
    
    https.get(url, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(outputPath);
        const location = response.headers.location;
        if (location) {
          downloadFile(location, outputPath)
            .then(resolve)
            .catch(reject);
          return;
        } else {
          reject(new Error('重定向但没有位置头'));
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(outputPath);
        reject(new Error(`下载失败，状态码: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      
      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;
        if (totalSize) {
          const percent = ((downloadedSize / totalSize) * 100).toFixed(1);
          process.stdout.write(`\r进度: ${percent}%`);
        }
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        console.log('\n下载完成');
        resolve();
      });
      
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      reject(err);
    });
  });
}

// 设置文件权限 (Unix系统)
function setExecutable(filePath: string): void {
  if (process.platform !== 'win32') {
    try {
      execSync(`chmod +x "${filePath}"`);
      console.log(`已设置执行权限: ${filePath}`);
    } catch (error) {
      console.warn(`设置执行权限失败: ${(error as Error).message}`);
    }
  }
}

// 主下载函数
async function downloadBinaries(): Promise<void> {
  console.log('开始下载二进制文件...\n');
  
  const rootDir = path.join(__dirname, '..');
  
  for (const platform of PLATFORMS) {
    console.log(`\n=== ${platform.toUpperCase()} 平台 ===`);
    
    const platformDir = path.join(rootDir, 'binaries', platform);
    ensureDir(platformDir);
    
    // 下载 yt-dlp
    const ytdlpUrl = BINARIES['yt-dlp'][platform];
    const ytdlpName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const ytdlpPath = path.join(platformDir, ytdlpName);
    
    try {
      if (fs.existsSync(ytdlpPath)) {
        console.log(`${ytdlpName} 已存在，跳过下载`);
      } else {
        await downloadFile(ytdlpUrl, ytdlpPath);
        setExecutable(ytdlpPath);
      }
    } catch (error) {
      console.error(`下载 ${ytdlpName} 失败:`, (error as Error).message);
    }
    
    // ffmpeg 需要手动下载
    const ffmpegName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const ffmpegPath = path.join(platformDir, ffmpegName);
    
    if (!fs.existsSync(ffmpegPath)) {
      console.log(`\n⚠️  ${ffmpegName} 需要手动下载:`);
      if (platform === 'win32') {
        console.log('   Windows: https://www.gyan.dev/ffmpeg/builds/');
        console.log('   下载 release build，解压后复制 ffmpeg.exe 到:');
        console.log(`   ${ffmpegPath}`);
      } else if (platform === 'darwin') {
        console.log('   macOS: https://evermeet.cx/ffmpeg/');
        console.log('   或使用 Homebrew: brew install ffmpeg');
        console.log(`   然后复制到: ${ffmpegPath}`);
      } else {
        console.log('   Linux: sudo apt install ffmpeg (或其他包管理器)');
        console.log(`   然后复制到: ${ffmpegPath}`);
      }
    } else {
      console.log(`${ffmpegName} 已存在 ✅`);
    }
  }
  
  console.log('\n下载任务完成！');
  console.log('\n注意事项:');
  console.log('1. ffmpeg 需要手动下载并放置到对应目录');
  console.log('2. 在 macOS 和 Linux 上，确保二进制文件有执行权限');
  console.log('3. 首次运行时可能需要在系统安全设置中允许运行');
}

// 检查现有二进制文件
function checkBinaries(): void {
  console.log('检查现有二进制文件:\n');
  
  const rootDir = path.join(__dirname, '..');
  
  for (const platform of PLATFORMS) {
    console.log(`${platform.toUpperCase()}:`);
    
    const platformDir = path.join(rootDir, 'binaries', platform);
    
    const ytdlpName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    const ffmpegName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    
    const ytdlpPath = path.join(platformDir, ytdlpName);
    const ffmpegPath = path.join(platformDir, ffmpegName);
    
    console.log(`  ${ytdlpName}: ${fs.existsSync(ytdlpPath) ? '✅' : '❌'}`);
    console.log(`  ${ffmpegName}: ${fs.existsSync(ffmpegPath) ? '✅' : '❌'}`);
    console.log('');
  }
}

// 主函数
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--check')) {
    checkBinaries();
  } else if (args.includes('--help')) {
    console.log('用法:');
    console.log('  npm run download-binaries        # 下载二进制文件');
    console.log('  npm run download-binaries --check # 检查现有文件');
    console.log('  npm run download-binaries --help  # 显示帮助');
  } else {
    try {
      await downloadBinaries();
    } catch (error) {
      console.error('下载过程中出现错误:', (error as Error).message);
      process.exit(1);
    }
  }
}

// 如果直接运行此文件
if (require.main === module) {
  main();
}

export { downloadBinaries, checkBinaries };
