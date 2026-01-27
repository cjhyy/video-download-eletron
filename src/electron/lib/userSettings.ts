import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface UserSettings {
  gpuCompatEnabled: boolean;
  closeToTray: boolean;
}

const defaultSettings: UserSettings = {
  gpuCompatEnabled: false,
  closeToTray: true,
};

function getSettingsPath(): string {
  const dir = app.getPath('userData');
  return path.join(dir, 'settings.json');
}

export function loadUserSettings(): UserSettings {
  try {
    const p = getSettingsPath();
    if (!fs.existsSync(p)) return defaultSettings;
    const raw = fs.readFileSync(p, 'utf8');
    const parsed = JSON.parse(raw) as Partial<UserSettings>;
    return { ...defaultSettings, ...parsed };
  } catch (err) {
    console.warn('[userSettings] load failed, using defaults:', (err as Error).message);
    return defaultSettings;
  }
}

export function saveUserSettings(updates: Partial<UserSettings>): UserSettings {
  const current = loadUserSettings();
  const next: UserSettings = { ...current, ...updates };
  const p = getSettingsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf8');
  return next;
}



