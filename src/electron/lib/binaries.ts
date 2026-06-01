import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execSync, execFileSync } from 'child_process';

/**
 * 尝试从系统 PATH 中查找二进制文件
 */
function findInSystemPath(binaryName: string): string | null {
  const platform = process.platform;
  const extension = platform === 'win32' ? '.exe' : '';
  const fullName = binaryName + extension;

  try {
    if (platform === 'win32') {
      // Windows: 使用 where 命令
      const result = execSync(`where ${fullName}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const firstLine = result.trim().split('\n')[0];
      if (firstLine && fs.existsSync(firstLine)) {
        return firstLine;
      }
    } else {
      // macOS/Linux: 使用 which 命令
      const result = execSync(`which ${fullName}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const foundPath = result.trim();
      if (foundPath && fs.existsSync(foundPath)) {
        return foundPath;
      }
    }
  } catch {
    // 命令执行失败，说明系统中没有安装该二进制文件
  }
  return null;
}

/**
 * 获取用户数据目录中的二进制文件路径（精简版下载后存放位置）
 */
function getUserDataBinaryPath(binaryName: string): string {
  const platform = process.platform;
  const extension = platform === 'win32' ? '.exe' : '';
  return path.join(app.getPath('userData'), 'binaries', platform, binaryName + extension);
}

/**
 * 获取二进制文件路径
 * 优先级：
 * 1. 开发模式：本地 binaries 文件夹
 * 2. 打包后：extraResources 中的 binaries（完整版）
 * 3. 用户数据目录中的 binaries（精简版下载后）
 * 4. 系统 PATH 中的二进制文件
 */
export function getBinaryPath(binaryName: string): string {
  const platform = process.platform;
  const extension = platform === 'win32' ? '.exe' : '';

  // 在开发模式下使用本地binaries文件夹
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    const devPath = path.join(__dirname, '..', 'binaries', platform, binaryName + extension);
    if (fs.existsSync(devPath)) {
      return devPath;
    }
    // 开发模式下如果本地没有，也尝试系统 PATH
    const systemPath = findInSystemPath(binaryName);
    if (systemPath) {
      return systemPath;
    }
    return devPath; // 返回预期路径，让调用方处理不存在的情况
  }

  // 用户数据目录中的二进制文件（精简版下载后，或更新后的较新版本）
  // 优先于包内 bundled 版本：更新会把最新版下载到此处（可写目录），
  // 必须盖过打包时内置的旧版，否则更新对完整版用户无效。
  const userDataPath = getUserDataBinaryPath(binaryName);
  if (fs.existsSync(userDataPath)) {
    return userDataPath;
  }

  // 打包内置的 extraResources（完整版，只读目录）
  const bundledPath = path.join(process.resourcesPath, 'binaries', platform, binaryName + extension);
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // 回退：尝试从系统 PATH 查找
  const systemPath = findInSystemPath(binaryName);
  if (systemPath) {
    return systemPath;
  }

  // 返回用户数据路径（精简版应下载到此位置）
  return userDataPath;
}

/**
 * 检查二进制文件是否使用的是内置版本
 */
export function isBundledBinary(binaryName: string): boolean {
  const binaryPath = getBinaryPath(binaryName);
  const platform = process.platform;
  const extension = platform === 'win32' ? '.exe' : '';

  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    const devPath = path.join(__dirname, '..', 'binaries', platform, binaryName + extension);
    return binaryPath === devPath && fs.existsSync(devPath);
  }

  const bundledPath = path.join(process.resourcesPath, 'binaries', platform, binaryName + extension);
  return binaryPath === bundledPath && fs.existsSync(bundledPath);
}

/**
 * 剥离内置 / 用户数据目录里二进制的 macOS quarantine 属性。
 *
 * 从 GitHub release 下载安装的 .app，macOS 会给整个包（含内置 yt-dlp/ffmpeg）
 * 打上 com.apple.quarantine。从被 quarantine 的 GUI app 内部执行同样被
 * quarantine 的内置二进制，会被 Gatekeeper 拦截（无法验证开发者），导致
 * execFile 失败/挂起 —— 表现为读不到版本号、甚至回退到系统 PATH 的旧版。
 *
 * 在 app 启动早期对 binaries 目录递归执行 `xattr -dr com.apple.quarantine`，
 * 即可让内置二进制正常执行。仅 macOS 需要；失败不影响启动（吞掉异常）。
 *
 * @param platform 传入以便测试；默认当前平台。
 */
export function removeBinariesQuarantine(platform: NodeJS.Platform = process.platform): void {
  if (platform !== 'darwin') return;

  const dirs: string[] = [];
  // 内置（完整版，打包在 resources 下）
  if (process.resourcesPath) {
    dirs.push(path.join(process.resourcesPath, 'binaries'));
  }
  // 用户数据目录（精简版下载 / 更新后）
  try {
    dirs.push(path.join(app.getPath('userData'), 'binaries'));
  } catch {
    // app 尚未就绪等极端情况，忽略
  }

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      execFileSync('xattr', ['-dr', 'com.apple.quarantine', dir], { stdio: 'ignore' });
      console.log(`[binaries] 已剥离 quarantine: ${dir}`);
    } catch (error) {
      // 没有 quarantine 属性时 xattr 也可能报错，无害；其它错误一并忽略，不阻塞启动。
      console.warn(`[binaries] 剥离 quarantine 失败（可忽略）: ${dir}`, (error as Error).message);
    }
  }
}




