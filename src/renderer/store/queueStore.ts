import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DownloadTask, DownloadTaskLogEntry } from './types';

type QueueState = {
  tasks: DownloadTask[];
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;

  addTask: (task: {
    url: string;
    title: string;
    outputPath: string;
    format?: string;
    audioOnly: boolean;
    playlistMode?: 'single' | 'playlist';
    playlistItems?: string;
    playlistEnd?: number;
    postProcess?: {
      embedSubs?: boolean;
      writeSubs?: boolean;
      writeAutoSubs?: boolean;
      subLangs?: string;
      writeThumbnail?: boolean;
      addMetadata?: boolean;
    };
  }) => string;
  updateTask: (id: string, updates: Partial<DownloadTask>) => void;
  appendTaskLog: (id: string, entry: DownloadTaskLogEntry) => void;
  removeTask: (id: string) => void;
  retryTask: (id: string) => void;
  clearCompleted: () => void;
  clearFailed: () => void;
  getTask: (id: string) => DownloadTask | undefined;
};

function sortByAddedAtDesc(tasks: DownloadTask[]): DownloadTask[] {
  return [...tasks].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
}

function normalizeOnHydrate(tasks: DownloadTask[]): DownloadTask[] {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  return tasks.map((t) => {
    let normalized = t;

    // After restart, a "downloading" task is not actually downloading anymore.
    // Mark it paused so user can resume explicitly.
    if (t.status === 'downloading') {
      normalized = { ...normalized, status: 'paused' };
    }

    // 清理超过7天的已完成/失败任务的日志（只保留最后5条）
    // 这样可以在应用重启时自动清理过期数据
    if (
      (t.status === 'completed' || t.status === 'failed') &&
      t.addedAt &&
      new Date(t.addedAt).getTime() < sevenDaysAgo &&
      t.logs &&
      t.logs.length > 5
    ) {
      normalized = { ...normalized, logs: t.logs.slice(-5) };
    }

    return normalized;
  });
}

export const useQueueStore = create<QueueState>()(
  persist(
    (set, get) => ({
      tasks: [],
      hasHydrated: false,
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),

      addTask: (task) => {
        const id = `download-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
        const newTask: DownloadTask = {
          id,
          url: task.url,
          title: task.title,
          status: 'pending',
          progress: 0,
          outputPath: task.outputPath,
          format: task.format,
          audioOnly: task.audioOnly,
          playlistMode: task.playlistMode,
          playlistItems: task.playlistItems,
          playlistEnd: task.playlistEnd,
          postProcess: task.postProcess,
          addedAt: new Date().toISOString(),
          retryCount: 0,
          maxRetries: 3,
        };

        set((state) => ({ tasks: sortByAddedAtDesc([newTask, ...state.tasks]) }));
        return id;
      },

      updateTask: (id, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;

            const updated = { ...t, ...updates };

            // 当任务完成或失败时，自动清理日志只保留最后 20 条
            // 这样可以避免 localStorage 膨胀，同时保留足够的调试信息
            if (
              (updates.status === 'completed' || updates.status === 'failed') &&
              updated.logs &&
              updated.logs.length > 20
            ) {
              updated.logs = updated.logs.slice(-20);
            }

            return updated;
          }),
        }));
      },

      appendTaskLog: (id, entry) => {
        set((state) => ({
          tasks: state.tasks.map((t) => {
            if (t.id !== id) return t;
            const prev = t.logs ?? [];
            const next = [...prev, entry];
            const MAX = 200; // keep last N lines to avoid storage bloat
            const trimmed = next.length > MAX ? next.slice(next.length - MAX) : next;
            return { ...t, logs: trimmed };
          }),
        }));
      },

      removeTask: (id) => set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),

      retryTask: (id) => {
        const task = get().tasks.find((t) => t.id === id);
        if (!task || task.status !== 'failed') return;
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === id
              ? { ...t, status: 'pending', progress: 0, error: undefined, retryCount: t.retryCount + 1 }
              : t
          ),
        }));
      },

      clearCompleted: () => set((state) => ({ tasks: state.tasks.filter((t) => t.status !== 'completed') })),
      clearFailed: () => set((state) => ({ tasks: state.tasks.filter((t) => t.status !== 'failed') })),

      getTask: (id) => get().tasks.find((t) => t.id === id),
    }),
    {
      name: 'downloadQueue',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // normalize persisted tasks
        state.tasks = normalizeOnHydrate(state.tasks ?? []);
        state.setHasHydrated(true);
      },
      partialize: (state) => ({ tasks: state.tasks }),
    }
  )
);


