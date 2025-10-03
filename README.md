# Video Downloader

基于 Electron + React + Material-UI 的现代化视频下载器，使用 yt-dlp 和 ffmpeg。

## ✨ 功能特性

### 🎬 视频下载
- 支持多平台视频下载（YouTube、Bilibili等）
- 自动获取视频信息（标题、上传者、时长）
- 多种格式选择（视频/音频）
- 实时下载进度显示
- Cookie支持（解决403错误）

### 📋 下载队列
- 批量下载管理
- 任务状态追踪（等待、下载中、已完成、失败）
- 自动队列处理
- 失败任务自动重试（最多3次）
- 一键清理已完成/失败任务

### ⚙️ 系统设置
- 默认下载路径配置
- 系统依赖检查（yt-dlp、ffmpeg）
- Cookie使用说明

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```

### 构建应用
```bash
npm run build
```

### 打包为可执行文件
```bash
npm run dist
```

## 📖 使用指南

### 1. 立即下载
1. 在"视频下载"页面输入视频URL
2. 点击"获取信息"
3. 选择下载路径和格式
4. 点击"立即下载"

### 2. 批量下载
1. 添加多个视频到队列
2. 切换到"下载队列"页面
3. 点击"开始下载"
4. 系统自动按顺序下载

### 3. Cookie配置（解决403错误）
如果遇到HTTP 403错误：
1. 进入"系统设置"页面
2. 在"Cookie配置"部分点击"启用Cookie"
3. 关闭所有Chrome浏览器窗口
4. 等待Cookie自动导出
5. 返回下载页面，即可使用Cookie下载受保护的视频

所有下载任务（包括队列中的任务）都会自动使用已启用的Cookie。

## 🛠️ 技术栈

- **前端框架**: React 19 + TypeScript
- **UI库**: Material-UI 7
- **路由**: React Router 7
- **构建工具**: Vite 7
- **桌面框架**: Electron 27
- **下载引擎**: yt-dlp + ffmpeg

## 📁 项目结构

```
listen-bd/
├── src/
│   ├── electron/          # Electron主进程
│   │   ├── main.ts
│   │   └── preload.ts
│   ├── components/        # React组件
│   │   └── Layout.tsx
│   ├── pages/            # 页面组件
│   │   ├── DownloadPage.tsx
│   │   ├── QueuePage.tsx
│   │   └── SettingsPage.tsx
│   ├── utils/            # 工具函数
│   │   └── downloadQueue.ts
│   ├── App.tsx
│   └── main.tsx
├── binaries/             # 二进制文件
│   └── win32/
│       ├── yt-dlp.exe
│       └── ffmpeg.exe
└── index.html
```

## 🎯 主要功能

### 下载队列管理
- ✅ 任务添加和删除
- ✅ 自动队列处理
- ✅ 实时进度更新
- ✅ 失败重试机制
- ✅ 批量操作支持

### Cookie支持
- ✅ 浏览器Cookie导出
- ✅ Cookie文件导入
- ✅ 自动Cookie管理

### 用户体验
- ✅ 现代化UI设计
- ✅ 响应式布局
- ✅ 实时状态反馈
- ✅ 操作日志记录

## 📝 开发说明

### 依赖要求
- Node.js 16+
- npm 或 yarn

### 开发环境
- Windows / macOS / Linux
- Chrome浏览器（用于Cookie导出）

### 构建说明
项目使用 Vite 进行构建，支持热更新（HMR）。

### 打包说明
使用 electron-builder 打包为可执行文件。

## 🐛 常见问题

### HTTP 403 错误
**解决方案**: 使用Cookie功能
1. 关闭Chrome浏览器
2. 使用"自动导出Cookie"功能
3. 或使用浏览器扩展手动导出Cookie文件

### 下载失败
**解决方案**:
1. 检查网络连接
2. 尝试重试功能（自动或手动）
3. 检查视频是否可用

### 队列不自动下载
**解决方案**:
1. 点击"开始下载"按钮
2. 确保有等待中的任务
3. 查看日志了解详细信息

## 📄 许可证

MIT License

## 🙏 致谢

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 强大的视频下载工具
- [ffmpeg](https://ffmpeg.org/) - 音视频处理库
- [Material-UI](https://mui.com/) - React UI组件库
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架
