# Runtime3D 开发任务清单 v1（cleanroom）

状态图例：`[ ]` 未开始，`[~]` 进行中，`[x]` 已完成，`[!]` 阻塞

## 0. 执行规则（强制）

1. 先读需求文档：`docs/runtime3d-product-requirements-v1.md`
2. 再按清单逐项实现
3. 每项完成后立即更新状态
4. 每次非 trivial 改动必须：
- 执行 `make check-runtime3d`
- 同步文档
- 中文提交并 push

## 1. 治理与基线

- [x] G1 新 cleanroom 分支建立并推送
- [x] G2 项目内中文 skill 建立
- [x] G3 非 npm 命令链路建立（Makefile + shell）
- [x] G4 需求文档与清单文档落盘

## 2. 玩法对齐与重构

- [x] A1 玩法对齐矩阵（main vs runtime3d）补齐
- [x] A2 角色系统迁移（保持语义一致）
- [x] A3 聊天/四动作/成长/专注/主动/天气/多宠物迁移

## 3. 3D 角色方案

- [x] B1 SVG 占位 3D 表现接入（rainbow-bot）
- [x] B2 全角色占位 3D 表现接入
- [x] B3 正式 3D 模型替换接口预留

## 4. 打包与验收

- [ ] C1 dmg-only 打包收口（Mac）
- [ ] C2 打包后自动冒烟（挂载/启动/核心交互）
- [ ] C3 30 分钟稳定性与性能门槛验证

## 5. 当前验收证据（2026-03-14）

1. 角色语义与切换链路：`scripts/smoke-all-roles-3d-proxy.mjs` + `scripts/smoke-runtime3d-parity-domains.mjs`
2. 玩法域覆盖：`scripts/smoke-runtime3d-parity-domains.mjs`（聊天/四动作/成长/专注/主动/天气/多宠物）
3. runtime3d 命名空间接入：`src/renderer/runtime3d/runtime3d-bootstrap.js` + `src/renderer/index.html`
4. 正式 3D 模型替换接口：`src/renderer/runtime3d/runtime3d-model-profiles.js` + 角色渲染数据口
