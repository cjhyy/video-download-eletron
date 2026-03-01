import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LearningProject } from '../types';

type LearningState = {
  projects: LearningProject[];
  hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  createProject: (p: Omit<LearningProject, 'id' | 'createdAt' | 'updatedAt'>) => string;
  deleteProject: (id: string) => void;
  updateProject: (id: string, updates: Partial<Omit<LearningProject, 'id'>>) => void;
  getProject: (id: string) => LearningProject | undefined;
};

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useLearningStore = create<LearningState>()(
  persist(
    (set, get) => ({
      projects: [],
      hasHydrated: false,
      setHasHydrated: (v) => set({ hasHydrated: v }),

      createProject: (p) => {
        const now = new Date().toISOString();
        const id = newId('learn');
        const project: LearningProject = {
          id,
          name: p.name,
          videoPath: p.videoPath,
          subtitlePath: p.subtitlePath,
          cues: p.cues,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ projects: [project, ...state.projects] }));
        return id;
      },

      deleteProject: (id) => set((state) => ({ projects: state.projects.filter((p) => p.id !== id) })),

      updateProject: (id, updates) =>
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        })),

      getProject: (id) => get().projects.find((p) => p.id === id),
    }),
    {
      name: 'learningStore',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: (state) => ({ projects: state.projects }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);


