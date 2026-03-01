/**
 * Single source of truth for IPC channel names.
 * Keep this file dependency-free so it can be imported by main/preload/renderer.
 */
export const IPCChannels = {
  SELECT_DOWNLOAD_DIRECTORY: 'select-download-directory',
  SELECT_COOKIE_FILE: 'select-cookie-file',
  SELECT_VIDEO_FILE: 'select-video-file',
  SELECT_SUBTITLE_FILE: 'select-subtitle-file',
  READ_TEXT_FILE: 'read-text-file',
  COPY_COOKIE_FILE: 'copy-cookie-file',
  GET_VIDEO_INFO: 'get-video-info',
  GET_PLAYLIST_INFO: 'get-playlist-info',
  GET_YTDLP_ARGS: 'get-ytdlp-args',
  SET_YTDLP_ARGS: 'set-ytdlp-args',
  DOWNLOAD_VIDEO: 'download-video',
  CANCEL_DOWNLOAD: 'cancel-download',
  OPEN_FOLDER: 'open-folder',
  CHECK_BINARIES: 'check-binaries',
  UPDATE_YT_DLP: 'update-yt-dlp',
  DOWNLOAD_PROGRESS: 'download-progress',
  DOWNLOAD_ERROR: 'download-error',
  DOWNLOAD_LOG: 'download-log',
  DOWNLOAD_DONE: 'download-done',
  GET_USER_SETTINGS: 'get-user-settings',
  SET_USER_SETTINGS: 'set-user-settings',
  EXPORT_COOKIES: 'export-cookies',
  LOGIN_AND_GET_COOKIES: 'login-and-get-cookies',
  CLEAR_COOKIE_CACHE: 'clear-cookie-cache',
  // Chrome Cookie 提取
  EXTRACT_BROWSER_COOKIES: 'extract-browser-cookies',
  DETECT_INSTALLED_BROWSERS: 'detect-installed-browsers',
  // Bilibili 扫码登录
  BILIBILI_GET_QR_CODE: 'bilibili-get-qr-code',
  BILIBILI_CHECK_QR_STATUS: 'bilibili-check-qr-status',
  // 下载二进制文件（精简版）
  DOWNLOAD_BINARY: 'download-binary',
  DOWNLOAD_BINARY_PROGRESS: 'download-binary-progress',
} as const;

export type IPCChannel = (typeof IPCChannels)[keyof typeof IPCChannels];


