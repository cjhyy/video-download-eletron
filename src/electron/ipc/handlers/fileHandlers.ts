import { dialog, shell, type BrowserWindow, type OpenDialogOptions } from 'electron';
import * as fs from 'fs';
import { validateSafeDirPath, validateSafeFilePath } from '../validate';

/** 文件选择配置 */
interface FileSelectConfig {
  title: string;
  filters: { name: string; extensions: string[] }[];
}

/** 预定义的文件选择配置 */
const FILE_SELECT_CONFIGS = {
  cookie: {
    title: '选择Cookie文件',
    filters: [
      { name: 'Cookie文件', extensions: ['txt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  },
  video: {
    title: '选择视频文件',
    filters: [
      { name: '视频文件', extensions: ['mp4', 'mkv', 'webm', 'mov', 'm4v'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  },
  subtitle: {
    title: '选择字幕文件',
    filters: [
      { name: '字幕文件', extensions: ['srt', 'vtt'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  },
} as const;

/**
 * 文件操作相关的 IPC 处理器
 * 独立于 IPC 层，便于单元测试
 */
export class FileHandlers {
  constructor(private getMainWindow: () => BrowserWindow | null) {}

  /**
   * 通用文件选择方法
   * @param options Electron OpenDialogOptions
   */
  private async selectPath(options: OpenDialogOptions): Promise<string | null> {
    const mainWindow = this.getMainWindow();
    if (!mainWindow) return null;

    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0];
  }

  /**
   * 通用文件选择方法（使用预定义配置）
   */
  private async selectFile(config: FileSelectConfig): Promise<string | null> {
    return this.selectPath({
      properties: ['openFile'],
      title: config.title,
      filters: config.filters,
    });
  }

  /** 选择下载目录 */
  async selectDownloadDirectory(): Promise<string | null> {
    return this.selectPath({ properties: ['openDirectory'] });
  }

  /** 选择 Cookie 文件 */
  async selectCookieFile(): Promise<string | null> {
    return this.selectFile(FILE_SELECT_CONFIGS.cookie);
  }

  /** 选择视频文件 */
  async selectVideoFile(): Promise<string | null> {
    return this.selectFile(FILE_SELECT_CONFIGS.video);
  }

  /** 选择字幕文件 */
  async selectSubtitleFile(): Promise<string | null> {
    return this.selectFile(FILE_SELECT_CONFIGS.subtitle);
  }

  /** 读取文本文件（带安全验证） */
  readTextFile(filePath: string): string {
    const safePath = validateSafeFilePath(filePath, 'filePath');
    return fs.readFileSync(safePath, 'utf8');
  }

  /** 打开文件夹（带安全验证） */
  async openFolder(folderPath: string): Promise<void> {
    const safePath = validateSafeDirPath(folderPath, 'folderPath');
    await shell.openPath(safePath);
  }

  /** 在文件管理器中显示并选中文件 */
  showItemInFolder(filePath: string): void {
    const safePath = validateSafeFilePath(filePath, 'filePath');
    shell.showItemInFolder(safePath);
  }
}
