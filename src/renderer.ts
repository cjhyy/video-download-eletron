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
  getVideoInfo: (url: string) => Promise<VideoInfo>;
  downloadVideo: (options: DownloadOptions) => Promise<{ success: boolean }>;
  openFolder: (folderPath: string) => Promise<void>;
  checkBinaries: () => Promise<BinaryStatus>;
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
      this.state.currentVideoInfo = await window.electronAPI.getVideoInfo(url);
      
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
    
    const downloadOptions: DownloadOptions = {
      url: this.elements.videoUrl.value.trim(),
      outputPath: this.state.downloadPath,
      format: selectedFormat,
      audioOnly: downloadType === 'audio'
    };
    
    this.state.isDownloading = true;
    this.elements.downloadBtn.disabled = true;
    this.elements.downloadBtn.innerHTML = '<span class="btn-text">下载中...</span><span class="btn-icon">⏳</span>';
    this.elements.progressSection.style.display = 'block';
    this.elements.progressStatus.textContent = '准备下载...';
    
    this.addLog(`开始下载: ${this.state.currentVideoInfo.title}`, 'info');
    this.addLog(`下载类型: ${downloadType === 'audio' ? '音频' : '视频'}`, 'info');
    
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
