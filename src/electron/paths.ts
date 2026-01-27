import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

function isDev(): boolean {
  return Boolean(process.env.VITE_DEV_SERVER_URL) || process.argv.includes('--dev');
}

function ensureDir(p: string): boolean {
  try {
    fs.mkdirSync(p, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure Electron/Chromium uses a writable, stable cache location.
 *
 * Fixes noisy Windows errors like:
 * - Unable to move the cache: 拒绝访问。 (0x5)
 * - Unable to create cache / Gpu Cache Creation failed
 * - service_worker_storage Database IO error
 */
export function configureAppPaths(): void {
  // Put dev data in a separate folder to avoid conflicts with installed builds.
  const baseName = isDev() ? `${app.getName()}-dev` : app.getName();

  // appData is a safe, writable location on Windows/macOS/Linux.
  const userDataDir = path.join(app.getPath('appData'), baseName);
  const cacheDir = path.join(userDataDir, 'cache');

  // If we can't create these folders, fall back to Electron defaults.
  if (!ensureDir(userDataDir) || !ensureDir(cacheDir)) return;

  // Must be called before app.whenReady() for best results.
  app.setPath('userData', userDataDir);
  app.setPath('cache', cacheDir);

  // Reduce cache-related noise/failures on locked-down systems.
  // (This does NOT disable GPU acceleration; it only disables shader disk cache.)
  app.commandLine.appendSwitch('--disable-gpu-shader-disk-cache');
}


