# Rainbow Bot 问题修复说明（2026-03-13）

## 问题背景
针对当前 AI 桌宠中 Rainbow Bot 的用户反馈，集中修复以下四类问题：

1. 头部天线缺失。
2. 走动过程中出现高频闪动。
3. 巡游时朝向不独立、动作僵硬。
4. 长时间运行后 CPU 占用偏高。

## 本次改动

### 1. 外观修复：补回头部天线
- 为 Rainbow Bot 全部 Sprite 帧（`assets/*.svg`）补充天线结构，保证各情绪和行走帧一致可见。
- 同时保留样式层天线微摆动变量，使运动时视觉更自然。

### 2. 防闪烁：行走状态防抖与保持
- 在 `CharacterAnimator.applyRainbowBot` 内增加行走状态短暂保持（约 260ms）。
- 解决速度阈值附近的 `walk`/`idle` 高频切换，降低帧序列频繁重置造成的闪动感。
- 在 `Caterpillar.move()` 中加入移动状态保持窗口（约 220ms），避免边界速度抖动导致状态颤动。

### 3. 动作独立性与流畅度
- 鼠标跟随朝向由“全局持续跟随”改为“仅悬停交互时跟随”，巡游阶段保持角色自主朝向。
- 朝向更新加入水平分量死区（`|direction.x| > 0.08`）和变更检测，减少左右抖动翻转。
- Rainbow Bot 行走姿态增加轻微前倾、位移偏置、压缩比例和天线摆动变量，改善僵硬感。

### 4. 长时性能优化
- Rainbow Bot 帧播放循环从高频 `requestAnimationFrame` 改为低频定时调度（按状态 FPS 驱动）。
- 页面隐藏时进一步降频轮询，减少后台无效动画开销。
- 避免重复写入相同 `img.src` / `data-sprite-*`，减少无效 DOM 更新。
- 下调 Rainbow Bot 各状态基础 FPS，并在低功耗模式下进一步降频。

## 影响范围
- `src/renderer/utils/character-animator.js`
- `src/renderer/components/Caterpillar.js`
- `src/renderer/characters/rainbow-bot-character.js`
- `src/renderer/characters/rainbow-bot/style.css`
- `src/renderer/characters/rainbow-bot/assets/*.svg`

## 最低验证
- `npm run check`

## 建议回归关注点
1. Rainbow Bot 在巡游过程中是否持续保持自主朝向。
2. 行走与停下切换时是否已无高频闪动。
3. 运行 30 分钟后的风扇噪声与 CPU 占用是否明显下降。
4. 低功耗状态（系统高负载）下动画是否仍保持可接受流畅度。
