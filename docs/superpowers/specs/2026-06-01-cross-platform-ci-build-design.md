# 跨平台 CI 打包设计

日期：2026-06-01

## 目标

push `v*` tag 时，GitHub Actions 自动跨平台打包（mac + Windows，full + lite），
每次打包内置当前最新的 yt-dlp / ffmpeg，mac 包做 ad-hoc 签名，产物直接发布为正式 release。

## 需求确认

- **目标平台**：macOS（DMG，arm64 + x64）、Windows（exe / NSIS，x64）。不打 Linux。
- **变体**：full（内置 yt-dlp/ffmpeg，装完即用）+ lite（首次启动让用户下载）都打。
- **yt-dlp/ffmpeg 版本**：每次构建跑 `npm run download-binaries` 拉最新版（full 用）。
- **触发**：push tag `v*`。
- **mac 签名**：CI 内做 ad-hoc 签名（`codesign --force --deep --sign -`），通过 electron-builder `afterSign` 钩子实现，封装 DMG 前完成；本地 `npm run dist` 也受益。无 Apple 证书/公证。
- **发布**：直接发布为正式 release（标记 latest），全自动，附所有产物。

## 架构

单个 workflow：`.github/workflows/release.yml`，两段 job。

```
触发: push tag v*
  ├─ job build (matrix: macos-latest, windows-latest)
  │    checkout → setup node 20 → npm ci
  │    → npm run download-binaries     # 拉最新 yt-dlp/ffmpeg 到 binaries/<os>/（供 full）
  │    → npm run dist:full              # full 包（afterSign 钩子在 mac 上做 ad-hoc 签名）
  │    → npm run dist:lite              # lite 包（同上）
  │    → upload-artifact (release/**/*.dmg, *.exe)
  └─ job release (needs: build)
       download-artifact (all)
       → softprops/action-gh-release   # 直接发布正式 release，附产物，latest
```

## 组件

### 1. `.github/workflows/release.yml`（新增）

- `on: push: tags: ['v*']`
- 权限：`contents: write`（创建 release 需要）。
- **build job**：`strategy.matrix.os: [macos-latest, windows-latest]`，`runs-on: ${{ matrix.os }}`。
  - mac 上 electron-builder 传 `--arm64 --x64` 出双架构；win 默认 x64。
  - 上传 `release/**/*.{dmg,exe}` 为 artifact（按 os 区分 artifact 名，避免覆盖）。
- **release job**：`needs: build`，下载全部 artifact，用 `softprops/action-gh-release@v2` 发布，
  `files:` 指向下载下来的所有安装包，`tag_name` 取触发的 tag，正式发布。

### 2. `build/notarize-adhoc.js`（新增）— afterSign 钩子

```js
const { execSync } = require('child_process');
exports.default = async (context) => {
  if (context.electronPlatformName !== 'darwin') return;     // 只处理 mac
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;
  execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
};
```

理由：electron-builder 先签 `.app` 再封装进 `.dmg`；ad-hoc 签名必须在封装前做。
`afterSign` 钩子在"签名阶段后、封装 DMG 前"触发，即使无真证书（签名被跳过）该钩子仍执行，
正是插入 ad-hoc 签名的时机。

### 3. `config/electron-builder.full.json` / `lite.json`（改）

各加一行：`"afterSign": "build/notarize-adhoc.js"`。

## 数据流 / 版本来源

- `download-binaries.mjs` 已从 `releases/latest/download/` 拉 yt-dlp（mac/win/linux 各对应 URL），
  ffmpeg 各平台各自源。每次 CI 构建都重新拉 → full 包总是内置最新 yt-dlp。
- `binaries/` 在 .gitignore 中，CI 现拉现用，不入库。

## 错误处理 / 边界

- download-binaries 失败（如限流）→ build job 失败，不发布坏包。
- 某一平台 job 失败 → release job 因 `needs` 不满足而不执行（默认）。
- mac 签名失败 → afterSign 抛错 → dist 失败 → 同上。

## 产物命名（沿用现有 artifactName，不改）

- mac full：`Video Downloader-<ver>-full-<arch>.dmg`
- mac lite：`Video Downloader Lite-<ver>-lite-<arch>.dmg`
- win full：`Video Downloader-<ver>-full-x64.exe`
- win lite：`Video Downloader Lite-<ver>-lite-x64.exe`

## 测试策略

- workflow 无单元测试，靠实际推 tag 触发一次验证端到端。
- afterSign 钩子逻辑简单，本地 `npm run dist:lite` 跑一次即可验证（签名 `codesign --verify` 通过）。

## 不做（YAGNI）

- 不打 Linux。
- 不做真 Apple 证书公证（无账号）。
- 不改 ffmpeg 下载源。
- 不为 lite 单独跳过 download-binaries（多拉一次 binaries 成本可忽略，且 full 也需要）。
