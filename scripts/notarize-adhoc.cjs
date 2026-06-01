/**
 * electron-builder afterSign 钩子：对 macOS 的 .app 做 ad-hoc 代码签名。
 *
 * 背景：本项目没有 Apple 开发者证书，electron-builder 会跳过真正的签名，
 * 打出的 .app 外层 bundle 未被正确签名，通过 `open` 启动会被 Gatekeeper 拦
 * （报 "code has no resources but signature indicates they must be present"）。
 *
 * 解决：在 electron-builder 封装 DMG 之前（afterSign 阶段），用 ad-hoc 身份
 * (`--sign -`) 对整个 bundle 重新做一次深度签名，使签名自洽、可被 `open` 启动。
 * 用户首次打开仍需右键打开（未公证），但不会因签名损坏而直接失败。
 *
 * 仅处理 darwin；其它平台直接跳过。本地 `npm run dist` 也会走到这里，无需手动重签。
 */
const { execSync } = require('child_process');

exports.default = async function notarizeAdhoc(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;

  console.log(`[afterSign] ad-hoc 签名: ${appPath}`);
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
  // 验证签名自洽，失败则抛错中断打包，避免产出无法启动的包。
  execSync(`codesign --verify --deep --strict "${appPath}"`, { stdio: 'inherit' });
  console.log(`[afterSign] 签名完成并通过验证: ${appPath}`);
};
