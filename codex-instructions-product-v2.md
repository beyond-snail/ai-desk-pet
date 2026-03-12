# Codex 执行指令：体验深化任务

> 文档状态：当前有效执行指令（v2）。
>
> 背景：v1 功能已全部落地（内置 AI、主动行为、成长系统、新手引导、角色选择）。
> 本轮聚焦体验深化——让用户感觉"它需要我，而且它记得我"。
>
> 实现基线请参考 [technical-documentation.md](technical-documentation.md)。
> 通用约束：不引入新 npm 依赖，保持 vanilla JS + class 语法，每个任务完成后确保 `npm start` 能正常启动。

---

## 任务一：状态可视化（P0）

### 目标

用户能直观感知宠物当前的 hunger / cleanliness / affection 状态，产生"它需要我照顾"的动机。

### 当前问题

`CareSystem` 有完整的状态数据，`care:update` 事件也在 `index.html` 里监听了，但没有任何 UI 展示给用户。

### 实现方案

在宠物旁边显示 3 个极简状态点，颜色随数值变化：绿（>60）→ 黄（30-60）→ 红（<30）。不显示数字，只显示颜色信号。

#### 步骤 1：在 `src/renderer/index.html` 的 `<body>` 里添加状态指示器 HTML

在 `<div id="pet-root">` 之后（或之前）添加：

```html
<div id="pet-status-bar">
  <span class="status-dot" data-type="hunger" title="饱食度">🍃</span>
  <span class="status-dot" data-type="cleanliness" title="清洁度">✨</span>
  <span class="status-dot" data-type="affection" title="亲密度">💛</span>
</div>
```

#### 步骤 2：在 `src/renderer/styles/main.css` 添加样式

```css
#pet-status-bar {
  position: fixed;
  bottom: 80px;
  right: 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  z-index: 100;
  pointer-events: none;
}

.status-dot {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  opacity: 0.85;
  transition: opacity 0.4s, filter 0.4s;
  filter: grayscale(0%);
}

.status-dot[data-level="low"] {
  filter: grayscale(60%);
  opacity: 0.5;
  animation: status-pulse 2s ease-in-out infinite;
}

@keyframes status-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.9; }
}
```

#### 步骤 3：在 `src/renderer/index.html` 的 `care:update` 事件监听里更新状态点

找到（约第 754 行）：

```javascript
window.addEventListener('care:update', function(event) {
  const detail = event.detail || {};
  if (detail.state) {
    petController.applyCareState(detail.state);
  }
  if (detail.message) {
    chatBubble.show(detail.message, 4000);
  }
});
```

改为：

```javascript
window.addEventListener('care:update', function(event) {
  const detail = event.detail || {};
  if (detail.state) {
    petController.applyCareState(detail.state);
    updateStatusBar(detail.state);
  }
  if (detail.message) {
    chatBubble.show(detail.message, 4000);
  }
});

function updateStatusBar(state) {
  const bar = document.getElementById('pet-status-bar');
  if (!bar) return;
  const fields = { hunger: state.hunger, cleanliness: state.cleanliness, affection: state.affection };
  Object.entries(fields).forEach(([type, value]) => {
    const dot = bar.querySelector(`[data-type="${type}"]`);
    if (!dot) return;
    dot.dataset.level = value < 30 ? 'low' : value < 60 ? 'mid' : 'high';
  });
}
```

#### 步骤 4：初始化时也调用一次

在 `careSystem.init()` 之后（约第 482 行），添加：

```javascript
const initialCareState = careSystem.getState();
updateStatusBar(initialCareState);
```

**注意**：`updateStatusBar` 函数定义在 `care:update` 监听块附近，确保它在调用前已定义（可以提前定义或用函数声明）。

---

## 任务二：记忆感知升级（P0）

### 目标

宠物在对话中能体现"记得你"——知道你叫什么、今天是第几天、上次离开多久了、最近聊过什么。

### 当前问题

`memory.js` 的 `getPromptContext()` 只输出行为统计（喂了几次），没有对话内容摘要，也没有时间感知。`chat.js` 的 `buildSystemPrompt()` 已经调用了它，但内容质量太低。

### 实现方案

#### 步骤 1：升级 `src/renderer/ai/memory.js` 的 `getPromptContext()` 方法

将现有的 `getPromptContext()` 方法（第 83-112 行）替换为：

```javascript
getPromptContext() {
  const now = Date.now();
  const parts = [];

  // 时间感知
  const firstEvent = this.events[0];
  if (firstEvent) {
    const daysSinceFirst = Math.floor((now - firstEvent.at) / (24 * 60 * 60 * 1000));
    if (daysSinceFirst === 0) {
      parts.push('今天是你们第一次见面。');
    } else {
      parts.push(`你们已经相处了 ${daysSinceFirst} 天。`);
    }
  }

  // 最近聊天内容摘要（取最近3条用户消息）
  const recentChats = this.events
    .filter(e => e.type === 'chat:user' && e.payload && e.payload.text)
    .slice(-3)
    .map(e => e.payload.text);
  if (recentChats.length > 0) {
    parts.push(`用户最近说过："${recentChats.join('"、"')}"`);
  }

  // 行为摘要
  const counters = this.countByType();
  const behaviorParts = [];
  if (counters['care:feed']) behaviorParts.push(`喂食${counters['care:feed']}次`);
  if (counters['care:pet']) behaviorParts.push(`抚摸${counters['care:pet']}次`);
  if (counters['focus:complete']) behaviorParts.push(`完成专注${counters['focus:complete']}次`);
  if (behaviorParts.length > 0) {
    parts.push(`今天互动：${behaviorParts.join('、')}。`);
  }

  return parts.length > 0 ? parts.join('') : '';
}
```

#### 步骤 2：升级 `src/renderer/ai/chat.js` 的 `buildSystemPrompt()` 方法

将现有的 `buildSystemPrompt()` 方法（第 47-83 行）替换为：

```javascript
buildSystemPrompt() {
  const longerChat = this.growthSystem && this.growthSystem.hasAbility('longer_chat');
  const maxWords = longerChat ? 100 : 60;

  let prompt = `你是一只可爱的桌面宠物，陪伴在用户的电脑桌面上。回复要简短、温暖、有个性，不超过${maxWords}个字。不要用"主人"称呼用户，用"你"就好。`;

  if (this.careSystem) {
    const state = this.careSystem.getState();
    if (state.hunger <= 0) {
      prompt += '你现在很饿，会委婉表达想吃东西。';
    } else if (state.hunger > 80) {
      prompt += '你刚吃饱，心情很好。';
    }
    if (state.affection >= 60) {
      prompt += '你和用户很亲密，说话会自然撒娇一点。';
    } else if (state.affection < 20) {
      prompt += '你和用户还不太熟，说话比较礼貌克制。';
    }
    if (state.cleanliness < 30) {
      prompt += '你有点脏，偶尔会提到想洗澡。';
    }
  }

  if (this.growthSystem) {
    const growthState = this.growthSystem.getState();
    prompt += `你当前等级 ${growthState.level}，成长阶段是"${growthState.stageLabel}"。`;
  }

  if (this.memoryManager && typeof this.memoryManager.getPromptContext === 'function') {
    const memCtx = this.memoryManager.getPromptContext();
    if (memCtx) prompt += memCtx;
  }

  return prompt;
}
```

---

## 任务三：回归问候（P1）

### 目标

用户第二天或隔了几小时再打开 App，宠物主动说一句"想你了"类的话，建立情感连接。

### 当前问题

`ProactiveBehavior` 已经存储了 `lastShutdownAt`，但 `checkGreeting()` 只做了时间段问候（早/晚），没有利用离开时长做回归问候。

### 实现方案

#### 步骤 1：在 `src/renderer/components/ProactiveBehavior.js` 的 `checkGreeting()` 方法里添加回归问候逻辑

找到 `checkGreeting()` 方法（约第 129 行），在方法开头（现有逻辑之前）插入：

```javascript
checkGreeting() {
  // 回归问候：离开超过4小时
  if (this.lastShutdownAt) {
    const awayMs = Date.now() - this.lastShutdownAt;
    const awayHours = awayMs / (1000 * 60 * 60);
    const returnKey = 'returnGreeting_' + new Date().toDateString();

    if (awayHours >= 4 && !this.timeGreetingMarks[returnKey]) {
      this.timeGreetingMarks[returnKey] = true;
      this.persistGreetingMarks();

      let msg;
      if (awayHours >= 24) {
        const days = Math.floor(awayHours / 24);
        msg = days >= 2
          ? `你去哪了，${days}天没见到你了。`
          : '昨天你走了之后，我一直在等你回来。';
      } else {
        const hours = Math.floor(awayHours);
        msg = `你离开了${hours}个小时，我有点想你。`;
      }

      window.setTimeout(() => {
        if (this.chatBubble && !this.suppressed) {
          this.chatBubble.show(msg, 5000);
        }
      }, 1500);
      return; // 回归问候优先，不再叠加时间段问候
    }
  }

  // 原有时间段问候逻辑继续往下走
  // ... （保留原有代码不变）
```

**注意**：只在方法开头插入上面的代码块，原有的时间段问候逻辑（morning/evening 判断）保持不变，直接跟在 `return;` 之后。

#### 步骤 2：确认 `persistGreetingMarks()` 方法存在

检查 `ProactiveBehavior.js` 里是否有 `persistGreetingMarks()` 方法（保存 `timeGreetingMarks` 到 store）。如果没有，添加：

```javascript
persistGreetingMarks() {
  if (window.electronAPI && window.electronAPI.storeSet) {
    window.electronAPI.storeSet('proactiveTimeGreetings', this.timeGreetingMarks);
    return;
  }
  localStorage.setItem('proactiveTimeGreetings', JSON.stringify(this.timeGreetingMarks));
}
```

---

## 任务四：主动行为内容扩充（P1）

### 目标

把 4 条固定文案扩充到 30 条，按情境分类，避免用户感觉"在背台词"。

### 当前问题

`ProactiveBehavior.js` 的 `thoughtPool` 只有 4 条（第 26-31 行），且全是通用文案，没有情境区分。

### 实现方案

#### 步骤 1：将 `thoughtPool` 替换为分类内容池

找到 `constructor()` 里的 `thoughtPool`（第 26-31 行），替换为：

```javascript
this.thoughtPools = {
  // 通用随机想法（最常触发）
  idle: [
    '你专注的时候，我也会安静陪着。',
    '今天桌面节奏不错。',
    '如果累了，记得喝口水。',
    '我刚刚在想，要不要陪你做个小目标。',
    '有时候我会盯着屏幕发呆，你呢？',
    '你今天看起来很忙的样子。',
    '我在这里，随时可以聊。',
    '窗口开了好多，你在忙什么？',
    '偶尔休息一下眼睛，看看远处。',
    '我觉得你今天做得不错。',
  ],
  // 早晨
  morning: [
    '早上好，今天也要好好的。',
    '新的一天，从这里开始。',
    '早安，昨晚睡得好吗？',
  ],
  // 下午
  afternoon: [
    '下午了，要不要喝杯水？',
    '午后容易犯困，要不要活动一下？',
    '今天下午的进展怎么样？',
  ],
  // 傍晚/晚上
  evening: [
    '辛苦了一天，晚上放松一下吧。',
    '今天完成了什么，可以告诉我。',
    '晚上了，不用太拼，明天继续。',
  ],
  // 长时间没互动
  idle_long: [
    '你好像很久没理我了，还在吗？',
    '我在这里等你，不着急。',
    '有什么想聊的吗？',
  ],
  // 完成番茄钟后
  focus_done: [
    '专注结束了，休息一下吧。',
    '你刚才很专注，我都不敢打扰你。',
    '完成了！要继续还是休息一会儿？',
  ],
};
// 保留 thoughtPool 作为 idle 的别名，兼容现有调用
this.thoughtPool = this.thoughtPools.idle;
```

#### 步骤 2：升级 `triggerThought()` 方法，按时间段选池

找到调用 `this.thoughtPool` 的地方（约第 353 行），将：

```javascript
this.chatBubble.show(this.thoughtPool[Math.floor(Math.random() * this.thoughtPool.length)], 4200);
```

替换为：

```javascript
const hour = new Date().getHours();
let pool;
if (hour >= 5 && hour < 11) pool = this.thoughtPools.morning;
else if (hour >= 11 && hour < 17) pool = this.thoughtPools.afternoon;
else if (hour >= 17 && hour < 23) pool = this.thoughtPools.evening;
else pool = this.thoughtPools.idle;

// 合并 idle 增加多样性
const combined = [...pool, ...this.thoughtPools.idle];
this.chatBubble.show(combined[Math.floor(Math.random() * combined.length)], 4200);
```

#### 步骤 3：在番茄钟完成事件里触发专属文案

在 `index.html` 里找到番茄钟完成的事件处理（搜索 `focus:complete` 或 `pomodoro`），在完成回调里添加：

```javascript
proactiveBehavior.triggerFocusDone && proactiveBehavior.triggerFocusDone();
```

同时在 `ProactiveBehavior.js` 里添加方法：

```javascript
triggerFocusDone() {
  if (this.suppressed || !this.chatBubble) return;
  const pool = this.thoughtPools.focus_done;
  this.chatBubble.show(pool[Math.floor(Math.random() * pool.length)], 4500);
}
```

---

## 任务五：升级/进化仪式感（P1）

### 目标

升级和进化是情感高峰时刻，现在只有一行 chatBubble 文字，体验太平。需要加视觉反馈。

### 当前问题

`index.html` 第 572-583 行的 `onLevelUp` 和 `onStageChange` 回调只调用了 `chatBubble.show()`，没有任何动画或特效。

### 实现方案

#### 步骤 1：在 `src/renderer/styles/main.css` 添加升级特效样式

```css
/* 升级粒子特效 */
.levelup-burst {
  position: fixed;
  pointer-events: none;
  z-index: 9999;
  font-size: 22px;
  animation: levelup-float 1.4s ease-out forwards;
}

@keyframes levelup-float {
  0%   { opacity: 1; transform: translateY(0) scale(1); }
  100% { opacity: 0; transform: translateY(-60px) scale(1.4); }
}

/* 进化光晕 */
.evolve-flash {
  position: fixed;
  inset: 0;
  background: radial-gradient(circle at center, rgba(255,220,80,0.35) 0%, transparent 70%);
  pointer-events: none;
  z-index: 9998;
  animation: evolve-fade 1.8s ease-out forwards;
}

@keyframes evolve-fade {
  0%   { opacity: 1; }
  100% { opacity: 0; }
}
```

#### 步骤 2：在 `index.html` 里添加特效触发函数

在 `<script>` 块里（`growthSystem.onLevelUp` 之前）添加两个工具函数：

```javascript
function triggerLevelUpEffect(x, y) {
  const emojis = ['⭐', '✨', '🌟', '💫'];
  emojis.forEach((emoji, i) => {
    const el = document.createElement('div');
    el.className = 'levelup-burst';
    el.textContent = emoji;
    el.style.left = (x + (i - 1.5) * 28) + 'px';
    el.style.top = (y - 20) + 'px';
    el.style.animationDelay = (i * 80) + 'ms';
    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  });
}

function triggerEvolveEffect() {
  const el = document.createElement('div');
  el.className = 'evolve-flash';
  document.body.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}
```

#### 步骤 3：在回调里调用特效

将现有的 `onLevelUp` 回调（约第 572 行）改为：

```javascript
growthSystem.onLevelUp = (payload) => {
  const abilities = payload.abilities.map((ability) => ability.name).join('、');
  const message = abilities ? `升级到 Lv.${payload.level}，解锁 ${abilities}！` : `升级到 Lv.${payload.level} 了！`;
  chatBubble.show(message, 5000);
  const petEl = document.getElementById('pet-root');
  if (petEl) {
    const rect = petEl.getBoundingClientRect();
    triggerLevelUpEffect(rect.left + rect.width / 2, rect.top);
  }
};
```

将现有的 `onStageChange` 回调（约第 578 行）改为：

```javascript
growthSystem.onStageChange = async (payload) => {
  if (payload.characterId === petController.currentCharacterId) {
    triggerEvolveEffect();
    await petController.evolveToCurrentStage();
    chatBubble.show(`✨ 进化了！成长到"${payload.stageLabel}"阶段。`, 5500);
  }
};
```

---

## 任务六：宠物个性化（P2）

### 目标

让用户在设置里选择宠物性格，影响 AI 对话风格，让不同用户的宠物"说话不一样"。

### 当前问题

所有用户的宠物 system prompt 完全一样，没有个性差异。

### 实现方案

#### 步骤 1：在 `src/renderer/components/Settings.js` 的面板 HTML 里添加性格选项

在"伙伴外观"section（约第 45 行）里，`当前角色` label 之后添加：

```html
<label>
  <span>性格风格</span>
  <select id="settings-personality">
    <option value="warm">温暖体贴（默认）</option>
    <option value="lively">活泼开朗</option>
    <option value="cool">冷静克制</option>
    <option value="witty">毒舌幽默</option>
  </select>
</label>
```

#### 步骤 2：在 `Settings.js` 的 `init()` 和 `save()` 里读写这个字段

在 `init()` 里加载时（找到其他字段的 load 逻辑，仿照添加）：

```javascript
this.personalityField = this.panel.querySelector('#settings-personality');
// 加载
const savedPersonality = await this.getValue('petPersonality', 'warm');
this.personalityField.value = savedPersonality;
```

在 `save()` 里保存时：

```javascript
await this.setValue('petPersonality', this.personalityField.value);
```

#### 步骤 3：在 `src/renderer/ai/chat.js` 的 `buildSystemPrompt()` 里读取性格并注入

在 `buildSystemPrompt()` 开头添加性格描述映射：

```javascript
const personalityMap = {
  warm:   '你性格温暖体贴，说话轻柔，善于共情，让人感到被关心。',
  lively: '你性格活泼开朗，说话带劲，喜欢用感叹号，充满正能量。',
  cool:   '你性格冷静克制，说话简洁，不废话，但关键时刻很靠谱。',
  witty:  '你性格毒舌幽默，说话带点调侃，但不伤人，让人忍不住笑。',
};

// 读取性格（异步读取有成本，先用同步 localStorage 兜底）
const personality = localStorage.getItem('petPersonality') || 'warm';
const personalityDesc = personalityMap[personality] || personalityMap.warm;
```

然后在 prompt 字符串里加入：

```javascript
let prompt = `你是一只可爱的桌面宠物，陪伴在用户的电脑桌面上。${personalityDesc}回复要简短，不超过${maxWords}个字。不要用"主人"称呼用户，用"你"就好。`;
```

**注意**：`Settings.js` 用的是 `electronAPI.storeSet`，但 `chat.js` 里同步读取用 `localStorage` 兜底。需要在 `Settings.js` 的 `save()` 里同时写一份到 `localStorage`：

```javascript
localStorage.setItem('petPersonality', this.personalityField.value);
await this.setValue('petPersonality', this.personalityField.value);
```

---

## 任务七：宠物命名（P1）

### 目标

用户在首次启动时给宠物起名字，宠物在对话中用自己的名字自称，建立"这是我的宠物"的情感连接。

### 当前问题

`OnboardingGuide.js` 的引导流程只有 3 句话就结束了，没有让用户参与任何决策。宠物没有名字，system prompt 里也没有名字信息。

### 实现方案

#### 步骤 1：在 `src/renderer/components/OnboardingGuide.js` 的 `start()` 方法里加入命名步骤

在现有流程的"点我一下试试"之后、"你可以和我聊天"之前，插入命名交互：

```javascript
// 点击后，展示命名输入
await this.delay(800);
const petName = await this.askForName();
if (petName) {
  await this.setValue('petName', petName);
  localStorage.setItem('petName', petName);
  this.chatBubble.show(`${petName}，好名字！我很喜欢。`, 3200);
} else {
  this.chatBubble.show('没关系，你随时可以在设置里给我起名字。', 3200);
}
await this.delay(2200);
```

#### 步骤 2：在 `OnboardingGuide.js` 里添加 `askForName()` 方法

`ChatBubble` 没有输入能力，用原生 DOM 创建一个临时输入框：

```javascript
askForName() {
  return new Promise((resolve) => {
    // 创建临时输入层
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed; bottom: 120px; left: 50%; transform: translateX(-50%);
      background: rgba(255,255,255,0.95); border-radius: 16px;
      padding: 14px 18px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      display: flex; gap: 8px; align-items: center; z-index: 9999;
      font-family: inherit;
    `;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = '给我起个名字吧…';
    input.maxLength = 12;
    input.style.cssText = `
      border: none; outline: none; background: transparent;
      font-size: 14px; width: 160px; color: #333;
    `;

    const btn = document.createElement('button');
    btn.textContent = '好';
    btn.style.cssText = `
      border: none; background: #6c8ef5; color: #fff;
      border-radius: 8px; padding: 4px 12px; cursor: pointer; font-size: 13px;
    `;

    overlay.appendChild(input);
    overlay.appendChild(btn);
    document.body.appendChild(overlay);
    input.focus();

    const finish = () => {
      const name = input.value.trim();
      overlay.remove();
      resolve(name || null);
    };

    btn.addEventListener('click', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish();
      if (e.key === 'Escape') { overlay.remove(); resolve(null); }
    });

    // 10 秒无操作自动跳过
    window.setTimeout(() => {
      if (document.body.contains(overlay)) {
        overlay.remove();
        resolve(null);
      }
    }, 10000);
  });
}
```

#### 步骤 3：在 `src/renderer/ai/chat.js` 的 `buildSystemPrompt()` 里注入宠物名字

在 `buildSystemPrompt()` 开头（`personalityMap` 之前）添加：

```javascript
const petName = localStorage.getItem('petName') || '';
```

然后修改 prompt 的基础描述，将：

```javascript
let prompt = `你是一只可爱的桌面宠物，陪伴在用户的电脑桌面上。${personalityDesc}回复要简短，不超过${maxWords}个字。不要用"主人"称呼用户，用"你"就好。`;
```

改为：

```javascript
const nameDesc = petName ? `你的名字叫"${petName}"，这是用户给你起的名字，你很喜欢这个名字。` : '';
let prompt = `你是一只可爱的桌面宠物，陪伴在用户的电脑桌面上。${nameDesc}${personalityDesc}回复要简短，不超过${maxWords}个字。不要用"主人"称呼用户，用"你"就好。`;
```

#### 步骤 4：在 `src/renderer/components/Settings.js` 里添加宠物名字设置项

在"伙伴外观"section 的性格选项之后添加：

```html
<label>
  <span>宠物名字</span>
  <input id="settings-pet-name" type="text" placeholder="给宠物起个名字" maxlength="12">
</label>
```

在 `Settings.js` 的 `init()` 里加载：

```javascript
this.petNameField = this.panel.querySelector('#settings-pet-name');
const savedPetName = await this.getValue('petName', '');
this.petNameField.value = savedPetName;
```

在 `save()` 里保存：

```javascript
localStorage.setItem('petName', this.petNameField.value.trim());
await this.setValue('petName', this.petNameField.value.trim());
```

**注意**：已完成引导的老用户不会再走 `OnboardingGuide`，但可以通过设置面板补填名字。两条路都要通。

---

## 任务八：跨会话对话持久化（P1）

### 目标

宠物重启后仍然记得上次聊了什么，不再每次都像"第一次见面"。

### 当前问题

`chat.js` 的 `this.messages` 只存在内存里，App 重启后清空。`saveChatHistory()` 和 `loadChatHistory()` 方法已存在但用了 `localStorage`，且没有在初始化时自动调用。

### 实现方案

#### 步骤 1：修改 `src/renderer/ai/chat.js` 的 `init()` 方法，启动时自动加载历史

在 `init()` 方法末尾（`this.streamListenerBound` 判断块之后）添加：

```javascript
await this.loadPersistedHistory();
```

#### 步骤 2：添加 `loadPersistedHistory()` 方法

```javascript
async loadPersistedHistory() {
  try {
    let history = null;
    if (window.electronAPI && window.electronAPI.storeGet) {
      history = await window.electronAPI.storeGet('chatHistory');
    } else {
      const raw = localStorage.getItem('chatHistory');
      history = raw ? JSON.parse(raw) : null;
    }
    if (Array.isArray(history) && history.length > 0) {
      // 只加载最近 20 条，避免 token 过多
      this.messages = history.slice(-20);
    }
  } catch (_e) {
    // 加载失败静默处理，不影响正常使用
  }
}
```

#### 步骤 3：修改 `addMessage()` 方法，每次新增消息后自动持久化

将现有的 `addMessage()` 方法（约第 166 行）改为：

```javascript
addMessage(role, content) {
  this.messages.push({ role, content });
  if (this.messages.length > this.maxContextLength) {
    this.messages.shift();
  }
  this.persistHistory();
}

persistHistory() {
  const snapshot = this.messages.slice(-20);
  if (window.electronAPI && window.electronAPI.storeSet) {
    window.electronAPI.storeSet('chatHistory', snapshot);
    return;
  }
  localStorage.setItem('chatHistory', JSON.stringify(snapshot));
}
```

**注意**：原有的 `saveChatHistory()` 和 `loadChatHistory()` 方法保留不动，`persistHistory()` 是新增的自动持久化方法。

---

## 任务九：长期记忆提取系统（P1）

### 目标

每次对话结束后，AI 自动提取用户透露的关键信息（名字、职业、习惯、当前状态等），存入长期记忆库，下次对话时注入 system prompt，让宠物真正"了解你"。

### 架构说明

```
用户说话 → 正常对话 → 对话结束后异步触发提取
                              ↓
                    调用 LLM 提取关键事实（不阻塞主流程）
                              ↓
                    追加到长期记忆库（store）
                              ↓
                    下次 buildSystemPrompt() 时注入
```

### 实现方案

#### 步骤 1：在 `src/renderer/ai/memory.js` 里添加长期记忆相关方法

在 `InteractionMemory` 类里添加以下方法：

```javascript
// 长期记忆库操作
async loadLongTermMemory() {
  try {
    if (window.electronAPI && window.electronAPI.storeGet) {
      return (await window.electronAPI.storeGet('longTermMemory')) || [];
    }
    const raw = localStorage.getItem('longTermMemory');
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

async saveLongTermMemory(memories) {
  const snapshot = memories.slice(-30); // 最多保留 30 条
  if (window.electronAPI && window.electronAPI.storeSet) {
    window.electronAPI.storeSet('longTermMemory', snapshot);
    return;
  }
  localStorage.setItem('longTermMemory', JSON.stringify(snapshot));
}

async appendLongTermMemory(fact) {
  if (!fact || fact.trim().length < 3) return;
  const memories = await this.loadLongTermMemory();
  memories.push({ text: fact.trim(), at: Date.now() });
  await this.saveLongTermMemory(memories);
}

async getLongTermContext() {
  const memories = await this.loadLongTermMemory();
  if (memories.length === 0) return '';
  const facts = memories.slice(-15).map(m => m.text).join('；');
  return `关于用户你知道：${facts}。`;
}
```

#### 步骤 2：在 `src/renderer/ai/chat.js` 里添加记忆提取触发逻辑

在 `processInputStream()` 方法的 `onDone(content)` 调用之前，插入异步提取（不 await，不阻塞）：

```javascript
// 异步提取长期记忆，不阻塞对话流程
this.extractAndSaveMemory(input, content);
```

添加 `extractAndSaveMemory()` 方法：

```javascript
async extractAndSaveMemory(userInput, assistantReply) {
  if (!this.memoryManager || !window.electronAPI || !window.electronAPI.llmChat) return;

  try {
    const extractPrompt = `从以下对话中提取用户透露的关键个人信息（如姓名、职业、所在城市、当前状态、习惯偏好等），用一句话概括，不超过25字。如果没有值得记录的新信息，返回空字符串。

用户说：${userInput}
宠物回复：${assistantReply}

只返回提取结果，不要解释。`;

    const result = await window.electronAPI.llmChat(
      [{ role: 'user', content: extractPrompt }],
      { systemPrompt: '你是一个信息提取助手，只提取关键事实，不做任何解释。' }
    );

    const fact = result && !result.error ? (result.content || '').trim() : '';
    if (fact && fact.length > 2 && fact.length < 60) {
      await this.memoryManager.appendLongTermMemory(fact);
    }
  } catch (_e) {
    // 提取失败静默处理
  }
}
```

同样在 `processInput()`（非流式）的 `return response` 之前也加上：

```javascript
this.extractAndSaveMemory(input, response);
```

#### 步骤 3：在 `buildSystemPrompt()` 里注入长期记忆

`getLongTermContext()` 是异步方法，但 `buildSystemPrompt()` 是同步的。解决方案：在 `ChatManager` 里缓存长期记忆，定期刷新。

在 `ChatManager` 的 `constructor()` 里添加：

```javascript
this.longTermContext = '';
```

在 `init()` 方法末尾添加（加载历史之后）：

```javascript
await this.refreshLongTermContext();
```

添加 `refreshLongTermContext()` 方法：

```javascript
async refreshLongTermContext() {
  if (this.memoryManager && typeof this.memoryManager.getLongTermContext === 'function') {
    this.longTermContext = await this.memoryManager.getLongTermContext();
  }
}
```

在 `extractAndSaveMemory()` 成功追加记忆后，刷新缓存：

```javascript
if (fact && fact.length > 2 && fact.length < 60) {
  await this.memoryManager.appendLongTermMemory(fact);
  await this.refreshLongTermContext(); // 刷新缓存
}
```

在 `buildSystemPrompt()` 里，在 `memoryManager.getPromptContext()` 之后追加长期记忆：

```javascript
if (this.longTermContext) {
  prompt += this.longTermContext;
}
```

#### 步骤 4：在 `index.html` 里确保 `chatManager.init()` 是 await 调用

找到 `chatManager.init(careSystem, growthSystem, memoryManager)` 的调用（约第 486 行），确认它是否在 async 函数里。如果是，改为：

```javascript
await chatManager.init(careSystem, growthSystem, memoryManager);
```

如果原来不是 await，需要确认 `init()` 方法签名改为 `async init()`。

**关键约束**：
- 记忆提取调用走 `window.electronAPI.llmChat`，会消耗每日限额。内置用户每天限额需要评估是否够用（当前限额见 `checkDailyLimit()`）
- 提取失败（网络错误、限额用完）必须静默处理，不能影响正常对话
- 长期记忆库最多 30 条，超出时淘汰最旧的

---

## 任务十：修复圆形菜单闪烁 bug（P0）

### 目标

消除点击宠物时圆形菜单出现前的一帧闪烁（短暂出现竖排按钮或不定位状态）。

### 根本原因

`QuickActions.js` 的 `showMenu()` 方法里，移除 `hidden` class 和设置 `data-state='expanded'` 是三步连续的同步操作：

```javascript
this.element.classList.remove('hidden');   // 第1步：display: none → block
this.element.dataset.visible = 'true';     // 第2步：触发 quick-actions-reveal 动画
this.element.dataset.state = 'expanded';   // 第3步：.quick-menu opacity: 0 → 1
```

浏览器在第1步和第3步之间可能渲染一帧：此时外层容器已可见（`quick-actions-reveal` 动画从 `opacity:0` 开始），但 `.quick-menu` 的 `opacity: 0` 初始状态还没被 `expanded` 覆盖，导致短暂的不一致状态。

### 实现方案

#### 步骤 1：修改 `src/renderer/styles/main.css`，给 `.quick-actions.hidden` 加 `visibility: hidden`

找到（约第 984 行）：

```css
.quick-actions.hidden {
  display: none;
}
```

改为：

```css
.quick-actions.hidden {
  display: none;
  visibility: hidden;
}
```

#### 步骤 2：修改 `src/renderer/components/QuickActions.js` 的 `showMenu()` 方法，确保 `data-state` 在移除 `hidden` 之前就设好

找到 `showMenu()` 方法里的这段（约第 192-197 行）：

```javascript
this.visible = true;
this.state = 'expanded';
this.lockUntil = Date.now() + this.expandLockMs;
this.element.classList.remove('hidden');
this.element.dataset.visible = 'true';
this.element.dataset.state = 'expanded';
```

改为：

```javascript
this.visible = true;
this.state = 'expanded';
this.lockUntil = Date.now() + this.expandLockMs;
// 先设好 data-state，再移除 hidden，避免浏览器渲染中间态
this.element.dataset.state = 'expanded';
this.element.dataset.visible = 'true';
this.element.classList.remove('hidden');
```

#### 步骤 3：同步修改 `hide()` 方法，保持 `hidden` class 和 `data-state` 的设置顺序一致

找到 `hide()` 方法里（约第 231-233 行）：

```javascript
this.element.classList.add('hidden');
this.element.dataset.visible = 'false';
this.element.dataset.state = 'hidden';
```

改为：

```javascript
this.element.dataset.state = 'hidden';
this.element.dataset.visible = 'false';
this.element.classList.add('hidden');
```

**验证**：修改后点击宠物，圆形菜单应该直接以完整圆形布局出现，不再有竖排或错位的中间帧。

---

## 任务十一：圆形菜单交互与动效全面优化（P1）

### 目标

将圆形菜单从"弹出一个 UI 面板"升级为"从宠物身上长出来的有机交互"。涵盖三个维度：动效（stagger spring 弹出）、布局（更紧凑）、交互（更灵敏 + 防误触）。

### 当前问题

1. **动效机械**：4 个按钮同时 fade + scale 出现，像弹出一个静态面板，没有生命感
2. **布局偏散**：188px 区域放 4 个 52px 按钮，按钮间距大，视觉重心不集中
3. **交互延迟**：hover 420ms 才出现偏慢；点击弹出 3.2s 自动收起偏短；鼠标从宠物移向按钮时可能经过空白区导致菜单闪退
4. **菜单打开后是静止的**：没有任何微动画，看起来"死了"

### 实现方案

#### 步骤 1：替换 CSS 动画系统

在 `src/renderer/styles/main.css` 中，找到从 `.quick-actions {`（约第 976 行）到 `@keyframes quick-actions-reveal` 结束（约第 1135 行）的所有圆形菜单相关样式，**整体替换**为以下内容：

```css
/* ===== 弧形菜单容器 ===== */
.quick-actions {
  position: fixed;
  width: 80px;
  height: 160px;
  pointer-events: none;
  z-index: 18;
}

.quick-actions.hidden {
  display: none;
  visibility: hidden;
}

/* ===== 菜单内层 ===== */
.quick-actions .quick-menu {
  position: relative;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* ===== 按钮基础样式 ===== */
.quick-actions .quick-menu button {
  position: absolute;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 1px solid rgba(201, 229, 213, 0.78);
  border-radius: 50%;
  background: linear-gradient(180deg, rgba(232, 248, 238, 0.92), rgba(204, 231, 216, 0.86));
  backdrop-filter: blur(8px) saturate(120%);
  box-shadow: 0 4px 12px rgba(18, 41, 28, 0.16), inset 0 1px 0 rgba(243, 253, 247, 0.5);
  color: rgba(20, 48, 33, 0.9);
  cursor: pointer;
  pointer-events: auto;
  /* 初始状态：缩小不可见 */
  opacity: 0;
  transform: scale(0.3);
  transition: none;
}

/* ===== 弧形布局：4 个按钮沿右侧弧线排列 ===== */
/* 弧形半径约 60px，从 -60° 到 +60°，均匀分布 */
.quick-actions .quick-menu button[data-action='chat'] {
  left: 16px;
  top: 6px;
}

.quick-actions .quick-menu button[data-action='feed'] {
  left: 32px;
  top: 42px;
}

.quick-actions .quick-menu button[data-action='pet'] {
  left: 32px;
  top: 78px;
}

.quick-actions .quick-menu button[data-action='clean'] {
  left: 16px;
  top: 114px;
}

/* ===== Stagger Spring 弹出动画 ===== */
.quick-actions[data-state='expanded'] .quick-menu button {
  pointer-events: auto;
  opacity: 1;
  transform: scale(1);
  animation: qa-btn-pop-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) both,
             qa-btn-breathe 2.8s ease-in-out 0.5s infinite;
}

/* 依次弹出：每个按钮延迟 45ms */
.quick-actions[data-state='expanded'] .quick-menu button:nth-child(1) { animation-delay: 0ms, 500ms; }
.quick-actions[data-state='expanded'] .quick-menu button:nth-child(2) { animation-delay: 45ms, 545ms; }
.quick-actions[data-state='expanded'] .quick-menu button:nth-child(3) { animation-delay: 90ms, 590ms; }
.quick-actions[data-state='expanded'] .quick-menu button:nth-child(4) { animation-delay: 135ms, 635ms; }

/* ===== 按钮 hover 效果 ===== */
.quick-actions .quick-menu button:hover {
  transform: scale(1.12);
  border-color: rgba(180, 219, 195, 0.94);
  background: linear-gradient(180deg, rgba(240, 252, 245, 0.94), rgba(214, 236, 223, 0.9));
  box-shadow: 0 6px 18px rgba(19, 45, 30, 0.2), inset 0 1px 0 rgba(250, 255, 252, 0.64);
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease;
  animation-play-state: paused, paused;
}

/* ===== 按钮文字 ===== */
.quick-actions .quick-menu button .icon {
  font-size: 14px;
  line-height: 1;
}

.quick-actions .quick-menu button .label {
  font-size: 9px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  letter-spacing: 0.1px;
  color: rgba(18, 45, 30, 0.86);
}

/* ===== Keyframes ===== */
@keyframes qa-btn-pop-in {
  0% {
    opacity: 0;
    transform: scale(0.3);
  }
  60% {
    opacity: 1;
    transform: scale(1.08);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes qa-btn-breathe {
  0%, 100% {
    transform: scale(1) translateY(0);
  }
  50% {
    transform: scale(1) translateY(-1.2px);
  }
}

/* ===== 左侧镜像：宠物靠右时菜单在左边 ===== */
.quick-actions[data-side='left'] .quick-menu {
  transform: scaleX(-1);
}

.quick-actions[data-side='left'] .quick-menu button {
  transform: scaleX(-1) scale(0.3);
}

.quick-actions[data-side='left'][data-state='expanded'] .quick-menu button {
  transform: scaleX(-1) scale(1);
}

.quick-actions[data-side='left'] .quick-menu button:hover {
  transform: scaleX(-1) scale(1.12);
}
```

**注意**：
- 删除旧的 `@keyframes quick-actions-reveal`，不再需要
- 删除旧的 `.quick-actions[data-visible='true']` 动画规则，不再需要
- 删除旧的 `.quick-menu::before` 中心装饰圆，弧形布局不需要
- 容器从 188×188px 改为 80×160px（窄长条，适合弧形）
- 按钮从 52px 缩小到 44px
- 4 个按钮沿弧线排列：上方偏左 → 中间偏右 → 中间偏右 → 下方偏左，形成向右凸出的弧形

#### 步骤 2：修改 `src/renderer/components/QuickActions.js` 的交互参数和定位逻辑

**2a. 修改 `constructor()` 里的时间参数**

找到（约第 14-17 行）：

```javascript
this.hoverShowDelayMs = 420;
this.hideDelayMs = 420;
this.expandLockMs = 1800;
```

改为：

```javascript
this.hoverShowDelayMs = 300;
this.hideDelayMs = 380;
this.expandLockMs = 2200;
```

**2b. 修改 `positionNearPet()` 方法，适配弧形布局**

弧形菜单是窄长条（80×160px），贴在宠物右侧或左侧。替换整个 `positionNearPet()` 方法：

```javascript
positionNearPet() {
  const petElement = this.petController && this.petController.getElement ? this.petController.getElement() : null;
  if (!petElement || !this.element) {
    return false;
  }

  const rect = petElement.getBoundingClientRect();
  const menuWidth = 80;
  const menuHeight = 160;
  const petGap = 8;
  const edgePadding = 6;

  // 优先放右侧，放不下放左侧
  const preferRight = rect.right + petGap;
  const preferLeft = rect.left - menuWidth - petGap;
  const fitsRight = preferRight + menuWidth <= window.innerWidth - edgePadding;
  const x = fitsRight ? preferRight : preferLeft;

  // 垂直居中对齐宠物
  const centerY = rect.top + rect.height * 0.5;
  const y = this.clamp(centerY - menuHeight / 2, edgePadding, window.innerHeight - menuHeight - edgePadding);

  this.element.style.left = `${x.toFixed(1)}px`;
  this.element.style.top = `${y.toFixed(1)}px`;

  // 如果放在左侧，翻转弧形方向
  this.element.dataset.side = fitsRight ? 'right' : 'left';
  return true;
}
```

**2c. 修改 `showForPet()` 的自动收起时间**

找到（约第 212 行）：

```javascript
this.scheduleHide(3200);
```

改为：

```javascript
this.scheduleHide(5000);
```

**2d. 修改 `showMenu()` 方法，去掉 `data-visible` 属性设置**

因为 CSS 里不再使用 `data-visible` 触发动画（改用 stagger 动画），`showMenu()` 里可以去掉 `dataset.visible` 的设置。但为了不影响其他可能依赖这个属性的逻辑，保留它不删除，只确保顺序正确。

当前 `showMenu()` 里的顺序已经在任务十里修正过了（先设 state 再移除 hidden），不需要再改。

**2e. 修改 `hide()` 方法，去掉 `data-visible` 属性设置**

同上，保留 `dataset.visible` 不删除，顺序已在任务十里修正。

#### 步骤 3：验证清单

修改完成后，逐项验证：

1. **弹出动效**：点击宠物，4 个按钮从小到大依次弹出（间隔约 45ms），带轻微 overshoot 弹性，总时长约 250ms
2. **弧形布局**：按钮沿宠物右侧呈弧形排列（上→中上→中下→下），不是十字形
3. **呼吸动画**：菜单打开后，按钮有轻微上下浮动（约 1.2px），周期 2.8s
4. **hover 反馈**：鼠标悬停按钮时放大到 1.12 倍，呼吸动画暂停
5. **左右自适应**：宠物靠右时菜单出现在左侧（镜像翻转）
6. **hover 触发**：鼠标悬停宠物约 300ms 后菜单出现（比之前快）
7. **自动收起**：点击弹出后 5s 自动收起（比之前长）
8. **无闪烁**：菜单出现时不再有竖排按钮的中间帧（任务十的修复仍然生效）
9. **`npm start` 正常启动**

**注意**：任务十和任务十一都修改了 QuickActions.js 和 main.css。如果按顺序执行（先十后十一），任务十一的 CSS 会完全覆盖任务十的 CSS 修改（因为是整体替换）。任务十的 JS 修改（showMenu/hide 顺序调整）在任务十一里仍然需要保持。建议 Codex 先执行任务十的 JS 修改，再执行任务十一的 CSS 整体替换。

---

## 最终执行顺序

按以下顺序执行，每个任务完成后验证 `npm start` 正常启动：

1. **任务一**（状态可视化）— ✅ 已完成
2. **任务二**（记忆感知升级）— ✅ 已完成
3. **任务三**（回归问候）— ✅ 已完成
4. **任务四**（主动行为扩充）— ✅ 已完成
5. **任务五**（升级仪式感）— ✅ 已完成
6. **任务六**（宠物个性化）— ✅ 已完成
7. **任务七**（宠物命名）— 待执行，依赖任务六
8. **任务八**（跨会话对话持久化）— 待执行，独立
9. **任务九**（长期记忆提取系统）— 待执行，独立
10. **任务十**（修复圆形菜单闪烁 bug）— 待执行，独立
11. **任务十一**（弧形菜单交互与动效优化）— 待执行，依赖任务十
12. **任务十二**（成长日记）— 待执行，独立
13. **任务十三**（宠物心情可视化）— 待执行，独立
14. **任务十四**（对话输入框体验优化）— 待执行，独立
15. **任务十五**（错误提示人格化）— 待执行，独立
16. **任务十六**（状态感知菜单按钮脉冲）— 待执行，依赖任务十一
17. **任务十七**（Rainbow Bot 视觉亮度提升）— 待执行，独立

**并行策略**：
- 任务七、八、九可以并行
- 任务十 → 十一按顺序
- 任务十二、十三、十四、十五、十七互相独立，可以并行
- 任务十六依赖任务十一的新 CSS 结构

任务七到九可以并行。任务十和十一按顺序执行。任务十二到十六独立，可在任意时机执行。

---

## 任务十二：成长日记（P1）

### 目标

每次升级/进化时自动记录一条日记，用户可以通过右键菜单查看宠物的成长历程，产生"我们一起走过来的"情感。

### 当前问题

`GrowthSystem` 有完整的升级/进化回调（`onLevelUp`、`onStageChange`），但没有任何历史记录。用户看不到宠物的成长轨迹。

### 实现方案

#### 步骤 1：在 `src/renderer/index.html` 的 `onLevelUp` 和 `onStageChange` 回调里追加日记记录

找到 `growthSystem.onLevelUp` 回调（约第 664 行），在回调函数体末尾（`triggerLevelUpEffect` 之后）追加：

```javascript
appendGrowthDiary({
  type: 'levelup',
  level: payload.level,
  abilities: payload.abilities.map((a) => a.name),
  timestamp: Date.now()
});
```

找到 `growthSystem.onStageChange` 回调（约第 675 行），在回调函数体末尾追加：

```javascript
appendGrowthDiary({
  type: 'evolve',
  stage: payload.stage,
  stageLabel: payload.stageLabel,
  timestamp: Date.now()
});
```

#### 步骤 2：在 `src/renderer/index.html` 的 `<script>` 里添加日记读写函数

在 `submitInput()` 函数之前添加：

```javascript
async function loadGrowthDiary() {
  try {
    if (window.electronAPI && window.electronAPI.storeGet) {
      return (await window.electronAPI.storeGet('growthDiary')) || [];
    }
    const raw = localStorage.getItem('growthDiary');
    return raw ? JSON.parse(raw) : [];
  } catch (_e) {
    return [];
  }
}

async function appendGrowthDiary(entry) {
  const diary = await loadGrowthDiary();
  diary.push(entry);
  // 最多保留 50 条
  const snapshot = diary.slice(-50);
  if (window.electronAPI && window.electronAPI.storeSet) {
    window.electronAPI.storeSet('growthDiary', snapshot);
  } else {
    localStorage.setItem('growthDiary', JSON.stringify(snapshot));
  }
}

async function showGrowthDiary() {
  const diary = await loadGrowthDiary();
  if (diary.length === 0) {
    chatBubble.show('还没有成长记录，继续陪我就会有的。', 3500);
    return;
  }

  // 创建日记面板
  let panel = document.getElementById('growth-diary-panel');
  if (panel) {
    panel.remove();
  }

  panel = document.createElement('div');
  panel.id = 'growth-diary-panel';
  panel.className = 'growth-diary-panel';

  const entries = diary.slice(-20).reverse().map((entry) => {
    const date = new Date(entry.timestamp);
    const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
    if (entry.type === 'levelup') {
      const abilityText = entry.abilities && entry.abilities.length > 0 ? `，解锁了 ${entry.abilities.join('、')}` : '';
      return `<div class="diary-entry"><span class="diary-date">${dateStr}</span><span class="diary-text">🎉 升到了 Lv.${entry.level}${abilityText}</span></div>`;
    }
    if (entry.type === 'evolve') {
      return `<div class="diary-entry"><span class="diary-date">${dateStr}</span><span class="diary-text">✨ 进化到"${entry.stageLabel}"阶段</span></div>`;
    }
    return '';
  }).join('');

  panel.innerHTML = `
    <div class="diary-header">
      <span>成长日记</span>
      <button type="button" class="diary-close" aria-label="关闭">✕</button>
    </div>
    <div class="diary-list">${entries || '<div class="diary-empty">暂无记录</div>'}</div>
  `;

  document.body.appendChild(panel);

  panel.querySelector('.diary-close').addEventListener('click', () => {
    panel.remove();
  });
}
```

#### 步骤 3：在右键菜单里添加"成长日记"入口

在 `src/main/index.js` 的 `buildContextMenu()` 函数里，在"设置"之前添加：

```javascript
{
  label: '成长日记',
  click: () => sendContextAction('growth-diary')
},
```

在 `src/renderer/index.html` 的 `onContextMenuAction` handler 的 `actionMap` 里添加：

```javascript
'growth-diary': () => showGrowthDiary(),
```

#### 步骤 4：在 `src/renderer/styles/main.css` 里添加日记面板样式

```css
/* ===== 成长日记面板 ===== */
.growth-diary-panel {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  width: 240px;
  max-height: 360px;
  background: rgba(245, 250, 247, 0.95);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(180, 210, 192, 0.5);
  border-radius: 14px;
  box-shadow: 0 8px 32px rgba(18, 41, 28, 0.15);
  z-index: 200;
  overflow: hidden;
  animation: diary-slide-in 0.25s ease;
}

.growth-diary-panel .diary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px 8px;
  font-size: 13px;
  font-weight: 600;
  color: rgba(20, 48, 33, 0.9);
  border-bottom: 1px solid rgba(180, 210, 192, 0.3);
}

.growth-diary-panel .diary-close {
  background: none;
  border: none;
  font-size: 14px;
  color: rgba(20, 48, 33, 0.5);
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 4px;
}

.growth-diary-panel .diary-close:hover {
  background: rgba(20, 48, 33, 0.08);
  color: rgba(20, 48, 33, 0.8);
}

.growth-diary-panel .diary-list {
  padding: 8px 14px 14px;
  overflow-y: auto;
  max-height: 290px;
}

.growth-diary-panel .diary-entry {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(180, 210, 192, 0.15);
  font-size: 12px;
  line-height: 1.4;
}

.growth-diary-panel .diary-entry:last-child {
  border-bottom: none;
}

.growth-diary-panel .diary-date {
  flex-shrink: 0;
  color: rgba(20, 48, 33, 0.45);
  font-size: 11px;
  min-width: 52px;
}

.growth-diary-panel .diary-text {
  color: rgba(20, 48, 33, 0.8);
}

.growth-diary-panel .diary-empty {
  text-align: center;
  color: rgba(20, 48, 33, 0.4);
  padding: 20px 0;
  font-size: 12px;
}

@keyframes diary-slide-in {
  0% { opacity: 0; transform: translateY(-50%) translateX(12px); }
  100% { opacity: 1; transform: translateY(-50%) translateX(0); }
}
```

---

## 任务十三：宠物心情可视化（P2）

### 目标

根据养成状态在宠物身上叠加细微的视觉变化，让用户一眼看出宠物的心情。不改动画系统，纯 CSS 实现。

### 当前问题

`CareSystem` 有 `getDerivedMood()` 方法返回 `'hungry'`/`'sad'`/`null`，`care:update` 事件也带了 `derivedMood` 字段，但渲染层没有任何视觉响应。

### 实现方案

#### 步骤 1：在 `src/renderer/index.html` 的 `care:update` 事件监听里，将 mood 映射到宠物元素的 `data-mood` 属性

找到 `window.addEventListener('care:update', ...)` 回调（约第 852 行），在 `updateStatusBar(detail.state)` 之后添加：

```javascript
// 心情可视化
const petElement = getPetElement();
if (petElement) {
  const mood = detail.derivedMood || 'normal';
  const avgState = (detail.state.hunger + detail.state.cleanliness + detail.state.affection) / 3;
  let moodLevel = 'happy';
  if (mood === 'sad') {
    moodLevel = 'sad';
  } else if (mood === 'hungry') {
    moodLevel = 'hungry';
  } else if (avgState < 40) {
    moodLevel = 'low';
  } else if (avgState > 70) {
    moodLevel = 'happy';
  } else {
    moodLevel = 'normal';
  }
  petElement.dataset.mood = moodLevel;
}
```

#### 步骤 2：在 `src/renderer/styles/main.css` 里添加心情视觉效果

在宠物动画相关样式区域添加：

```css
/* ===== 宠物心情可视化 ===== */
/* 开心：轻微发光 */
[data-mood='happy'] {
  filter: drop-shadow(0 0 6px rgba(168, 230, 190, 0.35)) brightness(1.03);
  transition: filter 1.5s ease;
}

/* 正常：无特殊效果 */
[data-mood='normal'] {
  filter: none;
  transition: filter 1.5s ease;
}

/* 状态偏低：轻微去饱和 */
[data-mood='low'] {
  filter: saturate(0.85) brightness(0.97);
  transition: filter 1.5s ease;
}

/* 饥饿：轻微灰度 + 微弱暖色 */
[data-mood='hungry'] {
  filter: saturate(0.75) brightness(0.94) sepia(0.08);
  transition: filter 1.5s ease;
}

/* 伤心：明显灰度 */
[data-mood='sad'] {
  filter: saturate(0.55) brightness(0.88);
  transition: filter 1.5s ease;
}
```

**注意**：这些 filter 可能和宠物已有的动画 filter（如 `idle-look` 的 `drop-shadow`、`yawn` 的 `saturate`）冲突。如果冲突，需要在动画 keyframes 里合并 filter 值。但因为 `data-mood` 是持续状态，动画是临时状态，动画结束后 mood filter 会自动恢复，所以大多数情况下不会有问题。

---

## 任务十四：对话输入框体验优化（P1）

### 目标

支持 Shift+Enter 换行（当前 Enter 直接发送），输入时宠物有"思考"表情，提升对话的沉浸感。

### 当前问题

1. `userInput` 是 `<input type="text">`，不支持多行。Enter 直接调用 `submitInput()`，没有 Shift+Enter 换行
2. 用户输入时宠物没有任何反应，感觉在和一个"死"的输入框交互

### 实现方案

#### 步骤 1：将 `<input>` 改为 `<textarea>`

在 `src/renderer/index.html` 里，找到（约第 26 行）：

```html
<input id="user-input" type="text" placeholder="说点什么..." maxlength="200" autocomplete="off">
```

改为：

```html
<textarea id="user-input" placeholder="说点什么..." maxlength="200" autocomplete="off" rows="1"></textarea>
```

#### 步骤 2：修改 keydown 事件处理，支持 Shift+Enter 换行

找到 `userInput.addEventListener('keydown', ...)` 回调（约第 761 行）：

```javascript
userInput.addEventListener('keydown', function(event) {
  if (event.key === 'Enter') {
    submitInput();
  }

  if (event.key === 'Escape') {
    collapseInputPanel({ force: true });
  }
});
```

改为：

```javascript
userInput.addEventListener('keydown', function(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    submitInput();
    return;
  }

  if (event.key === 'Escape') {
    collapseInputPanel({ force: true });
  }
});
```

#### 步骤 3：添加输入时的自动高度调整和宠物反应

在 keydown 事件之后添加：

```javascript
userInput.addEventListener('input', function() {
  // 自动调整高度（最多 3 行）
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 72) + 'px';

  // 输入时宠物显示"在听"的表情
  if (this.value.trim().length > 0) {
    setChatMood('listening');
  }
});
```

#### 步骤 4：在 `src/renderer/styles/main.css` 里调整 textarea 样式

找到 `#user-input` 的样式（如果有），确保 textarea 的样式和原来的 input 一致。添加或修改：

```css
#user-input {
  resize: none;
  overflow-y: hidden;
  min-height: 32px;
  max-height: 72px;
  line-height: 1.4;
}
```

#### 步骤 5：确认 `submitInput()` 兼容 textarea

`submitInput()` 里用的是 `userInput.value.trim()`，textarea 的 `.value` 和 input 一样，不需要改。但提交后需要重置高度：

在 `submitInput()` 的 `userInput.value = ''` 之后添加：

```javascript
userInput.style.height = 'auto';
```

#### 步骤 6：添加 `listening` 心情状态

检查 `setChatMood()` 函数是否支持 `'listening'` 状态。如果不支持，在宠物的 mood 映射里添加。`listening` 状态的视觉效果：宠物轻微歪头或耳朵竖起——如果当前动画系统不支持，可以用 CSS 实现轻微旋转：

```css
[data-chat-mood='listening'] {
  transform-origin: center bottom;
  animation: pet-listening 1.2s ease-in-out infinite;
}

@keyframes pet-listening {
  0%, 100% { transform: rotate(0deg); }
  30% { transform: rotate(2deg); }
  70% { transform: rotate(-1.5deg); }
}
```

**注意**：如果 `setChatMood` 不存在或不支持自定义状态，跳过步骤 6，只做步骤 1-5。

---

## 任务十五：错误提示人格化（P1）

### 目标

将技术性错误信息替换为宠物口吻的友好提示，让错误也成为互动的一部分。

### 当前问题

`chatBubble.showError()` 显示的是硬编码的技术文案（如"暂时无法处理这条消息。"），没有宠物的性格特征。

### 实现方案

#### 步骤 1：在 `src/renderer/index.html` 里创建人格化错误消息池

在 `submitInput()` 函数之前添加：

```javascript
const petErrorMessages = [
  '呜……我好像卡住了，再试一次好吗？',
  '刚才脑子转不过来了，你再说一遍？',
  '我出了点小状况，不过没事，再来！',
  '嗯？刚才没听清，可以再说一次吗？',
  '我打了个盹，错过了你说的话……'
];

function getRandomPetError() {
  return petErrorMessages[Math.floor(Math.random() * petErrorMessages.length)];
}
```

#### 步骤 2：替换 `submitInput()` 里的错误提示

找到 `submitInput()` 的 catch 块（约第 550-553 行）：

```javascript
} catch (error) {
  console.error(error);
  chatBubble.showError('暂时无法处理这条消息。');
}
```

改为：

```javascript
} catch (error) {
  console.error(error);
  chatBubble.show(getRandomPetError(), 4000);
  setChatMood('confused', { resetAfterMs: 2000 });
}
```

#### 步骤 3：替换 `chat.js` 里的 daily_limit 提示

`chat.js` 里的 `'今天聊得够多啦，明天再来找我玩吧～'` 已经是人格化的，保留不动。

**注意**：只改 `index.html` 里的 catch 块，不改 `chat.js` 内部的 fallback 逻辑。

---

## 任务十六：状态感知菜单按钮脉冲（P2）

### 目标

当宠物某个养成值低于 30 时，圆形菜单里对应的按钮图标轻微脉冲，暗示"该照顾了"。

### 当前问题

圆形菜单的 4 个按钮是静态的，不反映宠物当前状态。用户需要看状态点才知道该做什么。

### 实现方案

#### 步骤 1：在 `src/renderer/index.html` 的 `care:update` 事件监听里，更新菜单按钮的状态标记

找到 `window.addEventListener('care:update', ...)` 回调，在 `positionStatusBar()` 之后添加：

```javascript
// 更新菜单按钮状态感知
const quickMenuEl = document.querySelector('#quick-actions .quick-menu');
if (quickMenuEl && detail.state) {
  const feedBtn = quickMenuEl.querySelector('[data-action="feed"]');
  const cleanBtn = quickMenuEl.querySelector('[data-action="clean"]');
  const petBtn = quickMenuEl.querySelector('[data-action="pet"]');
  if (feedBtn) feedBtn.classList.toggle('needs-attention', detail.state.hunger < 30);
  if (cleanBtn) cleanBtn.classList.toggle('needs-attention', detail.state.cleanliness < 30);
  if (petBtn) petBtn.classList.toggle('needs-attention', detail.state.affection < 30);
}
```

#### 步骤 2：在 `src/renderer/styles/main.css` 里添加脉冲动画

在圆形菜单样式区域添加：

```css
/* ===== 状态感知按钮脉冲 ===== */
.quick-actions .quick-menu button.needs-attention .icon {
  animation: qa-needs-pulse 1.8s ease-in-out infinite;
}

@keyframes qa-needs-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.15); }
}
```

**注意**：脉冲动画只作用于 `.icon` 元素（emoji），不影响按钮本身的 stagger 弹出动画和呼吸动画。

---

## 任务十七：Rainbow Bot 视觉亮度提升（P1）

### 目标

Rainbow Bot 在深色桌面背景下显得太暗、不够突出。提升 SVG 渐变亮度和外发光，让它在任何背景下都"跳出来"。

### 当前问题

`src/renderer/characters/rainbow-bot/template.html` 里的 SVG 渐变色偏深：
- 头部渐变终点 `#3d7a9a`（暗蓝绿），在深色背景下几乎融入背景
- 身体渐变终点 `#4e8aaa`（暗蓝），同样偏暗
- 面罩颜色 `#123852` → `#102f4a`（极深蓝），在暗背景下看不清边界
- 四肢渐变终点 `#3d6a88`（暗蓝灰）
- 整体没有外发光（glow），缺乏存在感

### 实现方案

#### 步骤 1：提亮 SVG 渐变色

在 `src/renderer/characters/rainbow-bot/template.html` 里修改以下渐变：

**头部渐变 `rb-headGrad`**（约第 5-10 行）：

```xml
<radialGradient id="rb-headGrad" cx="35%" cy="28%" r="65%" gradientUnits="objectBoundingBox">
  <stop offset="0%" stop-color="#f0faff"/>
  <stop offset="30%" stop-color="#cce8f4"/>
  <stop offset="70%" stop-color="#94c8de"/>
  <stop offset="100%" stop-color="#5a9ab8"/>
</radialGradient>
```

**身体渐变 `rb-bodyGrad`**（约第 24-28 行）：

```xml
<radialGradient id="rb-bodyGrad" cx="38%" cy="25%" r="70%" gradientUnits="objectBoundingBox">
  <stop offset="0%" stop-color="#e8f4fa"/>
  <stop offset="40%" stop-color="#b0d8ea"/>
  <stop offset="100%" stop-color="#6aa0be"/>
</radialGradient>
```

**面罩渐变 `rb-visorGrad`**（约第 53-57 行）：

```xml
<linearGradient id="rb-visorGrad" x1="28" y1="48" x2="92" y2="84" gradientUnits="userSpaceOnUse">
  <stop offset="0%" stop-color="#1a4a6a"/>
  <stop offset="55%" stop-color="#245e85"/>
  <stop offset="100%" stop-color="#183d5c"/>
</linearGradient>
```

**四肢渐变 `rb-limbGrad`**（约第 35-40 行）：

```xml
<linearGradient id="rb-limbGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
  <stop offset="0%" stop-color="#d4e8f2"/>
  <stop offset="35%" stop-color="#b0d0e2"/>
  <stop offset="70%" stop-color="#82b0cc"/>
  <stop offset="100%" stop-color="#5580a0"/>
</linearGradient>
```

#### 步骤 2：增强外发光滤镜

找到 `rb-dropShadow` 滤镜（约第 82-84 行）：

```xml
<filter id="rb-dropShadow" x="-25%" y="-20%" width="150%" height="150%">
  <feDropShadow dx="2" dy="6" stdDeviation="5" flood-color="#001828" flood-opacity="0.5"/>
</filter>
```

改为（加一层柔和的外发光）：

```xml
<filter id="rb-dropShadow" x="-30%" y="-25%" width="160%" height="160%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="glow"/>
  <feFlood flood-color="#7ec8e8" flood-opacity="0.25" result="glowColor"/>
  <feComposite in="glowColor" in2="glow" operator="in" result="softGlow"/>
  <feDropShadow dx="1" dy="4" stdDeviation="4" flood-color="#001828" flood-opacity="0.4"/>
  <feMerge>
    <feMergeNode in="softGlow"/>
    <feMergeNode in="SourceGraphic"/>
  </feMerge>
</filter>
```

#### 步骤 3：提亮面罩内发光和眼睛发光

**面罩内发光 `rb-visorInnerGlow`**（约第 63-66 行）：

```xml
<radialGradient id="rb-visorInnerGlow" cx="50%" cy="55%" r="55%" gradientUnits="objectBoundingBox">
  <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.28"/>
  <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
</radialGradient>
```

**面罩边框**（约第 123 行），提亮边框颜色：

找到：
```xml
<rect x="29.5" y="49.5" width="61" height="33" rx="9" fill="none" stroke="rgba(118,214,255,0.34)" stroke-width="1"/>
```

改为：
```xml
<rect x="29.5" y="49.5" width="61" height="33" rx="9" fill="none" stroke="rgba(118,214,255,0.5)" stroke-width="1.2"/>
```

#### 步骤 4：在 `src/renderer/characters/rainbow-bot/style.css` 里添加默认外发光

在 Rainbow Bot 的 CSS 文件里，给整体添加一个微弱的常驻发光效果：

```css
.caterpillar[data-character='rainbow-bot'] .rb-svg {
  filter: drop-shadow(0 0 8px rgba(126, 200, 232, 0.2));
}
```

**注意**：这个 filter 可能和 `care:update` 的 mood filter 叠加。如果冲突，mood filter 会覆盖这个默认值（因为 mood filter 作用在 `.caterpillar` 父元素上，而这个作用在 `.rb-svg` 子元素上），所以不会有问题。

#### 验证

修改后在深色桌面壁纸下查看 Rainbow Bot：
1. 头部和身体应该明显更亮，蓝色调更清透
2. 面罩区域边界更清晰，内部发光更明显
3. 整体有一圈柔和的蓝色外发光，在深色背景下"浮"起来
4. 彩虹条纹颜色不变（已经够亮了）
5. 不影响 Caterpillar 角色的视觉效果
