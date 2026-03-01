import { describe, it, expect } from 'vitest';
import { IpcError, toIpcError } from '../ipcError';

describe('ipcError.ts', () => {
  describe('IpcError', () => {
    it('should create error with code and message', () => {
      const error = new IpcError('VALIDATION_ERROR', 'Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.name).toBe('VALIDATION_ERROR');
    });

    it('should create error with details', () => {
      const details = { field: 'url', value: 'invalid' };
      const error = new IpcError('VALIDATION_ERROR', 'Invalid input', details);
      expect(error.details).toEqual(details);
    });

    it('should be instanceof Error', () => {
      const error = new IpcError('INTERNAL_ERROR', 'Something went wrong');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(IpcError);
    });
  });

  describe('toIpcError', () => {
    it('should return IpcError as-is', () => {
      const original = new IpcError('NOT_FOUND', 'Resource not found');
      const result = toIpcError(original);
      expect(result).toBe(original);
    });

    it('should convert standard Error to IpcError', () => {
      const original = new Error('Something failed');
      const result = toIpcError(original);
      expect(result).toBeInstanceOf(IpcError);
      expect(result.code).toBe('INTERNAL_ERROR');
      expect(result.message).toBe('Something failed');
    });

    it('should handle ENOENT errors', () => {
      const original = new Error('File not found') as NodeJS.ErrnoException;
      original.code = 'ENOENT';
      const result = toIpcError(original);
      expect(result.code).toBe('NOT_FOUND');
    });

    it('should handle EACCES errors', () => {
      const original = new Error('Permission denied') as NodeJS.ErrnoException;
      original.code = 'EACCES';
      const result = toIpcError(original);
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('should handle EPERM errors', () => {
      const original = new Error('Operation not permitted') as NodeJS.ErrnoException;
      original.code = 'EPERM';
      const result = toIpcError(original);
      expect(result.code).toBe('PERMISSION_DENIED');
    });

    it('should handle EEXIST errors', () => {
      const original = new Error('File exists') as NodeJS.ErrnoException;
      original.code = 'EEXIST';
      const result = toIpcError(original);
      expect(result.code).toBe('CONFLICT');
    });

    it('should handle non-Error values', () => {
      const result = toIpcError('string error');
      expect(result).toBeInstanceOf(IpcError);
      expect(result.code).toBe('UNKNOWN');
    });

    it('should use fallback message when error has no message', () => {
      const original = new Error();
      const result = toIpcError(original, 'Custom fallback');
      expect(result.message).toBe('Custom fallback');
    });

    it('should handle null/undefined', () => {
      const resultNull = toIpcError(null);
      const resultUndefined = toIpcError(undefined);
      expect(resultNull.code).toBe('UNKNOWN');
      expect(resultUndefined.code).toBe('UNKNOWN');
    });
  });
});
