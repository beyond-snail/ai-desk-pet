# Codex 执行指令：产品体验优先级任务

> 文档状态：当前有效执行指令。
>
> 背景：桌面端 v1.0 功能已完整，但产品体验存在关键缺陷——AI 对话需要用户手动配置 API Key，导致开箱体验为"假 AI"。
> 本轮任务聚焦：让产品开箱即用、让宠物活起来、让用户有理由留下来。
>
> 实现基线请参考 [technical-documentation.md](technical-documentation.md)。
> 文档优先级请参考 [docs/document-authority.md](docs/document-authority.md)。

---

## 任务一：内置 AI 服务，零配置开箱即用

### 目标

用户首次启动 App，不需要任何配置，就能和宠物进行真实 AI 对话。

### 当前问题

- `src/main/index.js` 的 `handleLlmChat` 和 `handleLlmChatStream` 函数在没有 API Key 时直接返回错误
- `src/renderer/ai/chat.js` 收到 `no_api_key` 错误后显示"还没有配置 API Key"提示
- 用户如果不配置 Key，只能得到 `getMockResponse` 的罐头回复

### 实现步骤

#### 步骤 1：添加内置 LLM 配置

在 `src/main/index.js` 顶部（`let store = null;` 之前）添加内置配置常量：

```javascript
const BUILT_IN_LLM = {
  provider: 'deepseek',
  apiKey: 'sk-eece5712a74b4f94a100482b0c9943bb',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com/v1'
};
```

#### 步骤 2：修改 handleLlmChat 函数

修改 `handleLlmChat`（约第 213 行）的 Key 获取逻辑：

```javascript
async function handleLlmChat(messages, options = {}) {
  const userApiKey = store.get('llmApiKey');
  const isBuiltIn = !userApiKey;
  const apiKey = userApiKey || BUILT_IN_LLM.apiKey;
  const provider = isBuiltIn ? BUILT_IN_LLM.provider : (store.get('llmProvider') || 'deepseek');
  const model = isBuiltIn ? BUILT_IN_LLM.model : (store.get('llmModel') || 'deepseek-chat');
  // ... 后续逻辑不变，使用上面的 apiKey / provider / model 变量
```

对 `handleLlmChatStream`（约第 351 行）做同样的修改。

**关键约束**：
- 不要删除用户自定义 Key 的能力，只是在没有自定义 Key 时 fallback 到内置配置
- `handleLlmChat` 和 `handleLlmChatStream` 两个函数都要改
- Anthropic provider 分支保持不变，内置配置只走 DeepSeek

#### 步骤 3：移除 no_api_key 阻断

修改 `src/renderer/ai/chat.js`：

- `processInputStream` 方法（约第 139 行）：移除 `no_api_key` 的特殊错误处理，因为不会再出现这个错误
- `generateResponse` 方法（约第 172 行）：同样移除 `no_api_key` 判断
- 保留网络错误和其他 API 错误的 fallback 到 `getMockResponse`

#### 步骤 4：更新设置面板说明

修改 `src/renderer/components/Settings.js`：

将 LLM 接入区域的说明文字从：
```
不填写也可以继续使用本地回退回复。
```
改为：
```
已内置 AI 服务，无需配置即可聊天。填写自己的 Key 可获得更好的体验。
```

### 验证标准

1. 删除本地 electron-store 中的 `llmApiKey` 配置
2. 启动 App，点击宠物，选择聊天，输入任意文字
3. 宠物应返回真实 AI 回复（非罐头回复）
4. 流式输出正常工作（文字逐字显示）

---

## 任务二：每日对话限流（防止内置 Key 滥用）

### 目标

对使用内置 Key 的用户，限制每日对话次数。使用自定义 Key 的用户不受限制。

### 实现步骤

#### 步骤 1：在主进程添加限流逻辑

在 `src/main/index.js` 中添加限流工具函数：

```javascript
const DAILY_LIMIT = 100; // 内置 Key 每日对话上限

function checkDailyLimit() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const record = store.get('dailyUsage') || { date: '', count: 0 };

  if (record.date !== today) {
    store.set('dailyUsage', { date: today, count: 0 });
    return { allowed: true, remaining: DAILY_LIMIT };
  }

  if (record.count >= DAILY_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: DAILY_LIMIT - record.count };
}

function incrementDailyUsage() {
  const today = new Date().toISOString().slice(0, 10);
  const record = store.get('dailyUsage') || { date: '', count: 0 };

  if (record.date !== today) {
    store.set('dailyUsage', { date: today, count: 1 });
  } else {
    store.set('dailyUsage', { date: today, count: record.count + 1 });
  }
}
```

#### 步骤 2：在 handleLlmChat 和 handleLlmChatStream 中应用限流

仅当使用内置 Key（`isBuiltIn === true`）时检查限流：

```javascript
if (isBuiltIn) {
  const limit = checkDailyLimit();
  if (!limit.allowed) {
    // 返回限流提示，引导用户配置自己的 Key
    return { error: 'daily_limit', message: '今天的免费对话次数用完了，明天再来聊，或者在设置中配置自己的 API Key。' };
  }
  incrementDailyUsage();
}
```

对 stream 版本同样处理，通过 sendEvent 发送 error 类型事件。

#### 步骤 3：前端处理限流提示

在 `src/renderer/ai/chat.js` 的错误处理中，增加 `daily_limit` 错误类型的友好提示：

```javascript
if (error.error === 'daily_limit') {
  fallback = '今天聊得够多啦，明天再来找我玩吧～';
}
```

### 验证标准

1. 使用内置 Key 连续对话，确认计数正常
2. 手动将 `dailyUsage.count` 设为 100，确认下次对话返回限流提示
3. 配置自定义 Key 后，确认不受限流影响

---

## 任务三：宠物状态衰减机制

### 目标

宠物的饥饿度、清洁度、心情会随时间自然下降。长时间不互动，宠物会表现出不开心，给用户"需要照顾"的感觉。

### 当前状态

`src/renderer/components/CareSystem.js` 已有 hunger / cleanliness / affection 三个属性，但需要确认是否已有自动衰减。

### 实现步骤

#### 步骤 1：确认现有衰减机制

先读取 `CareSystem.js`，检查是否已有定时衰减逻辑。如果已有，跳到步骤 2 调整参数；如果没有，实现以下逻辑。

#### 步骤 2：实现或调整定时衰减

在 CareSystem 中添加定时衰减（如果不存在）：

```javascript
startDecay() {
  // 每 10 分钟衰减一次
  this.decayInterval = setInterval(() => {
    this.state.hunger = Math.max(0, this.state.hunger - 3);
    this.state.cleanliness = Math.max(0, this.state.cleanliness - 2);
    this.state.affection = Math.max(0, this.state.affection - 1);
    this.saveState();
    this.emitStateChange();
  }, 10 * 60 * 1000);
}
```

衰减速率参考：
- 饥饿度：每 10 分钟 -3（约 5.5 小时从满到空）
- 清洁度：每 10 分钟 -2（约 8 小时从满到空）
- 好感度：每 10 分钟 -1（约 16 小时从满到空）

#### 步骤 3：离线时间补偿

App 启动时，计算上次关闭到现在的时间差，按比例扣除状态值：

```javascript
applyOfflineDecay() {
  const lastActive = this.state.lastActiveTime || Date.now();
  const elapsed = Date.now() - lastActive;
  const intervals = Math.floor(elapsed / (10 * 60 * 1000));

  if (intervals > 0) {
    this.state.hunger = Math.max(0, this.state.hunger - intervals * 3);
    this.state.cleanliness = Math.max(0, this.state.cleanliness - intervals * 2);
    this.state.affection = Math.max(0, this.state.affection - intervals * 1);
    this.saveState();
  }
}
```

在 CareSystem 的 init 或 constructor 中调用 `applyOfflineDecay()`。
每次状态变更时更新 `lastActiveTime`。

#### 步骤 4：低状态视觉反馈

当任一状态低于 30 时，通过已有的情绪系统触发对应表现：
- 饥饿度 < 30：宠物显示饥饿表情/动画
- 清洁度 < 30：宠物显示脏兮兮的视觉效果
- 好感度 < 30：宠物动作变慢、不主动靠近

具体实现方式：通过 `window.dispatchEvent` 发送状态事件，让 Caterpillar / PetController 监听并切换动画状态。

### 验证标准

1. 启动 App，等待 10 分钟，确认状态值下降
2. 关闭 App，等待 30 分钟后重新打开，确认离线衰减生效
3. 饥饿度低于 30 时，宠物表现出饥饿状态
4. 喂食后状态恢复，宠物表现恢复正常

---

## 任务四：首次启动引导

### 目标

新用户第一次打开 App 时，宠物主动打招呼并演示自己的能力，而不是沉默地坐在桌面上。

### 实现步骤

#### 步骤 1：检测首次启动

在 `src/renderer/index.html` 的初始化流程中（或合适的入口组件），检查是否首次启动：

```javascript
const isFirstLaunch = !(await window.electronAPI.storeGet('hasLaunched'));
```

#### 步骤 2：实现引导序列

首次启动时，宠物依次执行以下动作（每步间隔 2-3 秒）：

1. 宠物从屏幕边缘走到中间位置
2. 气泡显示："你好呀！我是你的桌面伙伴～"
3. 气泡显示："点我一下试试？"
4. 用户点击后，显示快捷操作面板，气泡提示："你可以和我聊天、喂我吃东西、或者摸摸我"
5. 气泡显示："右键点我还有更多选项哦"
6. 标记 `hasLaunched = true`

#### 步骤 3：实现方式

创建 `src/renderer/components/OnboardingGuide.js`：

```javascript
class OnboardingGuide {
  constructor(chatBubble, petController) {
    this.chatBubble = chatBubble;
    this.petController = petController;
    this.step = 0;
  }

  async start() {
    const steps = [
      { delay: 1000, message: '你好呀！我是你的桌面伙伴～' },
      { delay: 3000, message: '点我一下试试？', waitForClick: true },
      { delay: 2000, message: '你可以和我聊天、喂我吃东西、或者摸摸我' },
      { delay: 4000, message: '右键点我还有更多选项哦～' },
      { delay: 3000, message: '好啦，有什么需要随时找我！' }
    ];

    for (const step of steps) {
      await this.delay(step.delay);
      this.chatBubble.show(step.message);

      if (step.waitForClick) {
        await this.waitForPetClick();
      }
    }

    window.electronAPI.storeSet('hasLaunched', true);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  waitForPetClick() {
    return new Promise(resolve => {
      const handler = () => {
        document.removeEventListener('pet:clicked', handler);
        resolve();
      };
      document.addEventListener('pet:clicked', handler);
    });
  }
}
```

在 `index.html` 初始化流程末尾调用：

```javascript
if (isFirstLaunch) {
  const guide = new OnboardingGuide(chatBubble, petController);
  guide.start();
}
```

**注意**：需要确认 `chatBubble` 组件的实际 API（show/display 方法名），以及宠物点击事件的实际事件名。先读取 `ChatBubble.js` 和 `Caterpillar.js` 确认。

### 验证标准

1. 清除 `hasLaunched` 标记，启动 App
2. 宠物自动执行引导序列，气泡依次显示
3. 第二次启动不再触发引导
4. 引导过程中用户可以正常交互（不阻塞）

---

## 任务五：宠物主动行为增强

### 目标

宠物不只是被动等待用户操作，而是会主动找用户互动。

### 当前状态

`src/renderer/components/ProactiveBehavior.js` 已存在。先读取该文件，了解现有的主动行为实现，在此基础上增强。

### 需要增加的主动行为

#### 1. 基于状态的主动提醒

当宠物状态低时，主动弹出气泡：
- 饥饿度 < 20："肚子好饿...能喂我点东西吗？"
- 清洁度 < 20："我好像有点脏了..."
- 好感度 < 20："好久没有摸摸我了..."

每种提醒至少间隔 30 分钟，避免烦人。

#### 2. 基于时间的主动问候

- 早上首次打开（6:00-10:00）："早上好！今天也要加油哦～"
- 中午时段（11:30-13:00）："该吃午饭了，别忘了休息一下"
- 晚上时段（18:00-20:00）："辛苦了一天，晚上放松一下吧"
- 深夜时段（23:00-次日 5:00）："这么晚了还在忙？注意休息呀"

每个时段只触发一次。

#### 3. 基于天气的主动评论

如果天气服务已配置且有数据，宠物偶尔评论天气：
- 下雨："外面在下雨呢，出门记得带伞"
- 高温（>35°C）："今天好热，多喝水"
- 低温（<5°C）："好冷，注意保暖"

### 实现约束

- 在现有 `ProactiveBehavior.js` 基础上扩展，不要重写
- 所有主动行为通过 ChatBubble 显示，不弹系统通知
- 主动行为有冷却时间，不能连续触发
- 用户正在输入或设置面板打开时，不触发主动行为

### 验证标准

1. 将饥饿度手动设为 15，等待一段时间，宠物主动提醒喂食
2. 在对应时间段启动 App，收到时段问候
3. 主动行为不会在用户操作时打断

---

---

## 任务六：唤醒与消失动画

### 目标

宠物的出现和隐藏不是生硬的显示/隐藏，而是有仪式感的动画：从屏幕边缘钻出来，离开时走回边缘消失。

### 设计原则

宠物是"来找你"的，不是被"开关"的。

### 实现步骤

#### 步骤 1：确认现有显示/隐藏逻辑

先读取 `src/main/index.js` 中托盘点击的 `mainWindow.show()` / `mainWindow.hide()` 调用，以及 `src/renderer/components/Caterpillar.js` 中的移动系统，了解当前如何控制宠物位置。

#### 步骤 2：唤醒动画——从边缘钻出

在渲染进程中，监听主进程发来的 `pet:show` 事件，执行入场动画：

1. 宠物初始位置设在屏幕左边缘外（x = -宠物宽度）
2. 透明度从 0 渐变到 1（200ms）
3. 宠物沿 x 轴走入屏幕，目标位置为屏幕左侧 15% 处，使用现有的移动系统（平滑插值，不要瞬移）
4. 入场完成后恢复正常漫游行为

入场边缘可以随机选择（左/右/下），增加每次出现的新鲜感。上边缘不用，避免遮挡菜单栏。

#### 步骤 3：消失动画——走回边缘

在渲染进程中，监听主进程发来的 `pet:hide` 事件，执行离场动画：

1. 宠物停止当前漫游，转向最近的屏幕边缘
2. 走向边缘（使用现有移动系统）
3. 到达边缘后透明度渐变到 0（200ms）
4. 动画完成后通知主进程执行真正的 `mainWindow.hide()`

**关键**：主进程不能立即 hide，要等渲染进程动画完成后再 hide。通过 IPC 实现：
- 主进程收到隐藏请求时，先发 `pet:hide` 给渲染进程
- 渲染进程动画完成后，发 `pet:hide-done` 给主进程
- 主进程收到 `pet:hide-done` 后执行 `mainWindow.hide()`

#### 步骤 4：修改托盘点击逻辑

修改 `src/main/index.js` 中托盘的 click 事件处理：

```javascript
tray.on('click', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isVisible()) {
    // 不直接 hide，先触发离场动画
    mainWindow.webContents.send('pet:hide');
  } else {
    mainWindow.show();
    mainWindow.webContents.send('pet:show');
  }
});
```

同时在 `preload.js` 中暴露新的 IPC 通道：
- `onPetShow(callback)` — 监听入场指令
- `onPetHide(callback)` — 监听离场指令
- `notifyHideDone()` — 通知主进程动画完成

在主进程 `registerIpc()` 中添加：
```javascript
ipcMain.on('pet:hide-done', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
  }
});
```

#### 步骤 5：首次启动特殊处理

首次启动时（配合任务四的引导），入场动画作为引导的第一步，宠物从左边缘走入，走到屏幕中间后停下，开始引导序列。

### 实现约束

- 动画必须使用现有的移动系统（Caterpillar.js 的平滑移动），不要用 CSS transition 直接移动宠物容器
- 离场动画期间禁止用户点击宠物（避免动画中断）
- 动画时长控制在 1.5 秒以内，不能让用户等太久

### 验证标准

1. 点击托盘图标，宠物从屏幕边缘走入，有淡入效果
2. 再次点击托盘，宠物走向边缘消失，有淡出效果
3. 动画流畅，无卡顿
4. 动画期间点击宠物无响应（不触发快捷菜单）

---

## 任务七：热键唤醒 + 自动激活语音

### 目标

用户按下全局热键，宠物出现的同时自动激活语音输入，实现"召唤即说话"的体验。不做常驻麦克风监听（隐私问题），而是热键触发后才开始录音。

### 实现步骤

#### 步骤 1：注册全局热键

在 `src/main/index.js` 的 `app.whenReady()` 中注册全局快捷键：

```javascript
const { globalShortcut } = require('electron');

// 在 app.whenReady() 里
globalShortcut.register('CommandOrControl+Shift+P', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isVisible()) {
    mainWindow.webContents.send('pet:hide');
  } else {
    mainWindow.show();
    mainWindow.webContents.send('pet:show-with-voice'); // 区别于普通 show
  }
});
```

在 `app.on('will-quit')` 中注销：
```javascript
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
```

#### 步骤 2：渲染进程处理 show-with-voice

在渲染进程中，监听 `pet:show-with-voice` 事件：

1. 执行入场动画（同任务六）
2. 入场动画完成后，自动触发语音输入激活
3. 语音输入激活的方式：调用现有 VoiceManager 的开始录音方法，或触发聊天面板打开并自动点击麦克风按钮

先读取 `src/renderer/components/VoiceManager.js`，确认现有的语音激活 API。

#### 步骤 3：在设置中允许自定义热键（可选，低优先级）

在设置面板的"桌面集成"区域增加热键显示：

```html
<label>
  <span>唤醒热键</span>
  <span class="settings-hotkey-display">⌘⇧P（暂不支持自定义）</span>
</label>
```

暂时只显示，不做自定义功能，后续版本再做。

#### 步骤 4：preload.js 新增通道

```javascript
onPetShowWithVoice: (callback) => ipcRenderer.on('pet:show-with-voice', (_event) => callback())
```

### 实现约束

- `globalShortcut` 在 macOS 上 `CommandOrControl+Shift+P` 可能与其他 App 冲突，如果注册失败要静默处理（不报错）
- 语音激活只在热键唤醒时触发，普通托盘点击唤醒不激活语音
- 不引入新的 npm 依赖

### 验证标准

1. 按 `Cmd+Shift+P`（macOS）或 `Ctrl+Shift+P`（Windows），宠物出现
2. 宠物入场后，语音输入自动激活（麦克风开始监听）
3. 宠物已显示时按热键，宠物执行离场动画消失
4. App 退出后热键自动注销，不影响其他程序

---

---

## 任务八：内置免费天气服务（Open-Meteo）

### 目标

天气功能开箱即用，用户不需要注册任何账号或填写 API Key。用 IP 自动定位城市，宠物能感知真实天气并做出反应。

### 当前问题

`src/renderer/services/WeatherService.js` 依赖和风天气 API，需要用户手动填写 API Key 和城市 ID，导致绝大多数用户的天气功能是关闭的。

### 实现方案

使用两个完全免费、无需 Key 的服务：
- **ip-api.com**：通过 IP 自动获取用户所在城市的经纬度（免费，无需注册）
- **Open-Meteo**：通过经纬度获取实时天气（完全免费，无需注册，每天 10000 次请求）

### 实现步骤

#### 步骤 1：先读取现有 WeatherService.js

读取 `src/renderer/services/WeatherService.js`，了解现有的数据结构、方法名、事件名，以及天气数据如何传递给宠物和特效系统。改造时保持对外接口不变。

#### 步骤 2：改造 WeatherService，新增内置天气获取

在 WeatherService 中新增 `fetchBuiltInWeather()` 方法：

```javascript
async fetchBuiltInWeather() {
  // 第一步：IP 定位获取经纬度
  const geoResp = await fetch('http://ip-api.com/json/?fields=lat,lon,city,country');
  const geo = await geoResp.json();

  // 第二步：用经纬度获取天气
  const weatherResp = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${geo.lat}&longitude=${geo.lon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
    `&wind_speed_unit=ms`
  );
  const data = await weatherResp.json();
  const current = data.current;

  // 第三步：转换为现有 WeatherService 的数据格式
  return {
    city: geo.city,
    temperature: Math.round(current.temperature_2m),
    condition: this.mapWeatherCode(current.weather_code),
    windSpeed: current.wind_speed_10m,
    humidity: current.relative_humidity_2m,
    source: 'open-meteo'
  };
}
```

Weather Code 映射（Open-Meteo 使用 WMO 标准）：

```javascript
mapWeatherCode(code) {
  if (code === 0) return 'sunny';           // 晴天
  if (code <= 3) return 'cloudy';           // 多云
  if (code <= 48) return 'foggy';           // 雾/霾
  if (code <= 67) return 'rainy';           // 雨
  if (code <= 77) return 'snowy';           // 雪
  if (code <= 82) return 'rainy';           // 阵雨
  if (code <= 99) return 'stormy';          // 雷暴
  return 'cloudy';
}
```

#### 步骤 3：修改 WeatherService 的初始化逻辑

修改 `init()` 或 `fetchWeather()` 方法，优先使用内置天气，和风天气作为可选覆盖：

```javascript
async fetchWeather() {
  const heWeatherKey = await this.getStoredApiKey(); // 读取用户配置的和风 Key

  if (heWeatherKey) {
    // 用户配置了和风天气，走原有逻辑
    return this.fetchHeWeather(heWeatherKey);
  }

  // 默认走内置免费天气
  return this.fetchBuiltInWeather();
}
```

#### 步骤 4：更新设置面板说明

修改 `src/renderer/components/Settings.js` 中天气区域的说明文字：

```
已内置免费天气服务，自动定位城市，无需配置。
填写和风天气 Key 可获得更精准的中国城市数据。
```

#### 步骤 5：IP 定位缓存

IP 定位结果缓存到 electron-store，避免每次启动都请求：

```javascript
async getLocation() {
  const cached = store.get('locationCache');
  const now = Date.now();

  // 缓存 24 小时
  if (cached && (now - cached.timestamp) < 24 * 60 * 60 * 1000) {
    return cached;
  }

  const resp = await fetch('http://ip-api.com/json/?fields=lat,lon,city,country');
  const geo = await resp.json();
  store.set('locationCache', { ...geo, timestamp: now });
  return geo;
}
```

注意：`ip-api.com` 的请求需要在主进程发出（Electron 渲染进程有 CSP 限制），通过 IPC 转发。在 `registerIpc()` 中添加：

```javascript
ipcMain.handle('weather:get-location', async () => {
  // 检查缓存
  const cached = store.get('locationCache');
  if (cached && (Date.now() - cached.timestamp) < 24 * 60 * 60 * 1000) {
    return cached;
  }
  const resp = await fetch('http://ip-api.com/json/?fields=lat,lon,city,country');
  const geo = await resp.json();
  store.set('locationCache', { ...geo, timestamp: Date.now() });
  return geo;
});
```

在 `preload.js` 中暴露：
```javascript
getWeatherLocation: () => ipcRenderer.invoke('weather:get-location')
```

### 实现约束

- 保持 WeatherService 对外的数据格式和事件名不变，不影响天气特效和宠物反应
- ip-api.com 免费版限制每分钟 45 次请求，App 启动时请求一次即可，不要轮询
- Open-Meteo 天气数据每 15 分钟刷新一次（现有逻辑保持不变）
- 网络请求失败时静默降级，不显示错误，天气功能不可用时宠物正常运行

### 验证标准

1. 不配置任何天气 Key，启动 App，宠物能感知当前天气（气泡或特效）
2. 天气数据包含城市名、温度、天气状况
3. 配置和风天气 Key 后，走和风天气逻辑（向后兼容）
4. 断网时 App 正常启动，天气功能静默失败

---

---

## 紧急修复：启动后宠物立即消失

### 问题描述

宠物入场动画完成后立即执行离场动画消失，输入框残留在屏幕左侧。

### 根本原因

`createWindow()` 中 `mainWindow.on('close')` 事件在窗口初始化阶段就会触发（Electron 在 `did-finish-load` 之前可能触发 close 事件），调用 `requestPetHide()` 发送 `pet:hide` IPC。此时入场动画正在进行（`presenceAnimating = true`），渲染进程将 `pendingHideRequest` 设为 `true`。入场完成后（`index.html` 第 247 行）检测到 `pendingHideRequest`，立即执行离场动画。

### 修复方案

在 `src/main/index.js` 的 `createWindow()` 函数中，修改 `mainWindow.on('close')` 的处理逻辑：

**当前代码（约第 311 行）：**
```javascript
mainWindow.on('close', (event) => {
  if (isQuitting) {
    return;
  }

  event.preventDefault();
  if (isWindowReady) {
    requestPetHide();
  } else {
    mainWindow.hide();
  }
});
```

**已有 `isWindowReady` 标志**（在 `did-finish-load` 事件中设为 `true`），上面的代码逻辑已经正确——`isWindowReady` 为 `false` 时直接 `hide()`，不发 IPC。

**真正的问题**：`requestPetHide()` 函数本身在 `isWindowReady` 为 `false` 时也会发送 `pet:hide` 事件。检查 `requestPetHide()` 函数：

```javascript
function requestPetHide() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  if (!isWindowReady) {
    mainWindow.hide();
    return;
  }

  sendWindowEvent('pet:hide');
}
```

如果 `requestPetHide()` 已经有 `isWindowReady` 检查，问题可能出在**托盘菜单的"隐藏宠物"按钮**或**全局热键**在窗口未就绪时被触发。

**实际修复**：在 `src/renderer/index.html` 的 `runEntranceAnimation` 函数中，将 `pendingHideRequest = false` 的重置移到更早的位置，并在入场动画开始时忽略任何已有的 pending hide 请求：

在 `runEntranceAnimation` 函数开头（`presenceAnimating = true` 之后）立即清除 pending 状态：

```javascript
async function runEntranceAnimation(options = {}) {
  if (presenceAnimating) {
    return;
  }

  const petElement = getPetElement();
  if (!petElement) {
    return;
  }

  presenceAnimating = true;
  pendingHideRequest = false;  // ← 这行已存在，确认位置正确
  // ... 其余代码不变
```

**如果上面已经正确，真正的修复在主进程**：在 `src/main/index.js` 中，`app.whenReady()` 的 `createWindow()` 调用之后，延迟 500ms 再允许 hide 操作：

```javascript
// 在 createWindow() 后添加保护期
let windowProtected = true;
setTimeout(() => { windowProtected = false; }, 500);

function requestPetHide() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (windowProtected) return;  // 启动保护期内忽略 hide 请求
  if (!isWindowReady) {
    mainWindow.hide();
    return;
  }
  sendWindowEvent('pet:hide');
}
```

### 验证

启动 App，宠物从边缘走入后应停留在屏幕上，不再自动消失。

---

## 任务九：输入面板 UI/UX 重设计

### 目标

将现有的简陋输入框+按钮组合，改造为与桌面宠物风格匹配的精致浮动输入面板。

### 当前问题

- 输入框、语音按钮、发送按钮三个元素平铺排列，视觉层次混乱
- 语音按钮使用 🎤 emoji，不专业
- 整体像一个普通网页表单，与桌面宠物的灵动感完全不搭
- 面板位置固定在宠物下方，没有动画过渡

### 设计方向

**风格**：Glassmorphism（毛玻璃）+ 有机圆角，与现有 chat-bubble 和 quick-actions 的设计语言保持一致。

**核心交互逻辑变化**：
- 默认只显示一个圆形语音按钮（悬浮在宠物旁边）
- 点击语音按钮 → 展开为完整输入面板（带动画）
- 输入框失焦且为空 → 收起回语音按钮
- 发送后 → 收起回语音按钮

### 实现步骤

#### 步骤 1：修改 HTML 结构

将 `src/renderer/index.html` 中的 input-panel 替换为：

```html
<div id="input-panel" class="input-panel hidden">
  <div class="input-panel-inner">
    <button id="voice-input-button" class="voice-btn" type="button" aria-label="语音输入">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="22"/>
      </svg>
    </button>
    <div class="input-expand-area">
      <input id="user-input" type="text" placeholder="说点什么…" maxlength="200" autocomplete="off">
      <button id="send-button" class="send-btn" type="button" aria-label="发送">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
      </button>
    </div>
  </div>
</div>
```

#### 步骤 2：重写 CSS 样式

在 `src/renderer/styles/main.css` 中，找到 `.input-panel` 相关样式（约第 192 行），**完整替换**以下所有 input-panel 相关规则（`.input-panel`、`#user-input`、`#send-button`、`#voice-input-button`）：

```css
/* ── 输入面板 ── */
.input-panel {
  position: absolute;
  z-index: 12;
  pointer-events: auto;
}

.input-panel.hidden {
  display: none;
}

.input-panel-inner {
  display: flex;
  align-items: center;
  gap: 0;
  height: 48px;
  padding: 4px;
  border-radius: 28px;
  background: rgba(255, 253, 248, 0.88);
  border: 1px solid rgba(87, 68, 42, 0.1);
  box-shadow: 0 12px 32px rgba(43, 30, 17, 0.14), 0 2px 8px rgba(43, 30, 17, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: width 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
  overflow: hidden;
  width: 48px; /* 收起状态：只显示语音按钮 */
}

.input-panel.expanded .input-panel-inner {
  width: min(340px, calc(100vw - 32px));
}

.voice-btn {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 24px;
  background: linear-gradient(145deg, #4f7a57, #2f5f39);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  box-shadow: 0 4px 12px rgba(47, 95, 57, 0.32);
}

.voice-btn:hover {
  transform: scale(1.06);
  box-shadow: 0 6px 18px rgba(47, 95, 57, 0.42);
}

.voice-btn[data-listening='true'] {
  background: radial-gradient(circle at 50% 35%, #6dbf7e, #2f5f39);
  animation: voice-pulse 1s ease-in-out infinite;
}

.input-expand-area {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  opacity: 0;
  transition: opacity 0.18s ease 0.08s;
  padding: 0 4px 0 8px;
  gap: 4px;
}

.input-panel.expanded .input-expand-area {
  opacity: 1;
}

#user-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  font-family: var(--ui-font);
  color: var(--text-main);
  padding: 0;
  line-height: 1.4;
}

#user-input::placeholder {
  color: rgba(32, 48, 38, 0.38);
}

.send-btn {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 20px;
  background: linear-gradient(145deg, #4f7a57, #2f5f39);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.18s ease, opacity 0.18s ease;
  opacity: 0.9;
}

.send-btn:hover {
  transform: scale(1.08);
  opacity: 1;
}

.send-btn:active {
  transform: scale(0.94);
}
```

**注意**：同时删除旧的 `#send-button` 和 `#voice-input-button` 规则（它们在 `#send-button, #settings-save, ...` 的联合选择器中），只保留 settings 相关的部分。具体：

找到这段代码：
```css
#send-button,
#settings-save,
#settings-close,
...
```
将 `#send-button,` 这一行删除。

找到：
```css
#send-button,
#settings-save {
  background: linear-gradient(135deg, #4d7f58, #2f5e39);
  color: #fff;
}
```
将 `#send-button,` 这一行删除。

找到：
```css
#send-button:hover,
#settings-save:hover,
...
```
将 `#send-button:hover,` 这一行删除。

#### 步骤 3：修改 JS 交互逻辑

在 `src/renderer/index.html` 的 `showInputPanel()` 和 `hideInputPanel()` 函数中，增加展开/收起动画：

**修改 `showInputPanel()`**：
```javascript
function showInputPanel() {
  positionInputPanel();
  inputPanel.classList.remove('hidden');
  // 先显示收起状态，再展开（触发动画）
  requestAnimationFrame(() => {
    inputPanel.classList.add('expanded');
  });
  petController.isMoving = true;
  quickActions.hide();
  setTimeout(() => userInput.focus(), 120); // 等展开动画后再 focus
}
```

**修改 `hideInputPanel()`**：
```javascript
function hideInputPanel() {
  inputPanel.classList.remove('expanded');
  // 等收起动画完成后再 hidden
  setTimeout(() => {
    inputPanel.classList.add('hidden');
    inputPanel.style.left = '-9999px';
    inputPanel.style.top = '-9999px';
  }, 300);
  petController.isMoving = false;
}
```

**修改语音按钮的 data-listening 属性**：

找到 VoiceManager 相关的监听代码，将 `voiceInputButton.dataset.listening` 的设置同步到新的 `.voice-btn` 元素（id 不变，仍是 `voice-input-button`）。

**输入框失焦收起**：在 `userInput` 的 blur 事件中，如果输入框为空则收起：

```javascript
userInput.addEventListener('blur', () => {
  if (!userInput.value.trim()) {
    setTimeout(() => {
      // 延迟检查，避免点击发送按钮时误收起
      if (document.activeElement !== sendButton && document.activeElement !== userInput) {
        hideInputPanel();
      }
    }, 150);
  }
});
```

#### 步骤 4：调整面板定位

`positionInputPanel()` 中，面板收起时宽度为 48px，展开时约 340px。定位时使用收起宽度（48px）计算初始位置，让语音按钮紧贴宠物右侧或下方：

```javascript
function positionInputPanel() {
  const petElement = getPetElement();
  if (!petElement) return;

  const rect = petElement.getBoundingClientRect();
  const collapsedSize = 48;

  // 优先放在宠物右侧
  let left = rect.right + 8;
  let top = rect.top + rect.height / 2 - collapsedSize / 2;

  // 右侧放不下时，放在下方
  if (left + collapsedSize > window.innerWidth - 12) {
    left = rect.left + rect.width / 2 - collapsedSize / 2;
    top = rect.bottom + 8;
  }

  // 边界保护
  left = Math.max(12, Math.min(window.innerWidth - collapsedSize - 12, left));
  top = Math.max(12, Math.min(window.innerHeight - collapsedSize - 12, top));

  inputPanel.style.left = `${left}px`;
  inputPanel.style.top = `${top}px`;
}
```

### 验证标准

1. 点击宠物，出现一个绿色圆形语音按钮（紧贴宠物旁边）
2. 点击语音按钮，面板向右展开，出现输入框和发送按钮（有弹性动画）
3. 输入框为空时失焦，面板收起回语音按钮
4. 发送消息后，面板收起
5. 语音录音时，语音按钮有绿色脉冲动画
6. 整体风格与 chat-bubble 和 quick-actions 一致（毛玻璃、圆角、绿色主题）

---

## 执行顺序

**严格按以下顺序执行，每完成一个任务后验证再进入下一个：**

1. ~~任务一（内置 AI）~~ ✅ 已完成
2. ~~任务二（限流）~~ ✅ 已完成
3. ~~紧急修复（启动消失 bug）~~ ✅ 已完成
4. ~~任务九（输入面板重设计）~~ ✅ 已完成
5. ~~任务三（状态衰减）~~ ✅ 已完成
6. ~~任务四（首次引导）~~ ✅ 已完成
7. ~~任务五（主动行为）~~ ✅ 已完成
8. ~~任务六（唤醒/消失动画）~~ ✅ 已完成
9. ~~任务七（热键 + 语音）~~ ✅ 已完成
10. ~~任务八（内置天气）~~ ✅ 已完成

---

## 任务十：新机器人角色（Rainbow Bot）

### 目标

将 `docs/robot-preview.html` 中已确认的机器人形象，作为新角色 `rainbow-bot` 集成进角色系统，并实现情绪状态与 AI 对话的联动。

### 背景

- 现有角色系统：`src/renderer/characters/` 下每个角色有 `config.json`、`template.html`、`style.css` 三个文件
- `BaseCharacter` 通过 `applyMood(mood)` 设置 `data-mood` 属性，CSS 根据属性切换动画
- 但新机器人的眼睛变形需要 JS DOM 操作（innerHTML 替换），不能纯靠 CSS
- 解决方案：新建 `RainbowBotCharacter` 类继承 `BaseCharacter`，重写 `applyMood`

---

### 步骤 1：创建角色目录和文件

创建以下文件：

**`src/renderer/characters/rainbow-bot/config.json`**

```json
{
  "id": "rainbow-bot",
  "name": "彩虹机器人",
  "description": "大眼睛会随情绪变化的可爱机器人，身上有彩虹条纹",
  "dimensions": {
    "width": 90,
    "height": 120
  },
  "animations": {
    "idle":    { "speed": 1.8, "amplitude": 1.5, "legRotation": 0, "frequency": 0.03 },
    "happy":   { "speed": 2.5, "amplitude": 2.5, "legRotation": 0, "frequency": 0.06 },
    "sleepy":  { "speed": 0.5, "amplitude": 0.5, "legRotation": 0, "frequency": 0.015 },
    "hungry":  { "speed": 1.2, "amplitude": 1.0, "legRotation": 0, "frequency": 0.03 },
    "excited": { "speed": 3.0, "amplitude": 3.0, "legRotation": 0, "frequency": 0.08 },
    "sad":     { "speed": 0.7, "amplitude": 0.8, "legRotation": 0, "frequency": 0.02 }
  },
  "moveParts": {
    "bodySelector": ".rb-body-group",
    "limbSelector": ".rb-leg-l, .rb-leg-r",
    "headSelector": ".rb-body-group"
  },
  "growth": {
    "stages": ["blueprint", "prototype", "v1", "v2", "final"],
    "stageLabels": ["蓝图", "原型机", "1.0版", "2.0版", "终极形态"]
  },
  "animationStrategy": "rainbow-bot",
  "movement": {
    "maxSpeedMultiplier": 0.85,
    "acceleration": 0.12,
    "turnResponsiveness": 0.09,
    "turnSlowdown": 0.35,
    "decelerationDistance": 90,
    "arrivalRadius": 10,
    "minTravelDistance": 160,
    "roamPadding": 80
  }
}
```

---

**`src/renderer/characters/rainbow-bot/template.html`**

直接使用 `docs/robot-preview.html` 中 `<svg id="robotSvg" ...>` 的完整内容，包裹在一个 div 中：

```html
<div class="caterpillar rainbow-bot" data-character="rainbow-bot">
  <svg class="rb-svg" width="90" height="120" viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- 完整复制 docs/robot-preview.html 中 <defs> 内的所有内容 -->
      <!-- 包括：headGrad, bodyGrad, limbGrad, eyeGlowL, eyeGlowR, visorGrad, rainbowStripe, shineGrad, dropShadow, glowFilter, visorClip, bodyClip -->
    </defs>

    <g class="rb-body-group" filter="url(#dropShadow)">
      <!-- 天线 -->
      <g class="rb-antenna-l"> ... </g>
      <g class="rb-antenna-r"> ... </g>

      <!-- 头部、面罩、眼睛、嘴巴、耳朵、颈部、身体、手臂、腿部 -->
      <!-- 完整复制 docs/robot-preview.html 中 <g class="robot-body-group"> 内的所有内容 -->
      <!-- 注意：将所有 class 名称前加 rb- 前缀，避免与其他角色冲突 -->
      <!-- 例如：antenna-l → rb-antenna-l, eye-l → rb-eye-l, leg-l-group → rb-leg-l-group -->
      <!-- id 也加前缀：mouthGroup → rb-mouthGroup, mouthPath → rb-mouthPath -->
    </g>

    <!-- 地面阴影 -->
    <ellipse cx="60" cy="162" rx="32" ry="5" fill="rgba(0,0,0,0.2)"/>
  </svg>
</div>
```

> **重要**：从 `docs/robot-preview.html` 完整复制 SVG 内容，将所有 class 名加 `rb-` 前缀。defs 中的 id（如 `headGrad`、`eyeGlowL`）也加 `rb-` 前缀（`rb-headGrad`、`rb-eyeGlowL`），并同步更新所有引用（`fill="url(#rb-headGrad)"`）。

---

**`src/renderer/characters/rainbow-bot/style.css`**

```css
/* ===== Rainbow Bot ===== */
.caterpillar[data-character='rainbow-bot'] {
  width: 90px;
  height: 120px;
  isolation: isolate;
}

.caterpillar[data-character='rainbow-bot'] .rb-svg {
  display: block;
  overflow: visible;
}

/* 待机呼吸 */
@keyframes rb-breathe {
  0%, 100% { transform: translateY(0); }
  50%       { transform: translateY(-3px); }
}

/* 高兴跳跳 */
@keyframes rb-happy-jump {
  0%, 100% { transform: translateY(0) scale(1); }
  40%       { transform: translateY(-12px) scale(1.05, 0.95); }
  60%       { transform: translateY(-14px) scale(0.95, 1.05); }
}

/* 困惑摇头 */
@keyframes rb-confused-shake {
  0%, 100% { transform: rotate(0deg); }
  25%       { transform: rotate(-6deg); }
  75%       { transform: rotate(6deg); }
}

/* 睡觉倾斜 */
@keyframes rb-sleep-tilt {
  0%, 100% { transform: rotate(-4deg) translateY(0); }
  50%       { transform: rotate(-4deg) translateY(-2px); }
}

/* 说话震动 */
@keyframes rb-talking {
  0%, 100% { transform: translateY(0); }
  25%       { transform: translateY(-2px) scaleX(1.02); }
  75%       { transform: translateY(1px) scaleX(0.98); }
}

/* 眩晕摇晃 */
@keyframes rb-dizzy-sway {
  0%, 100% { transform: rotate(-3deg) translateY(0); }
  50%       { transform: rotate(3deg) translateY(-2px); }
}

/* 天线弹动 */
@keyframes rb-antenna-wiggle {
  0%, 100% { transform: rotate(0deg); }
  25%       { transform: rotate(8deg); }
  75%       { transform: rotate(-8deg); }
}

/* 眼睛眨眼 */
@keyframes rb-blink {
  0%, 90%, 100% { transform: scaleY(1); }
  95%            { transform: scaleY(0.08); }
}

/* 眼睛发光脉冲 */
@keyframes rb-glow-pulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1; }
}

/* 彩虹条纹流动 */
@keyframes rb-stripe-flow {
  from { transform: translateX(0); }
  to   { transform: translateX(-20px); }
}

/* 腿部走路 */
@keyframes rb-leg-l {
  0%, 100% { transform: rotate(0deg); }
  50%       { transform: rotate(12deg); }
}
@keyframes rb-leg-r {
  0%, 100% { transform: rotate(0deg); }
  50%       { transform: rotate(-12deg); }
}

/* 眩晕螺旋旋转 */
@keyframes rb-spiral-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}

/* 默认动画应用 */
.caterpillar[data-character='rainbow-bot'] .rb-body-group {
  animation: rb-breathe 3s ease-in-out infinite;
  transform-origin: center bottom;
}

.caterpillar[data-character='rainbow-bot'] .rb-stripe-pattern {
  animation: rb-stripe-flow 2s linear infinite;
}

.caterpillar[data-character='rainbow-bot'] .rb-eye-l {
  transform-origin: 43px 62px;
  animation: rb-blink 4s ease-in-out infinite;
}
.caterpillar[data-character='rainbow-bot'] .rb-eye-r {
  transform-origin: 77px 62px;
  animation: rb-blink 4s ease-in-out infinite 0.08s;
}

.caterpillar[data-character='rainbow-bot'] .rb-antenna-l {
  transform-origin: 44px 28px;
}
.caterpillar[data-character='rainbow-bot'] .rb-antenna-r {
  transform-origin: 76px 28px;
}

.caterpillar[data-character='rainbow-bot'] .rb-leg-l-group {
  transform-origin: 46px 128px;
}
.caterpillar[data-character='rainbow-bot'] .rb-leg-r-group {
  transform-origin: 74px 128px;
}

/* 情绪状态 */
.caterpillar[data-character='rainbow-bot'][data-mood='happy'] .rb-body-group {
  animation: rb-happy-jump 0.6s ease-in-out infinite !important;
}
.caterpillar[data-character='rainbow-bot'][data-mood='excited'] .rb-body-group {
  animation: rb-happy-jump 0.4s ease-in-out infinite !important;
}
.caterpillar[data-character='rainbow-bot'][data-mood='confused'] .rb-body-group {
  animation: rb-confused-shake 0.5s ease-in-out infinite !important;
}
.caterpillar[data-character='rainbow-bot'][data-mood='sleepy'] .rb-body-group {
  animation: rb-sleep-tilt 2.5s ease-in-out infinite !important;
}
.caterpillar[data-character='rainbow-bot'][data-mood='talking'] .rb-body-group {
  animation: rb-talking 0.3s ease-in-out infinite !important;
}
.caterpillar[data-character='rainbow-bot'][data-mood='dizzy'] .rb-body-group {
  animation: rb-dizzy-sway 0.6s ease-in-out infinite !important;
  transform-origin: 60px 80px;
}

/* 走路时天线和腿部动画（通过 data-animation="walk" 触发） */
.caterpillar[data-character='rainbow-bot'][data-animation='walk'] .rb-antenna-l {
  animation: rb-antenna-wiggle 0.4s ease-in-out infinite;
}
.caterpillar[data-character='rainbow-bot'][data-animation='walk'] .rb-antenna-r {
  animation: rb-antenna-wiggle 0.4s ease-in-out infinite 0.1s;
}
.caterpillar[data-character='rainbow-bot'][data-animation='walk'] .rb-leg-l-group {
  animation: rb-leg-l 0.5s ease-in-out infinite alternate;
}
.caterpillar[data-character='rainbow-bot'][data-animation='walk'] .rb-leg-r-group {
  animation: rb-leg-r 0.5s ease-in-out infinite alternate;
}

/* 眩晕螺旋眼 */
.caterpillar[data-character='rainbow-bot'] .rb-dizzy-eye-l {
  transform-origin: 43px 62px;
  animation: rb-spiral-spin 1.2s linear infinite;
}
.caterpillar[data-character='rainbow-bot'] .rb-dizzy-eye-r {
  transform-origin: 77px 62px;
  animation: rb-spiral-spin 1.2s linear infinite reverse;
}

/* 说话时眼睛脉冲 */
.caterpillar[data-character='rainbow-bot'][data-mood='talking'] .rb-eye-l,
.caterpillar[data-character='rainbow-bot'][data-mood='talking'] .rb-eye-r {
  animation: rb-glow-pulse 0.4s ease-in-out infinite !important;
}

/* 方向翻转 */
.caterpillar[data-character='rainbow-bot'][data-direction='left'] .rb-svg {
  transform: scaleX(-1);
}
```

---

### 步骤 2：创建 RainbowBotCharacter 类

新建文件 **`src/renderer/characters/rainbow-bot-character.js`**：

```javascript
class RainbowBotCharacter extends BaseCharacter {
  constructor(config) {
    super(config);
    this._currentMood = 'idle';
  }

  // 眼睛形状模板（与 docs/robot-preview.html 保持一致）
  _eyeHTML(mood, cx, cy) {
    const isLeft = cx === 43;
    const glowId = isLeft ? 'rb-eyeGlowL' : 'rb-eyeGlowR';
    const glowClass = isLeft ? 'rb-eye-glow-l' : 'rb-eye-glow-r';

    switch (mood) {
      case 'happy':
      case 'excited':
        return `
          <circle cx="${cx}" cy="${cy}" r="8" fill="url(#${glowId})"/>
          <path d="M ${cx-6} ${cy+1} Q ${cx} ${cy-7} ${cx+6} ${cy+1}" fill="#38bdf8" stroke="#7ee8ff" stroke-width="1"/>
          <path d="M ${cx-4} ${cy} Q ${cx} ${cy-4} ${cx+4} ${cy}" fill="#7ee8ff"/>
          <circle cx="${cx+2}" cy="${cy-2}" r="1.2" fill="white" opacity="0.9"/>`;

      case 'confused':
        if (isLeft) {
          return `
            <circle cx="${cx}" cy="${cy}" r="6" fill="url(#${glowId})"/>
            <circle cx="${cx}" cy="${cy}" r="5" fill="#38bdf8"/>
            <circle cx="${cx}" cy="${cy}" r="3" fill="#7ee8ff"/>
            <circle cx="${cx}" cy="${cy}" r="1.5" fill="white" opacity="0.95"/>
            <circle cx="${cx+1.5}" cy="${cy-1.5}" r="0.8" fill="white" opacity="0.8"/>`;
        } else {
          return `
            <circle cx="${cx}" cy="${cy}" r="6" fill="url(#${glowId})"/>
            <ellipse cx="${cx}" cy="${cy}" rx="5.5" ry="2.5" fill="#38bdf8"/>
            <ellipse cx="${cx}" cy="${cy}" rx="3.5" ry="1.5" fill="#7ee8ff"/>
            <circle cx="${cx+1.5}" cy="${cy-0.5}" r="0.8" fill="white" opacity="0.8"/>
            <path d="M ${cx-5.5} ${cy-2.5} Q ${cx} ${cy-5} ${cx+5.5} ${cy-2.5}" fill="none" stroke="#8ab4c8" stroke-width="1.5" stroke-linecap="round"/>`;
        }

      case 'sleepy':
        return `
          <ellipse cx="${cx}" cy="${cy+1}" rx="6" ry="1.8" fill="#5a8aa0" opacity="0.6"/>
          <path d="M ${cx-6} ${cy+1} Q ${cx} ${cy-3} ${cx+6} ${cy+1}" fill="#6090a8" opacity="0.8"/>
          <path d="M ${cx-5} ${cy+1} L ${cx+5} ${cy+1}" stroke="#8ab4c8" stroke-width="2.5" stroke-linecap="round"/>`;

      case 'talking':
        return `
          <circle cx="${cx}" cy="${cy}" r="9" fill="url(#${glowId})" opacity="0.8"/>
          <circle cx="${cx}" cy="${cy}" r="7" fill="#0ea5e9" opacity="0.2"/>
          <circle cx="${cx}" cy="${cy}" r="6" fill="#38bdf8"/>
          <circle cx="${cx}" cy="${cy}" r="4" fill="#7ee8ff"/>
          <circle cx="${cx}" cy="${cy}" r="2.5" fill="white" opacity="0.95"/>
          <circle cx="${cx+2}" cy="${cy-2}" r="1.2" fill="white" opacity="0.9"/>`;

      case 'dizzy': {
        const cls = isLeft ? 'rb-dizzy-eye-l' : 'rb-dizzy-eye-r';
        return `
          <circle cx="${cx}" cy="${cy}" r="7" fill="#1a2a38" opacity="0.85"/>
          <g class="${cls}">
            <circle cx="${cx}" cy="${cy}" r="6.5" fill="none" stroke="#8ab4c8" stroke-width="1.2" opacity="0.3"/>
            <path d="M ${cx} ${cy} m 0 -5.5 a 5.5 5.5 0 0 1 5.5 5.5 a 4 4 0 0 1 -4 4 a 2.5 2.5 0 0 1 -2.5 -2.5 a 1.2 1.2 0 0 1 1.2 -1.2"
              fill="none" stroke="#a0c8e0" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="${cx}" cy="${cy}" r="1.5" fill="#c8e4f0"/>
          </g>`;
      }

      case 'sad':
        return `
          <circle class="${glowClass}" cx="${cx}" cy="${cy}" r="8" fill="url(#${glowId})"/>
          <circle cx="${cx}" cy="${cy}" r="5.5" fill="#38bdf8" opacity="0.6"/>
          <circle cx="${cx}" cy="${cy}" r="3.5" fill="#7ee8ff" opacity="0.7"/>
          <circle cx="${cx}" cy="${cy}" r="2" fill="white" opacity="0.7"/>`;

      default: // idle, hungry, etc.
        return `
          <circle class="${glowClass}" cx="${cx}" cy="${cy}" r="8" fill="url(#${glowId})"/>
          <circle cx="${cx}" cy="${cy}" r="7" fill="#0ea5e9" opacity="0.15"/>
          <circle cx="${cx}" cy="${cy}" r="5.5" fill="#38bdf8"/>
          <circle cx="${cx}" cy="${cy}" r="3.5" fill="#7ee8ff"/>
          <circle cx="${cx}" cy="${cy}" r="2" fill="white" opacity="0.95"/>
          <circle cx="${cx+2}" cy="${cy-2}" r="1" fill="white" opacity="0.8"/>`;
    }
  }

  _mouthPath(mood) {
    switch (mood) {
      case 'happy':
      case 'excited':  return 'M 44 74 Q 60 86 76 74';
      case 'confused':  return 'M 46 78 Q 60 76 74 80';
      case 'sleepy':    return 'M 50 76 Q 60 74 70 76';
      case 'dizzy':     return 'M 48 78 Q 60 82 72 78';
      case 'talking':   return 'M 48 76 Q 60 80 72 76';
      case 'sad':       return 'M 46 80 Q 60 74 74 80';
      default:          return 'M 46 76 Q 60 82 74 76';
    }
  }

  _updateEyes(mood) {
    if (!this.rootElement) return;
    const eyeL = this.rootElement.querySelector('.rb-eye-l');
    const eyeR = this.rootElement.querySelector('.rb-eye-r');
    if (!eyeL || !eyeR) return;

    eyeL.innerHTML = this._eyeHTML(mood, 43, 62);
    eyeR.innerHTML = this._eyeHTML(mood, 77, 62);

    // 眨眼动画只在 idle/hungry 状态保留
    const blinkMoods = ['idle', 'hungry'];
    if (blinkMoods.includes(mood)) {
      eyeL.style.animation = '';
      eyeR.style.animation = '';
    } else {
      eyeL.style.animation = 'none';
      eyeR.style.animation = 'none';
    }
  }

  _updateMouth(mood) {
    if (!this.rootElement) return;
    const mouth = this.rootElement.querySelector('#rb-mouthPath');
    if (mouth) mouth.setAttribute('d', this._mouthPath(mood));
  }

  applyMood(payload) {
    // 调用父类处理 data-mood 属性（驱动 CSS 动画）
    super.applyMood(payload);

    const mood = (typeof payload === 'object' && payload !== null)
      ? (payload.mood || 'idle')
      : (payload || 'idle');

    this._currentMood = mood;
    this._updateEyes(mood);
    this._updateMouth(mood);
  }
}
```

---

### 步骤 3：注册角色并加载类文件

**修改 `src/renderer/index.html`**：

1. 在 `<script src="characters/base-character.js"></script>` 之后添加：
   ```html
   <script src="characters/rainbow-bot-character.js"></script>
   ```

2. 在 `CharacterRegistry` 的 `BUILTIN_IDS` 中添加 `'rainbow-bot'`：
   - 找到 `src/renderer/characters/character-registry.js` 第 2 行：
     ```javascript
     static BUILTIN_IDS = ['caterpillar', 'cyber-bot', 'pixel-pet'];
     ```
   - 改为：
     ```javascript
     static BUILTIN_IDS = ['caterpillar', 'cyber-bot', 'pixel-pet', 'rainbow-bot'];
     ```

3. 在 `FALLBACK_OPTIONS` 中添加：
   ```javascript
   { id: 'rainbow-bot', name: '彩虹机器人', description: '大眼睛会随情绪变化的可爱机器人' }
   ```

4. 修改 `CharacterRegistry.load()` 方法，对 `rainbow-bot` 使用 `RainbowBotCharacter` 而非 `BaseCharacter`：
   ```javascript
   async load(id) {
     const targetId = this.has(id) ? id : this.getDefaultId();
     const config = this.characters.get(targetId);
     if (!config) throw new Error(`Character "${id}" not found`);

     // rainbow-bot 使用专属子类
     const CharClass = targetId === 'rainbow-bot' ? RainbowBotCharacter : BaseCharacter;
     const character = new CharClass(config);
     await character.load(`${this.basePath}/${targetId}`);
     return character;
   }
   ```

---

### 步骤 4：情绪与 AI 对话联动

**修改 `src/renderer/index.html`** 中的 `processInputStream` 调用（约第 398 行）：

```javascript
await chatManager.processInputStream(input, {
  onStart: () => {
    chatBubble.startStream();
    petController.applyMood('talking');          // 开始说话
  },
  onChunk: (chunk) => {
    chatBubble.appendStream(chunk);
  },
  onDone: (content) => {
    chatBubble.finishStream(5000);
    voiceManager.speak(content);
    petController.applyMood('happy');            // 说完变高兴
    setTimeout(() => petController.applyMood('idle'), 3000); // 3秒后恢复
  },
  onError: () => {
    chatBubble.startStream();
    petController.applyMood('confused');         // 出错变困惑
    setTimeout(() => petController.applyMood('idle'), 2000);
  }
});
```

同样，在用户发送消息时（`chatBubble.showLoading()` 之后）添加：
```javascript
petController.applyMood('confused'); // 思考中
```

---

### 步骤 5：将 rainbow-bot 设为默认角色

修改 `src/renderer/characters/character-registry.js` 的 `getDefaultId()` 方法：

```javascript
getDefaultId() {
  return this.characters.has('rainbow-bot') ? 'rainbow-bot'
    : this.characters.has('caterpillar') ? 'caterpillar'
    : (this.getAll()[0] || {}).id || 'caterpillar';
}
```

---

### 验证标准

1. 角色选择器中出现「彩虹机器人」选项
2. 选择后宠物显示为 SVG 机器人形象，有呼吸动画
3. 发送消息时：宠物眼睛变为「困惑」状（思考中）
4. AI 回复流式输出时：眼睛变为「说话」状（大眼睛脉冲）
5. 回复完成后：眼睛变为「高兴」状（月牙眼），3 秒后恢复正常
6. 宠物移动时天线和腿部有走路动画
7. 新角色不影响其他角色（caterpillar、cyber-bot、pixel-pet）正常工作

---

## 执行顺序（更新）

**严格按以下顺序执行，每完成一个任务后验证再进入下一个：**

1. ~~任务一（内置 AI）~~ ✅ 已完成
2. ~~任务二（限流）~~ ✅ 已完成
3. ~~紧急修复（启动消失 bug）~~ ✅ 已完成
4. ~~任务九（输入面板重设计）~~ ✅ 已完成
5. ~~任务三（状态衰减）~~ ✅ 已完成
6. ~~任务四（首次引导）~~ ✅ 已完成
7. ~~任务五（主动行为）~~ ✅ 已完成
8. ~~任务六（唤醒/消失动画）~~ ✅ 已完成
9. ~~任务七（热键 + 语音）~~ ✅ 已完成
10. ~~任务八（内置天气）~~ ✅ 已完成
11. ~~任务十（彩虹机器人角色）~~ ✅ 已完成
12. ~~任务十一（彩虹机器人3D升级）~~ ✅ 已完成

## 通用约束

1. 不要修改现有的角色系统、动画系统、打包配置
2. 不要引入新的 npm 依赖
3. 保持现有的代码风格（vanilla JS、class 语法、事件驱动）
4. 每个任务完成后确保 `npm start` 能正常启动
5. 所有新增代码需要有基本的错误处理（try-catch、fallback）

---

## 任务十一：彩虹机器人 3D 外观升级

### 目标

将 `src/renderer/characters/rainbow-bot/template.html` 和 `style.css` 升级为 3D 球形渐变版本，消除打包后"瘪瘪的"扁平感，同时修复嘴巴默认朝下（皱眉）的问题，并补全手臂走路动画。

参考设计文件：`docs/robot-preview.html`（已完成3D设计，可直接参考其 `<defs>` 和 SVG 结构）。

---

### 步骤 1：替换 `template.html` 的 `<defs>` 渐变定义

将 `src/renderer/characters/rainbow-bot/template.html` 中 `<defs>` 内的所有渐变替换为球形/圆柱渐变系统。

**删除旧的 `<defs>` 内容**（从 `<defs>` 到 `</defs>`），**替换为以下内容**：

```html
<defs>
  <!-- 头部：球形渐变，光源左上角 -->
  <radialGradient id="rb-headGrad" cx="35%" cy="28%" r="65%" gradientUnits="objectBoundingBox">
    <stop offset="0%"   stop-color="#eaf6ff"/>
    <stop offset="30%"  stop-color="#b8d8ec"/>
    <stop offset="70%"  stop-color="#7aaec8"/>
    <stop offset="100%" stop-color="#3d7a9a"/>
  </radialGradient>
  <!-- 头部右侧暗面 -->
  <linearGradient id="rb-headShadow" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
    <stop offset="0%"   stop-color="rgba(0,0,0,0)"/>
    <stop offset="60%"  stop-color="rgba(0,0,0,0)"/>
    <stop offset="100%" stop-color="rgba(0,20,40,0.28)"/>
  </linearGradient>
  <!-- 头部底部暗面 -->
  <linearGradient id="rb-headBottomShadow" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
    <stop offset="0%"   stop-color="rgba(0,0,0,0)"/>
    <stop offset="55%"  stop-color="rgba(0,0,0,0)"/>
    <stop offset="100%" stop-color="rgba(0,20,40,0.32)"/>
  </linearGradient>
  <!-- 身体：球形渐变 -->
  <radialGradient id="rb-bodyGrad" cx="38%" cy="25%" r="70%" gradientUnits="objectBoundingBox">
    <stop offset="0%"   stop-color="#daeef8"/>
    <stop offset="40%"  stop-color="#9ec8de"/>
    <stop offset="100%" stop-color="#4e8aaa"/>
  </radialGradient>
  <linearGradient id="rb-bodyShadow" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
    <stop offset="0%"   stop-color="rgba(0,0,0,0)"/>
    <stop offset="65%"  stop-color="rgba(0,0,0,0)"/>
    <stop offset="100%" stop-color="rgba(0,20,40,0.3)"/>
  </linearGradient>
  <!-- 四肢：圆柱渐变（左亮右暗） -->
  <linearGradient id="rb-limbGrad" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
    <stop offset="0%"   stop-color="#c8e0ee"/>
    <stop offset="35%"  stop-color="#a0c4d8"/>
    <stop offset="70%"  stop-color="#6a9ab8"/>
    <stop offset="100%" stop-color="#3d6a88"/>
  </linearGradient>
  <!-- 眼睛发光 -->
  <radialGradient id="rb-eyeGlowL" cx="43" cy="62" r="14" gradientUnits="userSpaceOnUse">
    <stop offset="0%"   stop-color="#a0f0ff" stop-opacity="1"/>
    <stop offset="50%"  stop-color="#38bdf8" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="rb-eyeGlowR" cx="77" cy="62" r="14" gradientUnits="userSpaceOnUse">
    <stop offset="0%"   stop-color="#a0f0ff" stop-opacity="1"/>
    <stop offset="50%"  stop-color="#38bdf8" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#0ea5e9" stop-opacity="0"/>
  </radialGradient>
  <!-- 面罩渐变 -->
  <linearGradient id="rb-visorGrad" x1="28" y1="48" x2="92" y2="84" gradientUnits="userSpaceOnUse">
    <stop offset="0%"   stop-color="#071220"/>
    <stop offset="100%" stop-color="#0a1e38"/>
  </linearGradient>
  <linearGradient id="rb-visorShine" x1="0" y1="0" x2="0.6" y2="1" gradientUnits="objectBoundingBox">
    <stop offset="0%"   stop-color="rgba(255,255,255,0.12)"/>
    <stop offset="40%"  stop-color="rgba(255,255,255,0.04)"/>
    <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
  </linearGradient>
  <!-- 顶部球面高光 -->
  <radialGradient id="rb-topShine" cx="40%" cy="20%" r="55%" gradientUnits="objectBoundingBox">
    <stop offset="0%"   stop-color="white" stop-opacity="0.55"/>
    <stop offset="50%"  stop-color="white" stop-opacity="0.15"/>
    <stop offset="100%" stop-color="white" stop-opacity="0"/>
  </radialGradient>
  <!-- 彩虹条纹 -->
  <pattern id="rb-rainbowStripe" x="0" y="0" width="20" height="8" patternUnits="userSpaceOnUse">
    <rect x="0" y="0"   width="20" height="2"   fill="#ff6b6b" opacity="0.95"/>
    <rect x="0" y="2"   width="20" height="1.5" fill="#ffa94d" opacity="0.95"/>
    <rect x="0" y="3.5" width="20" height="1.5" fill="#ffd43b" opacity="0.95"/>
    <rect x="0" y="5"   width="20" height="1.5" fill="#69db7c" opacity="0.95"/>
    <rect x="0" y="6.5" width="20" height="1.5" fill="#74c0fc" opacity="0.95"/>
  </pattern>
  <!-- 阴影滤镜 -->
  <filter id="rb-dropShadow" x="-25%" y="-20%" width="150%" height="150%">
    <feDropShadow dx="2" dy="6" stdDeviation="5" flood-color="#001828" flood-opacity="0.5"/>
  </filter>
  <filter id="rb-glowFilter">
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <!-- 裁剪 -->
  <clipPath id="rb-visorClip">
    <rect x="28" y="48" width="64" height="36" rx="10"/>
  </clipPath>
  <clipPath id="rb-bodyClip">
    <rect x="32" y="88" width="56" height="40" rx="10"/>
  </clipPath>
</defs>
```

---

### 步骤 2：替换 `template.html` 的头部和身体 SVG 结构

将 `<g class="rb-body-group" ...>` 内的头部和身体部分替换为3D版本。

**头部区域**（替换从天线到颈部的所有内容）：

```html
<g class="rb-body-group" filter="url(#rb-dropShadow)">

  <!-- 天线 -->
  <g class="rb-antenna-l">
    <line x1="44" y1="28" x2="36" y2="14" stroke="#8ab4c8" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="36" cy="12" r="4" fill="#7ee8ff" opacity="0.9" filter="url(#rb-glowFilter)"/>
    <circle cx="36" cy="12" r="2.5" fill="white"/>
  </g>
  <g class="rb-antenna-r">
    <line x1="76" y1="28" x2="84" y2="14" stroke="#8ab4c8" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="84" cy="12" r="4" fill="#7ee8ff" opacity="0.9" filter="url(#rb-glowFilter)"/>
    <circle cx="84" cy="12" r="2.5" fill="white"/>
  </g>

  <!-- 头部：球形渐变 5 层 -->
  <rect x="22" y="26" width="76" height="62" rx="22" fill="url(#rb-headGrad)"/>
  <rect x="22" y="26" width="76" height="62" rx="22" fill="url(#rb-headShadow)"/>
  <rect x="22" y="26" width="76" height="62" rx="22" fill="url(#rb-headBottomShadow)"/>
  <rect x="22" y="26" width="76" height="62" rx="22" fill="url(#rb-topShine)"/>
  <rect x="22" y="30" width="5"  height="54" rx="3" fill="rgba(0,15,30,0.18)"/>
  <rect x="93" y="30" width="5"  height="54" rx="3" fill="rgba(0,15,30,0.28)"/>

  <!-- 面罩 -->
  <rect x="28" y="48" width="64" height="36" rx="10" fill="url(#rb-visorGrad)"/>
  <rect x="28" y="48" width="64" height="36" rx="10" fill="url(#rb-visorShine)"/>
  <rect x="32" y="50" width="24" height="6"  rx="3" fill="rgba(255,255,255,0.1)"/>
  <rect x="30" y="76" width="60" height="6"  rx="3" fill="rgba(14,165,233,0.08)"/>

  <!-- 眼睛左 -->
  <g class="rb-eye-l">
    <circle class="rb-eye-glow-l" cx="43" cy="62" r="11" fill="url(#rb-eyeGlowL)"/>
    <circle cx="43" cy="62" r="9"   fill="#0ea5e9" opacity="0.2"/>
    <circle cx="43" cy="62" r="7.5" fill="#38bdf8"/>
    <circle cx="43" cy="62" r="5"   fill="#7ee8ff"/>
    <circle cx="43" cy="62" r="2.8" fill="white" opacity="0.95"/>
    <circle cx="46" cy="59" r="1.3" fill="white" opacity="0.85"/>
  </g>

  <!-- 眼睛右 -->
  <g class="rb-eye-r">
    <circle class="rb-eye-glow-r" cx="77" cy="62" r="11" fill="url(#rb-eyeGlowR)"/>
    <circle cx="77" cy="62" r="9"   fill="#0ea5e9" opacity="0.2"/>
    <circle cx="77" cy="62" r="7.5" fill="#38bdf8"/>
    <circle cx="77" cy="62" r="5"   fill="#7ee8ff"/>
    <circle cx="77" cy="62" r="2.8" fill="white" opacity="0.95"/>
    <circle cx="80" cy="59" r="1.3" fill="white" opacity="0.85"/>
  </g>

  <!-- 嘴巴（默认微笑，控制点 y=80 > 端点 y=74，SVG 坐标向下为正，形成上弧=微笑） -->
  <g id="rb-mouthGroup">
    <path id="rb-mouthPath" d="M 46 74 Q 60 80 74 74"
          stroke="#38bdf8" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.85"/>
  </g>

  <!-- 耳朵/侧面装饰 -->
  <rect x="16" y="52" width="8" height="16" rx="4" fill="#8ab4c8"/>
  <rect x="96" y="52" width="8" height="16" rx="4" fill="#8ab4c8"/>
  <rect x="17" y="56" width="6" height="8"  rx="3" fill="#5a8aa0"/>

  <!-- 颈部 -->
  <rect x="50" y="87" width="20" height="8" rx="4" fill="#7aa0b8"/>
  <rect x="52" y="88" width="16" height="6" rx="3" fill="#6090a8"/>

  <!-- 身体：球形渐变 -->
  <rect x="32" y="92" width="56" height="40" rx="10" fill="url(#rb-bodyGrad)"/>
  <rect x="32" y="92" width="56" height="40" rx="10" fill="url(#rb-bodyShadow)"/>
  <rect x="32" y="92" width="56" height="40" rx="10" fill="url(#rb-topShine)"/>
  <rect x="32" y="96" width="4"  height="32" rx="2" fill="rgba(0,15,30,0.15)"/>
  <rect x="84" y="96" width="4"  height="32" rx="2" fill="rgba(0,15,30,0.25)"/>

  <!-- 彩虹条纹 -->
  <g clip-path="url(#rb-bodyClip)">
    <g class="rb-stripe-pattern">
      <rect x="22" y="100" width="96" height="22" fill="url(#rb-rainbowStripe)"/>
    </g>
  </g>
  <!-- 条纹右侧暗面遮罩 -->
  <rect x="72" y="100" width="16" height="22" fill="rgba(0,15,30,0.18)"/>

  <!-- 胸口小灯 -->
  <circle cx="60" cy="124" r="5"   fill="#0ea5e9" opacity="0.9" filter="url(#rb-glowFilter)"/>
  <circle cx="60" cy="124" r="3.5" fill="#7ee8ff"/>
  <circle cx="59" cy="123" r="1.2" fill="white" opacity="0.8"/>
```

---

### 步骤 3：替换手臂和腿部 SVG 结构

继续在 `<g class="rb-body-group">` 内，替换手臂和腿部为圆柱渐变版本：

```html
  <!-- 左臂（圆柱渐变 + 顶部高光） -->
  <g class="rb-arm-l-group">
    <rect x="18" y="94" width="16" height="28" rx="8" fill="url(#rb-limbGrad)"/>
    <rect x="18" y="94" width="16" height="12" rx="8" fill="rgba(255,255,255,0.15)"/>
    <circle cx="26" cy="126" r="7" fill="#8ab4c8"/>
    <circle cx="26" cy="126" r="5" fill="#7aa0b8"/>
  </g>

  <!-- 右臂 -->
  <g class="rb-arm-r-group">
    <rect x="86" y="94" width="16" height="28" rx="8" fill="url(#rb-limbGrad)"/>
    <rect x="86" y="94" width="16" height="12" rx="8" fill="rgba(255,255,255,0.15)"/>
    <circle cx="94" cy="126" r="7" fill="#8ab4c8"/>
    <circle cx="94" cy="126" r="5" fill="#7aa0b8"/>
  </g>

  <!-- 左腿 -->
  <g class="rb-leg-l-group">
    <rect x="38" y="130" width="18" height="22" rx="9" fill="url(#rb-limbGrad)"/>
    <rect x="34" y="148" width="24" height="12" rx="6" fill="#6888a0"/>
    <rect x="34" y="152" width="24" height="4"  rx="2" fill="url(#rb-rainbowStripe)"/>
  </g>

  <!-- 右腿 -->
  <g class="rb-leg-r-group">
    <rect x="64" y="130" width="18" height="22" rx="9" fill="url(#rb-limbGrad)"/>
    <rect x="62" y="148" width="24" height="12" rx="6" fill="#6888a0"/>
    <rect x="62" y="152" width="24" height="4"  rx="2" fill="url(#rb-rainbowStripe)"/>
  </g>

</g>

<ellipse cx="60" cy="162" rx="32" ry="5" fill="rgba(0,0,0,0.2)"/>
```

---

### 步骤 4：在 `style.css` 中补全手臂走路动画

在 `src/renderer/characters/rainbow-bot/style.css` 中，找到 `rb-leg-r` keyframe 定义之后，添加手臂动画：

```css
/* 手臂走路 — 与腿反向 */
@keyframes rb-arm-l {
  0%   { transform: rotate(14deg); }
  100% { transform: rotate(-14deg); }
}
@keyframes rb-arm-r {
  0%   { transform: rotate(-14deg); }
  100% { transform: rotate(14deg); }
}
```

然后找到 `.rb-leg-l-group` 的 transform-origin 定义，在其后添加手臂的 transform-origin：

```css
.caterpillar[data-character='rainbow-bot'] .rb-arm-l-group {
  transform-origin: 26px 100px;
}
.caterpillar[data-character='rainbow-bot'] .rb-arm-r-group {
  transform-origin: 94px 100px;
}
```

然后找到走路时腿部动画的 CSS 规则，在其后添加手臂走路动画：

```css
.caterpillar[data-character='rainbow-bot'][data-animation='walk'] .rb-arm-l-group {
  animation: rb-arm-l 0.45s ease-in-out infinite alternate;
}
.caterpillar[data-character='rainbow-bot'][data-animation='walk'] .rb-arm-r-group {
  animation: rb-arm-r 0.45s ease-in-out infinite alternate;
}
```

同时，将腿部走路动画的摆动角度从 ±12deg 改为 ±18deg，使走路更自然：

```css
@keyframes rb-leg-l {
  0%   { transform: rotate(-18deg); }
  100% { transform: rotate(18deg); }
}
@keyframes rb-leg-r {
  0%   { transform: rotate(18deg); }
  100% { transform: rotate(-18deg); }
}
```

---

### 步骤 5：修复 `rainbow-bot-character.js` 中的嘴巴路径

在 `src/renderer/characters/rainbow-bot-character.js` 中，找到 `_updateMouth` 方法里的 `idle` 嘴巴路径，确认为微笑（控制点 y 大于端点 y）：

```javascript
// idle 微笑：控制点 y=80 > 端点 y=74，在 SVG 坐标系（y 向下）中形成上弧 = 微笑
idle:    'M 46 74 Q 60 80 74 74',
happy:   'M 44 74 Q 60 86 76 74',
confused:'M 46 78 Q 60 76 74 80',
sleepy:  'M 50 76 Q 60 74 70 76',
talking: 'M 48 76 Q 60 80 72 76',
dizzy:   'M 48 78 Q 60 82 72 78',
sad:     'M 46 80 Q 60 76 74 80',
```

如果当前代码中 idle 路径是 `M 46 76 Q 60 82 74 76`（控制点 y=82 > 端点 y=76，但这会形成下弧=皱眉），请将其改为 `M 46 74 Q 60 80 74 74`。

---

### 验证标准

1. 启动 app（`npm start`），选择「彩虹机器人」角色
2. 机器人头部和身体有明显球形立体感（左上高光，右下阴影）
3. 手臂和腿部有圆柱渐变（左亮右暗）
4. 默认表情为微笑（嘴角上扬），不是皱眉
5. 拖动宠物移动时，手臂和腿部交替摆动（手臂与腿反向）
6. 眩晕状态：眼睛螺旋旋转，身体轻微摇晃（不整体旋转）
7. 其他角色（caterpillar、cyber-bot、pixel-pet）不受影响

---

## 任务十二：修复快捷菜单残留 + 语音麦克风权限

### 目标

1. 窗口失焦时快捷操作菜单自动隐藏，不再飘在屏幕上
2. Electron 中语音识别能正常获取麦克风权限
3. 麦克风被拒绝时给出明确提示，而不是静默失败

### 当前问题

- `window.addEventListener('blur', ...)` 只调用了 `hideInputPanel()`，没有调用 `quickActions.hide()`，导致快捷菜单在窗口失焦后残留在屏幕上
- Electron 默认不授予 `webkitSpeechRecognition` 麦克风权限，导致点击麦克风按钮无任何反应
- `VoiceManager.onerror` 对所有错误统一返回 `type: 'error'`，无法区分权限拒绝和其他错误

---

### 步骤 1：修复 `src/renderer/index.html` — blur 事件处理

找到 `window.addEventListener('blur', ...)` 这段代码（约第 694 行），确认其中已包含 `quickActions.hide()`：

```javascript
window.addEventListener('blur', function() {
  quickActions.hide();
  hideInputPanel();
});
```

如果当前代码只有 `hideInputPanel()` 而没有 `quickActions.hide()`，在 `hideInputPanel()` 之前添加 `quickActions.hide();`。

---

### 步骤 2：修复 `src/renderer/index.html` — 语音权限错误提示

找到 `voiceManager.init(...)` 的 `onStateChange` 回调（约第 506 行），确认其中已有 `permission` 类型的处理分支：

```javascript
onStateChange: (state) => {
  if (state.type === 'listening') {
    chatBubble.show('我在听，你可以直接说。', 2200);
    return;
  }

  if (state.type === 'unsupported') {
    chatBubble.show('当前环境不支持语音输入。', 2600);
    return;
  }

  if (state.type === 'permission') {
    chatBubble.show('需要麦克风权限，请在系统设置里允许。', 3500);
    return;
  }

  if (state.type === 'error') {
    chatBubble.show('刚刚没有听清，我们再试一次。', 2600);
  }
}
```

如果缺少 `permission` 分支，在 `unsupported` 分支之后、`error` 分支之前添加上述代码。

---

### 步骤 3：修复 `src/renderer/components/VoiceManager.js` — 区分权限错误

找到 `this.recognition.onerror` 回调（约第 58 行），确认其已区分权限错误：

```javascript
this.recognition.onerror = (event) => {
  const err = event.error || 'unknown';
  const errorType = (err === 'not-allowed' || err === 'service-not-allowed') ? 'permission' : 'error';
  this.onStateChange({ type: errorType, error: err, supported: true });
  this.stopListening();
};
```

如果当前代码直接 `this.onStateChange({ type: 'error', ... })`，替换为上述版本。

---

### 步骤 4：修复 `src/main/index.js` — Electron 麦克风权限授权

找到 `createWindow` 函数中 `mainWindow` 创建完成后的位置（`mainWindow.loadFile(...)` 之后），确认已有 `setPermissionRequestHandler`：

```javascript
mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
  if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') {
    callback(true);
  } else {
    callback(false);
  }
});
```

如果不存在，在 `mainWindow.loadFile(...)` 调用之后添加上述代码块。

---

### 验证标准

1. 启动 app，点击宠物触发快捷操作菜单
2. 点击桌面其他区域让窗口失焦，快捷菜单应自动消失
3. 点击麦克风按钮，系统弹出麦克风权限请求（首次）或直接开始监听
4. 允许权限后，说话内容应出现在输入框并自动发送
5. 如果权限被拒绝，气泡显示「需要麦克风权限，请在系统设置里允许。」
