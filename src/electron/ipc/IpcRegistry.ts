import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { toIpcError } from './ipcError';

export type IpcHandler<TResult = void> = (
  event: IpcMainInvokeEvent,
  ...args: unknown[]
) => Promise<TResult> | TResult;

export interface IpcHandlerOptions {
  /** 超时时间（毫秒），默认 30000 */
  timeout?: number;
  /** 是否记录日志，默认 false（减少日志噪音） */
  log?: boolean;
}

/**
 * 带超时的 Promise 包装
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(timeoutMessage)),
        timeoutMs
      )
    ),
  ]);
}

/**
 * IPC 通道注册表
 * 提供统一的处理器注册、日志记录和错误处理
 */
export class IpcRegistry {
  private handlers = new Map<string, IpcHandler<unknown>>();
  private options = new Map<string, IpcHandlerOptions>();

  /**
   * 注册 IPC 处理器
   * @param channel 通道名称
   * @param handler 处理函数
   * @param options 配置选项
   */
  register<TResult = void>(
    channel: string,
    handler: IpcHandler<TResult>,
    options: IpcHandlerOptions = {}
  ): void {
    const { timeout = 30000, log = false } = options;

    this.handlers.set(channel, handler as IpcHandler<unknown>);
    this.options.set(channel, options);

    ipcMain.handle(channel, async (event, ...args: unknown[]) => {
      const startTime = Date.now();

      if (log) {
        console.log(`[IPC] → ${channel}`, args.length > 0 ? '(with args)' : '');
      }

      try {
        const result = await withTimeout(
          Promise.resolve(handler(event, ...args)),
          timeout,
          `IPC call ${channel} timed out after ${timeout}ms`
        );

        if (log) {
          const duration = Date.now() - startTime;
          console.log(`[IPC] ← ${channel} (${duration}ms)`);
        }

        return result;
      } catch (err) {
        const duration = Date.now() - startTime;
        console.error(`[IPC] ✗ ${channel} (${duration}ms):`, (err as Error).message);
        throw toIpcError(err);
      }
    });
  }

  /**
   * 获取已注册的处理器（用于测试）
   */
  getHandler<TResult = void>(
    channel: string
  ): IpcHandler<TResult> | undefined {
    return this.handlers.get(channel) as IpcHandler<TResult> | undefined;
  }

  /**
   * 获取所有已注册的通道名称
   */
  getAllChannels(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 检查通道是否已注册
   */
  hasChannel(channel: string): boolean {
    return this.handlers.has(channel);
  }

  /**
   * 移除所有处理器（用于测试清理）
   */
  removeAll(): void {
    for (const channel of this.handlers.keys()) {
      ipcMain.removeHandler(channel);
    }
    this.handlers.clear();
    this.options.clear();
  }
}

// 全局单例
export const ipcRegistry = new IpcRegistry();
