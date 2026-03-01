import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

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

  // 在打包后使用 extraResources（完整版）
  const bundledPath = path.join(process.resourcesPath, 'binaries', platform, binaryName + extension);
  if (fs.existsSync(bundledPath)) {
    return bundledPath;
  }

  // 用户数据目录中的二进制文件（精简版下载后）
  const userDataPath = getUserDataBinaryPath(binaryName);
  if (fs.existsSync(userDataPath)) {
    return userDataPath;
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




