import type { IpcErrorCode, IpcErrorPayload } from '../../shared/ipcErrors';

export class IpcError extends Error {
  public readonly code: IpcErrorCode;
  public readonly details?: unknown;

  constructor(code: IpcErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
    // Electron propagate name/message reliably; use name as stable code channel.
    this.name = code;
  }
}

function mapNodeErrorCode(err: NodeJS.ErrnoException): IpcErrorCode {
  switch (err.code) {
    case 'ENOENT':
      return 'NOT_FOUND';
    case 'EACCES':
    case 'EPERM':
      return 'PERMISSION_DENIED';
    case 'EEXIST':
      return 'CONFLICT';
    default:
      return 'INTERNAL_ERROR';
  }
}

export function toIpcError(err: unknown, fallbackMessage = 'Unexpected error'): IpcError {
  if (err instanceof IpcError) return err;
  if (err instanceof Error) {
    const anyErr = err as NodeJS.ErrnoException;
    const code = typeof anyErr.code === 'string' ? mapNodeErrorCode(anyErr) : 'INTERNAL_ERROR';
    return new IpcError(code, err.message || fallbackMessage);
  }
  return new IpcError('UNKNOWN', fallbackMessage, { err });
}

export function serializeIpcError(err: IpcError): IpcErrorPayload {
  return { code: err.code, message: err.message, details: err.details };
}



