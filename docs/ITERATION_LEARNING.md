# 英语训练（Learning）功能迭代文档（独立模块，低耦合）

## 1. 定位与原则
### 1.1 定位
- 本应用主能力是 **视频下载器**（下载/队列/设置/Cookie）。
- **英语训练**是额外增值能力：把“已存在的本地视频 + 字幕”转换成“句子级训练材料”。

### 1.2 低耦合原则（必须满足）
- **不改下载主链路**：下载页面、队列页面、下载任务模型保持稳定（训练不侵入）。
- **独立入口**：通过新增独立页面 `/learning` 进入训练模块。
- **独立数据域**：训练数据单独持久化（`learningStore`），不写入 `downloadQueue`/`appConfig`。
- **独立 IPC 域**：学习模块所需能力（例如文件选择）通过独立 IPC channel 暴露，不与下载 IPC 交叉污染。

## 2. 范围定义
### 2.1 M1（本次开始实现）：从本地文件创建学习项目
**目标**：跑通“本地选择视频+字幕 → 解析 SRT/VTT → 创建 Project → 浏览句子列表并播放”闭环。

**包含**
- 独立导航入口：英语训练
- Learning Hub（项目列表 + 创建项目）
- 项目详情页：句子列表（Cue）+ 点击播放该句
- 支持字幕格式：`.srt`、`.vtt`
- 本地持久化：项目列表与 cues

**不包含**
- 遮字幕、A/B loop、快捷键（M2）
- 录音、ASR、评分（M3）
- 复习系统、导出（M4）

### 2.2 M2（后续）：句子训练体验
- 遮字幕（显示/隐藏）
- A/B loop（循环当前句）
- 快捷键（空格播放、左右切句、R 重复、H 隐/显）
- 句子收藏、标难度

### 2.3 M3（后续）：口语 Judge（路线 B）
- 句子录音（本地保存）
- 云端 ASR 转写（单句）
- 自算评分（word diff + accuracy + 错词/漏词/多词）
- 历史成绩、最佳成绩

### 2.4 M4（后续）：复习与资料化
- 低分句复习队列（SRS）
- 导出讲义（HTML/PDF）/ Anki
- 双语字幕（可选）

## 3. 用户流程（M1）
1) 用户进入 **英语训练**（/learning）
2) 点击“创建学习项目”
3) 选择本地视频文件
4) 选择本地字幕文件（srt/vtt）
5) 填写/确认项目名称 → 创建
6) 进入项目详情：显示 cue 列表
7) 点击某句：视频跳转到该句起点并播放（简单实现：seek + play）

## 4. 页面与路由（M1）
- `/learning`：Learning Hub（项目列表/创建）
- `/learning/:projectId`：Project Detail（句子列表/播放）

## 5. 数据模型（M1）
### Project
- `id: string`
- `name: string`
- `videoPath: string`
- `subtitlePath: string`
- `createdAt: string (ISO)`
- `updatedAt: string (ISO)`
- `cues: Cue[]`

### Cue
- `id: string`
- `startMs: number`
- `endMs: number`
- `text: string`

## 6. 存储策略（M1）
- zustand persist，独立 key：`learningStore`
- 仅保存训练域数据；删除学习模块不影响下载域。

## 7. 字幕解析策略（M1）
- 支持 `.srt` / `.vtt`
- 规范化：
  - 去 BOM
  - 统一换行
  - 多行字幕合并成一条 text
  - 忽略 VTT header 与注释行
- 时间解析为毫秒：`startMs/endMs`

## 8. IPC（M1）
新增通用文件选择能力（学习模块使用）：
- `select-video-file`：选择视频文件（mp4/mkv/webm/mov 等）
- `select-subtitle-file`：选择字幕文件（srt/vtt）

## 9. 验收标准（M1）
- 能在 `/learning` 创建项目并持久化（重启仍存在）
- SRT/VTT 解析成功，句子列表可浏览
- 点击句子能播放对应片段（至少能 seek 到 startMs 并播放）
- 不影响现有下载功能与队列功能


