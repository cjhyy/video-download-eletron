import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
// 内联类型定义和常量，避免模块导入问题
interface VideoInfo {
  title: string;
  duration?: number;
  uploader?: string;
  formats: VideoFormat[];
}

interface VideoFormat {
  format_id: string;
  ext: string;
  quality?: string | number;
  filesize?: number;
  format_note?: string;
}

interface DownloadOptions {
  url: string;
  outputPath: string;
  format?: string;
  audioOnly: boolean;
}

interface BinaryStatus {
  ytDlp: boolean;
  ffmpeg: boolean;
  paths: {
    ytDlp: string;
    ffmpeg: string;
  };
}

// IPC 通道名称常量
const IPCChannels = {
  SELECT_DOWNLOAD_DIRECTORY: 'select-download-directory',
  GET_VIDEO_INFO: 'get-video-info',
  DOWNLOAD_VIDEO: 'download-video',
  OPEN_FOLDER: 'open-folder',
  CHECK_BINARIES: 'check-binaries',
  DOWNLOAD_PROGRESS: 'download-progress',
  DOWNLOAD_ERROR: 'download-error'
} as const;

// 保持对窗口对象的全局引用
let mainWindow: BrowserWindow | null = null;

// 读取配置文件
function loadConfig() {
  try {
    const configPath = path.join(__dirname, '..', 'config.json');
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(configData);
    }
  } catch (error) {
    console.warn('配置文件读取失败，使用默认配置:', (error as Error).message);
  }
  
  // 默认配置
  return {
    network: {
      proxy: '',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      socketTimeout: 30,
      retries: 5,
      retryDelay: 1
    },
    ytdlp: {
      additionalArgs: []
    }
  };
}

// 获取二进制文件路径
function getBinaryPath(binaryName: string): string {
  const platform = process.platform;
  let extension = '';
  
  if (platform === 'win32') {
    extension = '.exe';
  }
  
  // 在开发模式下使用本地binaries文件夹
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    return path.join(__dirname, '..', 'binaries', platform, binaryName + extension);
  }
  
  // 在打包后使用extraResources
  return path.join(process.resourcesPath, 'binaries', platform, binaryName + extension);
}

function createWindow(): void {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false
  });

  // 加载应用的 index.html
  mainWindow.loadFile('index.html');

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 当窗口被关闭时，取消引用窗口对象
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

// 修复 GPU 进程问题
app.disableHardwareAcceleration();

// 添加命令行开关来修复 GLES 上下文和虚拟化问题
app.commandLine.appendSwitch('--no-sandbox');
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--disable-gpu');
app.commandLine.appendSwitch('--disable-gpu-compositing');
app.commandLine.appendSwitch('--disable-accelerated-2d-canvas');
app.commandLine.appendSwitch('--disable-accelerated-video-decode');
app.commandLine.appendSwitch('--use-gl', 'swiftshader');
app.commandLine.appendSwitch('--ignore-gpu-blacklist');
app.commandLine.appendSwitch('--disable-dev-shm-usage');
app.commandLine.appendSwitch('--disable-features', 'VizDisplayCompositor');
app.commandLine.appendSwitch('--disable-gpu-memory-buffer-compositor-resources');
app.commandLine.appendSwitch('--disable-gpu-memory-buffer-video-frames');
app.commandLine.appendSwitch('--disable-background-timer-throttling');
app.commandLine.appendSwitch('--disable-renderer-backgrounding');
app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('--disable-ipc-flooding-protection');

// Electron 初始化完成并准备创建浏览器窗口
app.whenReady().then(createWindow);

// 当所有窗口都关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC 处理程序

// 选择下载目录
ipcMain.handle(IPCChannels.SELECT_DOWNLOAD_DIRECTORY, async (): Promise<string | null> => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  
  return null;
});

// 获取视频信息
ipcMain.handle(IPCChannels.GET_VIDEO_INFO, async (_event, url: string): Promise<VideoInfo> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    console.log(`[${new Date().toLocaleTimeString()}] 开始获取视频信息: ${url}`);
    
    const ytDlpPath = getBinaryPath('yt-dlp');
    console.log(`[${new Date().toLocaleTimeString()}] yt-dlp路径: ${ytDlpPath}`);
    
    // 检查yt-dlp是否存在
    if (!fs.existsSync(ytDlpPath)) {
      const error = `yt-dlp binary not found at: ${ytDlpPath}`;
      console.error(`[${new Date().toLocaleTimeString()}] ${error}`);
      reject(new Error(error));
      return;
    }

    const config = loadConfig();
    const args = [
      '--dump-json',
      '--no-playlist',
      '--socket-timeout', config.network.socketTimeout.toString(),
      '--retries', config.network.retries.toString(),
      '--fragment-retries', config.network.retries.toString(),
      '--retry-sleep', config.network.retryDelay.toString(),
      '--ignore-errors',
      '--no-warnings',
      '--user-agent', config.network.userAgent,
      ...config.ytdlp.additionalArgs
    ];
    
    // 如果配置了代理，添加代理参数
    if (config.network.proxy) {
      args.push('--proxy', config.network.proxy);
      console.log(`[${new Date().toLocaleTimeString()}] 使用代理: ${config.network.proxy}`);
    }
    
    args.push(url);
    
    console.log(`[${new Date().toLocaleTimeString()}] 执行命令: ${ytDlpPath} ${args.join(' ')}`);

    const childProcess: ChildProcess = spawn(ytDlpPath, args);
    let stdout = '';
    let stderr = '';

    childProcess.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      console.log(`[${new Date().toLocaleTimeString()}] yt-dlp stdout: ${chunk.slice(0, 200)}${chunk.length > 200 ? '...' : ''}`);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stderr += chunk;
      console.log(`[${new Date().toLocaleTimeString()}] yt-dlp stderr: ${chunk}`);
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
          
          const result = {
            title: videoInfo.title,
            duration: videoInfo.duration,
            uploader: videoInfo.uploader,
            formats: videoInfo.formats?.map((f: any) => ({
              format_id: f.format_id,
              ext: f.ext,
              quality: f.quality,
              filesize: f.filesize,
              format_note: f.format_note
            })) || []
          };
          
          console.log(`[${new Date().toLocaleTimeString()}] 视频信息处理完成，格式数量: ${result.formats.length}`);
          resolve(result);
        } catch (e) {
          const error = `Failed to parse video info: ${(e as Error).message}`;
          console.error(`[${new Date().toLocaleTimeString()}] ${error}`);
          reject(new Error(error));
        }
      } else {
        let errorMessage = `yt-dlp failed with code ${code}`;
        
        // 分析常见错误并提供友好提示
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
          // 显示原始错误的简化版本
          errorMessage = `获取视频信息失败: ${stderr.split('\n')[0] || '未知错误'}`;
        }
        
        console.error(`[${new Date().toLocaleTimeString()}] ${errorMessage}`);
        console.error(`[${new Date().toLocaleTimeString()}] 完整错误信息: ${stderr}`);
        reject(new Error(errorMessage));
      }
    });

    childProcess.on('error', (error: Error) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      const errorMsg = `Failed to start yt-dlp after ${duration}ms: ${error.message}`;
      console.error(`[${new Date().toLocaleTimeString()}] ${errorMsg}`);
      reject(new Error(errorMsg));
    });
    
    // 添加超时处理
    const timeout = setTimeout(() => {
      console.warn(`[${new Date().toLocaleTimeString()}] yt-dlp进程超时（30秒），正在终止...`);
      childProcess.kill('SIGKILL');
      reject(new Error('获取视频信息超时（30秒）'));
    }, 30000);
    
    childProcess.on('close', () => {
      clearTimeout(timeout);
    });
  });
});

// 下载视频
ipcMain.handle(IPCChannels.DOWNLOAD_VIDEO, async (event, options: DownloadOptions): Promise<{ success: boolean }> => {
  return new Promise((resolve, reject) => {
    const { url, outputPath, format, audioOnly } = options;
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
    const args = [
      '--ffmpeg-location', path.dirname(ffmpegPath),
      '--output', path.join(outputPath, '%(title)s.%(ext)s'),
      '--no-playlist',
      '--socket-timeout', config.network.socketTimeout.toString(),
      '--retries', config.network.retries.toString(),
      '--fragment-retries', config.network.retries.toString(),
      '--retry-sleep', config.network.retryDelay.toString(),
      '--user-agent', config.network.userAgent,
      ...config.ytdlp.additionalArgs
    ];

    // 如果配置了代理，添加代理参数
    if (config.network.proxy) {
      args.push('--proxy', config.network.proxy);
    }

    if (audioOnly) {
      args.push('--extract-audio', '--audio-format', 'mp3');
    } else if (format) {
      args.push('--format', format);
    }

    // 添加进度钩子
    args.push('--newline');
    args.push(url);

    const childProcess: ChildProcess = spawn(ytDlpPath, args);
    let lastProgress: { percent?: number } = {};

    childProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      
      // 解析下载进度
      const progressMatch = output.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+~?\s*(\d+\.?\d*\w+)\s+at\s+(\d+\.?\d*\w+\/s)/);
      if (progressMatch) {
        const progress = {
          percent: parseFloat(progressMatch[1]),
          size: progressMatch[2],
          speed: progressMatch[3]
        };
        
        // 只有当进度变化时才发送更新
        if (progress.percent !== lastProgress.percent) {
          event.sender.send(IPCChannels.DOWNLOAD_PROGRESS, progress);
          lastProgress = progress;
        }
      }

      // 检查是否完成
      if (output.includes('[download] 100%') || output.includes('has already been downloaded')) {
        event.sender.send(IPCChannels.DOWNLOAD_PROGRESS, { percent: 100, status: 'completed' });
      }
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const error = data.toString();
      event.sender.send(IPCChannels.DOWNLOAD_ERROR, error);
    });

    childProcess.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        reject(new Error(`Download failed with code: ${code}`));
      }
    });

    childProcess.on('error', (error: Error) => {
      reject(new Error(`Failed to start download: ${error.message}`));
    });
  });
});

// 打开文件夹
ipcMain.handle(IPCChannels.OPEN_FOLDER, async (_event, folderPath: string): Promise<void> => {
  await shell.openPath(folderPath);
});

// 检查二进制文件是否存在
ipcMain.handle(IPCChannels.CHECK_BINARIES, async (): Promise<BinaryStatus> => {
  const ytDlpPath = getBinaryPath('yt-dlp');
  const ffmpegPath = getBinaryPath('ffmpeg');
  
  return {
    ytDlp: fs.existsSync(ytDlpPath),
    ffmpeg: fs.existsSync(ffmpegPath),
    paths: {
      ytDlp: ytDlpPath,
      ffmpeg: ffmpegPath
    }
  };
});
