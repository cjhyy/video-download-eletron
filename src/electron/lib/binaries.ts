import * as path from 'path';

// 获取二进制文件路径
export function getBinaryPath(binaryName: string): string {
  const platform = process.platform;
  let extension = '';

  if (platform === 'win32') {
    extension = '.exe';
  }

  // 在开发模式下使用本地binaries文件夹
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    return path.join(__dirname, '..', 'binaries', platform, binaryName + extension);
  }

  // 在打包后使用extraResources
  return path.join(process.resourcesPath, 'binaries', platform, binaryName + extension);
}




