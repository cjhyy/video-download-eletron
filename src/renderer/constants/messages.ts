/**
 * 用户提示消息常量
 * 集中管理所有用户提示，便于国际化和统一修改
 */

// 下载相关消息
export const DOWNLOAD_MESSAGES = {
  // 信息获取
  GETTING_INFO: '正在获取视频信息...',
  INFO_SUCCESS: '视频信息获取成功',
  INFO_FAILED: '获取视频信息失败',

  // 队列操作
  ADDED_TO_QUEUE: '已添加到下载队列',
  ADDED_ENTRIES_TO_QUEUE: (count: number) => `已加入队列：${count} 个条目`,

  // 播放列表
  PLAYLIST_EXPANDED: '列表已展开',
  PLAYLIST_EXPAND_FAILED: '展开失败',
  NO_ENTRIES_SELECTED: '请至少选择一个条目',
  EXPAND_FIRST: '请先展开列表',

  // 下载状态
  DOWNLOADING: '下载中…',
  DOWNLOAD_COMPLETED: '下载完成',
  DOWNLOAD_FAILED: '下载失败',
  DOWNLOAD_PAUSED: '已暂停',
  DOWNLOAD_CANCELLED: '已取消',
} as const;

// 验证相关消息
export const VALIDATION_MESSAGES = {
  // URL
  URL_REQUIRED: '请输入视频链接',
  URL_INVALID: '请输入有效的 URL 格式',
  URL_PROTOCOL: 'URL 必须以 http:// 或 https:// 开头',
  URL_TOO_LONG: 'URL 长度不能超过 2048 字符',

  // 路径
  PATH_REQUIRED: '请选择下载路径',
  PATH_TOO_LONG: '路径长度不能超过 260 字符',
  PATH_INVALID_CHARS: '路径包含非法字符',

  // 数字
  NUMBER_REQUIRED: '请输入数字',
  NUMBER_INVALID: '请输入有效的数字',
  INTEGER_REQUIRED: '请输入整数',
  NUMBER_MIN: (min: number) => `数字不能小于 ${min}`,
  NUMBER_MAX: (max: number) => `数字不能大于 ${max}`,

  // 播放列表
  PLAYLIST_ITEMS_INVALID: '格式无效，示例: 1-10,13,15',
  SUB_LANGS_INVALID: '格式无效，示例: en.*,zh.*',

  // 文件
  FILENAME_REQUIRED: '文件名不能为空',
  FILENAME_INVALID_CHARS: '文件名包含非法字符',
  FILENAME_TOO_LONG: '文件名长度不能超过 255 字符',
  FILENAME_RESERVED: '文件名是系统保留名称',
} as const;

// Cookie 相关消息
export const COOKIE_MESSAGES = {
  ENABLED: 'Cookie 已启用',
  DISABLED: 'Cookie 未启用',
  AUTO_SELECTED: (name: string, domain: string) => `已自动选择 Cookie：${name}（${domain}）`,
  EXTRACT_SUCCESS: (count: number) => `成功提取 ${count} 条 Cookie`,
  EXTRACT_FAILED: '提取 Cookie 失败',
  FILE_INVALID: '无效的 Cookie 文件',
  HINT_403: '如遇到 403 错误，请在 "Cookie 配置" 中配置 Cookie。',
} as const;

// 设置相关消息
export const SETTINGS_MESSAGES = {
  SAVED: '设置已保存',
  SAVE_FAILED: '保存设置失败',
  RESET_SUCCESS: '已恢复默认设置',
  PATH_SET: (path: string) => `下载路径已设置: ${path}`,
  VERSION_FETCH_FAILED: '获取版本失败',
  UPDATE_SUCCESS: (version: string) => `更新成功：${version}`,
  UPDATE_FAILED: '更新失败',
  ALREADY_LATEST: '已是最新版本',
} as const;

// 队列相关消息
export const QUEUE_MESSAGES = {
  EMPTY: '队列为空',
  EMPTY_HINT: '请在"视频下载"页面添加任务。',
  TASK_PAUSED: '任务已暂停',
  TASK_RESUMED: '任务已继续',
  TASK_REMOVED: '任务已移除',
  TASK_RETRIED: '任务已重试',
  CLEARED_COMPLETED: '已清除完成的任务',
  CLEARED_FAILED: '已清除失败的任务',
  RETRY_COUNT: (current: number, max: number) => `重试（${current}/${max}）`,
} as const;

// 错误码映射
export const ERROR_CODE_MESSAGES: Record<string, string> = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  TIMEOUT: '请求超时，请稍后重试',
  NOT_FOUND: '资源未找到',
  FORBIDDEN: '访问被拒绝，可能需要登录或配置 Cookie',
  RATE_LIMITED: '请求过于频繁，请稍后重试',
  INVALID_URL: '无效的视频链接',
  UNSUPPORTED_SITE: '不支持的网站',
  YTDLP_ERROR: 'yt-dlp 执行错误',
  FFMPEG_ERROR: 'FFmpeg 处理错误',
  FILE_WRITE_ERROR: '文件写入失败',
  PERMISSION_DENIED: '权限不足',
  DISK_FULL: '磁盘空间不足',
  UNKNOWN: '未知错误',
} as const;

// 状态文本
export const STATUS_TEXT = {
  pending: '等待中',
  downloading: '下载中',
  completed: '已完成',
  failed: '失败',
  paused: '已暂停',
} as const;
