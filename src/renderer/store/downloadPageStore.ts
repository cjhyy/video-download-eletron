import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { DownloadPageState } from './types';

const defaultDownloadPageState: DownloadPageState = {
  videoUrl: '',
  videoInfo: null,
  downloadPath: '',
  selectedFormat: '',
  audioOnly: false,
  useBestQuality: true,
  playlistMode: 'single',
  playlistItems: '',
  playlistEnd: undefined,
  embedSubs: false,
  writeSubs: false,
  writeAutoSubs: false,
  subLangs: 'en.*',
  writeThumbnail: false,
  addMetadata: false,
};

type DownloadPageStore = {
  downloadPageState: DownloadPageState;
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  updateDownloadPageState: (updates: Partial<DownloadPageState>) => void;
  resetDownloadPageState: () => void;
};

export const useDownloadPageStore = create<DownloadPageStore>()(
  persist(
    (set) => ({
      downloadPageState: defaultDownloadPageState,
      hasHydrated: false,
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      updateDownloadPageState: (updates) =>
        set((state) => ({
          downloadPageState: { ...state.downloadPageState, ...updates },
        })),
      resetDownloadPageState: () => set({ downloadPageState: defaultDownloadPageState }),
    }),
    {
      name: 'downloadPageState',
      storage: createJSONStorage(() => sessionStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        state?.updateDownloadPageState(defaultDownloadPageState);
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({ downloadPageState: state.downloadPageState }),
    }
  )
);



