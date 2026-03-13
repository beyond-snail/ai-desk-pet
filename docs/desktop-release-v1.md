# Desktop Release Guide v1.0

> 文档状态：当前有效的发布补充文档。
>
> 这份文档只用于桌面端打包、安装形态和发布流程说明。
> 如涉及当前实现行为或交互模型，请以 [../technical-documentation.md](../technical-documentation.md) 为准。


本文档描述桌面端 v1.0 的安装形态、打包命令、CI 构建方式和当前验证状态。

## 1. 用户拿到的是什么

桌面端安装包按平台分发：
- macOS: `AI桌宠-<version>-<arch>.dmg`
- Windows: `AI桌宠-<version>-x64.exe`
- Linux: `AI桌宠-<version>-x64.AppImage`

安装后，应用表现为：
- 一个透明、无边框、置顶的 Electron 桌面窗口
- 一个可交互的桌宠角色，常驻桌面
- 一个系统托盘入口，用于显示、隐藏、设置和退出

## 2. 桌宠运行形态

运行时并不是传统主窗口应用，而是“桌面层 UI”：
- 覆盖桌面区域的透明窗口负责渲染宠物和浮层
- 宠物可以在桌面范围内移动
- 非交互区域自动鼠标穿透，避免干扰用户操作
- 交互区域包括宠物本体、输入面板、设置面板、角色选择面板和多宠物管理面板

## 3. 本地构建命令

### macOS

标准命令：

```bash
npm run build:mac
```

如果 `electron-builder` 下载 Electron 官方 zip 超时，改用本地分发包：

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

### 本地交付收口

```bash
npm run build:dist
```

## 4. CI 构建

GitHub Actions 工作流：
- `.github/workflows/desktop-build.yml`

CI 行为：
- macOS: 执行 `npm run build:mac:local`
- Windows: 执行 `npm run build:win`
- Linux: 执行 `npm run build:linux`
- 三平台统一上传 `dist/` 产物

正式发布工作流：
- `.github/workflows/release.yml`
- 标签格式：`v*`
- Release 资产由 GitHub Actions 直接挂到 Draft Release
- 应用内自动更新已可基于 GitHub Releases 元数据继续对接，目标仓库为 `beyond-snail/ai-desk-pet`

## 5. macOS 打包注意事项

项目已补齐：
- Hardened Runtime
- macOS entitlements
- 本机 `x64` DMG 打包验证

正式发布所需 secrets：
- `CSC_LINK`
- `CSC_KEY_PASSWORD`
- `APPLE_API_KEY` + `APPLE_API_KEY_ID` + `APPLE_API_ISSUER`
  或 `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD` + `APPLE_TEAM_ID`
  或 `APPLE_KEYCHAIN_PROFILE`

当前仍需在正式发布前由仓库管理员提供真实签名材料：
- `Developer ID Application` 证书
- notarization 凭据

## 6. 当前验证状态

已验证：
- `npm run check` 通过
- 三套内置角色可渲染并切换
- Electron 源码模式可启动
- `npm run build:mac:local` 可生成 DMG
- `dist/mac/AI桌宠.app` 可启动

未在当前机器实测：
- Windows 安装包运行验证
- Linux AppImage 运行验证
- macOS 正式签名与 notarization
