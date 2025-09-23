# Video Downloader App

基于 Electron 和 TypeScript 的现代化视频下载器，使用 yt-dlp 和 ffmpeg 二进制文件，无需 Python 环境。

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)
![Electron](https://img.shields.io/badge/electron-27.0.0-blue.svg)

## 🌟 特性

- 🚀 **无需 Python 环境** - 使用预编译的二进制文件
- 📘 **TypeScript 支持** - 类型安全的现代化开发体验
- 🎬 **多平台支持** - 支持 YouTube, Bilibili, Twitter 等主流视频平台
- 💻 **跨平台** - Windows, macOS, Linux 全平台支持
- 🎨 **现代化 UI** - 美观直观的用户界面
- 📊 **实时进度** - 下载进度实时显示
- 🎵 **音频提取** - 支持仅下载音频 (MP3)
- 📁 **灵活输出** - 自定义下载目录
- 🔧 **格式选择** - 支持多种视频格式和质量选择

## 📸 截图

*TODO: 添加应用截图*

## 🚀 快速开始

### 方法一：自动安装 (推荐)

#### Windows
```batch
# 克隆项目
git clone https://github.com/your-username/video-downloader-app.git
cd video-downloader-app

# 运行安装脚本
scripts\setup.bat
```

#### macOS/Linux
```bash
# 克隆项目
git clone https://github.com/your-username/video-downloader-app.git
cd video-downloader-app

# 运行安装脚本
chmod +x scripts/setup.sh
./scripts/setup.sh
```

### 方法二：手动安装

1. **安装依赖**
   ```bash
   npm install
   ```

2. **下载二进制文件**
   ```bash
   # 自动下载 yt-dlp
   node download-binaries.js
   
   # 手动下载 ffmpeg (参考 binaries/README.md)
   ```

3. **启动应用**
   ```bash
   npm start
   ```

## 📋 系统要求

- Node.js 16.0 或更高版本
- npm 或 yarn 包管理器
- 足够的磁盘空间用于下载的视频文件

## 🛠️ 开发

### 开发模式
```bash
npm run dev
```

### 构建应用
```bash
# 构建当前平台
npm run build

# 仅打包不安装
npm run pack

# 构建所有平台 (需要相应平台的二进制文件)
npm run dist
```

### 项目结构
```
video-downloader-app/
├── src/                 # TypeScript 源文件
│   ├── main.ts         # 主进程文件
│   ├── preload.ts      # 预加载脚本
│   ├── renderer.ts     # 渲染进程脚本
│   ├── download-binaries.ts # 二进制文件下载脚本
│   └── types.ts        # 类型定义
├── dist/               # 编译后的 JavaScript 文件
├── index.html          # 主界面
├── styles.css          # 样式文件
├── package.json        # 项目配置
├── tsconfig.json       # TypeScript 配置
├── .eslintrc.json      # ESLint 配置
├── assets/             # 应用图标
├── binaries/           # 二进制文件目录
│   ├── win32/         # Windows 二进制文件
│   ├── darwin/        # macOS 二进制文件
│   └── linux/         # Linux 二进制文件
└── scripts/           # 构建和开发脚本
```

## 📦 二进制文件

应用依赖以下二进制文件：

- **yt-dlp**: 视频下载核心
- **ffmpeg**: 音视频处理

### 自动下载
```bash
npm run download-binaries
```

### 手动下载
详细说明请参考 [`binaries/README.md`](binaries/README.md)

## 🎯 使用方法

1. **输入视频链接** - 支持主流视频平台的 URL
2. **获取视频信息** - 点击"获取信息"按钮
3. **选择下载选项** - 选择视频格式或音频模式
4. **选择下载目录** - 设置文件保存位置
5. **开始下载** - 点击下载按钮并等待完成

### 支持的平台

- YouTube
- Bilibili
- Twitter
- Facebook
- Instagram
- TikTok
- 以及 yt-dlp 支持的其他 1000+ 网站

## 🔧 配置

### 自定义 yt-dlp 参数
可以在 `src/main.ts` 中修改 yt-dlp 的调用参数来自定义行为。

### 添加新的视频格式
在 `src/renderer.ts` 中修改格式选择逻辑。

### TypeScript 开发
- 修改 `src/` 目录下的 TypeScript 文件
- 运行 `npm run build` 编译到 `dist/` 目录
- 使用 `npm run build:watch` 进行实时编译

## 🐛 故障排除

### 常见问题

1. **二进制文件未找到**
   - 确保 `binaries/` 目录下有对应平台的文件
   - 检查文件权限 (macOS/Linux 需要执行权限)

2. **下载失败**
   - 检查网络连接
   - 确认视频 URL 有效
   - 查看应用日志获取详细错误信息

3. **权限问题 (macOS/Linux)**
   ```bash
   chmod +x binaries/darwin/yt-dlp
   chmod +x binaries/darwin/ffmpeg
   ```

4. **安全警告 (macOS)**
   - 系统偏好设置 → 安全性与隐私 → 允许应用运行

### 日志查看
应用内置日志面板会显示详细的操作信息和错误消息。

## 🤝 贡献

欢迎贡献代码！请遵循以下步骤：

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目基于 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - 强大的视频下载工具
- [FFmpeg](https://ffmpeg.org/) - 音视频处理库
- [Electron](https://www.electronjs.org/) - 跨平台桌面应用框架

## 📞 支持

如果你喜欢这个项目，请给它一个 ⭐！

有问题或建议？欢迎创建 [Issue](https://github.com/your-username/video-downloader-app/issues)。

---

**免责声明**: 请遵守各视频平台的服务条款，仅下载你有权下载的内容。
