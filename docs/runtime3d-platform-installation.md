# Runtime3D 平台安装说明

## 1. 产物目录规范

打包后统一输出到按平台标注的目录：

- `dist/runtime3d-release/<platform-arch>/`

常见平台目录：

- `dist/runtime3d-release/darwin-x64/`
- `dist/runtime3d-release/darwin-arm64/`
- `dist/runtime3d-release/win32-x64/`（后续接入）
- `dist/runtime3d-release/linux-x64/`（后续接入）

每个平台目录包含：

- `AIDeskPet-runtime3d-<platform-arch>.dmg`
- `AIDeskPet-runtime3d-manifest-<platform-arch>.json`
- `AIDeskPet-runtime3d-performance-<platform-arch>.json`

挂载 dmg 后，卷内包含标准安装入口：

- `AIDeskPet.app`
- `Applications`（系统应用目录快捷方式）

## 2. macOS 安装与运行

### 2.1 Intel (x64)

1. 挂载 dmg：

```bash
cd dist/runtime3d-release/darwin-x64
open AIDeskPet-runtime3d-darwin-x64.dmg
```

2. 在 Finder 中把 `AIDeskPet.app` 拖到 `Applications`。

3. 从 `应用程序` 启动：

```bash
open /Applications/AIDeskPet.app
```

4. 如需交互冒烟模式（可选）：

```bash
RUNTIME3D_SCENARIO=interaction-smoke /Applications/AIDeskPet.app/Contents/MacOS/AIDeskPet
```

### 2.2 Apple Silicon (arm64)

1. 挂载 dmg：

```bash
cd dist/runtime3d-release/darwin-arm64
open AIDeskPet-runtime3d-darwin-arm64.dmg
```

2. 在 Finder 中把 `AIDeskPet.app` 拖到 `Applications`。

3. 从 `应用程序` 启动：

```bash
open /Applications/AIDeskPet.app
```

4. 如需交互冒烟模式（可选）：

```bash
RUNTIME3D_SCENARIO=interaction-smoke /Applications/AIDeskPet.app/Contents/MacOS/AIDeskPet
```

## 3. Gatekeeper 提示处理（未签名阶段）

若出现“已损坏/无法验证开发者”提示，执行：

```bash
xattr -dr com.apple.quarantine /Applications/AIDeskPet.app
```

然后重新启动：

```bash
open /Applications/AIDeskPet.app
```

## 4. Windows 安装说明（预留）

当前仓库尚未输出 `win32-x64` 安装包。

计划接入后将提供：

- `dist/runtime3d-release/win32-x64/AIDeskPet-runtime3d-win32-x64.zip`
- `dist/runtime3d-release/win32-x64/AIDeskPet.exe`

## 5. Linux 安装说明（预留）

当前仓库尚未输出 `linux-x64` 安装包。

计划接入后将提供：

- `dist/runtime3d-release/linux-x64/AIDeskPet-runtime3d-linux-x64.tar.gz`
- `dist/runtime3d-release/linux-x64/AIDeskPet.AppImage` 或 `AIDeskPet`

## 6. 验证命令

在仓库根目录执行：

```bash
npm run check
npm run build:runtime3d:release
```
