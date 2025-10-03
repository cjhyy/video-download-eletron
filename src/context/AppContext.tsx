import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';

interface CookieProfile {
  id: string;
  name: string;
  domain: string;
  cookieFile: string;
  createdAt: string;
}

interface AppConfig {
  defaultDownloadPath: string;
  cookieEnabled: boolean;
  cookieFile: string; // 保留用于向后兼容
  cookieProfiles: CookieProfile[];
  activeCookieProfileId: string | null;
}

interface VideoInfo {
  title: string;
  duration?: number;
  uploader?: string;
  formats: any[];
}

interface DownloadPageState {
  videoUrl: string;
  videoInfo: VideoInfo | null;
  downloadPath: string;
  selectedFormat: string;
  audioOnly: boolean;
  useBestQuality: boolean;
}

interface AppContextType {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  loadConfig: () => void;
  saveConfig: () => void;
  isLoaded: boolean;
  // 下载页面状态
  downloadPageState: DownloadPageState;
  updateDownloadPageState: (updates: Partial<DownloadPageState>) => void;
}

const defaultConfig: AppConfig = {
  defaultDownloadPath: '',
  cookieEnabled: false,
  cookieFile: '', // 保留用于向后兼容
  cookieProfiles: [],
  activeCookieProfileId: null,
};

const defaultDownloadPageState: DownloadPageState = {
  videoUrl: '',
  videoInfo: null,
  downloadPath: '',
  selectedFormat: '',
  audioOnly: false,
  useBestQuality: true, // 默认使用最高质量
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [isLoaded, setIsLoaded] = useState(false);
  const [downloadPageState, setDownloadPageState] = useState<DownloadPageState>(defaultDownloadPageState);

  const loadConfig = useCallback(() => {
    const savedConfig = localStorage.getItem('appConfig');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig({ ...defaultConfig, ...parsed });
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    }
    
    // 加载下载页面状态
    const savedDownloadState = sessionStorage.getItem('downloadPageState');
    if (savedDownloadState) {
      try {
        const parsed = JSON.parse(savedDownloadState);
        setDownloadPageState({ ...defaultDownloadPageState, ...parsed });
      } catch (error) {
        console.error('Failed to load download page state:', error);
      }
    }
    
    setIsLoaded(true);
  }, []);

  const updateConfig = useCallback((updates: Partial<AppConfig>) => {
    setConfig((prev) => {
      const newConfig = { ...prev, ...updates };
      // 自动保存到localStorage
      localStorage.setItem('appConfig', JSON.stringify(newConfig));
      return newConfig;
    });
  }, []);

  const saveConfig = useCallback(() => {
    localStorage.setItem('appConfig', JSON.stringify(config));
  }, [config]);

  const updateDownloadPageState = useCallback((updates: Partial<DownloadPageState>) => {
    setDownloadPageState((prev) => {
      const newState = { ...prev, ...updates };
      // 自动保存到sessionStorage（会话期间保持，关闭应用后清除）
      sessionStorage.setItem('downloadPageState', JSON.stringify(newState));
      return newState;
    });
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // 使用 useMemo 来保持 contextValue 的引用稳定
  const contextValue = useMemo(
    () => ({ 
      config, 
      updateConfig, 
      loadConfig, 
      saveConfig, 
      isLoaded,
      downloadPageState,
      updateDownloadPageState,
    }),
    [config, isLoaded, downloadPageState, updateConfig, loadConfig, saveConfig, updateDownloadPageState]
  );

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppConfig = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppConfig must be used within AppProvider');
  }
  return context;
};

export type { VideoInfo, DownloadPageState, CookieProfile, AppConfig };

