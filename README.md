# AI Desk Pet

桌面端 AI 桌宠项目。当前分支已完成主线替换，默认运行时为 `Runtime3D (Qt6 + Godot)` 的 release-native 路径。

## 当前状态

- 主线：`Runtime3D release-native`
- 策略：`Mac 先行`，按上线门禁推进
- 默认入口：`npm start` / `npm run build` 均为 release-native
- 历史 Electron 实现仅保留在 `src/` 与 `technical-documentation.md` 作为参考快照

## 文档入口

- 文档权威说明：[docs/document-authority.md](docs/document-authority.md)
- 3D 主方案：[docs/3d-runtime-migration-spec.md](docs/3d-runtime-migration-spec.md)
- 3D 任务书：[docs/3d-runtime-migration-tasks-for-codex.md](docs/3d-runtime-migration-tasks-for-codex.md)
- 原生切换说明（2026-03-14）：[docs/runtime3d-release-native-switch-2026-03-14.md](docs/runtime3d-release-native-switch-2026-03-14.md)
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

候选产物：

- `dist/runtime3d-release/release-manifest.json`
- `dist/runtime3d-release/performance-report.json`
- `dist/runtime3d-release/AIDeskPet-runtime3d-<platform-arch>.tar.gz`

## Native 运行时约定

原生运行时清单位于：

- `runtime/native/manifest.json`

当前仓库提供 `darwin-arm64` / `darwin-x64` shim 产物用于门禁验证。  
生产部署时应替换为真实 Qt6 / Godot 二进制，并保持同名入口：

- `qt-sidecar`
- `godot-runtime`

## 许可证

ISC License
