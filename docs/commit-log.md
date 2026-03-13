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
6. 使用 `git status --short` 二次确认工作区状态（是否还有未提交改动）。
7. 将本次提交记录追加到本文件。

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
  4. `git status --short` 检查剩余未提交文件。

