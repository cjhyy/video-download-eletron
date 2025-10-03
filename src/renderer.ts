// 类型定义
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

interface DownloadProgress {
  percent: number;
  size?: string;
  speed?: string;
  status?: 'downloading' | 'completed' | 'error';
}

interface BinaryStatus {
  ytDlp: boolean;
  ffmpeg: boolean;
  paths: {
    ytDlp: string;
    ffmpeg: string;
  };
}

interface ElectronAPI {
  selectDownloadDirectory: () => Promise<string | null>;
  getVideoInfo: (url: string, useBrowserCookies?: boolean, browserPath?: string, cookieFile?: string) => Promise<VideoInfo>;
  downloadVideo: (options: DownloadOptions) => Promise<{ success: boolean }>;
  openFolder: (folderPath: string) => Promise<void>;
  checkBinaries: () => Promise<BinaryStatus>;
  exportCookies: () => Promise<{ success: boolean; cookieFile?: string; error?: string }>;
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void;
  onDownloadError: (callback: (error: string) => void) => void;
  removeAllListeners: (channel: string) => void;
}

// 扩展 Window 接口
interface Window {
  electronAPI: ElectronAPI;
}

// DOM 元素接口
interface DOMElements {
  // 状态相关
  ytdlpStatus: HTMLElement;
  ffmpegStatus: HTMLElement;
  
  // 输入相关
  videoUrl: HTMLInputElement;
  getInfoBtn: HTMLButtonElement;
  useBrowserCookies: HTMLInputElement;
  cookieInput: HTMLElement;
  browserPath: HTMLInputElement;
  cookieFile: HTMLInputElement;
  selectCookieFileBtn: HTMLButtonElement;
  autoExportCookiesBtn: HTMLButtonElement;
  
  // 视频信息
  videoInfo: HTMLElement;
  videoTitle: HTMLElement;
  videoUploader: HTMLElement;
  videoDuration: HTMLElement;
  
  // 下载选项
  downloadOptions: HTMLElement;
  downloadPath: HTMLInputElement;
  selectPathBtn: HTMLButtonElement;
  openFolderBtn: HTMLButtonElement;
  videoFormat: HTMLSelectElement;
  enableRateLimit: HTMLInputElement;
  rateLimit: HTMLInputElement;
  downloadBtn: HTMLButtonElement;
  
  // 进度相关
  progressSection: HTMLElement;
  progressFill: HTMLElement;
  progressText: HTMLElement;
  downloadSize: HTMLElement;
  downloadSpeed: HTMLElement;
  progressStatus: HTMLElement;
  
  // 日志
  logContent: HTMLElement;
}

// 应用状态
class AppState {
  public currentVideoInfo: VideoInfo | null = null;
  public downloadPath = '';
  public isDownloading = false;

  constructor() {}
}

// 应用主类
class VideoDownloaderApp {
  private elements: DOMElements;
  private state: AppState;

  constructor() {
    this.state = new AppState();
    this.elements = this.initializeElements();
    this.setupEventListeners();
    this.initApp();
  }

  private initializeElements(): DOMElements {
    const getElementById = (id: string): HTMLElement => {
      const element = document.getElementById(id);
      if (!element) {
        throw new Error(`Element with id '${id}' not found`);
      }
      return element;
    };

    return {
      // 状态相关
      ytdlpStatus: getElementById('ytdlpStatus'),
      ffmpegStatus: getElementById('ffmpegStatus'),
      
      // 输入相关
      videoUrl: getElementById('videoUrl') as HTMLInputElement,
      getInfoBtn: getElementById('getInfoBtn') as HTMLButtonElement,
      useBrowserCookies: getElementById('useBrowserCookies') as HTMLInputElement,
      cookieInput: getElementById('cookieInput'),
      browserPath: getElementById('browserPath') as HTMLInputElement,
      cookieFile: getElementById('cookieFile') as HTMLInputElement,
      selectCookieFileBtn: getElementById('selectCookieFileBtn') as HTMLButtonElement,
      autoExportCookiesBtn: getElementById('autoExportCookiesBtn') as HTMLButtonElement,
      
      // 视频信息
      videoInfo: getElementById('videoInfo'),
      videoTitle: getElementById('videoTitle'),
      videoUploader: getElementById('videoUploader'),
      videoDuration: getElementById('videoDuration'),
      
      // 下载选项
      downloadOptions: getElementById('downloadOptions'),
      downloadPath: getElementById('downloadPath') as HTMLInputElement,
      selectPathBtn: getElementById('selectPathBtn') as HTMLButtonElement,
      openFolderBtn: getElementById('openFolderBtn') as HTMLButtonElement,
      videoFormat: getElementById('videoFormat') as HTMLSelectElement,
      enableRateLimit: getElementById('enableRateLimit') as HTMLInputElement,
      rateLimit: getElementById('rateLimit') as HTMLInputElement,
      downloadBtn: getElementById('downloadBtn') as HTMLButtonElement,
      
      // 进度相关
      progressSection: getElementById('progressSection'),
      progressFill: getElementById('progressFill'),
      progressText: getElementById('progressText'),
      downloadSize: getElementById('downloadSize'),
      downloadSpeed: getElementById('downloadSpeed'),
      progressStatus: getElementById('progressStatus'),
      
      // 日志
      logContent: getElementById('logContent')
    };
  }

  private setupEventListeners(): void {
    // 按钮事件
    this.elements.getInfoBtn.addEventListener('click', () => this.getVideoInfo());
    this.elements.selectPathBtn.addEventListener('click', () => this.selectDownloadPath());
    this.elements.openFolderBtn.addEventListener('click', () => this.openFolder());
    this.elements.downloadBtn.addEventListener('click', () => this.startDownload());

    // 回车键获取视频信息
    this.elements.videoUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.getVideoInfo();
      }
    });

    // 下载类型切换
    document.querySelectorAll('input[name="downloadType"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const formatGroup = document.getElementById('formatGroup');
        if (formatGroup) {
          formatGroup.style.display = target.value === 'audio' ? 'none' : 'block';
        }
      });
    });

    // 限流勾选框切换
    this.elements.enableRateLimit.addEventListener('change', () => {
      const rateLimitGroup = document.getElementById('rateLimitGroup');
      if (rateLimitGroup) {
        rateLimitGroup.style.display = this.elements.enableRateLimit.checked ? 'block' : 'none';
      }
    });

    // Cookie勾选框切换
    this.elements.useBrowserCookies.addEventListener('change', () => {
      this.elements.cookieInput.style.display = this.elements.useBrowserCookies.checked ? 'block' : 'none';
    });

    // Cookie方法切换
    document.querySelectorAll('input[name="cookieMethod"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const browserCookieInput = document.getElementById('browserCookieInput');
        const fileCookieInput = document.getElementById('fileCookieInput');
        if (browserCookieInput && fileCookieInput) {
          browserCookieInput.style.display = target.value === 'browser' ? 'block' : 'none';
          fileCookieInput.style.display = target.value === 'file' ? 'block' : 'none';
        }
      });
    });

    // Cookie文件选择按钮
    this.elements.selectCookieFileBtn.addEventListener('click', async () => {
      try {
        const selectedPath = await window.electronAPI.selectDownloadDirectory();
        if (selectedPath) {
          // 注意：这里selectDownloadDirectory实际上只能选择目录
          // 如果需要选择文件，需要添加新的IPC方法
          this.elements.cookieFile.value = selectedPath;
          this.addLog(`Cookie文件路径已设置: ${selectedPath}`, 'success');
        }
      } catch (error) {
        this.addLog(`选择Cookie文件失败: ${(error as Error).message}`, 'error');
      }
    });

    // 自动导出Cookie按钮
    this.elements.autoExportCookiesBtn.addEventListener('click', () => this.autoExportCookies());

    // 监听下载进度
    window.electronAPI.onDownloadProgress((progress: DownloadProgress) => {
      this.updateProgress(progress);
    });

    // 监听下载错误
    window.electronAPI.onDownloadError((error: string) => {
      this.addLog(`下载错误: ${error}`, 'error');
    });
  }

  // 工具函数
  private addLog(message: string, type: 'info' | 'error' | 'success' = 'info'): void {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    this.elements.logContent.appendChild(logEntry);
    this.elements.logContent.scrollTop = this.elements.logContent.scrollHeight;
  }

  private formatDuration(seconds?: number): string {
    if (!seconds) return '未知';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  private formatFileSize(bytes?: number): string {
    if (!bytes) return '未知';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  // 初始化应用
  private async initApp(): Promise<void> {
    this.addLog('正在检查系统依赖...');
    
    try {
      const binaryStatus = await window.electronAPI.checkBinaries();
      
      // 更新 yt-dlp 状态
      if (binaryStatus.ytDlp) {
        this.elements.ytdlpStatus.textContent = '✅ 已就绪';
        this.elements.ytdlpStatus.className = 'status-indicator success';
      } else {
        this.elements.ytdlpStatus.textContent = '❌ 未找到';
        this.elements.ytdlpStatus.className = 'status-indicator error';
        this.addLog(`yt-dlp 二进制文件未找到: ${binaryStatus.paths.ytDlp}`, 'error');
      }
      
      // 更新 ffmpeg 状态
      if (binaryStatus.ffmpeg) {
        this.elements.ffmpegStatus.textContent = '✅ 已就绪';
        this.elements.ffmpegStatus.className = 'status-indicator success';
      } else {
        this.elements.ffmpegStatus.textContent = '❌ 未找到';
        this.elements.ffmpegStatus.className = 'status-indicator error';
        this.addLog(`ffmpeg 二进制文件未找到: ${binaryStatus.paths.ffmpeg}`, 'error');
      }
      
      // 检查是否都可用
      if (binaryStatus.ytDlp && binaryStatus.ffmpeg) {
        this.addLog('所有依赖检查通过，应用可以正常使用', 'success');
      } else {
        this.addLog('部分依赖缺失，请确保二进制文件已正确放置', 'error');
      }
      
    } catch (error) {
      this.addLog(`依赖检查失败: ${(error as Error).message}`, 'error');
    }
  }

  // 获取视频信息
  private async getVideoInfo(): Promise<void> {
    const url = this.elements.videoUrl.value.trim();
    
    if (!url) {
      this.addLog('请输入视频链接', 'error');
      return;
    }
    
    this.elements.getInfoBtn.disabled = true;
    this.elements.getInfoBtn.textContent = '获取中...';
    
    const startTime = Date.now();
    this.addLog(`正在获取视频信息: ${url}`);
    console.log(`[${new Date().toLocaleTimeString()}] 渲染进程开始请求视频信息: ${url}`);
    
    try {
      this.addLog('正在调用 yt-dlp 获取视频详情...', 'info');
      const useBrowserCookies = this.elements.useBrowserCookies.checked;
      const cookieMethodElement = document.querySelector('input[name="cookieMethod"]:checked') as HTMLInputElement;
      const cookieMethod = cookieMethodElement?.value || 'browser';
      const browserPath = this.elements.browserPath.value.trim();
      const cookieFile = this.elements.cookieFile.value.trim();
      
      if (useBrowserCookies) {
        if (cookieMethod === 'file' && cookieFile) {
          this.addLog(`使用Cookie文件: ${cookieFile}`, 'info');
        } else {
          this.addLog(`从Chrome浏览器读取Cookie (自动检测)`, 'info');
        }
      }
      
      this.state.currentVideoInfo = await window.electronAPI.getVideoInfo(
        url, 
        useBrowserCookies && cookieMethod === 'browser', 
        browserPath,
        cookieMethod === 'file' ? cookieFile : undefined
      );
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      console.log(`[${new Date().toLocaleTimeString()}] 渲染进程收到视频信息，总耗时: ${duration}ms`);
      this.addLog(`视频信息获取完成，耗时: ${(duration / 1000).toFixed(1)}秒`, 'success');
      
      // 显示视频信息
      this.elements.videoTitle.textContent = this.state.currentVideoInfo.title || '未知';
      this.elements.videoUploader.textContent = this.state.currentVideoInfo.uploader || '未知';
      this.elements.videoDuration.textContent = this.formatDuration(this.state.currentVideoInfo.duration);
      
      // 填充格式选择
      this.elements.videoFormat.innerHTML = '<option value="">自动选择最佳质量</option>';
      if (this.state.currentVideoInfo.formats && this.state.currentVideoInfo.formats.length > 0) {
        this.state.currentVideoInfo.formats
          .filter(f => f.ext && f.format_note)
          .slice(0, 10) // 限制显示数量
          .forEach(format => {
            const option = document.createElement('option');
            option.value = format.format_id;
            option.textContent = `${format.ext.toUpperCase()} - ${format.format_note} ${format.filesize ? `(${this.formatFileSize(format.filesize)})` : ''}`;
            this.elements.videoFormat.appendChild(option);
          });
      }
      
      // 显示相关区域
      this.elements.videoInfo.style.display = 'block';
      this.elements.downloadOptions.style.display = 'block';
      
      this.addLog('视频信息获取成功', 'success');
      
    } catch (error) {
      this.addLog(`获取视频信息失败: ${(error as Error).message}`, 'error');
    } finally {
      this.elements.getInfoBtn.disabled = false;
      this.elements.getInfoBtn.textContent = '获取信息';
    }
  }

  // 自动导出Cookie
  private async autoExportCookies(): Promise<void> {
    this.elements.autoExportCookiesBtn.disabled = true;
    this.elements.autoExportCookiesBtn.textContent = '导出中...';
    this.addLog('开始自动导出Chrome Cookies...', 'info');
    
    try {
      const result = await window.electronAPI.exportCookies();
      
      if (result.success && result.cookieFile) {
        this.elements.cookieFile.value = result.cookieFile;
        // 自动切换到文件模式
        const fileRadio = document.querySelector('input[name="cookieMethod"][value="file"]') as HTMLInputElement;
        if (fileRadio) {
          fileRadio.checked = true;
          fileRadio.dispatchEvent(new Event('change'));
        }
        this.addLog(`Cookie导出成功: ${result.cookieFile}`, 'success');
        this.addLog('已自动切换到"Cookie文件"模式', 'success');
      } else {
        this.addLog(`Cookie导出失败: ${result.error || '未知错误'}`, 'error');
        if (result.error && result.error.includes('Could not copy')) {
          this.addLog('提示: 请先关闭所有Chrome浏览器窗口，然后重试', 'error');
        }
      }
    } catch (error) {
      this.addLog(`Cookie导出失败: ${(error as Error).message}`, 'error');
    } finally {
      this.elements.autoExportCookiesBtn.disabled = false;
      this.elements.autoExportCookiesBtn.textContent = '🚀 自动导出Cookie';
    }
  }

  // 选择下载路径
  private async selectDownloadPath(): Promise<void> {
    try {
      const selectedPath = await window.electronAPI.selectDownloadDirectory();
      if (selectedPath) {
        this.state.downloadPath = selectedPath;
        this.elements.downloadPath.value = selectedPath;
        this.elements.openFolderBtn.style.display = 'inline-flex';
        this.elements.downloadBtn.disabled = false;
        this.addLog(`下载路径已设置: ${selectedPath}`, 'success');
      }
    } catch (error) {
      this.addLog(`选择下载路径失败: ${(error as Error).message}`, 'error');
    }
  }

  // 打开文件夹
  private async openFolder(): Promise<void> {
    if (this.state.downloadPath) {
      try {
        await window.electronAPI.openFolder(this.state.downloadPath);
      } catch (error) {
        this.addLog(`打开文件夹失败: ${(error as Error).message}`, 'error');
      }
    }
  }

  // 开始下载
  private async startDownload(): Promise<void> {
    if (!this.state.currentVideoInfo || !this.state.downloadPath) {
      this.addLog('请先获取视频信息并选择下载路径', 'error');
      return;
    }
    
    const downloadTypeElement = document.querySelector('input[name="downloadType"]:checked') as HTMLInputElement;
    const downloadType = downloadTypeElement?.value || 'video';
    const selectedFormat = this.elements.videoFormat.value;
    
    const cookieMethodElement = document.querySelector('input[name="cookieMethod"]:checked') as HTMLInputElement;
    const cookieMethod = cookieMethodElement?.value || 'browser';
    const useBrowserCookies = this.elements.useBrowserCookies.checked;
    
    const downloadOptions: DownloadOptions = {
      url: this.elements.videoUrl.value.trim(),
      outputPath: this.state.downloadPath,
      format: selectedFormat,
      audioOnly: downloadType === 'audio',
      rateLimit: this.elements.enableRateLimit.checked ? this.elements.rateLimit.value.trim() : undefined,
      useBrowserCookies: useBrowserCookies && cookieMethod === 'browser',
      browserPath: this.elements.browserPath.value.trim(),
      cookieFile: cookieMethod === 'file' ? this.elements.cookieFile.value.trim() : undefined
    };
    
    this.state.isDownloading = true;
    this.elements.downloadBtn.disabled = true;
    this.elements.downloadBtn.innerHTML = '<span class="btn-text">下载中...</span><span class="btn-icon">⏳</span>';
    this.elements.progressSection.style.display = 'block';
    this.elements.progressStatus.textContent = '准备下载...';
    
    this.addLog(`开始下载: ${this.state.currentVideoInfo.title}`, 'info');
    this.addLog(`下载类型: ${downloadType === 'audio' ? '音频' : '视频'}`, 'info');
    if (this.elements.enableRateLimit.checked && this.elements.rateLimit.value.trim()) {
      this.addLog(`限流设置: ${this.elements.rateLimit.value.trim()}`, 'info');
    }
    if (useBrowserCookies) {
      if (cookieMethod === 'file' && downloadOptions.cookieFile) {
        this.addLog(`使用Cookie文件: ${downloadOptions.cookieFile}`, 'info');
      } else {
        this.addLog(`从Chrome浏览器读取Cookie`, 'info');
      }
    }
    
    try {
      await window.electronAPI.downloadVideo(downloadOptions);
      this.addLog('下载完成！', 'success');
      this.elements.progressStatus.textContent = '下载完成';
      this.elements.downloadBtn.innerHTML = '<span class="btn-text">下载完成</span><span class="btn-icon">✅</span>';
    } catch (error) {
      this.addLog(`下载失败: ${(error as Error).message}`, 'error');
      this.elements.progressStatus.textContent = '下载失败';
      this.elements.downloadBtn.innerHTML = '<span class="btn-text">下载失败</span><span class="btn-icon">❌</span>';
    } finally {
      this.state.isDownloading = false;
      setTimeout(() => {
        this.elements.downloadBtn.disabled = false;
        this.elements.downloadBtn.innerHTML = '<span class="btn-text">开始下载</span><span class="btn-icon">⬇️</span>';
      }, 3000);
    }
  }

  // 更新进度显示
  private updateProgress(progress: DownloadProgress): void {
    if (progress.percent !== undefined) {
      this.elements.progressFill.style.width = `${progress.percent}%`;
      this.elements.progressText.textContent = `${progress.percent.toFixed(1)}%`;
    }
    
    if (progress.size) {
      this.elements.downloadSize.textContent = `大小: ${progress.size}`;
    }
    
    if (progress.speed) {
      this.elements.downloadSpeed.textContent = `速度: ${progress.speed}`;
    }
    
    if (progress.status === 'completed') {
      this.elements.progressStatus.textContent = '下载完成';
    }
  }
}

// 页面加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
  new VideoDownloaderApp();
});
