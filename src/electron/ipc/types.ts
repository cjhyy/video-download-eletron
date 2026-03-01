/**
 * IPC 处理器参数类型定义
 * 将所有多参数接口统一为对象参数，便于扩展和测试
 */

/** 获取视频信息参数 */
export interface GetVideoInfoParams {
  url: string;
  useBrowserCookies?: boolean;
  browserPath?: string;
  cookieFile?: string;
}

/** 获取播放列表信息参数 */
export interface GetPlaylistInfoParams {
  url: string;
  cookieFile?: string;
  useBrowserCookies?: boolean;
  browserPath?: string;
  playlistEnd?: number;
}

/** 用户设置更新参数 */
export interface UserSettingsUpdateParams {
  gpuCompatEnabled?: boolean;
  closeToTray?: boolean;
}
