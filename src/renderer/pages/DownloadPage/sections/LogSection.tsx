import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card';
import { ScrollArea } from '@renderer/components/ui/scroll-area';

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'error';
}

interface LogSectionProps {
  logs: LogEntry[];
}

export const LogSection: React.FC<LogSectionProps> = ({ logs }) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">操作日志</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-40 w-full rounded-md border bg-muted/20 p-4">
          <div className="space-y-1">
            {logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">暂无日志</p>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={`text-sm ${
                    log.type === 'error'
                      ? 'text-destructive'
                      : log.type === 'success'
                        ? 'text-green-600 dark:text-green-500'
                        : 'text-foreground'
                  }`}
                >
                  <span className="mr-2 opacity-50">[{new Date().toLocaleTimeString()}]</span>
                  {log.message}
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
