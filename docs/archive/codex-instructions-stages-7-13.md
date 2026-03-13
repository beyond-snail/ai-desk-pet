# Codex 实现指令：阶段 7-13

> 文档状态：已归档历史文档。
>
> 这份文档保留历史上下文，仅供回顾，不应作为当前桌面端 v1.0 的实现依据。
> 当前实现请读取 [../../technical-documentation.md](../../technical-documentation.md)。


本文件包含阶段 7 到 13 的精确 Codex 实现指令。Codex 按顺序执行，每完成一个阶段后进入下一个。

---

## 阶段七: 角色皮肤系统

### 目标
将毛毛虫形象从硬编码改为可配置的角色系统，支持多角色切换。所有角色共享同一套行为系统（移动、情绪、养成、对话），但各自有独立的视觉表现。

### 初期内置角色

| 角色 ID | 名称 | 视觉描述 |
|---------|------|----------|
| `caterpillar` | 毛毛虫 | 当前默认形象，绿色 5 节段身体 + 触角 + 小短腿 |
| `cyber-bot` | 赛博小机器人 | 方形金属身体，LED 眼睛（蓝色发光），天线，履带，霓虹描边 |
| `pixel-pet` | 像素宠物 | 8-bit 风格像素画，类似拓麻歌子，2-3 帧动画循环 |

### 步骤 1: 创建角色基础架构

创建目录结构：
```
src/renderer/characters/
├── character-registry.js
├── base-character.js
└── caterpillar/
    ├── config.json
    ├── template.html
    └── style.css
```

`base-character.js`:
```javascript
class BaseCharacter {
  constructor(config) {
    this.config = config;
    this.container = null;
    this.styleElement = null;
    this.templateHTML = '';
    this.styleCSS = '';
  }

  async load(basePath) {
    const templateResp = await fetch(`${basePath}/template.html`);
    this.templateHTML = await templateResp.text();

    const styleResp = await fetch(`${basePath}/style.css`);
    this.styleCSS = await styleResp.text();
  }

  render(container) {
    this.container = container;
    container.innerHTML = this.templateHTML;
    this.loadCSS();
  }

  loadCSS() {
    this.styleElement = document.createElement('style');
    this.styleElement.textContent = this.styleCSS;
    document.head.appendChild(this.styleElement);
  }

  unloadCSS() {
    if (this.styleElement) {
      this.styleElement.remove();
      this.styleElement = null;
    }
  }

  getAnimationParams(mood) {
    return this.config.animations[mood] || this.config.animations.idle;
  }

  getMoveParts() {
    return this.config.moveParts;
  }

  getDimensions() {
    return this.config.dimensions;
  }

  destroy() {
    this.unloadCSS();
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
```

`character-registry.js`:
```javascript
class CharacterRegistry {
  constructor() {
    this.characters = new Map();
    this.basePath = 'characters';
  }

  register(id, config) {
    this.characters.set(id, config);
  }

  getAll() {
    return Array.from(this.characters.entries()).map(([id, config]) => ({ id, ...config }));
  }

  async load(id) {
    const config = this.characters.get(id);
    if (!config) throw new Error(`Character "${id}" not found`);

    const character = new BaseCharacter(config);
    await character.load(`${this.basePath}/${id}`);
    return character;
  }

  async init() {
    const builtinIds = ['caterpillar', 'cyber-bot', 'pixel-pet'];
    for (const id of builtinIds) {
      try {
        const resp = await fetch(`${this.basePath}/${id}/config.json`);
        const config = await resp.json();
        this.register(id, config);
      } catch (e) {
        console.warn(`Failed to load character ${id}:`, e);
      }
    }
  }
}
```

### 步骤 2: 提取毛毛虫为角色配置

`characters/caterpillar/config.json`:
```json
{
  "id": "caterpillar",
  "name": "毛毛虫",
  "description": "可爱的绿色小毛毛虫",
  "dimensions": { "width": 80, "height": 40 },
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

`characters/caterpillar/template.html` — 从 `index.html` 中提取 `#caterpillar` 内部的 HTML（`.body`、`.head`、`.legs` 三个 div 及其子元素）。

`characters/caterpillar/style.css` — 从 `main.css` 中提取所有毛毛虫专属样式（`.segment`、`.head`、`.eye`、`.antenna`、`.legs`、`.leg` 及其变体、`data-mood` 属性选择器、`data-dirty` 属性选择器、相关 keyframes `antenna-wave`/`leg-move`）。`main.css` 中只保留通用样式（`*`、`html/body`、`.caterpillar` 容器基础样式、`.chat-bubble`、`.input-panel`、`#user-input`、`#send-button`、`#pomodoro-timer`、`body-wave`/`crawl` keyframes）。

### 步骤 3: 重构 `Caterpillar.js` → `PetController.js`

将 `src/renderer/components/Caterpillar.js` 重命名为 `src/renderer/components/PetController.js`，类名改为 `PetController`，做以下改造：

1. constructor 中新增属性：
```javascript
this.registry = null;
this.character = null;
this.currentCharacterId = null;
```

2. `init()` 改造为接受 characterId 参数：
```javascript
async init(characterId) {
  this.registry = new CharacterRegistry();
  await this.registry.init();

  characterId = characterId || await this.loadSavedCharacter() || 'caterpillar';
  await this.loadCharacter(characterId);

  await this.loadScreenSize();
  this.position = {
    x: Math.max(40, Math.round(this.screenSize.width * 0.25)),
    y: Math.max(40, Math.round(this.screenSize.height * 0.25))
  };

  this.setPosition(this.position.x, this.position.y);
  this.bindEvents();
  this.initSegments();
  this.initLegs();
  this.startContinuousMovement();
  this.startBodyWaveAnimation();
  this.startMoodMonitoring();
  this.applyMoodVisuals();
  this.updateIgnoreMouseEvents(true);
}
```

3. 新增角色加载方法：
```javascript
async loadCharacter(characterId) {
  if (this.character) {
    this.character.destroy();
  }
  this.character = await this.registry.load(characterId);
  this.character.render(this.element);
  this.currentCharacterId = characterId;
  this.saveCharacter(characterId);
}

async loadSavedCharacter() {
  if (window.electronAPI && window.electronAPI.storeGet) {
    return window.electronAPI.storeGet('selectedCharacter');
  }
  return localStorage.getItem('selectedCharacter');
}

saveCharacter(id) {
  if (window.electronAPI && window.electronAPI.storeSet) {
    window.electronAPI.storeSet('selectedCharacter', id);
  } else {
    localStorage.setItem('selectedCharacter', id);
  }
}

async switchCharacter(characterId) {
  this.element.style.transition = 'opacity 0.3s ease';
  this.element.style.opacity = '0';
  await new Promise(r => setTimeout(r, 300));
  await this.loadCharacter(characterId);
  this.initSegments();
  this.initLegs();
  this.applyMoodVisuals();
  this.element.style.opacity = '1';
}
```

4. `getMoodProfile()` 改为从角色配置获取：
```javascript
getMoodProfile() {
  if (this.character) {
    return this.character.getAnimationParams(this.mood);
  }
  // 降级：如果角色未加载，使用默认值
  return { speed: 2, amplitude: 2, legRotation: 15, frequency: 0.05 };
}
```

5. `initSegments()` 和 `initLegs()` 改为使用角色配置的选择器：
```javascript
initSegments() {
  const selector = this.character ? this.character.getMoveParts().bodySelector : '.segment';
  this.segments = Array.from(this.element.querySelectorAll(selector));
}

initLegs() {
  const selector = this.character ? this.character.getMoveParts().limbSelector : '.leg';
  this.legs = Array.from(this.element.querySelectorAll(selector));
}
```

### 步骤 4: 创建赛博小机器人角色

创建目录 `src/renderer/characters/cyber-bot/`。

`characters/cyber-bot/config.json`:
```json
{
  "id": "cyber-bot",
  "name": "赛博小机器人",
  "description": "霓虹风格的小型机器人",
  "dimensions": { "width": 60, "height": 70 },
  "animations": {
    "idle": { "speed": 1.5, "amplitude": 1.5, "legRotation": 0, "frequency": 0.04 },
    "happy": { "speed": 2.2, "amplitude": 2.5, "legRotation": 0, "frequency": 0.06 },
    "sleepy": { "speed": 0.4, "amplitude": 0.5, "legRotation": 0, "frequency": 0.02 },
    "hungry": { "speed": 1.0, "amplitude": 1.0, "legRotation": 0, "frequency": 0.03 },
    "excited": { "speed": 3.0, "amplitude": 3.5, "legRotation": 0, "frequency": 0.08 },
    "sad": { "speed": 0.6, "amplitude": 0.6, "legRotation": 0, "frequency": 0.025 }
  },
  "moveParts": {
    "bodySelector": ".bot-body",
    "limbSelector": ".bot-track",
    "headSelector": ".bot-head"
  }
}
```

`characters/cyber-bot/template.html`:
```html
<div class="bot-head">
  <div class="bot-antenna">
    <div class="antenna-tip"></div>
  </div>
  <div class="bot-face">
    <div class="bot-eye left"></div>
    <div class="bot-eye right"></div>
    <div class="bot-mouth"></div>
  </div>
</div>
<div class="bot-body">
  <div class="bot-chest">
    <div class="bot-light"></div>
  </div>
  <div class="bot-arm left"></div>
  <div class="bot-arm right"></div>
</div>
<div class="bot-tracks">
  <div class="bot-track left"></div>
  <div class="bot-track right"></div>
</div>
```

`characters/cyber-bot/style.css` — 纯 CSS 绘制，要求：
- `.bot-head`: 40×30px 圆角矩形，`background: #2a2a3e`，`border: 2px solid #00f0ff`（霓虹蓝描边），`box-shadow: 0 0 8px #00f0ff`
- `.bot-antenna`: 居中，2px 宽 15px 高线条，顶部 `.antenna-tip` 为 6×6px 圆形，`background: #ff00ff`，`animation: antenna-blink 2s infinite`
- `.bot-eye`: 8×8px 圆形，`background: #00f0ff`，`box-shadow: 0 0 6px #00f0ff`。`[data-mood="happy"]` 时变为弯月形（`border-radius` 变化）。`[data-mood="sleepy"]` 时高度缩为 2px。`[data-mood="sad"]` 时颜色变 `#6666ff`
- `.bot-mouth`: 12×2px 横线，happy 时变弧形（`border-radius: 0 0 6px 6px; height: 4px`）
- `.bot-body`: 36×30px 矩形，`background: #1a1a2e`，霓虹描边
- `.bot-chest .bot-light`: 8×8px 圆形，`animation: chest-glow 1.5s infinite alternate`（在 `#00ff88` 和 `#004422` 之间渐变）
- `.bot-arm`: 6×20px 矩形，左右各偏移，idle 时轻微摆动 `animation: arm-swing 3s ease-in-out infinite`
- `.bot-track`: 14×8px 圆角矩形，`background: #333`，`border: 1px solid #00f0ff`
- `[data-dirty="true"]` 时所有霓虹发光效果减弱（`box-shadow` 透明度降低 50%），`.bot-light` 闪烁变慢
- 定义 keyframes: `antenna-blink`、`chest-glow`、`arm-swing`

### 步骤 5: 创建像素宠物角色

创建目录 `src/renderer/characters/pixel-pet/`。

`characters/pixel-pet/config.json`:
```json
{
  "id": "pixel-pet",
  "name": "像素宠物",
  "description": "8-bit 风格的复古像素宠物",
  "dimensions": { "width": 64, "height": 64 },
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

`characters/pixel-pet/template.html`:
```html
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
```

`characters/pixel-pet/style.css` — 像素风格，要求：
- 所有元素使用 `image-rendering: pixelated`，无圆角（`border-radius: 0`），用 `box-shadow` 模拟像素点阵
- `.pixel-body`: 32×28px，`background: #ffcc66`，`border: 2px solid #996633`。使用 `animation: pixel-bounce 0.6s steps(2) infinite` 实现 2 帧弹跳
- `.pixel-ear`: 8×8px 三角形（用 border hack），`background: #ffcc66`，`border: 2px solid #996633`
- `.pixel-eye`: 4×4px 方块，`background: #333`。`[data-mood="happy"]` 时变为 4×2px（眯眼）。`[data-mood="sleepy"]` 时变为 4×1px。`[data-mood="sad"]` 时下移 1px
- `.pixel-cheek`: 4×4px，`background: #ff9999`，`opacity: 0`。`[data-mood="happy"]` 时 `opacity: 1`
- `.pixel-mouth`: 6×2px，`background: #333`。happy 时用 `box-shadow` 画出微笑弧线
- `.pixel-foot`: 8×4px，`background: #ffcc66`，`border: 2px solid #996633`，`animation: pixel-walk 0.4s steps(2) infinite`（交替上下 2px）
- `[data-dirty="true"]` 时 body 颜色变暗（`filter: brightness(0.7)`），增加 `box-shadow` 模拟灰尘像素点
- 定义 keyframes: `pixel-bounce`（steps(2) 上下 2px）、`pixel-walk`（steps(2) 交替脚）

### 步骤 6: 创建角色选择器 UI

创建 `src/renderer/components/CharacterPicker.js`:
```javascript
class CharacterPicker {
  constructor() {
    this.element = null;
    this.isOpen = false;
    this.onSelect = null;
  }

  init(petController) {
    this.petController = petController;
    this.createElement();
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.id = 'character-picker';
    this.element.className = 'character-picker hidden';
    document.body.appendChild(this.element);
  }

  async open() {
    if (this.isOpen) return;
    this.isOpen = true;

    const characters = this.petController.registry.getAll();
    const currentId = this.petController.currentCharacterId;

    this.element.innerHTML = `
      <div class="picker-title">选择角色</div>
      <div class="picker-grid">
        ${characters.map(c => `
          <div class="picker-item ${c.id === currentId ? 'active' : ''}" data-id="${c.id}">
            <div class="picker-preview" data-character="${c.id}"></div>
            <div class="picker-name">${c.name}</div>
            <div class="picker-desc">${c.description}</div>
          </div>
        `).join('')}
      </div>
      <button class="picker-close">关闭</button>
    `;

    this.element.classList.remove('hidden');
    this.bindPickerEvents();

    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(false);
    }
  }

  bindPickerEvents() {
    this.element.querySelectorAll('.picker-item').forEach(item => {
      item.addEventListener('click', async () => {
        const id = item.dataset.id;
        if (id !== this.petController.currentCharacterId) {
          await this.petController.switchCharacter(id);
        }
        this.close();
      });
    });

    this.element.querySelector('.picker-close').addEventListener('click', () => {
      this.close();
    });
  }

  close() {
    this.isOpen = false;
    this.element.classList.add('hidden');
    if (window.electronAPI && window.electronAPI.setIgnoreMouseEvents) {
      window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
    }
  }
}
```

在 `main.css` 中添加角色选择器样式：
```css
.character-picker {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(20, 20, 30, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 24px;
  z-index: 10000;
  backdrop-filter: blur(10px);
  min-width: 320px;
}

.character-picker.hidden { display: none; }

.picker-title {
  color: #fff;
  font-size: 16px;
  text-align: center;
  margin-bottom: 16px;
}

.picker-grid {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.picker-item {
  width: 90px;
  padding: 12px 8px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
}

.picker-item:hover { border-color: rgba(255, 255, 255, 0.3); background: rgba(255, 255, 255, 0.05); }
.picker-item.active { border-color: #4fc3f7; background: rgba(79, 195, 247, 0.1); }

.picker-preview {
  width: 64px;
  height: 64px;
  margin: 0 auto 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.picker-name { color: #fff; font-size: 13px; font-weight: bold; }
.picker-desc { color: #aaa; font-size: 11px; margin-top: 4px; }

.picker-close {
  display: block;
  margin: 16px auto 0;
  padding: 6px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}

.picker-close:hover { background: rgba(255, 255, 255, 0.2); }
```

### 步骤 7: 更新 index.html 和右键菜单

1. 在 `index.html` 中添加 `<script src="components/CharacterPicker.js"></script>` 和 `<script src="characters/base-character.js"></script>` 和 `<script src="characters/character-registry.js"></script>`。

2. 在 `app.js`（或主初始化脚本）中初始化 CharacterPicker：
```javascript
const characterPicker = new CharacterPicker();
characterPicker.init(petController); // petController 是重命名后的 PetController 实例
```

3. 在 `src/main/index.js` 的 `buildContextMenu()` 中添加"切换角色"菜单项：
```javascript
{
  label: '切换角色',
  click: () => mainWindow.webContents.send('context-menu-action', 'switch-character')
}
```

4. 在渲染进程中监听该事件，调用 `characterPicker.open()`。

### 步骤 8: 验证清单

- [ ] 默认加载毛毛虫角色，行为与重构前完全一致
- [ ] 右键菜单出现"切换角色"选项
- [ ] 点击后弹出角色选择面板，显示 3 个角色
- [ ] 切换到赛博小机器人，视觉正确，动画正常
- [ ] 切换到像素宠物，视觉正确，动画正常
- [ ] 切换角色后关闭重开，记住上次选择
- [ ] 所有角色的情绪表情（happy/sad/sleepy/hungry）视觉变化正确
- [ ] 所有角色的脏污状态视觉变化正确
- [ ] 聊天气泡、输入面板、番茄钟等 UI 不受角色切换影响

---

## 阶段八: 成长进化系统

### 目标
为宠物添加经验值和等级系统，宠物通过互动积累经验，达到阈值后升级并解锁新能力或视觉变化。

### 步骤 1: 创建 GrowthSystem.js

创建 `src/renderer/components/GrowthSystem.js`:
```javascript
class GrowthSystem {
  constructor() {
    this.level = 1;
    this.exp = 0;
    this.totalExp = 0;
    this.maxLevel = 10;
    this.levelThresholds = [0, 100, 250, 500, 800, 1200, 1800, 2500, 3500, 5000];
    this.unlockedAbilities = [];
    this.onLevelUp = null;
  }

  async init() {
    await this.loadState();
  }

  addExp(amount, source = 'unknown') {
    if (this.level >= this.maxLevel) return;

    this.exp += amount;
    this.totalExp += amount;

    while (this.level < this.maxLevel && this.exp >= this.getExpToNext()) {
      this.exp -= this.getExpToNext();
      this.level++;
      this.handleLevelUp();
    }

    this.saveState();
  }

  getExpToNext() {
    if (this.level >= this.maxLevel) return Infinity;
    return this.levelThresholds[this.level] - (this.level > 1 ? this.levelThresholds[this.level - 1] : 0);
  }

  getProgress() {
    if (this.level >= this.maxLevel) return 1;
    const needed = this.getExpToNext();
    return needed > 0 ? this.exp / needed : 0;
  }

  handleLevelUp() {
    const abilities = this.getAbilitiesForLevel(this.level);
    this.unlockedAbilities.push(...abilities);

    if (this.onLevelUp) {
      this.onLevelUp({
        level: this.level,
        abilities,
        totalExp: this.totalExp
      });
    }
  }

  getAbilitiesForLevel(level) {
    const abilityMap = {
      2: [{ id: 'faster_move', name: '加速移动', description: '移动速度+20%' }],
      3: [{ id: 'longer_chat', name: '话多了', description: '对话回复字数上限提升' }],
      4: [{ id: 'weather_sense', name: '天气感知', description: '根据天气变化情绪' }],
      5: [{ id: 'night_mode', name: '夜间模式', description: '晚上自动变安静' }],
      6: [{ id: 'dance', name: '跳舞', description: '解锁跳舞动作' }],
      7: [{ id: 'mini_games', name: '小游戏', description: '解锁互动小游戏' }],
      8: [{ id: 'custom_color', name: '自定义颜色', description: '可以改变宠物颜色' }],
      9: [{ id: 'multi_pet', name: '多宠物', description: '可以同时养多只宠物' }],
      10: [{ id: 'evolution', name: '终极进化', description: '宠物外观进化' }]
    };
    return abilityMap[level] || [];
  }

  hasAbility(abilityId) {
    return this.unlockedAbilities.some(a => a.id === abilityId);
  }

  getState() {
    return {
      level: this.level,
      exp: this.exp,
      totalExp: this.totalExp,
      progress: this.getProgress(),
      unlockedAbilities: this.unlockedAbilities
    };
  }

  async saveState() {
    const state = {
      level: this.level,
      exp: this.exp,
      totalExp: this.totalExp,
      unlockedAbilities: this.unlockedAbilities
    };
    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet('growthState', state);
    } else {
      localStorage.setItem('growthState', JSON.stringify(state));
    }
  }

  async loadState() {
    let state;
    if (window.electronAPI && window.electronAPI.storeGet) {
      state = await window.electronAPI.storeGet('growthState');
    } else {
      const saved = localStorage.getItem('growthState');
      state = saved ? JSON.parse(saved) : null;
    }

    if (state) {
      this.level = state.level || 1;
      this.exp = state.exp || 0;
      this.totalExp = state.totalExp || 0;
      this.unlockedAbilities = state.unlockedAbilities || [];
    }
  }
}
```

### 步骤 2: 经验值获取规则

在各交互点添加经验值奖励：

| 行为 | 经验值 | 触发位置 |
|------|--------|----------|
| 喂食 | +10 | CareSystem.feed() |
| 抚摸 | +5 | CareSystem.pet() |
| 清洁 | +8 | CareSystem.clean() |
| 完成对话 | +3 | ChatManager.processInput() |
| 完成番茄钟 | +25 | PomodoroTimer 完成回调 |
| 每日首次打开 | +15 | app.js 初始化时检查 |

在 `app.js` 初始化中：
```javascript
const growthSystem = new GrowthSystem();
await growthSystem.init();

// 将 growthSystem 传递给需要的组件
// CareSystem 的 feed/pet/clean 回调中调用 growthSystem.addExp()
```

在 CareSystem 的 `feed()`、`pet()`、`clean()` 方法末尾添加：
```javascript
// 在 feed() 末尾
if (window.growthSystem) window.growthSystem.addExp(10, 'feed');

// 在 pet() 末尾
if (window.growthSystem) window.growthSystem.addExp(5, 'pet');

// 在 clean() 末尾
if (window.growthSystem) window.growthSystem.addExp(8, 'clean');
```

在 ChatManager 的 `processInput()` 末尾添加：
```javascript
if (window.growthSystem) window.growthSystem.addExp(3, 'chat');
```

将 growthSystem 挂载到 window 上以便各组件访问：
```javascript
window.growthSystem = growthSystem;
```

### 步骤 3: 等级显示 UI

在宠物旁边显示等级徽章。在 `index.html` 中添加：
```html
<div id="level-badge" class="level-badge">
  <span class="level-number">1</span>
  <div class="exp-bar">
    <div class="exp-fill"></div>
  </div>
</div>
```

在 `main.css` 中添加：
```css
.level-badge {
  position: absolute;
  top: -25px;
  right: -10px;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: none;
}

.level-number {
  background: linear-gradient(135deg, #ffd700, #ffaa00);
  color: #333;
  font-size: 10px;
  font-weight: bold;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.exp-bar {
  width: 40px;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  overflow: hidden;
}

.exp-fill {
  height: 100%;
  background: linear-gradient(90deg, #4fc3f7, #00e676);
  border-radius: 2px;
  transition: width 0.5s ease;
  width: 0%;
}
```

等级徽章放在 `#caterpillar`（或宠物容器）内部，跟随宠物移动。

### 步骤 4: 升级动画

当升级时，显示升级特效：
```javascript
growthSystem.onLevelUp = (info) => {
  showLevelUpEffect(info);
  chatBubble.show(`升到 ${info.level} 级啦！解锁了：${info.abilities.map(a => a.name).join('、')}`, 5000);
};

function showLevelUpEffect(info) {
  const effect = document.createElement('div');
  effect.className = 'level-up-effect';
  effect.innerHTML = `
    <div class="level-up-text">Level Up!</div>
    <div class="level-up-number">${info.level}</div>
  `;
  document.body.appendChild(effect);

  setTimeout(() => effect.remove(), 2000);

  // 更新等级徽章
  document.querySelector('.level-number').textContent = info.level;
}
```

在 `main.css` 中添加升级特效样式：
```css
.level-up-effect {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 10001;
  animation: level-up-anim 2s ease-out forwards;
  pointer-events: none;
}

.level-up-text {
  font-size: 28px;
  font-weight: bold;
  color: #ffd700;
  text-shadow: 0 0 20px rgba(255, 215, 0, 0.8);
}

.level-up-number {
  font-size: 48px;
  font-weight: bold;
  color: #fff;
  text-shadow: 0 0 30px rgba(255, 255, 255, 0.8);
}

@keyframes level-up-anim {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
  30% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
  70% { opacity: 1; transform: translate(-50%, -60%) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -80%) scale(0.8); }
}
```

### 步骤 5: 验证清单

- [ ] 喂食/抚摸/清洁/对话/番茄钟完成后经验值正确增加
- [ ] 经验条实时更新
- [ ] 达到阈值后触发升级动画和气泡提示
- [ ] 升级后解锁的能力记录正确
- [ ] 关闭重开后等级和经验值保持
- [ ] 满级后不再获得经验值

---

## 阶段九: 屏幕边缘交互与天气集成

### 目标
让宠物能感知屏幕边缘并做出反应（爬墙、探头、弹回），同时集成天气 API 让宠物根据真实天气变化情绪和视觉效果。

### 步骤 1: 屏幕边缘检测

在 `PetController.js` 中添加边缘检测逻辑：

```javascript
// 在 moveToTarget() 或 updatePosition() 中添加边缘检测
checkEdgeInteraction() {
  const dims = this.character ? this.character.getDimensions() : { width: 80, height: 40 };
  const margin = 5;

  const atLeft = this.position.x <= margin;
  const atRight = this.position.x >= this.screenSize.width - dims.width - margin;
  const atTop = this.position.y <= margin;
  const atBottom = this.position.y >= this.screenSize.height - dims.height - margin;

  if (atLeft || atRight || atTop || atBottom) {
    this.handleEdgeReaction({ atLeft, atRight, atTop, atBottom });
  }
}

handleEdgeReaction(edges) {
  // 到达边缘时的行为
  if (edges.atBottom) {
    // 到达底部：坐下休息
    this.element.setAttribute('data-edge', 'bottom');
    this.triggerEdgeBehavior('sit');
  } else if (edges.atLeft || edges.atRight) {
    // 到达左右边缘：探头看
    this.element.setAttribute('data-edge', edges.atLeft ? 'left' : 'right');
    this.triggerEdgeBehavior('peek');
  } else if (edges.atTop) {
    // 到达顶部：倒挂
    this.element.setAttribute('data-edge', 'top');
    this.triggerEdgeBehavior('hang');
  }
}

triggerEdgeBehavior(behavior) {
  if (this.edgeBehaviorTimer) return; // 防止重复触发

  // 边缘行为持续 3-8 秒后自动离开
  const duration = 3000 + Math.random() * 5000;
  this.edgeBehaviorTimer = setTimeout(() => {
    this.element.removeAttribute('data-edge');
    this.edgeBehaviorTimer = null;
    // 给一个远离边缘的新目标
    this.setNewRandomTarget();
  }, duration);
}

setNewRandomTarget() {
  const dims = this.character ? this.character.getDimensions() : { width: 80, height: 40 };
  const padding = 60;
  this.target = {
    x: padding + Math.random() * (this.screenSize.width - dims.width - padding * 2),
    y: padding + Math.random() * (this.screenSize.height - dims.height - padding * 2)
  };
}
```

在角色的 CSS 中添加边缘状态样式（以毛毛虫为例，其他角色类似）：
```css
/* caterpillar/style.css 追加 */
[data-edge="left"] .body { transform: rotate(-15deg); }
[data-edge="right"] .body { transform: rotate(15deg); }
[data-edge="top"] .body { transform: rotate(180deg); }
[data-edge="bottom"] .legs { display: none; } /* 坐下时隐藏腿 */
```

### 步骤 2: 创建 WeatherService.js

创建 `src/renderer/services/WeatherService.js`:
```javascript
class WeatherService {
  constructor() {
    this.currentWeather = null;
    this.updateInterval = null;
    this.apiKey = null;
    this.city = null;
  }

  async init() {
    // 从设置加载 API key 和城市
    if (window.electronAPI && window.electronAPI.storeGet) {
      this.apiKey = await window.electronAPI.storeGet('weatherApiKey');
      this.city = await window.electronAPI.storeGet('weatherCity');
    }

    if (this.apiKey && this.city) {
      await this.fetchWeather();
      // 每 30 分钟更新一次
      this.updateInterval = setInterval(() => this.fetchWeather(), 30 * 60 * 1000);
    }
  }

  async fetchWeather() {
    if (!this.apiKey || !this.city) return null;

    try {
      // 使用和风天气 API（免费额度足够）
      const resp = await fetch(
        `https://devapi.qweather.com/v7/weather/now?location=${this.city}&key=${this.apiKey}`,
        { headers: { 'Accept': 'application/json' } }
      );
      const data = await resp.json();

      if (data.code === '200' && data.now) {
        this.currentWeather = {
          temp: parseInt(data.now.temp),
          text: data.now.text,        // "晴"、"多云"、"小雨" 等
          icon: data.now.icon,
          humidity: parseInt(data.now.humidity),
          windSpeed: parseInt(data.now.windSpeedScale || data.now.windScale)
        };
        return this.currentWeather;
      }
    } catch (error) {
      console.warn('Weather fetch failed:', error);
    }
    return null;
  }

  getWeatherMoodEffect() {
    if (!this.currentWeather) return null;

    const text = this.currentWeather.text;
    const temp = this.currentWeather.temp;

    // 天气 → 情绪映射
    if (text.includes('晴') && temp >= 20 && temp <= 28) {
      return { mood: 'happy', reason: '天气真好' };
    }
    if (text.includes('雨')) {
      return { mood: 'sleepy', reason: '下雨了，想睡觉' };
    }
    if (text.includes('雪')) {
      return { mood: 'excited', reason: '下雪啦！' };
    }
    if (temp > 35) {
      return { mood: 'sad', reason: '好热啊' };
    }
    if (temp < 5) {
      return { mood: 'sad', reason: '好冷啊' };
    }

    return null;
  }

  getWeatherVisualEffect() {
    if (!this.currentWeather) return null;

    const text = this.currentWeather.text;

    if (text.includes('雨')) return 'rain';
    if (text.includes('雪')) return 'snow';
    if (text.includes('雾') || text.includes('霾')) return 'fog';
    if (text.includes('晴')) return 'sunny';
    if (text.includes('多云') || text.includes('阴')) return 'cloudy';

    return null;
  }

  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
  }
}
```

### 步骤 3: 天气视觉效果

在宠物周围显示天气粒子效果。创建 `src/renderer/effects/WeatherEffects.js`:
```javascript
class WeatherEffects {
  constructor() {
    this.container = null;
    this.particles = [];
    this.animationFrame = null;
    this.currentEffect = null;
  }

  init(petElement) {
    this.container = document.createElement('div');
    this.container.className = 'weather-effects';
    this.container.style.cssText = 'position:absolute;top:-30px;left:-20px;right:-20px;bottom:-10px;pointer-events:none;overflow:hidden;';
    petElement.appendChild(this.container);
  }

  setEffect(type) {
    if (this.currentEffect === type) return;
    this.clear();
    this.currentEffect = type;

    switch (type) {
      case 'rain':
        this.startRain();
        break;
      case 'snow':
        this.startSnow();
        break;
      case 'sunny':
        this.startSunny();
        break;
      default:
        break;
    }
  }

  startRain() {
    const createDrop = () => {
      const drop = document.createElement('div');
      drop.className = 'rain-drop';
      drop.style.left = Math.random() * 100 + '%';
      drop.style.animationDuration = (0.3 + Math.random() * 0.3) + 's';
      this.container.appendChild(drop);
      setTimeout(() => drop.remove(), 600);
    };
    this.effectInterval = setInterval(createDrop, 100);
  }

  startSnow() {
    const createFlake = () => {
      const flake = document.createElement('div');
      flake.className = 'snow-flake';
      flake.style.left = Math.random() * 100 + '%';
      flake.style.animationDuration = (1 + Math.random() * 2) + 's';
      this.container.appendChild(flake);
      setTimeout(() => flake.remove(), 3000);
    };
    this.effectInterval = setInterval(createFlake, 300);
  }

  startSunny() {
    const glow = document.createElement('div');
    glow.className = 'sun-glow';
    this.container.appendChild(glow);
  }

  clear() {
    if (this.effectInterval) {
      clearInterval(this.effectInterval);
      this.effectInterval = null;
    }
    this.container.innerHTML = '';
    this.currentEffect = null;
  }
}
```

在 `main.css` 中添加天气效果样式：
```css
.rain-drop {
  position: absolute;
  top: 0;
  width: 1px;
  height: 8px;
  background: linear-gradient(transparent, #4fc3f7);
  animation: rain-fall linear forwards;
}

@keyframes rain-fall {
  to { transform: translateY(80px); opacity: 0; }
}

.snow-flake {
  position: absolute;
  top: 0;
  width: 4px;
  height: 4px;
  background: #fff;
  border-radius: 50%;
  animation: snow-fall linear forwards;
}

@keyframes snow-fall {
  to { transform: translateY(80px) translateX(10px); opacity: 0; }
}

.sun-glow {
  position: absolute;
  top: -15px;
  right: -15px;
  width: 20px;
  height: 20px;
  background: radial-gradient(circle, rgba(255,215,0,0.6), transparent);
  border-radius: 50%;
  animation: sun-pulse 2s ease-in-out infinite;
}

@keyframes sun-pulse {
  0%, 100% { transform: scale(1); opacity: 0.6; }
  50% { transform: scale(1.3); opacity: 1; }
}
```

### 步骤 4: 集成天气到情绪系统

在 `app.js` 中初始化天气服务并连接到情绪系统：
```javascript
const weatherService = new WeatherService();
await weatherService.init();

const weatherEffects = new WeatherEffects();
weatherEffects.init(petController.element);

// 天气影响情绪（仅当 GrowthSystem 解锁了 weather_sense 能力时）
function applyWeatherEffects() {
  if (!growthSystem.hasAbility('weather_sense')) return;

  const moodEffect = weatherService.getWeatherMoodEffect();
  if (moodEffect) {
    // 天气情绪作为次要因素，不覆盖饥饿等强情绪
    petController.suggestMood(moodEffect.mood, 'weather');
  }

  const visualEffect = weatherService.getWeatherVisualEffect();
  if (visualEffect) {
    weatherEffects.setEffect(visualEffect);
  }
}

// 每 5 分钟检查一次天气效果
setInterval(applyWeatherEffects, 5 * 60 * 1000);
applyWeatherEffects();
```

在 PetController 中添加 `suggestMood()` 方法（低优先级情绪建议）：
```javascript
suggestMood(mood, source) {
  // 如果当前有更高优先级的情绪（饥饿、脏污），不覆盖
  const highPriority = ['hungry', 'sad'];
  if (highPriority.includes(this.mood) && source === 'weather') return;
  this.setMood(mood);
}
```

### 步骤 5: 设置面板添加天气配置

**重要：预置默认 API Key**

在 electron-store 的默认值中预填和风天气 API Key：`57dab2c285894938b6c34a92b5a4fed6`

即在 store 初始化时设置默认值：
```javascript
const store = new Store({
  defaults: {
    // ... 其他默认值
    weatherApiKey: '57dab2c285894938b6c34a92b5a4fed6',
    weatherCity: '',  // 城市 ID 仍需用户配置
    weatherEnabled: true  // 默认开启天气功能
  }
});
```

在设置面板中添加天气 API 配置项：
- 和风天气 API Key 输入框（预填默认值 `57dab2c285894938b6c34a92b5a4fed6`）
- 城市 ID 输入框（提示用户去和风天气查询城市 ID）
- 天气功能开关

### 步骤 6: 验证清单

- [ ] 宠物到达屏幕边缘时触发对应行为（探头/坐下/倒挂）
- [ ] 边缘行为持续数秒后自动离开
- [ ] 配置天气 API 后能获取天气数据
- [ ] 天气影响宠物情绪（需先解锁 weather_sense 能力）
- [ ] 下雨/下雪时宠物周围出现粒子效果
- [ ] 未配置天气 API 时不报错，功能静默禁用

---

## 阶段十: 系统状态监控

### 目标
让宠物能感知用户的系统状态（CPU、内存、电池），并通过表情和对话做出反应，成为一个有用的系统状态指示器。

### 步骤 1: 主进程系统监控

在 `src/main/index.js` 中添加系统信息获取：

```javascript
const os = require('os');

function getSystemInfo() {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();

  // CPU 使用率（取最近一次采样的平均值）
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  }
  const cpuUsage = Math.round((1 - totalIdle / totalTick) * 100);

  // 内存使用率
  const memUsage = Math.round((1 - freeMem / totalMem) * 100);

  return {
    cpuUsage,
    memUsage,
    totalMem: Math.round(totalMem / 1024 / 1024 / 1024 * 10) / 10, // GB
    freeMem: Math.round(freeMem / 1024 / 1024 / 1024 * 10) / 10,
    platform: process.platform,
    uptime: Math.round(os.uptime() / 60) // 分钟
  };
}
```

添加 IPC handler：
```javascript
ipcMain.handle('system:get-info', () => {
  return getSystemInfo();
});
```

在 `preload.js` 中暴露：
```javascript
getSystemInfo: () => ipcRenderer.invoke('system:get-info')
```

### 步骤 2: 电池状态（仅笔记本）

在主进程中添加电池检测（使用 Electron 的 powerMonitor）：

```javascript
const { powerMonitor } = require('electron');

// 在 app.whenReady() 之后
function getBatteryInfo() {
  // Electron 没有直接的电池 API，通过 powerMonitor 事件间接获取
  // 或使用 child_process 调用系统命令
  return new Promise((resolve) => {
    if (process.platform === 'darwin') {
      const { execSync } = require('child_process');
      try {
        const output = execSync('pmset -g batt', { encoding: 'utf8' });
        const match = output.match(/(\d+)%/);
        const charging = output.includes('charging') || output.includes('AC Power');
        resolve({
          level: match ? parseInt(match[1]) : null,
          charging
        });
      } catch {
        resolve({ level: null, charging: false });
      }
    } else if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      try {
        const output = execSync('WMIC PATH Win32_Battery Get EstimatedChargeRemaining', { encoding: 'utf8' });
        const match = output.match(/(\d+)/);
        resolve({
          level: match ? parseInt(match[1]) : null,
          charging: false // Windows 需要额外检测
        });
      } catch {
        resolve({ level: null, charging: false });
      }
    } else {
      resolve({ level: null, charging: false });
    }
  });
}

ipcMain.handle('system:get-battery', async () => {
  return getBatteryInfo();
});
```

在 `preload.js` 中暴露：
```javascript
getBatteryInfo: () => ipcRenderer.invoke('system:get-battery')
```

### 步骤 3: 创建 SystemMonitor.js

创建 `src/renderer/services/SystemMonitor.js`:
```javascript
class SystemMonitor {
  constructor() {
    this.systemInfo = null;
    this.batteryInfo = null;
    this.pollInterval = null;
    this.onAlert = null;
    this.alertCooldowns = {};
  }

  async init() {
    await this.poll();
    // 每 60 秒轮询一次
    this.pollInterval = setInterval(() => this.poll(), 60 * 1000);
  }

  async poll() {
    if (window.electronAPI) {
      if (window.electronAPI.getSystemInfo) {
        this.systemInfo = await window.electronAPI.getSystemInfo();
      }
      if (window.electronAPI.getBatteryInfo) {
        this.batteryInfo = await window.electronAPI.getBatteryInfo();
      }
    }
    this.checkAlerts();
  }

  checkAlerts() {
    if (!this.systemInfo) return;

    // CPU 过高
    if (this.systemInfo.cpuUsage > 85) {
      this.triggerAlert('high_cpu', `CPU 使用率 ${this.systemInfo.cpuUsage}%，电脑有点累了`);
    }

    // 内存过高
    if (this.systemInfo.memUsage > 90) {
      this.triggerAlert('high_mem', `内存快满了（${this.systemInfo.memUsage}%），要不要关掉一些程序？`);
    }

    // 电池低
    if (this.batteryInfo && this.batteryInfo.level !== null) {
      if (this.batteryInfo.level <= 15 && !this.batteryInfo.charging) {
        this.triggerAlert('low_battery', `电量只剩 ${this.batteryInfo.level}% 了，快充电！`);
      }
    }

    // 运行时间过长
    if (this.systemInfo.uptime > 480) { // 8 小时
      this.triggerAlert('long_uptime', '电脑已经开了很久了，要不要休息一下？');
    }
  }

  triggerAlert(type, message) {
    const now = Date.now();
    const cooldown = 10 * 60 * 1000; // 10 分钟冷却

    if (this.alertCooldowns[type] && now - this.alertCooldowns[type] < cooldown) {
      return;
    }

    this.alertCooldowns[type] = now;
    if (this.onAlert) {
      this.onAlert({ type, message });
    }
  }

  getMoodEffect() {
    if (!this.systemInfo) return null;

    if (this.systemInfo.cpuUsage > 85 || this.systemInfo.memUsage > 90) {
      return { mood: 'sad', reason: '系统负载高' };
    }

    if (this.batteryInfo && this.batteryInfo.level !== null && this.batteryInfo.level <= 15) {
      return { mood: 'sleepy', reason: '电量低' };
    }

    return null;
  }

  getState() {
    return {
      system: this.systemInfo,
      battery: this.batteryInfo
    };
  }

  destroy() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
```

### 步骤 4: 集成到主应用

在 `app.js` 中：
```javascript
const systemMonitor = new SystemMonitor();
await systemMonitor.init();

// 系统告警通过聊天气泡显示
systemMonitor.onAlert = (alert) => {
  chatBubble.show(alert.message, 5000);
};

// 系统状态影响情绪
function applySystemMoodEffect() {
  const effect = systemMonitor.getMoodEffect();
  if (effect) {
    petController.suggestMood(effect.mood, 'system');
  }
}

setInterval(applySystemMoodEffect, 60 * 1000);
```

### 步骤 5: 系统状态融入对话

在 `ChatManager.buildSystemPrompt()` 中添加系统状态上下文：
```javascript
// 在 buildSystemPrompt() 末尾添加
if (window.systemMonitor) {
  const state = window.systemMonitor.getState();
  if (state.system) {
    if (state.system.cpuUsage > 80) {
      prompt += `用户的电脑 CPU 使用率很高(${state.system.cpuUsage}%)，你可以关心一下。`;
    }
    if (state.system.memUsage > 85) {
      prompt += `用户的电脑内存快满了(${state.system.memUsage}%)，可以提醒关闭一些程序。`;
    }
  }
  if (state.battery && state.battery.level !== null && state.battery.level <= 20) {
    prompt += `用户的电脑电量只有${state.battery.level}%了，提醒充电。`;
  }
}
```

将 systemMonitor 挂载到 window：
```javascript
window.systemMonitor = systemMonitor;
```

### 步骤 6: 验证清单

- [ ] 系统信息（CPU、内存）每 60 秒更新
- [ ] CPU > 85% 时宠物通过气泡提醒
- [ ] 内存 > 90% 时宠物通过气泡提醒
- [ ] 电池 ≤ 15% 时宠物提醒充电
- [ ] 告警有 10 分钟冷却，不会反复弹出
- [ ] 系统状态影响宠物情绪
- [ ] 对话中宠物能感知系统状态并回应

---

## 阶段十一: 多宠物社交系统

### 目标
支持同时显示多只宠物，宠物之间能互动（靠近时聊天、一起玩耍）。此功能需要 GrowthSystem 等级 9 解锁 `multi_pet` 能力后才可用。

### 步骤 1: 创建 PetManager.js

创建 `src/renderer/components/PetManager.js`:
```javascript
class PetManager {
  constructor() {
    this.pets = new Map(); // id → PetController
    this.primaryPetId = 'primary';
    this.maxPets = 3;
    this.socialCheckInterval = null;
  }

  async init(primaryPet) {
    this.pets.set(this.primaryPetId, primaryPet);
    this.startSocialCheck();
  }

  canAddPet() {
    if (!window.growthSystem || !window.growthSystem.hasAbility('multi_pet')) {
      return false;
    }
    return this.pets.size < this.maxPets;
  }

  async addPet(characterId) {
    if (!this.canAddPet()) return null;

    const id = `pet-${Date.now()}`;

    // 创建新的宠物容器
    const container = document.createElement('div');
    container.id = id;
    container.className = 'caterpillar'; // 复用宠物容器样式
    container.style.cssText = 'position:absolute;cursor:pointer;z-index:100;';
    document.body.appendChild(container);

    // 创建新的 PetController 实例
    const pet = new PetController();
    pet.element = container;
    await pet.init(characterId);

    // 随机位置，避免与现有宠物重叠
    const pos = this.findNonOverlappingPosition();
    pet.setPosition(pos.x, pos.y);

    this.pets.set(id, pet);
    this.savePetList();
    return id;
  }

  removePet(id) {
    if (id === this.primaryPetId) return; // 不能移除主宠物

    const pet = this.pets.get(id);
    if (pet) {
      pet.destroy();
      pet.element.remove();
      this.pets.delete(id);
      this.savePetList();
    }
  }

  findNonOverlappingPosition() {
    const existing = Array.from(this.pets.values()).map(p => p.position);
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    for (let attempt = 0; attempt < 20; attempt++) {
      const x = 60 + Math.random() * (screenW - 160);
      const y = 60 + Math.random() * (screenH - 160);

      const tooClose = existing.some(pos => {
        const dx = pos.x - x;
        const dy = pos.y - y;
        return Math.sqrt(dx * dx + dy * dy) < 120;
      });

      if (!tooClose) return { x, y };
    }

    return { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };
  }

  // 社交互动检测
  startSocialCheck() {
    this.socialCheckInterval = setInterval(() => {
      if (this.pets.size < 2) return;
      this.checkSocialInteractions();
    }, 3000);
  }

  checkSocialInteractions() {
    const petList = Array.from(this.pets.entries());

    for (let i = 0; i < petList.length; i++) {
      for (let j = i + 1; j < petList.length; j++) {
        const [idA, petA] = petList[i];
        const [idB, petB] = petList[j];

        const dx = petA.position.x - petB.position.x;
        const dy = petA.position.y - petB.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 100) {
          this.triggerSocialEvent(idA, petA, idB, petB);
        }
      }
    }
  }

  triggerSocialEvent(idA, petA, idB, petB) {
    // 冷却检查
    const cooldownKey = `${idA}-${idB}`;
    if (this.socialCooldowns && this.socialCooldowns[cooldownKey]) {
      if (Date.now() - this.socialCooldowns[cooldownKey] < 30000) return;
    }
    if (!this.socialCooldowns) this.socialCooldowns = {};
    this.socialCooldowns[cooldownKey] = Date.now();

    // 随机社交行为
    const events = [
      () => {
        petA.setMood('happy');
        petB.setMood('happy');
        if (window.chatBubble) {
          window.chatBubble.show('交到新朋友了！', 3000);
        }
      },
      () => {
        petA.setMood('excited');
        petB.setMood('excited');
        if (window.chatBubble) {
          window.chatBubble.show('一起玩耍！', 3000);
        }
      },
      () => {
        // 互相追逐：B 追 A
        petA.setNewRandomTarget();
        setTimeout(() => {
          petB.target = { x: petA.position.x, y: petA.position.y };
        }, 500);
      }
    ];

    const event = events[Math.floor(Math.random() * events.length)];
    event();
  }

  getAllPets() {
    return Array.from(this.pets.entries()).map(([id, pet]) => ({
      id,
      characterId: pet.currentCharacterId,
      isPrimary: id === this.primaryPetId
    }));
  }

  async savePetList() {
    const list = this.getAllPets()
      .filter(p => !p.isPrimary)
      .map(p => p.characterId);

    if (window.electronAPI && window.electronAPI.storeSet) {
      window.electronAPI.storeSet('additionalPets', list);
    }
  }

  async loadSavedPets() {
    let list;
    if (window.electronAPI && window.electronAPI.storeGet) {
      list = await window.electronAPI.storeGet('additionalPets');
    }

    if (list && Array.isArray(list)) {
      for (const characterId of list) {
        await this.addPet(characterId);
      }
    }
  }

  destroy() {
    if (this.socialCheckInterval) {
      clearInterval(this.socialCheckInterval);
    }
    // 只销毁非主宠物
    for (const [id, pet] of this.pets) {
      if (id !== this.primaryPetId) {
        pet.destroy();
        pet.element.remove();
      }
    }
  }
}
```

### 步骤 2: 右键菜单添加多宠物管理

在 `buildContextMenu()` 中添加（仅当解锁 multi_pet 能力时显示）：
```javascript
// 在渲染进程中，根据能力动态构建菜单
// 通过 IPC 通知主进程更新菜单
{
  label: '添加宠物',
  click: () => mainWindow.webContents.send('context-menu-action', 'add-pet')
},
{
  label: '管理宠物',
  click: () => mainWindow.webContents.send('context-menu-action', 'manage-pets')
}
```

在渲染进程中处理：
```javascript
case 'add-pet':
  if (petManager.canAddPet()) {
    characterPicker.onSelect = async (characterId) => {
      await petManager.addPet(characterId);
    };
    characterPicker.open();
  } else {
    chatBubble.show('已经有最多的宠物了！', 3000);
  }
  break;

case 'manage-pets':
  // 显示宠物列表，可以移除非主宠物
  showPetManagePanel();
  break;
```

### 步骤 3: 集成到 app.js

```javascript
const petManager = new PetManager();
await petManager.init(petController);

// 如果已解锁多宠物能力，加载保存的额外宠物
if (window.growthSystem && window.growthSystem.hasAbility('multi_pet')) {
  await petManager.loadSavedPets();
}

window.petManager = petManager;
```

### 步骤 4: 验证清单

- [ ] 等级 9 解锁 multi_pet 前，右键菜单不显示"添加宠物"
- [ ] 解锁后可以添加最多 2 只额外宠物（总共 3 只）
- [ ] 额外宠物可以选择不同角色
- [ ] 宠物靠近时触发社交互动（变开心、追逐等）
- [ ] 社交互动有 30 秒冷却
- [ ] 可以移除额外宠物，但不能移除主宠物
- [ ] 关闭重开后额外宠物保持

---

## 阶段十二: 测试与性能优化

### 目标
确保应用稳定运行，优化内存和 CPU 占用，修复已知问题。桌面宠物作为常驻应用，性能至关重要。

### 步骤 1: 性能审计

检查并优化以下性能问题：

1. **动画帧率控制**：确保所有 `requestAnimationFrame` 循环在窗口不可见时暂停：
```javascript
// 在 PetController.js 中
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    this.pauseAnimations();
  } else {
    this.resumeAnimations();
  }
});

pauseAnimations() {
  if (this.animationFrame) {
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = null;
  }
}

resumeAnimations() {
  if (!this.animationFrame) {
    this.startBodyWaveAnimation();
  }
}
```

2. **定时器清理**：审计所有 `setInterval`/`setTimeout`，确保组件销毁时全部清除。在每个使用定时器的类中添加 `destroy()` 方法：
```javascript
// 需要检查的类：
// - PetController: movement timer, wave animation, mood monitoring
// - CareSystem: decay timer
// - PomodoroTimer: countdown timer
// - SystemMonitor: poll interval
// - WeatherService: update interval
// - PetManager: social check interval
// - GrowthSystem: (无定时器，但检查事件监听器)
```

3. **DOM 操作优化**：
- 天气粒子效果：限制同时存在的粒子数量（最多 20 个）
- 聊天气泡定位：缓存宠物位置，避免每次都调用 `getBoundingClientRect()`
- 角色切换：使用 `documentFragment` 批量插入 DOM

4. **内存泄漏检查**：
- 确保事件监听器在组件销毁时移除
- 确保 `WeatherEffects` 的粒子元素被正确清理
- 确保角色切换时旧角色的 CSS `<style>` 标签被移除

### 步骤 2: CSS 动画优化

将所有动画改为使用 `transform` 和 `opacity`（GPU 加速），避免触发 layout/paint：

```css
/* 不好 - 触发 layout */
.segment { top: 2px; }

/* 好 - GPU 加速 */
.segment { transform: translateY(2px); }
```

检查所有角色的 CSS 动画，确保：
- 使用 `will-change: transform` 提示浏览器
- 不在动画中修改 `width`/`height`/`top`/`left`
- 使用 `contain: layout style` 限制重绘范围

### 步骤 3: Electron 特定优化

1. **透明窗口性能**：
```javascript
// 在 createWindow() 中，如果 GPU 加速有问题
app.commandLine.appendSwitch('disable-gpu-compositing');
// 或者启用硬件加速
app.commandLine.appendSwitch('enable-gpu-rasterization');
```

2. **减少 IPC 调用频率**：
- 系统信息轮询从 60 秒改为 120 秒（如果 CPU 不高的话）
- 批量 store 写入：收集多个 store.set 调用，合并为一次写入

3. **窗口事件优化**：
```javascript
// setIgnoreMouseEvents 调用频率限制
let lastMouseEventUpdate = 0;
function throttledSetIgnoreMouseEvents(ignore, options) {
  const now = Date.now();
  if (now - lastMouseEventUpdate < 50) return; // 50ms 节流
  lastMouseEventUpdate = now;
  mainWindow.setIgnoreMouseEvents(ignore, options);
}
```

### 步骤 4: 错误处理加固

1. 所有 `async` 函数添加 try-catch，防止未捕获异常导致应用崩溃
2. 添加全局错误处理：
```javascript
// 渲染进程
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  event.preventDefault();
});

window.addEventListener('error', (event) => {
  console.error('Uncaught error:', event.error);
});
```

3. 主进程：
```javascript
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
```

### 步骤 5: 验证清单

- [ ] 应用空闲时 CPU 占用 < 3%
- [ ] 内存占用 < 100MB
- [ ] 窗口最小化/隐藏时动画暂停
- [ ] 连续运行 1 小时无内存增长
- [ ] 所有组件的 destroy() 方法正确清理资源
- [ ] 角色切换无内存泄漏
- [ ] 全局错误处理不会导致应用崩溃
- [ ] 透明窗口在 macOS 和 Windows 上渲染正常

---

## 阶段十三: 构建与发布

### 目标
配置 electron-builder，生成 macOS（.dmg）和 Windows（.exe/.msi）安装包，准备发布。

### 步骤 1: 安装构建依赖

```bash
npm install --save-dev electron-builder
```

### 步骤 2: 配置 package.json

在 `package.json` 中添加构建配置：
```json
{
  "name": "ai-desk-pet",
  "version": "1.0.0",
  "description": "AI 桌面宠物 - 你的智能桌面伙伴",
  "main": "src/main/index.js",
  "scripts": {
    "start": "electron .",
    "build": "electron-builder",
    "build:mac": "electron-builder --mac",
    "build:win": "electron-builder --win",
    "build:all": "electron-builder --mac --win"
  },
  "build": {
    "appId": "com.ai-desk-pet.app",
    "productName": "AI桌宠",
    "directories": {
      "output": "dist"
    },
    "files": [
      "src/**/*",
      "node_modules/**/*",
      "package.json"
    ],
    "extraResources": [],
    "mac": {
      "category": "public.app-category.entertainment",
      "icon": "assets/icon.icns",
      "target": [
        {
          "target": "dmg",
          "arch": ["x64", "arm64"]
        }
      ],
      "darkModeSupport": true,
      "hardenedRuntime": true,
      "gatekeeperAssess": false
    },
    "dmg": {
      "title": "AI桌宠",
      "contents": [
        { "x": 130, "y": 220 },
        { "x": 410, "y": 220, "type": "link", "path": "/Applications" }
      ]
    },
    "win": {
      "icon": "assets/icon.ico",
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "assets/icon.ico",
      "uninstallerIcon": "assets/icon.ico",
      "installerHeaderIcon": "assets/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "AI桌宠"
    },
    "linux": {
      "icon": "assets/icon.png",
      "target": ["AppImage"],
      "category": "Game"
    }
  }
}
```

### 步骤 3: 创建应用图标

创建 `assets/` 目录，需要以下图标文件：
- `assets/icon.png` — 512×512 PNG（用于 Linux 和作为源文件）
- `assets/icon.icns` — macOS 图标（从 PNG 转换）
- `assets/icon.ico` — Windows 图标（从 PNG 转换）

图标设计：一只可爱的绿色毛毛虫头部特写，圆形背景，简洁卡通风格。

如果没有设计工具，可以先用一个简单的占位图标，后续替换。使用 `electron-icon-builder` 从 PNG 生成多平台图标：
```bash
npx electron-icon-builder --input=assets/icon.png --output=assets/
```

### 步骤 4: 自动更新配置（可选）

如果需要自动更新，安装 `electron-updater`：
```bash
npm install electron-updater
```

在 `src/main/index.js` 中添加：
```javascript
const { autoUpdater } = require('electron-updater');

app.whenReady().then(() => {
  // ... 现有代码

  // 检查更新（仅在打包后生效）
  if (app.isPackaged) {
    autoUpdater.checkForUpdatesAndNotify();
  }
});

autoUpdater.on('update-available', () => {
  mainWindow.webContents.send('update-available');
});

autoUpdater.on('update-downloaded', () => {
  mainWindow.webContents.send('update-downloaded');
});
```

### 步骤 5: 开机自启动

添加开机自启动选项：
```javascript
const { app } = require('electron');

// 在设置中添加开关
ipcMain.on('app:set-auto-launch', (_event, enabled) => {
  app.setLoginItemSettings({
    openAtLogin: enabled,
    openAsHidden: true
  });
  store.set('autoLaunch', enabled);
});

ipcMain.handle('app:get-auto-launch', () => {
  return store.get('autoLaunch', false);
});
```

在 `preload.js` 中暴露：
```javascript
setAutoLaunch: (enabled) => ipcRenderer.send('app:set-auto-launch', enabled),
getAutoLaunch: () => ipcRenderer.invoke('app:get-auto-launch')
```

在设置面板中添加"开机自启动"开关。

### 步骤 6: 系统托盘

添加系统托盘图标，让应用可以最小化到托盘：
```javascript
const { Tray, Menu } = require('electron');

let tray = null;

function createTray() {
  tray = new Tray(path.join(__dirname, '../../assets/tray-icon.png'));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示宠物',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: '隐藏宠物',
      click: () => mainWindow.hide()
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => mainWindow.webContents.send('context-menu-action', 'settings')
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('AI桌宠');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}
```

在 `app.whenReady()` 中调用 `createTray()`。

需要 `assets/tray-icon.png`（16×16 或 22×22 的小图标）。macOS 上使用 Template 图标（黑白）效果更好。

### 步骤 7: 构建测试

```bash
# macOS 构建
npm run build:mac

# Windows 构建（需要在 Windows 上或使用 CI）
npm run build:win

# 验证构建产物
ls -la dist/
```

### 步骤 8: 验证清单

- [ ] `npm run build:mac` 成功生成 .dmg 文件
- [ ] macOS 安装后应用正常运行
- [ ] 透明窗口、鼠标穿透在打包后正常工作
- [ ] electron-store 数据在打包后正确读写
- [ ] 系统托盘图标显示正确
- [ ] 开机自启动功能正常
- [ ] 右键菜单在打包后正常弹出
- [ ] LLM API 调用在打包后正常工作
- [ ] 应用图标在 Dock/任务栏中显示正确

---

## 执行顺序总结

| 阶段 | 名称 | 依赖 | 预估复杂度 |
|------|------|------|-----------|
| 7 | 角色皮肤系统 | 阶段 1-6 完成 | 高 |
| 8 | 成长进化系统 | 阶段 7 | 中 |
| 9 | 屏幕边缘+天气 | 阶段 7, 8 | 中 |
| 10 | 系统状态监控 | 阶段 7 | 中 |
| 11 | 多宠物社交 | 阶段 7, 8 | 高 |
| 12 | 测试与优化 | 阶段 7-11 | 中 |
| 13 | 构建与发布 | 阶段 12 | 中 |

每个阶段完成后，运行应用验证功能正常，再进入下一阶段。如果某个阶段的验证清单有未通过项，先修复再继续。
