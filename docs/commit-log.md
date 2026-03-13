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
