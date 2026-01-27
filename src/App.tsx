import React, { Suspense, lazy, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { ConfirmProvider } from './components/ConfirmProvider';
import { useConfigStore } from './store/configStore';

const DownloadPage = lazy(() => import('./pages/DownloadPage'));
const QueuePage = lazy(() => import('./pages/QueuePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const CookiePage = lazy(() => import('./pages/CookiePage'));
const CombinedSettingsPage = lazy(() => import('./pages/CombinedSettingsPage'));
const LearningHubPage = lazy(() => import('./learning/pages/LearningHubPage'));
const LearningProjectPage = lazy(() => import('./learning/pages/LearningProjectPage'));

const PageLoader = () => (
  <div className="flex h-[50vh] w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
  </div>
);

const App: React.FC = () => {
  const updateConfig = useConfigStore((s) => s.updateConfig);

  useEffect(() => {
    // Sync settings from main process on startup
    const syncSettings = async () => {
      try {
        const s = await window.electronAPI.getUserSettings();
        updateConfig({ 
          gpuCompatEnabled: !!s.gpuCompatEnabled,
          closeToTray: !!s.closeToTray
        });
      } catch (e: any) {
        console.warn('Failed to load initial user settings:', e?.message);
      }
    };
    void syncSettings();
  }, [updateConfig]);

  return (
    <Router>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/download" replace />} />
            <Route path="/download" element={<DownloadPage />} />
            <Route path="/queue" element={<QueuePage />} />
            <Route path="/settings" element={<CombinedSettingsPage />} />
            <Route path="/learning" element={<LearningHubPage />} />
            <Route path="/learning/:projectId" element={<LearningProjectPage />} />
          </Routes>
        </Suspense>
      </Layout>
      <Toaster position="top-center" richColors />
      <ConfirmProvider />
    </Router>
  );
};

export default App;

