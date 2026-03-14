# 文档权威级别说明

本文档用于说明仓库内各 Markdown 文档的用途和权威级别，避免代理在全量读取时混用历史规划、商业分析和当前实现基线。

## 1. 最高优先级

### `docs/runtime3d-product-requirements-v1.md`
用途：Runtime3D cleanroom 需求基线。

应相信它用于：
- 功能范围与验收口径
- “玩法语义不变”边界

### `docs/runtime3d-development-checklist-v1.md`
用途：Runtime3D cleanroom 逐项推进清单。

应相信它用于：
- 任务状态
- 阶段验收
- 交付节奏

### `docs/runtime3d-feature-parity-baseline-main.md`
用途：main 与 runtime3d 的功能对齐说明。

应相信它用于：
- 玩法等价判断
- 是否发生功能缩减判断

### `technical-documentation.md`
用途：当前实现基线文档。

应相信它用于：
- 当前桌面端 v1.0 的真实实现状态
- 当前交互模型
- 当前性能结论
- 当前架构、模块、约束和后续建议

如果其他文档与它冲突，以它为准。

### `README.md`
用途：项目对外入口说明。

应相信它用于：
- 当前产品范围
- 当前已实现能力概览
- 本地开发与打包方式

如果和 `technical-documentation.md` 冲突，以 `technical-documentation.md` 为准。

## 2. 当前有效的专项文档

### `docs/product-roadmap-2026.md`
用途：当前有效的中长期产品规划文档。

只应在以下场景使用：
- 版本路线图（v1.2/v1.3/v1.4/v2.0）
- 北极星指标与阶段目标
- 产品优先级和方向判断

若涉及“当前是否已实现”，仍以 `technical-documentation.md` 为准。

### `docs/product-role-handover.md`
用途：产品角色接管与执行节奏文档。

只应在以下场景使用：
- Claude 离岗后的产品职责承接
- 需求流转模板与发布门禁
- 迭代节奏与执行约束

若涉及具体代码行为或实现细节，以 `technical-documentation.md` 为准。

### `docs/desktop-release-v1.md`
用途：桌面端 v1.0 的打包与发布补充说明。

只应在以下场景使用：
- 安装形态
- 桌面分发产物
- CI / Release 工作流理解

若涉及交互、实现细节或当前行为，以 `technical-documentation.md` 为准。

### `docs/macos-signing-setup.md`
用途：macOS 签名与 notarization 准备说明。

只应在以下场景使用：
- CSR / 私钥准备
- Apple Developer 证书准备
- GitHub Secrets 配置
- notarization 环境变量准备

## 3. 历史 / 参考文档

以下文档不应被当作当前实现依据。
如无特殊需要，代理应忽略 `docs/archive/` 目录中的内容。


### `docs/archive/development-plan.md`
性质：早期开发规划文档。

问题：
- 包含早期阶段拆分
- 含有过时的交互和实现假设
- 不代表当前代码基线

### `docs/archive/codex-instructions-stages-7-13.md`
性质：阶段性执行指令历史记录。

问题：
- 是当时的分阶段实现说明，不是当前状态总结
- 只能作为“已做过哪些事情”的历史上下文
- 不应覆盖当前交互或性能决策

### `docs/archive/business-plan.md`
性质：商业规划文档。

问题：
- 用于商业模式、用户画像和市场定位分析
- 不应用于推导当前实现、技术架构或当前交互

### `docs/character-design-spec.md`
性质：角色视觉与风格参考文档。

问题：
- 只适合用于理解角色外观方向
- 不是当前交互、性能和实现细节的权威来源

## 4. Claude / 代理读取建议

如果代理会读取所有文档，请按以下顺序建立认知：

1. `technical-documentation.md`
2. `README.md`
3. `docs/runtime3d-product-requirements-v1.md`
4. `docs/runtime3d-development-checklist-v1.md`
5. `docs/runtime3d-feature-parity-baseline-main.md`
6. `docs/product-roadmap-2026.md`
7. `docs/product-role-handover.md`
8. `docs/desktop-release-v1.md`
9. `docs/macos-signing-setup.md`
10. 其他历史 / 参考文档仅作补充，不作实现依据

## 5. 冲突处理规则

如果两份文档冲突，按以下优先级解决：

1. `technical-documentation.md`
2. `README.md`
3. `docs/runtime3d-product-requirements-v1.md`
4. `docs/runtime3d-development-checklist-v1.md`
5. `docs/runtime3d-feature-parity-baseline-main.md`
6. 当前有效专项文档（按读取建议顺序）
7. 历史 / 参考文档


## 6. 归档约定

- `docs/archive/` 保存历史规划和历史执行文档
- 根路径同名文件现在只保留归档入口，避免旧内容继续污染全局读取
- 新的当前实现说明只应继续写入 `technical-documentation.md`
