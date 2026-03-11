# 角色视觉设计规范 v2.0

> 文档状态：角色视觉参考文档。
>
> 这份文档主要描述角色外观与视觉风格，不是当前交互、性能和实现行为的权威来源。
> 如与当前实现冲突，以 [../technical-documentation.md](../technical-documentation.md) 为准。


本文档是 Codex 可直接执行的 CSS 升级指令。对三个内置角色的视觉表现进行全面升级，增加表情细节、情绪粒子效果、更丰富的动画。

> 设计稿参考：`docs/character-design-v2.png` / `docs/character-design-v2.drawio`

---

## 通用升级原则

1. **所有尺寸增大 20%** — 当前角色在高分屏上偏小，提升可见性
2. **增加嘴巴元素** — 三个角色都缺少嘴巴，无法表达微笑/悲伤
3. **增加腮红元素** — 用于 happy 状态的可爱表现
4. **眼睛升级为白底+黑瞳** — 更有灵魂感，支持更多表情变化
5. **情绪粒子用 CSS ::after/::before 伪元素实现** — 不增加 DOM 复杂度
6. **所有动画使用 GPU 加速** — transform/opacity only，不触发 layout

---

## 一、毛毛虫 (Caterpillar) 升级

> 参考形象：`assets/caterpillar-reference.png`（绿色身体+黄色斑点+红色触角/腿+橙色腮红）
> 实现方式：CSS 做身体结构和动画，关键表情/装饰用小图片叠加

### 设计要点（对照参考图）

| 部位 | 参考图特征 | CSS 实现 | 图片辅助 |
|------|-----------|---------|---------|
| 身体 | 绿色渐变，6-7 节圆润段 | CSS 圆角 div，渐变 #8BC34A→#689F38 | — |
| 斑点 | 每节身体上有黄色圆斑 | CSS ::before 伪元素，#FFD54F 圆形 | — |
| 头部 | 大圆头，比身体大 1.5x | CSS 圆形 div | 表情图片叠加在头部 |
| 眼睛 | 大黑瞳+白底+高光点 | — | PNG 精灵图（6 种表情） |
| 嘴巴 | 微笑弧线 | — | 包含在表情精灵图中 |
| 腮红 | 橙色椭圆 | CSS 半透明 #FFAB91 | — |
| 触角 | 红色弯曲+圆球顶端 | CSS #E53935 + ::after 球 | — |
| 腿 | 红色小短腿 | CSS #E53935 | — |

### 表情精灵图需求（`assets/caterpillar-faces.png`）

需要制作一张精灵图，包含以下 7 种表情（每个 32x32px）：

| 序号 | 表情 | 对应状态 | 描述 |
|------|------|---------|------|
| 0 | 默认 | idle | 微笑，黑瞳居中 |
| 1 | 开心 | happy | 弯月眼 ◠◠，大微笑 |
| 2 | 困倦 | sleepy | 半闭眼 — —，小嘴 |
| 3 | 饥饿 | hungry | 大水汪汪眼，O 嘴 |
| 4 | 兴奋 | excited | 星星眼 ★★，大笑 |
| 5 | 悲伤 | sad | 下垂眼+泪滴，倒弧嘴 |
| 6 | 嫌弃 | dirty | >_< 眯眼，吐舌 |

> 精灵图暂时可以用 CSS 模拟，等有美术资源后替换为真实图片

### 1.1 template.html 修改

```html
<div id="caterpillar" class="caterpillar" data-character="caterpillar">
  <div class="body">
    <div class="segment"></div>
    <div class="segment"></div>
    <div class="segment"></div>
    <div class="segment"></div>
    <div class="segment"></div>
  </div>
  <div class="head">
    <div class="eye left"></div>
    <div class="eye right"></div>
    <div class="antenna left"></div>
    <div class="antenna right"></div>
    <div class="mouth"></div>
    <div class="blush left"></div>
    <div class="blush right"></div>
  </div>
  <div class="legs">
    <div class="leg left"></div>
    <div class="leg right"></div>
    <div class="leg left"></div>
    <div class="leg right"></div>
    <div class="leg left"></div>
    <div class="leg right"></div>
    <div class="leg left"></div>
    <div class="leg right"></div>
    <div class="leg left"></div>
    <div class="leg right"></div>
  </div>
</div>
```

### 1.2 config.json 修改

更新尺寸（增大 20%）：

```json
{
  "id": "caterpillar",
  "name": "毛毛虫",
  "description": "可爱的绿色小毛毛虫",
  "dimensions": { "width": 96, "height": 48 },
  "animations": {
    "idle": { "speed": 2, "amplitude": 2, "legRotation": 15, "frequency": 0.05 },
    "happy": { "speed": 2.6, "amplitude": 2.8, "legRotation": 18, "frequency": 0.07 },
    "sleepy": { "speed": 0.5, "amplitude": 0.5, "legRotation": 0, "frequency": 0.02 },
    "hungry": { "speed": 1.2, "amplitude": 1.1, "legRotation": 10, "frequency": 0.04 },
    "excited": { "speed": 3.2, "amplitude": 4, "legRotation": 22, "frequency": 0.09 },
    "sad": { "speed": 0.8, "amplitude": 0.8, "legRotation": 6, "frequency": 0.03 }
  },
  "moveParts": {
    "bodySelector": ".segment",
    "limbSelector": ".leg",
    "headSelector": ".head"
  }
}
```

### 1.3 style.css 完整替换

```css
/* ===== 毛毛虫 v2.0 ===== */
/* 配色参考：绿身+黄斑点+红触角/腿+橙腮红 */

/* --- 基础结构 --- */
.caterpillar[data-character='caterpillar'] .body {
  position: relative;
  display: flex;
  align-items: center;
  height: 48px;
  z-index: 1;
}

.caterpillar[data-character='caterpillar'] .segment {
  width: 19px;
  height: 48px;
  background: linear-gradient(135deg, #8BC34A, #689F38);
  border-radius: 24px;
  position: relative;
  box-shadow: inset -2px -2px 5px rgba(0, 0, 0, 0.15);
}

/* 每节段黄色圆斑点（参考图核心特征） */
.caterpillar[data-character='caterpillar'] .segment::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  background: #FFD54F;
  border-radius: 50%;
  opacity: 0.85;
}

/* 白色高光弧用 ::after */
.caterpillar[data-character='caterpillar'] .segment::after {
  content: '';
  position: absolute;
  top: 15%;
  left: 20%;
  width: 50%;
  height: 25%;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
}

/* --- 头部（比身体大 1.5x） --- */
.caterpillar[data-character='caterpillar'] .head {
  position: absolute;
  left: -18px;
  top: 50%;
  transform: translateY(-50%);
  width: 32px;
  height: 40px;
  background: linear-gradient(135deg, #8BC34A, #7CB342);
  border-radius: 18px 18px 14px 14px;
  z-index: 2;
  box-shadow: inset -2px -2px 5px rgba(0, 0, 0, 0.12);
}

/* --- 表情区域（CSS 默认，可被精灵图替换） --- */
/* 当有精灵图时，用 .face-sprite 覆盖此区域 */
.caterpillar[data-character='caterpillar'] .face {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  /* 未来替换为: background: url('../../../assets/caterpillar-faces.png') no-repeat; */
  /* background-position 按 mood 切换精灵图帧 */
}

/* --- 眼睛（CSS 默认版） --- */
.caterpillar[data-character='caterpillar'] .eye {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #ffffff;
  border-radius: 50%;
  top: 8px;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
}

/* 大黑瞳 + 高光点 */
.caterpillar[data-character='caterpillar'] .eye::after {
  content: '';
  position: absolute;
  width: 5px;
  height: 5px;
  background: #1a1a1a;
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 1px -1px 0 0 rgba(255,255,255,0.9); /* 高光点 */
}

.caterpillar[data-character='caterpillar'] .eye.left { left: 4px; }
.caterpillar[data-character='caterpillar'] .eye.right { right: 4px; }

/* --- 嘴巴（微笑弧线） --- */
.caterpillar[data-character='caterpillar'] .mouth {
  position: absolute;
  bottom: 7px;
  left: 50%;
  transform: translateX(-50%);
  width: 8px;
  height: 4px;
  background: transparent;
  border-bottom: 2px solid #558B2F;
  border-radius: 0 0 50% 50%;
}

/* --- 腮红（橙色，默认半透明常显） --- */
.caterpillar[data-character='caterpillar'] .blush {
  position: absolute;
  width: 6px;
  height: 4px;
  background: #FFAB91;
  border-radius: 50%;
  opacity: 0.4;
  top: 20px;
  transition: opacity 0.5s ease;
}

.caterpillar[data-character='caterpillar'] .blush.left { left: 1px; }
.caterpillar[data-character='caterpillar'] .blush.right { right: 1px; }

/* --- 触角：红色弯曲 + 红色圆球顶端（参考图核心特征） --- */
.caterpillar[data-character='caterpillar'] .antenna {
  position: absolute;
  width: 2px;
  height: 12px;
  background: #E53935;
  top: -10px;
  border-radius: 1px;
  transform-origin: bottom;
  animation: caterpillar-antenna-wave 2s infinite ease-in-out;
}

/* 红色圆球顶端 */
.caterpillar[data-character='caterpillar'] .antenna::after {
  content: '';
  position: absolute;
  top: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  background: #E53935;
  border-radius: 50%;
}

.caterpillar[data-character='caterpillar'] .antenna.left {
  left: 6px;
  transform: rotate(-30deg);
  animation-delay: 0s;
}

.caterpillar[data-character='caterpillar'] .antenna.right {
  right: 6px;
  transform: rotate(30deg);
  animation-delay: 1s;
}

/* --- 腿部 --- */
.caterpillar[data-character='caterpillar'] .legs {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.caterpillar[data-character='caterpillar'] .leg {
  position: absolute;
  width: 6px;
  height: 14px;
  background: #E53935;
  border-radius: 3px;
  transform-origin: top;
  animation: caterpillar-leg-move 1s infinite ease-in-out;
}

.caterpillar[data-character='caterpillar'] .leg.left { left: 8px; }
.caterpillar[data-character='caterpillar'] .leg.right { right: 8px; }
.caterpillar[data-character='caterpillar'] .leg:nth-child(1),
.caterpillar[data-character='caterpillar'] .leg:nth-child(2) { top: 2px; animation-delay: 0s; }
.caterpillar[data-character='caterpillar'] .leg:nth-child(3),
.caterpillar[data-character='caterpillar'] .leg:nth-child(4) { top: 11px; animation-delay: 0.2s; }
.caterpillar[data-character='caterpillar'] .leg:nth-child(5),
.caterpillar[data-character='caterpillar'] .leg:nth-child(6) { top: 20px; animation-delay: 0.4s; }
.caterpillar[data-character='caterpillar'] .leg:nth-child(7),
.caterpillar[data-character='caterpillar'] .leg:nth-child(8) { top: 29px; animation-delay: 0.6s; }
.caterpillar[data-character='caterpillar'] .leg:nth-child(9),
.caterpillar[data-character='caterpillar'] .leg:nth-child(10) { top: 38px; animation-delay: 0.8s; }

/* ===== 情绪状态 ===== */

/* --- Happy: 金色光晕 + 弯月眼 + 腮红 + 微笑 --- */
.caterpillar[data-character='caterpillar'][data-mood='happy'] {
  filter: drop-shadow(0 0 12px rgba(255, 213, 79, 0.85));
}

.caterpillar[data-character='caterpillar'][data-mood='happy'] .eye {
  height: 4px;
  border-radius: 4px 4px 0 0;
  overflow: hidden;
}

.caterpillar[data-character='caterpillar'][data-mood='happy'] .eye::after {
  display: none; /* 弯月眼不需要瞳孔 */
}

.caterpillar[data-character='caterpillar'][data-mood='happy'] .blush {
  opacity: 1;
}

.caterpillar[data-character='caterpillar'][data-mood='happy'] .mouth {
  width: 8px;
  height: 4px;
  background: transparent;
  border-bottom: 2px solid #2E7D32;
  border-radius: 0 0 50% 50%;
}

.caterpillar[data-character='caterpillar'][data-mood='happy'] .antenna {
  animation-duration: 1s; /* 加速摆动 */
}

/* Happy 星星粒子 */
.caterpillar[data-character='caterpillar'][data-mood='happy']::after {
  content: '✦';
  position: absolute;
  top: -12px;
  right: -5px;
  font-size: 8px;
  color: #FFD54F;
  animation: caterpillar-sparkle 1.5s infinite ease-in-out;
}

/* --- Sleepy: 暗淡 + 半闭眼 + 触角下垂 + 呼吸 --- */
.caterpillar[data-character='caterpillar'][data-mood='sleepy'] {
  opacity: 0.85;
  filter: saturate(0.75) brightness(0.85);
  animation: caterpillar-breathe 3s infinite ease-in-out;
}

.caterpillar[data-character='caterpillar'][data-mood='sleepy'] .eye {
  height: 2px;
  border-radius: 2px;
  top: 10px;
}

.caterpillar[data-character='caterpillar'][data-mood='sleepy'] .eye::after {
  display: none;
}

.caterpillar[data-character='caterpillar'][data-mood='sleepy'] .antenna.left {
  transform: rotate(40deg);
  animation: none;
}

.caterpillar[data-character='caterpillar'][data-mood='sleepy'] .antenna.right {
  transform: rotate(-40deg);
  animation: none;
}

.caterpillar[data-character='caterpillar'][data-mood='sleepy'] .mouth {
  width: 4px;
  height: 2px;
  border-radius: 50%;
}

.caterpillar[data-character='caterpillar'][data-mood='sleepy'] .leg {
  animation: none;
}

/* Zzz 气泡 */
.caterpillar[data-character='caterpillar'][data-mood='sleepy']::after {
  content: 'z';
  position: absolute;
  top: -16px;
  left: -2px;
  font-size: 10px;
  font-weight: bold;
  color: #7986CB;
  opacity: 0.8;
  animation: caterpillar-zzz 2s infinite ease-in-out;
}

/* --- Hungry: 去饱和 + 大眼 + O嘴 + 抖动 --- */
.caterpillar[data-character='caterpillar'][data-mood='hungry'] {
  filter: saturate(0.7) brightness(0.92);
  animation: caterpillar-tremble 0.3s infinite;
}

.caterpillar[data-character='caterpillar'][data-mood='hungry'] .eye {
  width: 8px;
  height: 8px;
  top: 6px;
}

.caterpillar[data-character='caterpillar'][data-mood='hungry'] .eye::after {
  width: 5px;
  height: 5px;
}

.caterpillar[data-character='caterpillar'][data-mood='hungry'] .mouth {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #2E7D32;
}

/* --- Excited: 绿色强光 + 大弹跳 + 脉冲 --- */
.caterpillar[data-character='caterpillar'][data-mood='excited'] {
  filter: drop-shadow(0 0 16px rgba(105, 240, 174, 0.9));
  animation: caterpillar-pulse 0.8s infinite ease-in-out;
}

.caterpillar[data-character='caterpillar'][data-mood='excited'] .eye {
  width: 8px;
  height: 8px;
}

.caterpillar[data-character='caterpillar'][data-mood='excited'] .blush {
  opacity: 0.8;
}

.caterpillar[data-character='caterpillar'][data-mood='excited'] .antenna {
  animation-duration: 0.5s;
}

/* 彩色粒子 */
.caterpillar[data-character='caterpillar'][data-mood='excited']::after {
  content: '✦✧';
  position: absolute;
  top: -14px;
  right: -8px;
  font-size: 9px;
  color: #69F0AE;
  animation: caterpillar-sparkle 0.8s infinite;
}

/* --- Sad: 灰度 + 下垂 + 泪滴 --- */
.caterpillar[data-character='caterpillar'][data-mood='sad'] {
  opacity: 0.82;
  filter: grayscale(0.25) brightness(0.78);
  transform: translateY(3px);
}

.caterpillar[data-character='caterpillar'][data-mood='sad'] .eye {
  top: 10px;
}

.caterpillar[data-character='caterpillar'][data-mood='sad'] .antenna.left {
  transform: rotate(50deg);
  animation: none;
}

.caterpillar[data-character='caterpillar'][data-mood='sad'] .antenna.right {
  transform: rotate(-50deg);
  animation: none;
}

.caterpillar[data-character='caterpillar'][data-mood='sad'] .mouth {
  width: 8px;
  height: 4px;
  background: transparent;
  border-top: 2px solid #2E7D32;
  border-radius: 50% 50% 0 0;
  border-bottom: none;
}

/* 泪滴 */
.caterpillar[data-character='caterpillar'][data-mood='sad'] .eye.right::before {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 4px;
  background: #90CAF9;
  border-radius: 0 0 50% 50%;
  animation: caterpillar-tear 2s infinite;
}

/* --- Dirty: 脏污 + 斑点 + 臭气 --- */
.caterpillar[data-character='caterpillar'][data-dirty='true'] .segment,
.caterpillar[data-character='caterpillar'][data-dirty='true'] .head,
.caterpillar[data-character='caterpillar'][data-dirty='true'] .leg,
.caterpillar[data-character='caterpillar'][data-dirty='true'] .antenna {
  filter: brightness(0.7) saturate(0.6) sepia(0.15);
}

/* 脏污斑点 */
.caterpillar[data-character='caterpillar'][data-dirty='true'] .segment:nth-child(2)::after,
.caterpillar[data-character='caterpillar'][data-dirty='true'] .segment:nth-child(4)::after {
  content: '';
  position: absolute;
  width: 4px;
  height: 4px;
  background: #795548;
  border-radius: 50%;
  top: 30%;
  left: 30%;
  opacity: 0.6;
}

/* 臭气线 */
.caterpillar[data-character='caterpillar'][data-dirty='true']::before {
  content: '~';
  position: absolute;
  top: -10px;
  left: 50%;
  font-size: 12px;
  color: #8D6E63;
  opacity: 0.6;
  animation: caterpillar-stink 1.5s infinite;
}

/* ===== 关键帧动画 ===== */

@keyframes caterpillar-antenna-wave {
  0%, 100% { transform: rotate(-30deg); }
  50% { transform: rotate(-10deg); }
}

@keyframes caterpillar-leg-move {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(30deg); }
}

@keyframes caterpillar-sparkle {
  0%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
  50% { opacity: 1; transform: translateY(-8px) scale(1); }
}

@keyframes caterpillar-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.97); }
}

@keyframes caterpillar-zzz {
  0% { opacity: 0; transform: translate(0, 0) scale(0.5); }
  50% { opacity: 0.8; transform: translate(4px, -8px) scale(1); }
  100% { opacity: 0; transform: translate(8px, -16px) scale(0.7); }
}

@keyframes caterpillar-tremble {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-1px); }
  75% { transform: translateX(1px); }
}

@keyframes caterpillar-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes caterpillar-tear {
  0% { opacity: 0; transform: translateX(-50%) translateY(0); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateX(-50%) translateY(8px); }
}

@keyframes caterpillar-stink {
  0%, 100% { opacity: 0; transform: translateY(0); }
  50% { opacity: 0.6; transform: translateY(-6px); }
}
```

---

## 二、赛博小机器人 (Cyber-Bot) 升级

### 2.1 template.html 修改

增加胸口小屏幕和表情显示：

```html
<div id="caterpillar" class="caterpillar cyber-bot" data-character="cyber-bot">
  <div class="bot-antenna"></div>
  <div class="bot-shell">
    <div class="bot-panel"></div>
    <div class="bot-eyes">
      <div class="bot-eye left"></div>
      <div class="bot-eye right"></div>
    </div>
    <div class="bot-screen"></div>
  </div>
  <div class="bot-track left"></div>
  <div class="bot-track right"></div>
</div>
```

### 2.2 config.json 修改

尺寸增大 20%：

```json
{
  "id": "cyber-bot",
  "name": "赛博小机器人",
  "description": "方形金属身体，蓝色 LED 眼睛与履带底盘",
  "dimensions": { "width": 103, "height": 70 },
  "animations": {
    "idle": { "speed": 1.8, "amplitude": 1.2, "legRotation": 0, "frequency": 0.035 },
    "happy": { "speed": 2.2, "amplitude": 1.8, "legRotation": 0, "frequency": 0.05 },
    "sleepy": { "speed": 0.4, "amplitude": 0.4, "legRotation": 0, "frequency": 0.015 },
    "hungry": { "speed": 1.1, "amplitude": 1, "legRotation": 0, "frequency": 0.03 },
    "excited": { "speed": 2.8, "amplitude": 2.2, "legRotation": 0, "frequency": 0.07 },
    "sad": { "speed": 0.7, "amplitude": 0.8, "legRotation": 0, "frequency": 0.02 }
  },
  "moveParts": {
    "bodySelector": ".bot-shell",
    "limbSelector": ".bot-track",
    "headSelector": ".bot-shell"
  }
}
```

### 2.3 style.css 完整替换

```css
/* ===== 赛博机器人 v2.0 ===== */

.caterpillar[data-character='cyber-bot'] {
  width: 103px;
  height: 70px;
}

/* --- 壳体 --- */
.caterpillar[data-character='cyber-bot'] .bot-shell {
  position: absolute;
  inset: 12px 12px 16px;
  border-radius: 20px;
  background: linear-gradient(135deg, #546E7A, #90A4AE 50%, #546E7A);
  border: 2px solid rgba(0, 188, 212, 0.4);
  box-shadow: 0 0 20px rgba(0, 188, 212, 0.35), inset 0 -4px 8px rgba(0, 0, 0, 0.2);
}

/* --- 面板 --- */
.caterpillar[data-character='cyber-bot'] .bot-panel {
  position: absolute;
  inset: 8px 14px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(0,0,0,0.15));
}

/* --- LED 眼睛：呼吸动画 --- */
.caterpillar[data-character='cyber-bot'] .bot-eyes {
  position: absolute;
  top: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
}

.caterpillar[data-character='cyber-bot'] .bot-eye {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #4DD0E1;
  box-shadow: 0 0 12px #4DD0E1, 0 0 4px #4DD0E1;
  animation: cyber-eye-breathe 2.5s infinite ease-in-out;
}

/* --- 胸口小屏幕 --- */
.caterpillar[data-character='cyber-bot'] .bot-screen {
  position: absolute;
  bottom: 6px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 10px;
  background: #1B2631;
  border-radius: 3px;
  border: 1px solid rgba(0, 188, 212, 0.3);
  overflow: hidden;
}

/* 屏幕默认显示 :) */
.caterpillar[data-character='cyber-bot'] .bot-screen::after {
  content: ':)';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 7px;
  font-family: monospace;
  color: #4DD0E1;
  line-height: 1;
}

/* --- 天线：脉冲球顶 --- */
.caterpillar[data-character='cyber-bot'] .bot-antenna {
  position: absolute;
  top: 0;
  left: 50%;
  width: 4px;
  height: 18px;
  background: linear-gradient(180deg, #84FFFF, #546E7A);
  transform: translateX(-50%);
}

.caterpillar[data-character='cyber-bot'] .bot-antenna::after {
  content: '';
  position: absolute;
  top: -7px;
  left: 50%;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #84FFFF;
  transform: translateX(-50%);
  box-shadow: 0 0 14px rgba(132, 255, 255, 0.85);
  animation: cyber-antenna-pulse 1.5s infinite ease-in-out;
}

/* --- 履带 --- */
.caterpillar[data-character='cyber-bot'] .bot-track {
  position: absolute;
  bottom: 0;
  width: 32px;
  height: 16px;
  border-radius: 8px;
  background: repeating-linear-gradient(90deg, #263238, #263238 4px, #455A64 4px, #455A64 8px);
  animation: cyber-track 0.5s linear infinite;
}

.caterpillar[data-character='cyber-bot'] .bot-track.left { left: 10px; }
.caterpillar[data-character='cyber-bot'] .bot-track.right { right: 10px; }

/* ===== 情绪状态 ===== */

/* --- Happy: 绿色眼 + 心形屏幕 + 绿光晕 --- */
.caterpillar[data-character='cyber-bot'][data-mood='happy'] .bot-eye {
  background: #69F0AE;
  box-shadow: 0 0 14px #69F0AE, 0 0 6px #69F0AE;
}

.caterpillar[data-character='cyber-bot'][data-mood='happy'] .bot-shell {
  box-shadow: 0 0 24px rgba(105, 240, 174, 0.4), inset 0 -4px 8px rgba(0, 0, 0, 0.18);
}

.caterpillar[data-character='cyber-bot'][data-mood='happy'] .bot-screen::after {
  content: '♥';
  color: #69F0AE;
}

.caterpillar[data-character='cyber-bot'][data-mood='happy'] .bot-antenna::after {
  animation-duration: 0.6s;
}

/* 齿轮粒子 */
.caterpillar[data-character='cyber-bot'][data-mood='happy']::after {
  content: '⚙';
  position: absolute;
  top: -8px;
  right: 5px;
  font-size: 8px;
  color: #69F0AE;
  animation: cyber-particle-float 1.5s infinite;
}

/* --- Sleepy: 暗淡 + 横线眼 + Zzz屏幕 --- */
.caterpillar[data-character='cyber-bot'][data-mood='sleepy'] {
  filter: brightness(0.7);
}

.caterpillar[data-character='cyber-bot'][data-mood='sleepy'] .bot-eye {
  height: 4px;
  border-radius: 999px;
  margin-top: 4px;
  background: #546E7A;
  box-shadow: none;
}

.caterpillar[data-character='cyber-bot'][data-mood='sleepy'] .bot-shell {
  box-shadow: 0 0 8px rgba(0, 188, 212, 0.15), inset 0 -4px 8px rgba(0, 0, 0, 0.2);
}

.caterpillar[data-character='cyber-bot'][data-mood='sleepy'] .bot-screen::after {
  content: 'Zzz';
  color: #546E7A;
}

.caterpillar[data-character='cyber-bot'][data-mood='sleepy'] .bot-antenna::after {
  box-shadow: none;
  background: #546E7A;
}

.caterpillar[data-character='cyber-bot'][data-mood='sleepy'] .bot-track {
  animation: none;
}

/* --- Hungry: 红色警告 + LOW BATTERY 屏幕 --- */
.caterpillar[data-character='cyber-bot'][data-mood='hungry'] .bot-eye {
  background: #FF6D00;
  box-shadow: 0 0 10px #FF6D00;
  animation: cyber-eye-blink-warn 0.8s infinite;
}

.caterpillar[data-character='cyber-bot'][data-mood='hungry'] .bot-shell {
  border-color: rgba(255, 109, 0, 0.5);
  animation: cyber-border-flicker 1s infinite;
}

.caterpillar[data-character='cyber-bot'][data-mood='hungry'] .bot-screen::after {
  content: 'LOW';
  color: #FF6D00;
  animation: cyber-text-blink 1s infinite;
}

.caterpillar[data-character='cyber-bot'][data-mood='hungry'] .bot-antenna::after {
  background: #FF6D00;
  box-shadow: 0 0 10px rgba(255, 109, 0, 0.7);
}

.caterpillar[data-character='cyber-bot'][data-mood='hungry'] .bot-track {
  animation: cyber-track 1.5s linear infinite; /* 变慢 */
}

/* 火花粒子 */
.caterpillar[data-character='cyber-bot'][data-mood='hungry']::after {
  content: '⚡';
  position: absolute;
  bottom: 8px;
  right: 0;
  font-size: 8px;
  animation: cyber-spark 0.6s infinite;
}

/* --- Excited: 彩虹全开 + 星形眼 + 数据流 --- */
.caterpillar[data-character='cyber-bot'][data-mood='excited'] .bot-shell {
  border-color: rgba(255, 255, 255, 0.6);
  animation: cyber-rainbow-border 2s linear infinite;
  box-shadow: 0 0 30px rgba(0, 188, 212, 0.5), 0 0 15px rgba(105, 240, 174, 0.3);
}

.caterpillar[data-character='cyber-bot'][data-mood='excited'] .bot-eye {
  width: 14px;
  height: 14px;
  background: #84FFFF;
  box-shadow: 0 0 16px #84FFFF, 0 0 8px #69F0AE;
  animation: cyber-eye-breathe 0.4s infinite;
}

.caterpillar[data-character='cyber-bot'][data-mood='excited'] .bot-screen::after {
  content: '!!!';
  color: #84FFFF;
  animation: cyber-text-blink 0.3s infinite;
}

.caterpillar[data-character='cyber-bot'][data-mood='excited'] .bot-antenna::after {
  animation: cyber-antenna-spin 0.3s linear infinite;
}

/* 数据流粒子 */
.caterpillar[data-character='cyber-bot'][data-mood='excited']::after {
  content: '01';
  position: absolute;
  top: -10px;
  right: -5px;
  font-size: 7px;
  font-family: monospace;
  color: #84FFFF;
  opacity: 0.7;
  animation: cyber-data-stream 1s infinite;
}

/* --- Sad: 全灰 + 无光 + :( 屏幕 --- */
.caterpillar[data-character='cyber-bot'][data-mood='sad'] {
  filter: grayscale(0.3);
}

.caterpillar[data-character='cyber-bot'][data-mood='sad'] .bot-eye {
  background: #90A4AE;
  box-shadow: none;
  animation: none;
}

.caterpillar[data-character='cyber-bot'][data-mood='sad'] .bot-shell {
  box-shadow: none;
  border-color: rgba(144, 164, 174, 0.3);
}

.caterpillar[data-character='cyber-bot'][data-mood='sad'] .bot-screen::after {
  content: ':(';
  color: #90A4AE;
}

.caterpillar[data-character='cyber-bot'][data-mood='sad'] .bot-antenna {
  transform: translateX(-50%) rotate(-15deg);
  transform-origin: bottom;
}

.caterpillar[data-character='cyber-bot'][data-mood='sad'] .bot-antenna::after {
  background: #90A4AE;
  box-shadow: none;
}

/* --- Dirty --- */
.caterpillar[data-character='cyber-bot'][data-dirty='true'] .bot-shell {
  filter: brightness(0.7) saturate(0.6);
}

.caterpillar[data-character='cyber-bot'][data-dirty='true'] .bot-screen::after {
  content: 'ERR';
  color: #8D6E63;
}

/* ===== 关键帧动画 ===== */

@keyframes cyber-track {
  from { background-position: 0 0; }
  to { background-position: 16px 0; }
}

@keyframes cyber-eye-breathe {
  0%, 100% { opacity: 1; box-shadow: 0 0 12px currentColor, 0 0 4px currentColor; }
  50% { opacity: 0.7; box-shadow: 0 0 6px currentColor, 0 0 2px currentColor; }
}

@keyframes cyber-antenna-pulse {
  0%, 100% { box-shadow: 0 0 14px rgba(132, 255, 255, 0.85); transform: translateX(-50%) scale(1); }
  50% { box-shadow: 0 0 8px rgba(132, 255, 255, 0.4); transform: translateX(-50%) scale(0.85); }
}

@keyframes cyber-antenna-spin {
  from { transform: translateX(-50%) rotate(0deg); }
  to { transform: translateX(-50%) rotate(360deg); }
}

@keyframes cyber-particle-float {
  0%, 100% { opacity: 0; transform: translateY(0) rotate(0deg); }
  50% { opacity: 0.8; transform: translateY(-10px) rotate(180deg); }
}

@keyframes cyber-eye-blink-warn {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

@keyframes cyber-border-flicker {
  0%, 100% { border-color: rgba(255, 109, 0, 0.5); }
  50% { border-color: rgba(255, 109, 0, 0.15); }
}

@keyframes cyber-text-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}

@keyframes cyber-spark {
  0%, 100% { opacity: 0; transform: scale(0.5); }
  50% { opacity: 1; transform: scale(1.2); }
}

@keyframes cyber-rainbow-border {
  0% { border-color: rgba(255, 0, 0, 0.5); }
  16% { border-color: rgba(255, 165, 0, 0.5); }
  33% { border-color: rgba(255, 255, 0, 0.5); }
  50% { border-color: rgba(0, 255, 0, 0.5); }
  66% { border-color: rgba(0, 188, 212, 0.5); }
  83% { border-color: rgba(138, 43, 226, 0.5); }
  100% { border-color: rgba(255, 0, 0, 0.5); }
}

@keyframes cyber-data-stream {
  0% { opacity: 0; transform: translateY(0); }
  50% { opacity: 0.7; }
  100% { opacity: 0; transform: translateY(-12px); }
}
```

---

## 三、像素宠物 (Pixel-Pet) 升级

### 3.1 template.html 修改

增加嘴巴变体支持和汗滴元素：

```html
<div id="caterpillar" class="caterpillar pixel-pet" data-character="pixel-pet">
  <div class="pixel-body">
    <div class="pixel-ear left"></div>
    <div class="pixel-ear right"></div>
    <div class="pixel-face">
      <div class="pixel-eye left"></div>
      <div class="pixel-eye right"></div>
      <div class="pixel-cheek left"></div>
      <div class="pixel-cheek right"></div>
      <div class="pixel-mouth"></div>
    </div>
  </div>
  <div class="pixel-feet">
    <div class="pixel-foot left"></div>
    <div class="pixel-foot right"></div>
  </div>
</div>
```

（HTML 结构不变，保持兼容）

### 3.2 config.json 修改

尺寸增大 20%：

```json
{
  "id": "pixel-pet",
  "name": "像素宠物",
  "description": "8-bit 风格的复古像素宠物",
  "dimensions": { "width": 77, "height": 77 },
  "animations": {
    "idle": { "speed": 1.0, "amplitude": 2, "legRotation": 0, "frequency": 0.03 },
    "happy": { "speed": 1.8, "amplitude": 3, "legRotation": 0, "frequency": 0.05 },
    "sleepy": { "speed": 0.3, "amplitude": 0.5, "legRotation": 0, "frequency": 0.015 },
    "hungry": { "speed": 0.8, "amplitude": 1.5, "legRotation": 0, "frequency": 0.03 },
    "excited": { "speed": 2.5, "amplitude": 4, "legRotation": 0, "frequency": 0.07 },
    "sad": { "speed": 0.5, "amplitude": 0.8, "legRotation": 0, "frequency": 0.02 }
  },
  "moveParts": {
    "bodySelector": ".pixel-body",
    "limbSelector": ".pixel-foot",
    "headSelector": ".pixel-body"
  }
}
```

### 3.3 style.css 完整替换

```css
/* ===== 像素宠物 v2.0 ===== */
/* 核心原则：所有尺寸为 2px 倍数，无圆角，无抗锯齿 */

.caterpillar[data-character='pixel-pet'] {
  width: 77px;
  height: 77px;
  image-rendering: pixelated;
}

.caterpillar[data-character='pixel-pet'] * {
  image-rendering: pixelated;
  border-radius: 0;
}

/* --- 身体 --- */
.caterpillar[data-character='pixel-pet'] .pixel-body {
  position: absolute;
  top: 14px;
  left: 19px;
  width: 38px;
  height: 34px;
  background: #FFCC66;
  border: 2px solid #996633;
  box-shadow: inset -4px 0 0 rgba(0,0,0,0.1);
  animation: pixel-bounce 0.6s steps(2) infinite;
}

/* --- 耳朵 --- */
.caterpillar[data-character='pixel-pet'] .pixel-ear {
  position: absolute;
  top: -10px;
  width: 10px;
  height: 10px;
  background: #FFCC66;
  border: 2px solid #996633;
}

.caterpillar[data-character='pixel-pet'] .pixel-ear.left { left: 2px; }
.caterpillar[data-character='pixel-pet'] .pixel-ear.right { right: 2px; }

/* --- 脸部容器 --- */
.caterpillar[data-character='pixel-pet'] .pixel-face {
  position: relative;
  width: 100%;
  height: 100%;
}

/* --- 眼睛 --- */
.caterpillar[data-character='pixel-pet'] .pixel-eye {
  position: absolute;
  top: 10px;
  width: 6px;
  height: 6px;
  background: #333333;
}

.caterpillar[data-character='pixel-pet'] .pixel-eye.left { left: 8px; }
.caterpillar[data-character='pixel-pet'] .pixel-eye.right { right: 8px; }

/* --- 腮红（默认隐藏） --- */
.caterpillar[data-character='pixel-pet'] .pixel-cheek {
  position: absolute;
  top: 18px;
  width: 6px;
  height: 4px;
  background: #FF9999;
  opacity: 0;
  transition: opacity 0.2s steps(1);
}

.caterpillar[data-character='pixel-pet'] .pixel-cheek.left { left: 4px; }
.caterpillar[data-character='pixel-pet'] .pixel-cheek.right { right: 4px; }

/* --- 嘴巴 --- */
.caterpillar[data-character='pixel-pet'] .pixel-mouth {
  position: absolute;
  top: 22px;
  left: 50%;
  width: 8px;
  height: 2px;
  background: #333333;
  transform: translateX(-50%);
}

/* --- 脚 --- */
.caterpillar[data-character='pixel-pet'] .pixel-feet {
  position: absolute;
  bottom: 12px;
  left: 19px;
  width: 38px;
  height: 12px;
}

.caterpillar[data-character='pixel-pet'] .pixel-foot {
  position: absolute;
  bottom: 0;
  width: 10px;
  height: 6px;
  background: #FFCC66;
  border: 2px solid #996633;
  animation: pixel-walk 0.4s steps(2) infinite;
}

.caterpillar[data-character='pixel-pet'] .pixel-foot.left { left: 2px; }
.caterpillar[data-character='pixel-pet'] .pixel-foot.right { right: 2px; animation-delay: 0.2s; }

/* ===== 情绪状态 ===== */

/* --- Happy: 眯眼 + 腮红 + U嘴 + 像素心 --- */
.caterpillar[data-character='pixel-pet'][data-mood='happy'] .pixel-eye {
  height: 3px;
  top: 12px;
}

.caterpillar[data-character='pixel-pet'][data-mood='happy'] .pixel-cheek {
  opacity: 1;
}

.caterpillar[data-character='pixel-pet'][data-mood='happy'] .pixel-mouth {
  width: 6px;
  height: 4px;
  background: transparent;
  border-bottom: 2px solid #333;
  border-left: 2px solid #333;
  border-right: 2px solid #333;
}

.caterpillar[data-character='pixel-pet'][data-mood='happy'] .pixel-body {
  filter: brightness(1.1);
  animation: pixel-bounce 0.4s steps(3) infinite;
}

/* 像素心粒子 */
.caterpillar[data-character='pixel-pet'][data-mood='happy']::after {
  content: '♥';
  position: absolute;
  top: 2px;
  right: 12px;
  font-size: 8px;
  color: #FF9999;
  image-rendering: pixelated;
  animation: pixel-heart-float 1.5s steps(4) infinite;
}

/* 耳朵摆动 */
.caterpillar[data-character='pixel-pet'][data-mood='happy'] .pixel-ear {
  animation: pixel-ear-wiggle 0.5s steps(2) infinite;
}

/* --- Sleepy: 线眼 + 无弹跳 + 像素Z --- */
.caterpillar[data-character='pixel-pet'][data-mood='sleepy'] .pixel-eye {
  height: 2px;
  top: 13px;
}

.caterpillar[data-character='pixel-pet'][data-mood='sleepy'] .pixel-mouth {
  width: 4px;
  opacity: 0.5;
}

.caterpillar[data-character='pixel-pet'][data-mood='sleepy'] .pixel-body {
  filter: brightness(0.8);
  animation: none;
  transform: rotate(3deg);
}

.caterpillar[data-character='pixel-pet'][data-mood='sleepy'] .pixel-foot {
  animation: none;
}

/* 像素 Z */
.caterpillar[data-character='pixel-pet'][data-mood='sleepy']::after {
  content: 'Z';
  position: absolute;
  top: 0;
  left: 8px;
  font-size: 10px;
  font-family: monospace;
  font-weight: bold;
  color: #7986CB;
  image-rendering: pixelated;
  animation: pixel-zzz 2s steps(4) infinite;
}

/* --- Hungry: 大眼 + O嘴 + 抖动 + 汗滴 --- */
.caterpillar[data-character='pixel-pet'][data-mood='hungry'] .pixel-eye {
  width: 8px;
  height: 8px;
  top: 8px;
}

.caterpillar[data-character='pixel-pet'][data-mood='hungry'] .pixel-mouth {
  width: 6px;
  height: 6px;
  background: #333;
}

.caterpillar[data-character='pixel-pet'][data-mood='hungry'] .pixel-body {
  animation: pixel-shake 0.3s steps(4) infinite;
}

/* 像素汗滴 */
.caterpillar[data-character='pixel-pet'][data-mood='hungry']::after {
  content: '';
  position: absolute;
  top: 14px;
  right: 14px;
  width: 4px;
  height: 6px;
  background: #90CAF9;
  animation: pixel-sweat 1s steps(3) infinite;
}

/* --- Excited: 星眼 + 大U嘴 + 最大弹跳 + 像素彩纸 --- */
.caterpillar[data-character='pixel-pet'][data-mood='excited'] .pixel-eye {
  width: 8px;
  height: 8px;
  background: transparent;
  box-shadow:
    2px 0 0 #333, -2px 0 0 #333,
    0 2px 0 #333, 0 -2px 0 #333; /* 十字星形 */
}

.caterpillar[data-character='pixel-pet'][data-mood='excited'] .pixel-cheek {
  opacity: 1;
  background: #FF6B6B;
}

.caterpillar[data-character='pixel-pet'][data-mood='excited'] .pixel-mouth {
  width: 8px;
  height: 6px;
  background: transparent;
  border-bottom: 2px solid #333;
  border-left: 2px solid #333;
  border-right: 2px solid #333;
}

.caterpillar[data-character='pixel-pet'][data-mood='excited'] .pixel-body {
  filter: brightness(1.15);
  animation: pixel-bounce 0.3s steps(2) infinite;
}

.caterpillar[data-character='pixel-pet'][data-mood='excited'] .pixel-ear {
  animation: pixel-ear-wiggle 0.3s steps(2) infinite;
}

/* 像素彩纸 */
.caterpillar[data-character='pixel-pet'][data-mood='excited']::after {
  content: '✦';
  position: absolute;
  top: 0;
  right: 8px;
  font-size: 10px;
  color: #FF6B6B;
  animation: pixel-confetti 0.8s steps(4) infinite;
}

/* --- Sad: 下移眼 + 倒U嘴 + 下沉 + 像素泪 --- */
.caterpillar[data-character='pixel-pet'][data-mood='sad'] .pixel-eye {
  top: 12px;
}

.caterpillar[data-character='pixel-pet'][data-mood='sad'] .pixel-mouth {
  width: 6px;
  height: 4px;
  background: transparent;
  border-top: 2px solid #333;
  border-left: 2px solid #333;
  border-right: 2px solid #333;
}

.caterpillar[data-character='pixel-pet'][data-mood='sad'] .pixel-body {
  filter: saturate(0.5) brightness(0.85);
  animation: none;
  transform: translateY(2px);
}

.caterpillar[data-character='pixel-pet'][data-mood='sad'] .pixel-foot {
  animation: pixel-walk 1s steps(2) infinite; /* 变慢 */
}

.caterpillar[data-character='pixel-pet'][data-mood='sad'] .pixel-ear {
  transform: translateY(2px); /* 耳朵下垂 */
}

/* 像素泪滴 */
.caterpillar[data-character='pixel-pet'][data-mood='sad']::after {
  content: '';
  position: absolute;
  top: 28px;
  left: 30px;
  width: 2px;
  height: 4px;
  background: #90CAF9;
  animation: pixel-tear 1.5s steps(3) infinite;
}

/* --- Dirty --- */
.caterpillar[data-character='pixel-pet'][data-dirty='true'] .pixel-body {
  filter: brightness(0.7) sepia(0.2);
  box-shadow: 6px 0 0 rgba(120,120,120,0.5), inset -4px 0 0 rgba(0,0,0,0.12);
}

/* ===== 关键帧动画 ===== */
/* 所有动画使用 steps() 保持像素感 */

@keyframes pixel-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}

@keyframes pixel-walk {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(2px); }
}

@keyframes pixel-heart-float {
  0% { opacity: 0; transform: translateY(0); }
  25% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-12px); }
}

@keyframes pixel-ear-wiggle {
  0%, 100% { transform: rotate(0deg); }
  50% { transform: rotate(-8deg); }
}

@keyframes pixel-zzz {
  0% { opacity: 0; transform: translate(0, 0); }
  50% { opacity: 0.8; transform: translate(4px, -6px); }
  100% { opacity: 0; transform: translate(8px, -12px); }
}

@keyframes pixel-shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-2px); }
  75% { transform: translateX(2px); }
}

@keyframes pixel-sweat {
  0% { opacity: 0; transform: translateY(0); }
  50% { opacity: 1; }
  100% { opacity: 0; transform: translateY(6px); }
}

@keyframes pixel-confetti {
  0%, 100% { opacity: 0; transform: translateY(0) scale(0.5); }
  50% { opacity: 1; transform: translateY(-8px) scale(1.2); }
}

@keyframes pixel-tear {
  0% { opacity: 0; transform: translateY(0); }
  30% { opacity: 1; }
  100% { opacity: 0; transform: translateY(8px); }
}
```

---

## 四、Codex 执行指令

按以下顺序执行升级：

1. 备份现有三个角色目录
2. 按上述规范替换每个角色的 `template.html`、`config.json`、`style.css`
3. 确保 `base-character.js` 的 `applyMood()` 方法正确设置 `data-mood` 和 `data-dirty` 属性
4. 测试每个角色在 6 种情绪 + dirty 状态下的视觉表现
5. 确认所有动画使用 GPU 加速（transform/opacity only）
6. 确认无 CSS 冲突（每个角色的选择器都以 `[data-character='xxx']` 限定）
