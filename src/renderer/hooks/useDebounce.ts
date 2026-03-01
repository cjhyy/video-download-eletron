/**
 * 防抖相关 Hooks
 * 用于优化频繁触发的操作
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { UI_CONFIG } from '@renderer/constants';

/**
 * 防抖值 Hook
 * 延迟更新值，适用于搜索输入等场景
 *
 * @param value 需要防抖的值
 * @param delay 延迟时间（毫秒），默认 300ms
 * @returns 防抖后的值
 *
 * @example
 * const [search, setSearch] = useState('');
 * const debouncedSearch = useDebouncedValue(search, 300);
 *
 * useEffect(() => {
 *   // 只在 debouncedSearch 变化时执行搜索
 *   performSearch(debouncedSearch);
 * }, [debouncedSearch]);
 */
export function useDebouncedValue<T>(value: T, delay: number = UI_CONFIG.DEBOUNCE_DELAY_MS): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 防抖回调 Hook
 * 延迟执行回调函数，适用于按钮点击、API 调用等场景
 *
 * @param callback 需要防抖的回调函数
 * @param delay 延迟时间（毫秒），默认 300ms
 * @returns 防抖后的回调函数
 *
 * @example
 * const debouncedSubmit = useDebouncedCallback(
 *   (data) => submitForm(data),
 *   500
 * );
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = UI_CONFIG.DEBOUNCE_DELAY_MS
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(callback);

  // 保持最新的 callback 引用
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay]
  );
}

/**
 * 节流回调 Hook
 * 限制回调函数的执行频率，适用于滚动、resize 等高频事件
 *
 * @param callback 需要节流的回调函数
 * @param delay 最小间隔时间（毫秒），默认 300ms
 * @returns 节流后的回调函数
 *
 * @example
 * const throttledScroll = useThrottledCallback(
 *   (e) => handleScroll(e),
 *   100
 * );
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = UI_CONFIG.DEBOUNCE_DELAY_MS
): (...args: Parameters<T>) => void {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRunRef.current;

      if (timeSinceLastRun >= delay) {
        lastRunRef.current = now;
        callbackRef.current(...args);
      } else {
        // 确保最后一次调用也会执行
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          lastRunRef.current = Date.now();
          callbackRef.current(...args);
        }, delay - timeSinceLastRun);
      }
    },
    [delay]
  );
}

/**
 * 防抖状态 Hook
 * 提供防抖的状态管理，包含 loading 状态
 *
 * @param initialValue 初始值
 * @param delay 延迟时间（毫秒）
 * @returns [value, setValue, debouncedValue, isPending]
 */
export function useDebouncedState<T>(
  initialValue: T,
  delay: number = UI_CONFIG.DEBOUNCE_DELAY_MS
): [T, (value: T) => void, T, boolean] {
  const [value, setValue] = useState<T>(initialValue);
  const [debouncedValue, setDebouncedValue] = useState<T>(initialValue);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (value !== debouncedValue) {
      setIsPending(true);
    }

    const timer = setTimeout(() => {
      setDebouncedValue(value);
      setIsPending(false);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return [value, setValue, debouncedValue, isPending];
}
