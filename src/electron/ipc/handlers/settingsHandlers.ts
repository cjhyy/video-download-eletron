import type { BrowserWindow } from 'electron';
import { loadUserSettings, saveUserSettings, type UserSettings } from '../../lib/userSettings';
import { getYtDlpAdditionalArgs, setYtDlpAdditionalArgs } from '../../lib/config';
import { createTray, destroyTray } from '../../window/tray';
import { validateYtDlpArgs, validateUserSettingsUpdate } from '../validate';

/**
 * 设置相关操作的 IPC 处理器
 * 独立于 IPC 层，便于单元测试
 */
export class SettingsHandlers {
  constructor(private getMainWindow: () => BrowserWindow | null) {}

  /** 获取用户设置 */
  async getUserSettings(): Promise<UserSettings> {
    return loadUserSettings();
  }

  /** 更新用户设置 */
  async setUserSettings(updates: unknown): Promise<UserSettings> {
    const validated = validateUserSettingsUpdate(updates);

    const next = saveUserSettings({
      gpuCompatEnabled: validated.gpuCompatEnabled,
      closeToTray: validated.closeToTray,
    });

    // Keep tray state consistent with settings at runtime.
    if (validated.closeToTray === true) {
      createTray(this.getMainWindow);
    } else if (validated.closeToTray === false) {
      destroyTray();
    }

    return next;
  }

  /** 获取 yt-dlp 额外参数 */
  getYtDlpArgs(): string[] {
    return getYtDlpAdditionalArgs();
  }

  /** 设置 yt-dlp 额外参数 */
  setYtDlpArgs(additionalArgs: unknown): string[] {
    const validated = validateYtDlpArgs(additionalArgs);
    return setYtDlpAdditionalArgs(validated);
  }
}

// 注意：SettingsHandlers 需要 getMainWindow，所以不能导出静态单例
// 需要在 registerIpcHandlers 中实例化
