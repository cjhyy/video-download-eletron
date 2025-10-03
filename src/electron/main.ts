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
  rateLimit?: string;
  useBrowserCookies?: boolean;
  browserPath?: string;
  cookieFile?: string;
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
  SELECT_COOKIE_FILE: 'select-cookie-file',
  COPY_COOKIE_FILE: 'copy-cookie-file',
  GET_VIDEO_INFO: 'get-video-info',
  DOWNLOAD_VIDEO: 'download-video',
  OPEN_FOLDER: 'open-folder',
  CHECK_BINARIES: 'check-binaries',
  UPDATE_YT_DLP: 'update-yt-dlp',
  DOWNLOAD_PROGRESS: 'download-progress',
  DOWNLOAD_ERROR: 'download-error',
  EXPORT_COOKIES: 'export-cookies',
  LOGIN_AND_GET_COOKIES: 'login-and-get-cookies',
  CLEAR_COOKIE_CACHE: 'clear-cookie-cache'
} as const;

// 保持对窗口对象的全局引用
let mainWindow: BrowserWindow | null = null;

// 获取Cookie缓存目录
function getCookieCacheDir(): string {
  const tempDir = app.getPath('temp');
  const cookieDir = path.join(tempDir, 'yt-dlp-cookie');
  
  // 确保目录存在
  if (!fs.existsSync(cookieDir)) {
    fs.mkdirSync(cookieDir, { recursive: true });
  }
  
  return cookieDir;
}

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
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    show: false
  });

  // 开发模式下加载Vite服务器，生产模式加载打包后的文件
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    // 开发模式下打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 当窗口被关闭时，取消引用窗口对象
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
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

// 选择Cookie文件
ipcMain.handle(IPCChannels.SELECT_COOKIE_FILE, async (): Promise<string | null> => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Cookie文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] }
    ],
    title: '选择Cookie文件'
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  
  return null;
});

// 复制Cookie文件到本地目录
ipcMain.handle(IPCChannels.COPY_COOKIE_FILE, async (_event, sourcePath: string, domain: string): Promise<{ success: boolean; cookieFile?: string; error?: string }> => {
  try {
    // 验证源文件是否存在
    if (!fs.existsSync(sourcePath)) {
      return { success: false, error: '源文件不存在' };
    }

    // 验证文件扩展名
    if (!sourcePath.toLowerCase().endsWith('.txt')) {
      return { success: false, error: '只支持.txt格式的Cookie文件' };
    }

    // 获取Cookie缓存目录
    const cookieDir = getCookieCacheDir();
    
    // 清理域名，生成目标文件名
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
    const targetPath = path.join(cookieDir, `${safeDomain}.txt`);

    // 复制文件
    fs.copyFileSync(sourcePath, targetPath);
    
    console.log(`[${new Date().toLocaleTimeString()}] Cookie文件已复制: ${sourcePath} -> ${targetPath}`);
    return { success: true, cookieFile: targetPath };
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] 复制Cookie文件失败:`, error);
    return { success: false, error: (error as Error).message };
  }
});

// 获取视频信息
ipcMain.handle(IPCChannels.GET_VIDEO_INFO, async (_event, url: string, useBrowserCookies?: boolean, browserPath?: string, cookieFile?: string): Promise<VideoInfo> => {
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
      '-v',
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
    
    // 如果启用了cookie，添加cookie参数
    if (cookieFile && fs.existsSync(cookieFile)) {
      // 使用cookie文件（推荐方式）
      args.push('--cookies', cookieFile);
      console.log(`[${new Date().toLocaleTimeString()}] 使用Cookie文件: ${cookieFile}`);
    } else if (useBrowserCookies && browserPath) {
      // 直接从浏览器读取，不指定配置文件路径，只使用浏览器名称
      // 这样yt-dlp会自动查找默认配置文件，并使用容器避免锁定
      args.push('--cookies-from-browser', 'chrome');
      console.log(`[${new Date().toLocaleTimeString()}] 从Chrome浏览器读取Cookie (使用默认配置)`);
      console.log(`[${new Date().toLocaleTimeString()}] 如果Chrome正在运行，yt-dlp会尝试使用容器访问Cookie`);
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
      
      // 过滤非关键警告
      if (chunk.includes('WARNING') && 
          (chunk.includes('SABR') || 
           chunk.includes('Some tv client') ||
           chunk.includes('have been skipped'))) {
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
          
          const result = {
            title: videoInfo.title,
            duration: videoInfo.duration,
            uploader: videoInfo.uploader,
            formats: videoInfo.formats?.map((f: any) => ({
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
              abr: f.abr
            })) || []
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
    const { url, outputPath, format, audioOnly, rateLimit, useBrowserCookies, browserPath, cookieFile } = options;
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
      '-v',
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

    // 如果启用了限流，添加限流参数
    if (rateLimit) {
      args.push('--limit-rate', rateLimit);
    }

    // 如果启用了cookie，添加cookie参数
    if (cookieFile && fs.existsSync(cookieFile)) {
      // 使用cookie文件（推荐方式）
      args.push('--cookies', cookieFile);
      console.log(`[${new Date().toLocaleTimeString()}] 使用Cookie文件: ${cookieFile}`);
    } else if (useBrowserCookies && browserPath) {
      // 直接从浏览器读取，不指定配置文件路径，只使用浏览器名称
      // 这样yt-dlp会自动查找默认配置文件，并使用容器避免锁定
      args.push('--cookies-from-browser', 'chrome');
      console.log(`[${new Date().toLocaleTimeString()}] 从Chrome浏览器读取Cookie (使用默认配置)`);
      console.log(`[${new Date().toLocaleTimeString()}] 如果Chrome正在运行，yt-dlp会尝试使用容器访问Cookie`);
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
      
      // 过滤掉非关键警告信息
      if (error.includes('WARNING') && 
          (error.includes('SABR') || 
           error.includes('Some tv client') ||
           error.includes('have been skipped'))) {
        // 这些是YouTube的实验性警告，不影响下载，只记录到控制台
        console.log(`[${new Date().toLocaleTimeString()}] yt-dlp警告: ${error.trim()}`);
        return;
      }
      
      // 只发送真正的错误
      if (error.includes('ERROR')) {
        event.sender.send(IPCChannels.DOWNLOAD_ERROR, error);
      }
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

// 更新 yt-dlp
ipcMain.handle(IPCChannels.UPDATE_YT_DLP, async (): Promise<{ success: boolean; message?: string; error?: string }> => {
  return new Promise((resolve) => {
    const ytDlpPath = getBinaryPath('yt-dlp');
    
    if (!fs.existsSync(ytDlpPath)) {
      resolve({ success: false, error: 'yt-dlp 未找到' });
      return;
    }
    
    console.log(`[${new Date().toLocaleTimeString()}] 开始更新 yt-dlp...`);
    console.log(`[${new Date().toLocaleTimeString()}] yt-dlp 路径: ${ytDlpPath}`);
    
    // 使用 -U 或 --update 参数更新
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
        // 检查输出判断是否已经是最新版本
        if (stdout.includes('already up to date') || stdout.includes('已是最新版本')) {
          resolve({ 
            success: true, 
            message: 'yt-dlp 已经是最新版本' 
          });
        } else if (stdout.includes('Updated') || stdout.includes('更新成功')) {
          resolve({ 
            success: true, 
            message: 'yt-dlp 更新成功！' 
          });
        } else {
          resolve({ 
            success: true, 
            message: stdout.trim() || 'yt-dlp 更新完成' 
          });
        }
      } else {
        const errorMsg = stderr || stdout || '更新失败';
        console.error(`[${new Date().toLocaleTimeString()}] yt-dlp 更新失败: ${errorMsg}`);
        
        // 检查是否是因为没有权限
        if (errorMsg.includes('Permission denied') || errorMsg.includes('权限')) {
          resolve({ 
            success: false, 
            error: '更新失败：权限不足。请尝试以管理员身份运行应用。' 
          });
        } else {
          resolve({ 
            success: false, 
            error: `更新失败: ${errorMsg}` 
          });
        }
      }
    });
    
    childProcess.on('error', (error: Error) => {
      console.error(`[${new Date().toLocaleTimeString()}] yt-dlp 更新进程错误:`, error);
      resolve({ 
        success: false, 
        error: `更新进程错误: ${error.message}` 
      });
    });
  });
});

// 导出Chrome Cookies
ipcMain.handle(IPCChannels.EXPORT_COOKIES, async (): Promise<{ success: boolean; cookieFile?: string; error?: string }> => {
  return new Promise((resolve) => {
    const ytDlpPath = getBinaryPath('yt-dlp');
    
    if (!fs.existsSync(ytDlpPath)) {
      resolve({ success: false, error: 'yt-dlp未找到' });
      return;
    }
    
    // 在临时目录创建cookie文件
    const tempDir = app.getPath('temp');
    const cookieFile = path.join(tempDir, 'yt-dlp-cookies.txt');
    
    console.log(`[${new Date().toLocaleTimeString()}] 开始导出Chrome Cookies到: ${cookieFile}`);
    
    // 使用yt-dlp的--cookies-from-browser功能导出cookies
    // 然后使用--cookies选项来使用导出的cookies
    const args = [
      '-v',
      '--cookies-from-browser', 'chrome',
      '--cookies', cookieFile,
      '--print', 'cookies_exported',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ' // 使用一个测试URL
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
    
    // 设置超时
    setTimeout(() => {
      childProcess.kill('SIGKILL');
      resolve({ success: false, error: 'Cookie导出超时（30秒）' });
    }, 30000);
  });
});

// 登录并获取Cookies
ipcMain.handle(IPCChannels.LOGIN_AND_GET_COOKIES, async (_event, url: string, domain: string): Promise<{ success: boolean; cookieFile?: string; error?: string }> => {
  return new Promise((resolve) => {
    // 创建登录窗口
    const loginWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        session: require('electron').session.defaultSession
      },
      title: '登录以获取Cookie - 登录成功后请关闭此窗口',
      autoHideMenuBar: true
    });

    loginWindow.loadURL(url);

    let resolved = false;

    // 当窗口关闭时提取cookies
    loginWindow.on('closed', async () => {
      if (resolved) return;
      resolved = true;

      try {
        // 获取所有cookies
        const cookies = await require('electron').session.defaultSession.cookies.get({});
        
        console.log(`[${new Date().toLocaleTimeString()}] 获取到 ${cookies.length} 个Cookie`);
        
        if (cookies.length === 0) {
          resolve({ success: false, error: '未获取到Cookie，请确保已完成登录' });
          return;
        }

        // 将cookies保存为Netscape格式，使用专门的Cookie目录
        const cookieDir = getCookieCacheDir();
        // 清理域名，移除特殊字符
        const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '-').toLowerCase();
        const cookieFile = path.join(cookieDir, `${safeDomain}.txt`);
        
        // Netscape格式：domain flag path secure expiration name value
        let cookieContent = '# Netscape HTTP Cookie File\n';
        cookieContent += '# This is a generated file! Do not edit.\n\n';
        
        cookies.forEach(cookie => {
          const domain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;
          const flag = 'TRUE';
          const cookiePath = cookie.path || '/';
          const secure = cookie.secure ? 'TRUE' : 'FALSE';
          const expiration = cookie.expirationDate ? Math.floor(cookie.expirationDate) : '0';
          const name = cookie.name;
          const value = cookie.value;
          
          cookieContent += `${domain}\t${flag}\t${cookiePath}\t${secure}\t${expiration}\t${name}\t${value}\n`;
        });

        fs.writeFileSync(cookieFile, cookieContent, 'utf8');
        console.log(`[${new Date().toLocaleTimeString()}] Cookie文件已创建: ${cookieFile}`);
        console.log(`[${new Date().toLocaleTimeString()}] Cookie内容长度: ${cookieContent.length} 字符`);
        
        resolve({ success: true, cookieFile });
      } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Cookie提取失败:`, error);
        resolve({ success: false, error: (error as Error).message });
      }
    });

    // 添加一个提示页面
    loginWindow.webContents.on('did-finish-load', () => {
      loginWindow.webContents.executeJavaScript(`
        // 添加一个浮动提示
        const hint = document.createElement('div');
        hint.innerHTML = '<div style="position:fixed;top:10px;right:10px;background:#4caf50;color:white;padding:15px 20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.2);z-index:999999;font-family:Arial;font-size:14px;">✅ 登录成功后请关闭此窗口以保存Cookie</div>';
        document.body.appendChild(hint);
      `).catch(() => {
        // 某些页面可能不允许执行脚本，忽略错误
      });
    });
  });
});

// 清除Cookie缓存
ipcMain.handle(IPCChannels.CLEAR_COOKIE_CACHE, async (): Promise<{ success: boolean; message?: string; error?: string }> => {
  try {
    const cookieDir = getCookieCacheDir();
    
    if (!fs.existsSync(cookieDir)) {
      return { success: true, message: 'Cookie缓存目录不存在，无需清理' };
    }

    // 读取目录中的所有文件
    const files = fs.readdirSync(cookieDir);
    let deletedCount = 0;

    // 删除所有 .txt 文件
    for (const file of files) {
      if (file.endsWith('.txt')) {
        const filePath = path.join(cookieDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`[${new Date().toLocaleTimeString()}] 已删除Cookie文件: ${file}`);
        } catch (err) {
          console.error(`[${new Date().toLocaleTimeString()}] 删除文件失败: ${file}`, err);
        }
      }
    }

    const message = deletedCount > 0 
      ? `成功清除 ${deletedCount} 个Cookie缓存文件` 
      : 'Cookie缓存目录为空';
    
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
    return { success: true, message };
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] 清除Cookie缓存失败:`, error);
    return { success: false, error: (error as Error).message };
  }
});
