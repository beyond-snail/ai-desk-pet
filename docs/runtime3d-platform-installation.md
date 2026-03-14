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

挂载 dmg 后，卷内包含：

- `AIDeskPet-runtime3d-launcher-<platform-arch>.sh`
- `AIDeskPet-runtime3d-install-<platform-arch>.txt`
- `runtime/native/*`

## 2. macOS 安装与运行

### 2.1 Intel (x64)

1. 解压：

```bash
cd dist/runtime3d-release/darwin-x64
hdiutil attach AIDeskPet-runtime3d-darwin-x64.dmg
```

2. 进入应用目录并运行：

```bash
cd /Volumes/AIDeskPet-runtime3d-darwin-x64
chmod +x AIDeskPet-runtime3d-launcher-darwin-x64.sh
./AIDeskPet-runtime3d-launcher-darwin-x64.sh
```

3. 交互冒烟运行（可选）：

```bash
RUNTIME3D_SCENARIO=interaction-smoke ./AIDeskPet-runtime3d-launcher-darwin-x64.sh
```

4. 卸载镜像（运行完成后）：

```bash
hdiutil detach /Volumes/AIDeskPet-runtime3d-darwin-x64
```

### 2.2 Apple Silicon (arm64)

1. 解压：

```bash
cd dist/runtime3d-release/darwin-arm64
hdiutil attach AIDeskPet-runtime3d-darwin-arm64.dmg
```

2. 进入应用目录并运行：

```bash
cd /Volumes/AIDeskPet-runtime3d-darwin-arm64
chmod +x AIDeskPet-runtime3d-launcher-darwin-arm64.sh
./AIDeskPet-runtime3d-launcher-darwin-arm64.sh
```

3. 交互冒烟运行（可选）：

```bash
RUNTIME3D_SCENARIO=interaction-smoke ./AIDeskPet-runtime3d-launcher-darwin-arm64.sh
```

4. 卸载镜像（运行完成后）：

```bash
hdiutil detach /Volumes/AIDeskPet-runtime3d-darwin-arm64
```

## 3. Windows 安装说明（预留）

当前仓库尚未输出 `win32-x64` 安装包。

计划接入后将提供：

- `dist/runtime3d-release/win32-x64/AIDeskPet-runtime3d-win32-x64.zip`
- `dist/runtime3d-release/win32-x64/run-runtime3d.bat`

## 4. Linux 安装说明（预留）

当前仓库尚未输出 `linux-x64` 安装包。

计划接入后将提供：

- `dist/runtime3d-release/linux-x64/AIDeskPet-runtime3d-linux-x64.tar.gz`（Linux 保持 tar.gz）
- `dist/runtime3d-release/linux-x64/AIDeskPet-runtime3d-linux-x64/AIDeskPet-runtime3d-launcher-linux-x64.sh`

## 5. 验证命令

在仓库根目录执行：

```bash
npm run check
npm run build:runtime3d:release
```

构建完成后，确认对应平台目录下存在上述 4 类文件。
