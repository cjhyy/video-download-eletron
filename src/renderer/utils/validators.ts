/**
 * 表单验证工具
 * 统一的验证函数，供各页面复用
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * URL 验证
 */
export const urlValidators = {
  /**
   * 验证视频 URL 是否有效
   */
  isValidVideoUrl(url: string): ValidationResult {
    if (!url || !url.trim()) {
      return { valid: false, error: '请输入视频链接' };
    }

    const trimmed = url.trim();

    // 基本 URL 格式检查
    try {
      new URL(trimmed);
    } catch {
      return { valid: false, error: '请输入有效的 URL 格式' };
    }

    // 检查是否为 http/https 协议
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      return { valid: false, error: 'URL 必须以 http:// 或 https:// 开头' };
    }

    // URL 长度限制
    if (trimmed.length > 2048) {
      return { valid: false, error: 'URL 长度不能超过 2048 字符' };
    }

    return { valid: true };
  },

  /**
   * 检查 URL 是否为支持的站点
   */
  isSupportedSite(url: string): ValidationResult {
    const result = this.isValidVideoUrl(url);
    if (!result.valid) return result;

    // 已知支持的站点域名模式
    const supportedPatterns = [
      /youtube\.com/i,
      /youtu\.be/i,
      /bilibili\.com/i,
      /b23\.tv/i,
      /vimeo\.com/i,
      /twitter\.com/i,
      /x\.com/i,
      /instagram\.com/i,
      /facebook\.com/i,
      /tiktok\.com/i,
      /douyin\.com/i,
      /twitch\.tv/i,
      /dailymotion\.com/i,
      /soundcloud\.com/i,
      /pornhub\.com/i,
      /xvideos\.com/i,
    ];

    const trimmed = url.trim();
    const isSupported = supportedPatterns.some((pattern) => pattern.test(trimmed));

    if (!isSupported) {
      return {
        valid: true, // 仍然允许尝试，因为 yt-dlp 支持很多站点
        error: '此站点可能不受支持，但仍可尝试下载',
      };
    }

    return { valid: true };
  },
};

/**
 * 路径验证
 */
export const pathValidators = {
  /**
   * 验证下载路径
   */
  isValidDownloadPath(path: string): ValidationResult {
    if (!path || !path.trim()) {
      return { valid: false, error: '请选择下载路径' };
    }

    // 路径长度限制
    if (path.length > 260) {
      return { valid: false, error: '路径长度不能超过 260 字符' };
    }

    // 检查是否包含非法字符（Windows）
    const invalidChars = /[<>"|?*]/;
    if (invalidChars.test(path)) {
      return { valid: false, error: '路径包含非法字符' };
    }

    return { valid: true };
  },

  /**
   * 验证 Cookie 文件路径
   */
  isValidCookieFilePath(path: string): ValidationResult {
    if (!path || !path.trim()) {
      return { valid: false, error: '请选择 Cookie 文件' };
    }

    // 检查扩展名
    const validExtensions = ['.txt', '.json', '.sqlite', '.db'];
    const hasValidExt = validExtensions.some((ext) =>
      path.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      return {
        valid: true,
        error: '文件扩展名不常见，可能不是有效的 Cookie 文件',
      };
    }

    return { valid: true };
  },
};

/**
 * 数字验证
 */
export const numberValidators = {
  /**
   * 验证数字输入
   */
  isValidNumber(
    value: any,
    options?: {
      min?: number;
      max?: number;
      integer?: boolean;
      allowEmpty?: boolean;
    }
  ): ValidationResult {
    const { min, max, integer = false, allowEmpty = false } = options || {};

    // 空值检查
    if (value === undefined || value === null || value === '') {
      if (allowEmpty) return { valid: true };
      return { valid: false, error: '请输入数字' };
    }

    const num = Number(value);

    // 检查是否为有效数字
    if (!Number.isFinite(num)) {
      return { valid: false, error: '请输入有效的数字' };
    }

    // 整数检查
    if (integer && !Number.isInteger(num)) {
      return { valid: false, error: '请输入整数' };
    }

    // 最小值检查
    if (min !== undefined && num < min) {
      return { valid: false, error: `数字不能小于 ${min}` };
    }

    // 最大值检查
    if (max !== undefined && num > max) {
      return { valid: false, error: `数字不能大于 ${max}` };
    }

    return { valid: true };
  },

  /**
   * 验证播放列表选集格式
   */
  isValidPlaylistItems(value: string): ValidationResult {
    if (!value || !value.trim()) {
      return { valid: true }; // 空值允许
    }

    const trimmed = value.trim();

    // 格式: 1-10,13,15 或 1,2,3 或 1-5
    const pattern = /^(\d+(-\d+)?)(,\s*\d+(-\d+)?)*$/;

    if (!pattern.test(trimmed)) {
      return {
        valid: false,
        error: '格式无效，示例: 1-10,13,15',
      };
    }

    return { valid: true };
  },

  /**
   * 验证并发数
   */
  isValidConcurrency(value: any): ValidationResult {
    return this.isValidNumber(value, { min: 1, max: 10, integer: true });
  },
};

/**
 * 字符串验证
 */
export const stringValidators = {
  /**
   * 验证字幕语言格式
   */
  isValidSubLangs(value: string): ValidationResult {
    if (!value || !value.trim()) {
      return { valid: true }; // 空值使用默认
    }

    const trimmed = value.trim();

    // 格式: en,zh 或 en.*,zh.* 等
    const pattern = /^[\w.*-]+(,\s*[\w.*-]+)*$/;

    if (!pattern.test(trimmed)) {
      return {
        valid: false,
        error: '格式无效，示例: en.*,zh.*',
      };
    }

    return { valid: true };
  },

  /**
   * 验证文件名
   */
  isValidFileName(value: string): ValidationResult {
    if (!value || !value.trim()) {
      return { valid: false, error: '文件名不能为空' };
    }

    const trimmed = value.trim();

    // 检查非法字符
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(trimmed)) {
      return { valid: false, error: '文件名包含非法字符' };
    }

    // 长度限制
    if (trimmed.length > 255) {
      return { valid: false, error: '文件名长度不能超过 255 字符' };
    }

    // 保留名称检查（Windows）
    const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
    if (reserved.test(trimmed)) {
      return { valid: false, error: '文件名是系统保留名称' };
    }

    return { valid: true };
  },
};

/**
 * 组合验证函数
 */
export function validateAll(
  validations: Array<() => ValidationResult>
): ValidationResult {
  for (const validate of validations) {
    const result = validate();
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/**
 * 下载表单验证
 */
export function validateDownloadForm(params: {
  videoUrl: string;
  downloadPath: string;
  playlistItems?: string;
  playlistEnd?: number | string;
}): ValidationResult {
  return validateAll([
    () => urlValidators.isValidVideoUrl(params.videoUrl),
    () => pathValidators.isValidDownloadPath(params.downloadPath),
    () => numberValidators.isValidPlaylistItems(params.playlistItems || ''),
    () =>
      numberValidators.isValidNumber(params.playlistEnd, {
        min: 1,
        integer: true,
        allowEmpty: true,
      }),
  ]);
}

/**
 * Cookie 配置验证
 */
export function validateCookieConfig(params: {
  name: string;
  domain: string;
  cookieFile: string;
}): ValidationResult {
  return validateAll([
    () => {
      if (!params.name.trim()) {
        return { valid: false, error: '请输入配置名称' };
      }
      return { valid: true };
    },
    () => {
      if (!params.domain.trim()) {
        return { valid: false, error: '请输入域名' };
      }
      return { valid: true };
    },
    () => pathValidators.isValidCookieFilePath(params.cookieFile),
  ]);
}
