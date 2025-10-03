export interface DownloadTask {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'paused';
  progress: number;
  outputPath: string;
  format?: string;
  audioOnly: boolean;
  error?: string;
  addedAt: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
}

export class DownloadQueueManager {
  private tasks: Map<string, DownloadTask> = new Map();
  private listeners: Set<(tasks: DownloadTask[]) => void> = new Set();
  private currentDownload: string | null = null;
  private maxConcurrent: number = 1; // 同时下载数量
  private autoStartCallback: (() => void) | null = null;

  addTask(task: Omit<DownloadTask, 'id' | 'status' | 'progress' | 'addedAt' | 'retryCount' | 'maxRetries'>): string {
    const id = `download-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTask: DownloadTask = {
      ...task,
      id,
      status: 'pending',
      progress: 0,
      addedAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };
    this.tasks.set(id, newTask);
    this.notifyListeners();
    
    // 自动触发下载队列处理
    if (this.autoStartCallback) {
      setTimeout(() => {
        this.autoStartCallback?.();
      }, 100);
    }
    
    return id;
  }

  retryTask(id: string): void {
    const task = this.tasks.get(id);
    if (task && task.status === 'failed') {
      this.tasks.set(id, {
        ...task,
        status: 'pending',
        progress: 0,
        error: undefined,
        retryCount: task.retryCount + 1,
      });
      this.notifyListeners();
    }
  }

  removeTask(id: string): void {
    this.tasks.delete(id);
    this.notifyListeners();
  }

  updateTask(id: string, updates: Partial<DownloadTask>): void {
    const task = this.tasks.get(id);
    if (task) {
      this.tasks.set(id, { ...task, ...updates });
      this.notifyListeners();
    }
  }

  getTask(id: string): DownloadTask | undefined {
    return this.tasks.get(id);
  }

  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values()).sort(
      (a, b) => b.addedAt.getTime() - a.addedAt.getTime()
    );
  }

  getPendingTasks(): DownloadTask[] {
    return this.getAllTasks().filter((task) => task.status === 'pending');
  }

  clearCompleted(): void {
    const completed = this.getAllTasks().filter((task) => task.status === 'completed');
    completed.forEach((task) => this.tasks.delete(task.id));
    this.notifyListeners();
  }

  clearFailed(): void {
    const failed = this.getAllTasks().filter((task) => task.status === 'failed');
    failed.forEach((task) => this.tasks.delete(task.id));
    this.notifyListeners();
  }

  setCurrentDownload(id: string | null): void {
    this.currentDownload = id;
  }

  getCurrentDownload(): string | null {
    return this.currentDownload;
  }

  subscribe(listener: (tasks: DownloadTask[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setAutoStartCallback(callback: (() => void) | null): void {
    this.autoStartCallback = callback;
  }

  private notifyListeners(): void {
    const tasks = this.getAllTasks();
    this.listeners.forEach((listener) => listener(tasks));
  }
}

// 单例
export const downloadQueue = new DownloadQueueManager();

