# AI Desk Pet

桌面端 AI 桌宠项目。当前分支已完成主线替换，默认运行时为 `Runtime3D (Qt6 + Godot)` 的 release-native 路径。

## 当前状态

- 主线：`Runtime3D release-native`
- 策略：`Mac 先行`，按上线门禁推进
- 默认入口：`npm start` / `npm run build` 均为 release-native
- 玩法运行体：`runtime/native/*/{qt-sidecar,godot-runtime}` 原生二进制（非 npm 运行）
- 历史 Electron 实现仅保留在 `src/` 与 `technical-documentation.md` 作为参考快照

## 文档入口

- 文档权威说明：[docs/document-authority.md](docs/document-authority.md)
- 3D 主方案：[docs/3d-runtime-migration-spec.md](docs/3d-runtime-migration-spec.md)
- 3D 任务书：[docs/3d-runtime-migration-tasks-for-codex.md](docs/3d-runtime-migration-tasks-for-codex.md)
- 原生切换说明（2026-03-14）：[docs/runtime3d-release-native-switch-2026-03-14.md](docs/runtime3d-release-native-switch-2026-03-14.md)
- 平台安装说明：[docs/runtime3d-platform-installation.md](docs/runtime3d-platform-installation.md)
- Final DoD 状态：[docs/runtime3d-final-dod-status-2026-03-13.md](docs/runtime3d-final-dod-status-2026-03-13.md)

## 命令

基础命令：

```bash
npm run check
npm start
npm run build
```

专项命令：

```bash
npm run check:runtime3d
npm run check:runtime3d:native
npm run smoke:runtime3d:ipc
npm run smoke:runtime3d:motion
npm run smoke:runtime3d:migration
npm run smoke:runtime3d:backfill
npm run smoke:runtime3d:performance
```

## Release 门禁

上线候选门禁：

```bash
npm run check
npm run check:runtime3d:native
npm run build:runtime3d:release
```

说明：`build:runtime3d:release` 会在生成 dmg 后自动执行 `.app` 冒烟自测（挂载/启动/握手/卸载）。

候选产物：

- `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-manifest-<platform-arch>.json`
- `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-performance-<platform-arch>.json`
- `dist/runtime3d-release/<platform-arch>/AIDeskPet-runtime3d-<platform-arch>.dmg`
- `/Volumes/AIDeskPet-runtime3d-<platform-arch>/AIDeskPet.app`
- `/Volumes/AIDeskPet-runtime3d-<platform-arch>/Applications`（拖拽安装目标）

## Native 运行时约定

原生运行时清单位于：

- `runtime/native/manifest.json`

当前仓库已提供可执行原生运行时（由 `runtime/native-src` 编译产出），保持同名入口：

- `qt-sidecar`
- `godot-runtime`

## 许可证

ISC License
