import type { IpcErrorCode, IpcErrorPayload } from '@/shared/ipcErrors';

const KNOWN: Set<IpcErrorCode> = new Set([
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'PERMISSION_DENIED',
  'CONFLICT',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'UNKNOWN',
]);

export function parseIpcError(err: unknown): IpcErrorPayload {
  const fallback: IpcErrorPayload = { code: 'UNKNOWN', message: '未知错误' };
  if (!err || typeof err !== 'object') return fallback;

  const anyErr = err as any;
  const name = typeof anyErr.name === 'string' ? (anyErr.name as IpcErrorCode) : undefined;
  const message = typeof anyErr.message === 'string' ? anyErr.message : undefined;

  if (name && KNOWN.has(name)) {
    return { code: name, message: message || '错误' };
  }

  return { code: 'UNKNOWN', message: message || fallback.message };
}



