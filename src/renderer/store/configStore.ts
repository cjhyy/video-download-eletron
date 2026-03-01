import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppConfig } from './types';

const defaultConfig: AppConfig = {
  defaultDownloadPath: '',
  cookieEnabled: false,
  cookieFile: '',
  cookieProfiles: [],
  activeCookieProfileId: null,
  gpuCompatEnabled: false,
  closeToTray: true,
  maxConcurrentDownloads: 3,
};

type ConfigState = {
  config: AppConfig;
  hasHydrated: boolean;
  setHasHydrated: (hydrated: boolean) => void;
  updateConfig: (updates: Partial<AppConfig>) => void;
  setConfig: (config: AppConfig) => void;
};

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      config: defaultConfig,
      hasHydrated: false,
      setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
        })),
      setConfig: (config) => set({ config }),
    }),
    {
      name: 'appConfig',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      onRehydrateStorage: () => (state) => {
        state?.setConfig({ ...defaultConfig, ...(state?.config ?? {}) });
        state?.setHasHydrated(true);
      },
      // Avoid persisting isLoaded
      partialize: (state) => ({ config: state.config }),
    }
  )
);


