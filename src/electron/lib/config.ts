import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  network: {
    proxy: string;
    userAgent: string;
    socketTimeout: number;
    retries: number;
    retryDelay: number;
  };
  ytdlp: {
    additionalArgs: string[];
  };
}

const defaultConfig: AppConfig = {
  network: {
    proxy: '',
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    socketTimeout: 30,
    retries: 5,
    retryDelay: 1,
  },
  ytdlp: {
    additionalArgs: [],
  },
};

function getUserConfigPath(): string {
  // userData exists in both dev and packaged apps, and is writable.
  const dir = app.getPath('userData');
  return path.join(dir, 'config.json');
}

function getBundledConfigPath(): string {
  // Dev fallback: project root config.json is copied next to dist-electron in dev builds.
  // (We keep it as a read-only fallback; user overrides go into userData.)
  return path.join(__dirname, '..', 'config.json');
}

function readConfigFile(p: string): Partial<AppConfig> | null {
  try {
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, 'utf8');
    return JSON.parse(raw) as Partial<AppConfig>;
  } catch (e) {
    console.warn('配置文件读取失败:', p, (e as Error).message);
    return null;
  }
}

function mergeConfig(base: AppConfig, patch?: Partial<AppConfig> | null): AppConfig {
  if (!patch) return base;
  return {
    network: { ...base.network, ...(patch.network ?? {}) },
    ytdlp: {
      ...base.ytdlp,
      ...(patch.ytdlp ?? {}),
      additionalArgs: Array.isArray(patch.ytdlp?.additionalArgs)
        ? (patch.ytdlp?.additionalArgs as unknown[]).filter((v): v is string => typeof v === 'string')
        : base.ytdlp.additionalArgs,
    },
  };
}

// 读取配置文件（优先 userData，其次 bundled，其次默认）
export function loadConfig(): AppConfig {
  const bundled = readConfigFile(getBundledConfigPath());
  const user = readConfigFile(getUserConfigPath());
  const merged = mergeConfig(mergeConfig(defaultConfig, bundled), user);
  return merged;
}

export function saveConfig(updates: Partial<AppConfig>): AppConfig {
  const current = loadConfig();
  const next = mergeConfig(current, updates);
  const p = getUserConfigPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

export function getYtDlpAdditionalArgs(): string[] {
  return loadConfig().ytdlp.additionalArgs ?? [];
}

export function setYtDlpAdditionalArgs(additionalArgs: string[]): string[] {
  const next = saveConfig({ ytdlp: { additionalArgs } });
  return next.ytdlp.additionalArgs ?? [];
}




