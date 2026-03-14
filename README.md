# AI Desk Pet

桌面端养成式 AI 桌宠。当前聚焦 v1.0 桌面产品验证，范围为 macOS、Windows、Linux。移动端暂不纳入实现范围。

## Cleanroom 重构分支说明

当前分支 `rewrite/runtime3d-cleanroom` 采用“需求先行 + 清单推进”流程，目标是新技术主线重构且玩法语义保持与 main 一致。

文档入口：

- 需求文档：[docs/runtime3d-product-requirements-v1.md](docs/runtime3d-product-requirements-v1.md)
- 开发清单：[docs/runtime3d-development-checklist-v1.md](docs/runtime3d-development-checklist-v1.md)
- 功能对齐说明：[docs/runtime3d-feature-parity-baseline-main.md](docs/runtime3d-feature-parity-baseline-main.md)
- 项目内 skill：[skills/aideskpet-delivery-governance-cn/SKILL.md](skills/aideskpet-delivery-governance-cn/SKILL.md)

cleanroom 分支命令（非 npm 主入口）：

```bash
make check-runtime3d
make smoke-runtime3d
make build-runtime3d-release
```

## 当前状态

桌面端 v1.0 核心链路已落地，并已进入“交互手感 + 性能收口”阶段：
- Electron 透明置顶桌面窗口
- 角色系统（毛毛虫 / 赛博机器人 / 像素宠物 / 彩虹机器人）
- 彩虹机器人 Sprite 帧序列 2.5D 外观（按情绪/移动播放轻量帧）
- 情绪、照顾、成长、进化
- 内置免费天气（IP 定位 + Open-Meteo）与系统状态联动
- 番茄钟、主动行为、多宠物
- 语音输入 / 回复朗读（基于 Web Speech API）
- 快捷操作条、双击庆祝、拖拽反馈、抚摸手势
- 输入面板重设计：默认隐藏，仅在聊天动作或语音唤醒时展开
- 首次启动引导
- 托盘显隐出入场动画 + 全局热键唤醒语音
- 内置 AI 零配置聊天 + 每日限流
- 角色独立运动参数与连续巡游控制
- 启动时默认不展示快捷操作条
- 运动与动画已合并为单 requestAnimationFrame 主循环，以降低长期运行开销
- 系统高负载下自动降帧（60/30/20 FPS 分档），减少持续运行时 CPU 占用
- 本地 macOS DMG 打包验证通过

详细实现可查看 [technical-documentation.md](technical-documentation.md)。

如果需要让 Claude / 其他代理读取仓库内全部文档，请先看 [docs/document-authority.md](docs/document-authority.md)。
产品角色接管与执行节奏请看 [docs/product-role-handover.md](docs/product-role-handover.md)。

历史规划与历史阶段指令已归档到 `docs/archive/`，根路径仅保留入口说明，避免误读。

## 最终呈现形式

应用安装后，最终呈现为一个长期驻留在桌面上的透明宠物窗口：
- 宠物悬浮在桌面最上层，可自由移动、拖拽、点击交互
- 鼠标不在宠物和面板区域时，窗口自动鼠标穿透，不影响正常桌面操作
- 通过系统托盘控制显示、隐藏、设置和退出，显示/隐藏带出入场动画
- 支持全局热键 `Cmd/Ctrl+Shift+P` 唤醒宠物并自动开启语音输入
- 角色支持成长、情绪变化、天气状态、系统状态和多宠物联动

## 安装形式

桌面端发布产物按平台分发：
- `macOS`: `.dmg`
- `Windows`: `NSIS .exe` 安装包
- `Linux`: `.AppImage`

安装后的应用主体是 Electron 桌面程序，不是浏览器网页，不需要常驻打开开发服务器。

## 已实现功能

- 多角色系统：毛毛虫、赛博机器人、像素宠物、彩虹机器人（默认）
- 宠物移动与交互：连续巡游、拖拽、朝向、单击展开快捷操作条、双击庆祝、抚摸手势
- 输入交互：默认隐藏、按需展开、失焦或点空白自动隐藏
- 对话气泡：跟随宠物平滑移动，自动边界约束与箭头方向修正
- 首次引导：首启自动介绍交互方式，等待用户点击完成引导
- 快捷操作：聊天、喂食、抚摸、清洁
- 对话与命令：内置 LLM 零配置聊天、每日限流、命令分流、语音输入、回复朗读
- 对话记忆：本地记录近期互动并注入聊天上下文
- 养成系统：喂食、抚摸、清洁、成长经验、等级与阶段、状态衰减
- 主动行为：低状态提醒、分时问候、天气评论、靠近鼠标、边缘休息、番茄钟联动
- 专注统计：支持今日/本周专注分钟数与完成次数（命令 `专注报告`）
- 环境联动：内置免费天气、昼夜、屏幕边缘行为、CPU/内存状态响应
- 多宠物：额外宠物实例、简单社交行为
- 桌面集成：托盘、显隐动画、全局热键、开机自启动、自动更新接入位
- 轻量化优化：快捷操作条默认隐藏、天气粒子减量、运动与动画合并单循环、去除高开销 UI 模糊效果

## 技术栈

- Electron
- HTML / CSS / JavaScript
- CSS 动画 + requestAnimationFrame
- electron-store
- electron-builder

## 本地开发

```bash
npm install
npm start
```

说明：
- `npm start` / `npm run dev` 现在通过 `scripts/start-electron.mjs` 启动，会自动清理 `ELECTRON_RUN_AS_NODE` 环境变量，避免 Electron 被错误当作 Node 进程启动。

## 校验命令

```bash
npm run check
```

内容：
- JS 语法检查
- 内置角色配置校验

## 打包命令

### macOS

默认命令：

```bash
npm run build:mac
```

如果当前网络环境会导致 `electron-builder` 下载 Electron 官方压缩包超时，使用本地分发包构建：

```bash
npm run build:mac:local
```

### Windows

```bash
npm run build:win
```

### Linux

```bash
npm run build:linux
```

### 本地桌面分发收口命令

```bash
npm run build:dist
```

说明：
- 先执行 `npm run check`
- 再执行本机可用的 macOS 本地 DMG 构建

## CI 构建

仓库内已提供 GitHub Actions 工作流：
- `.github/workflows/desktop-build.yml`

工作流会在 macOS / Windows / Linux 三个平台上：
- 安装依赖
- 执行 `npm run check`
- 生成桌面安装包
- 上传构建产物

正式发布工作流：
- `.github/workflows/release.yml`
- 触发条件：推送 `v*` 标签
- macOS 发布需配置 `CSC_LINK`、`CSC_KEY_PASSWORD`，以及一组完整的 notarization 凭据
- Release 资产由 GitHub Actions 上传，目标仓库为 `beyond-snail/ai-desk-pet`

## 当前已验证产物

已在本机生成并验证：
- `dist/AIDeskPet-1.0.0-x64.dmg`
- `dist/mac/AIDeskPet.app`

说明：
- 当前 macOS 构建为未签名产物，适合开发验证和内部测试
- 正式分发前建议补齐 `Developer ID Application` 签名与 notarization

## 项目结构

```text
ai-desk-pet/
├── src/
│   ├── main/
│   └── renderer/
├── assets/
├── build/
│   ├── entitlements.mac.plist
│   └── entitlements.mac.inherit.plist
├── scripts/
├── docs/
├── .github/workflows/
├── package.json
└── technical-documentation.md
```

## 许可证

ISC License
