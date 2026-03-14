# 文档权威级别说明（Runtime3D 主线）

本文档用于统一仓库文档读取顺序，避免代理混用历史 Electron 文档与当前 Runtime3D 执行文档。

## 1. 最高优先级（当前执行基线）

### `docs/3d-runtime-migration-spec.md`
用途：Runtime3D（Qt6 + Godot）主方案。

应相信它用于：
- 目标、约束、架构边界
- IPC 契约
- 性能和包体指标
- 风险处理与阶段切换门槛

若与其他文档冲突，以此为准。

### `docs/3d-runtime-migration-tasks-for-codex.md`
用途：Codex 执行任务书（A-G 阶段拆解）。

应相信它用于：
- 阶段任务、依赖关系
- 验收标准、提交规范
- 阶段推进节奏

若与主方案冲突，以 `docs/3d-runtime-migration-spec.md` 为准。

### `README.md`
用途：项目入口与当前研发状态说明。

应相信它用于：
- 当前主线状态
- 本地开发/校验/构建命令入口
- 关键文档导航

若与主方案冲突，以 `docs/3d-runtime-migration-spec.md` 为准。

## 2. 当前有效专项文档

### `docs/product-roadmap-2026.md`
用途：版本目标与产品优先级。

### `docs/3d-runtime-baseline-2026-03-13.md`
用途：迁移前包体与运行指标基线。

### `docs/runtime3d-stage-b-report-2026-03-13.md`
用途：Runtime3D B 阶段实现与验收记录。

### `docs/runtime3d-stage-c-motion-foundation-2026-03-13.md`
用途：Runtime3D C 阶段（默认机器人运动逻辑）实现与验收记录。

### `docs/runtime3d-stage-d-interaction-foundation-2026-03-13.md`
用途：Runtime3D D 阶段（交互/聊天/语音最小闭环）实现与验收记录。

### `docs/runtime3d-stage-e-migration-foundation-2026-03-13.md`
用途：Runtime3D E 阶段（数据迁移基础）实现与验收记录。

### `docs/runtime3d-stage-f-performance-build-foundation-2026-03-13.md`
用途：Runtime3D F 阶段（性能与构建基础）实现与验收记录。

### `docs/runtime3d-stage-g-backfill-foundation-2026-03-13.md`
用途：Runtime3D G 阶段（玩法回填基础）实现与验收记录。

### `docs/runtime3d-final-dod-status-2026-03-13.md`
用途：Runtime3D A-G 阶段完成状态与 Final DoD 检查记录。

### `docs/runtime3d-release-native-switch-2026-03-14.md`
用途：Runtime3D 默认入口切换到 release-native 的执行说明和门禁标准。

### `docs/adr/*`
用途：Runtime3D 架构决策记录（为什么这么做）。

### `docs/product-role-handover.md`
用途：产品职责承接与执行节奏。

## 3. 历史 / 参考文档（不作为当前实现依据）

### `technical-documentation.md`
性质：Electron 时代实现快照（历史参考）。

限制：
- 可用于追溯历史功能语义
- 不可用于判断当前主线是否已实现
- 不可覆盖 Runtime3D 主方案与任务书

### `docs/新技术方案.md`
性质：外部提案输入文档。

限制：
- 仅用于方案对比和灵感吸收
- 不作为仓库执行基线

### `docs/archive/*`
性质：历史规划与历史执行记录。

限制：
- 只作背景补充，不参与当前冲突决策

## 4. 代理读取建议

### 常规开发场景
1. `README.md`
2. `docs/3d-runtime-migration-spec.md`
3. `docs/3d-runtime-migration-tasks-for-codex.md`
4. `docs/product-roadmap-2026.md`
5. `docs/3d-runtime-baseline-2026-03-13.md`
6. `docs/runtime3d-stage-b-report-2026-03-13.md`
7. `docs/runtime3d-stage-c-motion-foundation-2026-03-13.md`
8. `docs/runtime3d-stage-d-interaction-foundation-2026-03-13.md`
9. `docs/runtime3d-stage-e-migration-foundation-2026-03-13.md`
10. `docs/runtime3d-stage-f-performance-build-foundation-2026-03-13.md`
11. `docs/runtime3d-stage-g-backfill-foundation-2026-03-13.md`
12. `docs/runtime3d-final-dod-status-2026-03-13.md`
13. `docs/runtime3d-release-native-switch-2026-03-14.md`
14. `docs/adr/*`
15. 其他历史/参考文档（按需）

### 3D 换轨实施场景（强制）
1. `docs/product-roadmap-2026.md`
2. `docs/3d-runtime-migration-spec.md`
3. `docs/3d-runtime-migration-tasks-for-codex.md`
4. `docs/3d-runtime-baseline-2026-03-13.md`
5. `docs/runtime3d-stage-b-report-2026-03-13.md`
6. `docs/runtime3d-stage-c-motion-foundation-2026-03-13.md`
7. `docs/runtime3d-stage-d-interaction-foundation-2026-03-13.md`
8. `docs/runtime3d-stage-e-migration-foundation-2026-03-13.md`
9. `docs/runtime3d-stage-f-performance-build-foundation-2026-03-13.md`
10. `docs/runtime3d-stage-g-backfill-foundation-2026-03-13.md`
11. `docs/runtime3d-final-dod-status-2026-03-13.md`
12. `docs/runtime3d-release-native-switch-2026-03-14.md`
13. `docs/adr/*`
14. `README.md`
15. `technical-documentation.md`（仅历史语义比对）

## 5. 冲突处理规则

若文档冲突，按以下优先级处理：

1. `docs/3d-runtime-migration-spec.md`
2. `docs/3d-runtime-migration-tasks-for-codex.md`
3. `README.md`
4. 其他当前有效专项文档
5. 历史/参考文档

## 6. 维护约定

- 当前主线实施说明应更新在 Runtime3D 文档体系（主方案、任务书、ADR、阶段报告）。
- `technical-documentation.md` 保持历史快照属性，除“历史定位声明”外不再增量维护为主基线。
