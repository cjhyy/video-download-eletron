/**
 * 统一错误处理
 * 提供一致的错误处理逻辑和用户反馈
 */

import { toast } from 'sonner';
import { parseIpcError, type IpcError } from './ipcError';
import { ERROR_CODE_MESSAGES } from '@renderer/constants/messages';

type ErrorContext = 'download' | 'settings' | 'cookie' | 'queue' | 'general';

interface ErrorHandlerOptions {
  /** 是否显示 toast */
  showToast?: boolean;
  /** 是否打印到控制台 */
  logToConsole?: boolean;
  /** 自定义消息前缀 */
  messagePrefix?: string;
  /** 自定义日志回调 */
  onLog?: (message: string, type: 'error' | 'warn') => void;
}

interface ErrorResult {
  /** 解析后的错误 */
  parsed: IpcError;
  /** 用户友好的消息 */
  userMessage: string;
  /** 完整的错误消息（包含详情） */
  fullMessage: string;
}

/**
 * 获取用户友好的错误消息
 */
function getUserFriendlyMessage(error: IpcError, context: ErrorContext): string {
  // 优先使用预定义的错误码消息
  if (error.code && ERROR_CODE_MESSAGES[error.code]) {
    return ERROR_CODE_MESSAGES[error.code];
  }

  // 根据上下文提供默认消息
  const contextMessages: Record<ErrorContext, string> = {
    download: '下载失败',
    settings: '设置保存失败',
    cookie: 'Cookie 操作失败',
    queue: '队列操作失败',
    general: '操作失败',
  };

  return contextMessages[context];
}

/**
 * 格式化错误详情
 */
function formatErrorDetails(error: IpcError): string {
  let details = '';

  if (error.code && error.code !== 'UNKNOWN') {
    details += `[${error.code}] `;
  }

  details += error.message;

  // 添加 stderr 尾部信息（如果有）
  if (error.details?.stderrTail && Array.isArray(error.details.stderrTail)) {
    const tail = error.details.stderrTail.filter(Boolean);
    if (tail.length > 0) {
      details += `\n\n---- 详细信息 ----\n${tail.join('\n')}`;
    }
  }

  return details;
}

/**
 * 统一错误处理函数
 */
export function handleError(
  error: unknown,
  context: ErrorContext,
  options: ErrorHandlerOptions = {}
): ErrorResult {
  const {
    showToast = true,
    logToConsole = true,
    messagePrefix,
    onLog,
  } = options;

  // 解析错误
  const parsed = parseIpcError(error);

  // 获取用户友好消息
  const userMessage = messagePrefix
    ? `${messagePrefix}: ${getUserFriendlyMessage(parsed, context)}`
    : getUserFriendlyMessage(parsed, context);

  // 完整消息
  const fullMessage = formatErrorDetails(parsed);

  // 控制台日志
  if (logToConsole) {
    console.error(`[${context.toUpperCase()}] ${fullMessage}`);
  }

  // 自定义日志回调
  if (onLog) {
    onLog(`${userMessage} [${parsed.code}]: ${parsed.message}`, 'error');
  }

  // Toast 通知
  if (showToast) {
    toast.error(userMessage, {
      description: parsed.code !== 'UNKNOWN' ? `错误码: ${parsed.code}` : undefined,
    });
  }

  return { parsed, userMessage, fullMessage };
}

/**
 * 处理下载相关错误
 */
export function handleDownloadError(
  error: unknown,
  options?: Omit<ErrorHandlerOptions, 'messagePrefix'>
): ErrorResult {
  return handleError(error, 'download', {
    ...options,
    messagePrefix: '下载失败',
  });
}

/**
 * 处理设置相关错误
 */
export function handleSettingsError(
  error: unknown,
  options?: Omit<ErrorHandlerOptions, 'messagePrefix'>
): ErrorResult {
  return handleError(error, 'settings', {
    ...options,
    messagePrefix: '设置错误',
  });
}

/**
 * 处理 Cookie 相关错误
 */
export function handleCookieError(
  error: unknown,
  options?: Omit<ErrorHandlerOptions, 'messagePrefix'>
): ErrorResult {
  return handleError(error, 'cookie', {
    ...options,
    messagePrefix: 'Cookie 操作失败',
  });
}

/**
 * 处理队列相关错误
 */
export function handleQueueError(
  error: unknown,
  options?: Omit<ErrorHandlerOptions, 'messagePrefix'>
): ErrorResult {
  return handleError(error, 'queue', {
    ...options,
    messagePrefix: '队列操作失败',
  });
}

/**
 * 静默处理错误（只记录日志，不显示 toast）
 */
export function handleErrorSilently(error: unknown, context: ErrorContext): ErrorResult {
  return handleError(error, context, {
    showToast: false,
    logToConsole: true,
  });
}

/**
 * 创建带上下文的错误处理器
 * 适用于 Hook 或组件中复用
 */
export function createErrorHandler(
  context: ErrorContext,
  defaultOptions: ErrorHandlerOptions = {}
) {
  return (error: unknown, options?: ErrorHandlerOptions) => {
    return handleError(error, context, { ...defaultOptions, ...options });
  };
}
