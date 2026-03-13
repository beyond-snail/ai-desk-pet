# 代码提交步骤记录

## 目的
- 记录每次代码提交时的执行步骤、范围和校验结果。
- 避免提交遗漏，保证可追溯。

## 标准步骤（每次提交都执行）
1. 使用 `git status --short` 确认改动范围。
2. 使用 `git diff` 核对关键改动，确认没有误改文件。
3. 运行最低校验：`npm run check`。
4. 使用 `git add <files...>` 暂存本次提交范围。
5. 使用中文提交信息执行 `git commit -m "<中文说明>"`。
6. 立即执行 `git push origin <当前分支>`（默认 `main`）。
7. 使用 `git status -sb` 二次确认本地与远端状态（不允许遗留 `ahead`）。
8. 将本次提交记录追加到本文件（包含 `commit` 和 `push` 结果）。

## 提交记录

### 2026-03-13
- 提交哈希：`cc3e12c`
- 提交信息：`perf: migrate rainbow-bot to sprite-frame rendering and add adaptive load shedding`
- 主要内容：
  - Rainbow Bot 迁移为 Sprite 帧序列图片渲染。
  - 增加自动低功耗降载与自适应降帧联动。
  - 清理旧预览资源并同步 README/技术文档。
  - 新增 `docs/product-role-handover.md`。
- 执行步骤：
  1. `git status --short` 查看待提交文件。
  2. `git add` 选择本次相关文件并暂存。
  3. `git commit` 生成提交。
  4. `git push origin main` 推送远端。
  5. `git status -sb` 检查分支是否同步。

### 2026-03-13（补充）
- 提交哈希：`88043a0`
- 提交信息：`补充文档权威说明与毛毛虫3D样式，并新增提交步骤记录`
- 主要内容：
  - 更新 `docs/document-authority.md` 的文档优先级说明。
  - 调整 `caterpillar` 样式细节。
  - 新增 `docs/commit-log.md`。
- 执行结果：
  - 本地提交后已执行 `git push origin main`。
  - 当前状态已同步远端（`main` 无 `ahead`）。

### 2026-03-13（Rainbow Bot 四项修复）
- 提交哈希：`75a30e0`
- 提交信息：`修复AI桌宠Rainbow Bot天线缺失、闪烁与高占用问题`
- 主要内容：
  - 补回 Rainbow Bot 全帧天线素材，并增加轻微摆动姿态。
  - 增加行走状态防抖/保持，修复高频闪动。
  - 调整朝向逻辑：仅悬停交互时看向鼠标，巡游保持自主朝向。
  - 将 Rainbow Bot 帧循环改为低频定时调度，降低长时 CPU 开销。
  - 新增修复文档 `docs/rainbow-bot-fix-2026-03-13.md`。
- 校验与打包：
  - `npm run check` 通过。
  - `npm run build:dist` 通过，生成 `dist/AI桌宠-1.0.0-x64.dmg`。
- 执行步骤：
  1. `git status --short` 确认改动范围。
  2. `git diff --cached` 核对本次提交文件。
  3. `npm run check` 最低校验。
  4. `npm run build:dist` 本地打包验证。
  5. `git commit -m "修复AI桌宠Rainbow Bot天线缺失、闪烁与高占用问题"`。
  6. `git push origin main` 推送失败（HTTP2 framing）。
  7. `git config http.version HTTP/1.1 && git push origin main` 推送成功。
  8. `git status -sb` 确认 `main...origin/main` 无 `ahead`。

### 2026-03-13（一次性提交当前遗留改动）
- 提交哈希：`见本次提交输出`
- 提交信息：`一次性提交当前产品文档与应用配置改动`
- 主要内容：
  - 统一更新产品命名与打包产物文案（AI桌宠）。
  - 同步 README、技术文档、发布说明与 QA 记录。
  - 更新应用入口配置与图标资源。
- 执行步骤：
  1. `git status --short` 确认改动范围。
  2. `git diff --stat` 核对改动摘要。
  3. `npm run check` 执行最低校验。
  4. `git add` 一次性暂存本次全部文件。
  5. `git commit -m "一次性提交当前产品文档与应用配置改动"`。
  6. `git push origin main` 推送远端。
  7. `git status -sb` 确认无 `ahead`。

### 2026-03-13（英文名与桌面图标统一）
- 提交哈希：`见本次提交输出`
- 提交信息：`统一英文产品名AIDeskPet并更新桌面图标`
- 主要内容：
  - 产品名统一为 `AIDeskPet`（`productName` / DMG 标题 / Windows 快捷方式名）。
  - 使用 `assets/icon.png` 重新生成 `assets/icon.icns`，修复 macOS 桌面图标未更新问题。
  - 同步 README、技术文档与发布说明中的产物名称。
- 校验与打包：
  - `npm run check` 通过。
  - `npm run build:dist` 通过，生成 `dist/AIDeskPet-1.0.0-x64.dmg`。
- 执行步骤：
  1. `git status --short` 确认改动范围。
  2. `npm run check` 最低校验。
  3. 重新生成 `assets/icon.icns`。
  4. `npm run build:dist` 本地打包验证。
  5. `git add` 暂存本次文件。
  6. `git commit -m "统一英文产品名AIDeskPet并更新桌面图标"`。
  7. `git push origin main` 推送远端。
  8. `git status -sb` 确认无 `ahead`。
