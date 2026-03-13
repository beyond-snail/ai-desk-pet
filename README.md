# AI Desk Pet

桌面端 AI 桌宠项目。当前分支已执行主线切换，研发主路径为 `Runtime3D (Qt6 + Godot)`，并采用 `macOS 先行` 策略。

## 当前状态

- 主线：`Runtime3D`（A 阶段 + B/C/D/E 基础链路已落地）
- 研发策略：视觉与性能优先，先切换再回填玩法
- 执行方式：按 `A-G` 阶段任务书推进
- 当前默认入口：`npm start` / `npm run dev` -> Runtime3D bootstrap

说明：
- `technical-documentation.md` 当前仅作为 Electron 时代的历史快照，不再作为本分支的主执行基线。
- `docs/新技术方案.md` 保留为外部提案输入，不作为执行依据。

## 文档入口

- 文档权威说明：[docs/document-authority.md](docs/document-authority.md)
- 产品路线图：[docs/product-roadmap-2026.md](docs/product-roadmap-2026.md)
- 3D 换轨主方案：[docs/3d-runtime-migration-spec.md](docs/3d-runtime-migration-spec.md)
- 3D 换轨任务书（Codex 执行）：[docs/3d-runtime-migration-tasks-for-codex.md](docs/3d-runtime-migration-tasks-for-codex.md)
- 3D 基线报告（迁移前）：[docs/3d-runtime-baseline-2026-03-13.md](docs/3d-runtime-baseline-2026-03-13.md)
- 3D 阶段报告（B 阶段）：[docs/runtime3d-stage-b-report-2026-03-13.md](docs/runtime3d-stage-b-report-2026-03-13.md)
- 3D 阶段报告（C 运动基础）：[docs/runtime3d-stage-c-motion-foundation-2026-03-13.md](docs/runtime3d-stage-c-motion-foundation-2026-03-13.md)
- 3D 阶段报告（D 交互基础）：[docs/runtime3d-stage-d-interaction-foundation-2026-03-13.md](docs/runtime3d-stage-d-interaction-foundation-2026-03-13.md)
- 3D 阶段报告（E 迁移基础）：[docs/runtime3d-stage-e-migration-foundation-2026-03-13.md](docs/runtime3d-stage-e-migration-foundation-2026-03-13.md)
- ADR 决策记录：`docs/adr/*`
- 历史实现快照：[technical-documentation.md](technical-documentation.md)
- 外部提案输入（仅参考）：[docs/新技术方案.md](docs/新技术方案.md)

## 开发命令

```bash
npm install
npm run check
npm start
```

附加命令：

```bash
npm run start:runtime3d
npm run check:runtime3d
npm run smoke:runtime3d:ipc
npm run smoke:runtime3d:motion
npm run smoke:runtime3d:migration
npm run build
```

说明：
- 当前仍使用 `npm scripts` 作为统一任务编排入口（校验、bootstrap、后续构建流水线占位）。
- 这不代表运行时仍是 Electron 主线；运行时主线目标是 `Qt6 + Godot`。
- `npm run check` 会执行 runtime3d IPC 冒烟（Godot/Qt 双进程握手）。
- `npm run check` 还会执行默认机器人运动仿真冒烟（状态机 + 离屏回归）。
- `npm run check` 还会覆盖 D 阶段最小交互链路（四动作 + 聊天流式 + 语音/TTS）。
- `npm run check` 还会覆盖 E 阶段迁移冒烟（空/普通/重度样本 + 幂等性）。

## 项目结构（当前主线相关）

```text
ai-desk-pet/
├── runtime/
│   ├── godot/
│   ├── qt-sidecar/
│   ├── shared-ipc/
│   └── migration/
├── docs/
│   ├── adr/
│   ├── 3d-runtime-migration-spec.md
│   ├── 3d-runtime-migration-tasks-for-codex.md
│   └── 3d-runtime-baseline-2026-03-13.md
├── scripts/
└── src/                      # 历史 Electron 代码快照（迁移窗口期参考）
```

## 许可证

ISC License
