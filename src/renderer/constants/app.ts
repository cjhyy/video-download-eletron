/**
 * 应用常量配置
 * 集中管理硬编码值，便于维护和修改
 */

// 队列相关配置
export const QUEUE_CONFIG = {
  /** 默认最大并发下载数 */
  DEFAULT_MAX_CONCURRENT: 3,
  /** 最小并发数 */
  MIN_CONCURRENT: 1,
  /** 最大并发数 */
  MAX_CONCURRENT: 10,
  /** 任务日志最大行数 */
  MAX_LOG_LINES: 200,
  /** 任务完成后保留的日志行数 */
  COMPLETED_LOG_RETENTION: 20,
  /** 默认最大重试次数 */
  DEFAULT_MAX_RETRIES: 3,
  /** 调度延迟（毫秒） */
  SCHEDULE_DELAY_MS: 200,
} as const;

// 播放列表相关配置
export const PLAYLIST_CONFIG = {
  /** 虚拟列表项高度 */
  ITEM_HEIGHT: 72,
  /** 虚拟列表容器高度 */
  LIST_HEIGHT: 288,
  /** 最大播放列表项数 */
  MAX_ITEMS: 1000,
  /** 默认前 N 条限制 */
  DEFAULT_PLAYLIST_END: undefined,
} as const;

// 验证相关配置
export const VALIDATION_CONFIG = {
  /** URL 最大长度 */
  URL_MAX_LENGTH: 2048,
  /** 路径最大长度 */
  PATH_MAX_LENGTH: 260,
  /** 文件名最大长度 */
  FILENAME_MAX_LENGTH: 255,
} as const;

// UI 相关配置
export const UI_CONFIG = {
  /** 防抖延迟（毫秒） */
  DEBOUNCE_DELAY_MS: 300,
  /** Toast 显示时长（毫秒） */
  TOAST_DURATION_MS: 3000,
  /** 日志滚动区域高度 */
  LOG_SCROLL_HEIGHT: 160,
  /** 滚动区域高度 */
  SCROLL_AREA_HEIGHT: 288,
} as const;

// 下载格式相关
export const FORMAT_CONFIG = {
  /** 最佳质量格式 */
  BEST_QUALITY_FORMAT: 'bestvideo+bestaudio/best',
  /** 默认字幕语言 */
  DEFAULT_SUB_LANGS: 'en.*',
} as const;

// 网络相关配置
export const NETWORK_CONFIG = {
  /** 默认重试次数 */
  DEFAULT_RETRIES: 1,
  /** 重试延迟（毫秒） */
  RETRY_DELAY_MS: 0,
} as const;

// 存储版本
export const STORAGE_VERSION = {
  CONFIG: 1,
  QUEUE: 1,
  DOWNLOAD_PAGE: 1,
  LEARNING: 1,
} as const;

// 存储键名
export const STORAGE_KEYS = {
  CONFIG: 'appConfig',
  QUEUE: 'downloadQueue',
  DOWNLOAD_PAGE: 'downloadPageState',
  LEARNING: 'learningProjects',
} as const;
