import { useCallback, useState } from 'react';

export type LogType = 'info' | 'error' | 'success';

export interface LogEntry {
  message: string;
  type: LogType;
}

export function useLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string, type: LogType = 'info') => {
    setLogs((prev) => [...prev, { message: `[${new Date().toLocaleTimeString()}] ${message}`, type }]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, addLog, clearLogs, setLogs };
}




