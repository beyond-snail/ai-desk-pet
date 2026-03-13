# AI Desk Pet 技术文档

## 1. 文档定位

本文档描述当前仓库中的真实实现状态，面向以下用途：
- 让 Claude / Codex / 其他工程代理快速理解当前代码基线
- 作为桌面端 v1.0 的实现说明，而不是历史规划草案
- 记录已经做出的交互和性能决策，避免后续讨论回退到旧假设

本文档只覆盖桌面端 v1.0：
- `macOS`
- `Windows`
- `Linux`

移动端暂不纳入当前实现，也不要据此文档推导移动端兼容方案。

## 2. 当前产品结论

### 2.1 当前产品形态

应用安装后，表现为一个长期驻留在桌面上的透明 Electron 窗口，窗口内承载一个可交互的桌宠角色。

当前桌宠支持：
- 在桌面上自由巡游和拖拽
- 基于状态变化呈现情绪和反馈
- 聊天、语音输入、命令、番茄钟、天气和系统联动
- 多角色切换
- 多宠物扩展能力

### 2.2 当前交互结论

以下结论已经落在代码中，是当前默认行为：

- 单击宠物：触发轻反馈并直接展开环形动作菜单
- 快捷交互：`悬停直出环形菜单`（紧凑玻璃风，包含 `聊天 / 喂食 / 抚摸 / 清洁`）
- 对话气泡：随宠物平滑跟随，自动贴边并动态调整小三角指向
- 聊天输入：默认隐藏，仅在快捷操作 `聊天` 或热键语音唤醒时展开
- 状态可视化：宠物旁边常驻 `饱食 / 清洁 / 亲密` 三枚状态点（绿/黄/红）
- 首次引导：支持给宠物命名（老用户可在设置面板补填）
- 双击宠物：触发庆祝反馈
- 拖拽放下：触发掉落反馈
- 抚摸手势：鼠标在宠物上来回滑动可触发开心反馈
- 快捷操作条：默认隐藏，启动后不应出现在左上角

### 2.3 当前性能结论

以下性能取向已经落在代码中：

- 运动更新与身体动画已合并到单 `requestAnimationFrame` 主循环
- 气泡跟随使用 `requestAnimationFrame` 平滑插值，避免“瞬移”
- 不再使用“运动一套定时器 + 动画一套 RAF”的双循环结构
- 天气粒子数量已下调，避免透明桌面层上的持续高频动画过多
- Rainbow Bot 从复杂 SVG 节点改为 Sprite 帧序列图片渲染，减少持续动画合成压力
- 快捷操作条改为小尺寸玻璃风并收紧面积，控制额外合成负担
- 新增自动低功耗降载：当系统 CPU 或内存压力偏高时，自动降低天气粒子与 Rainbow Bot 高开销发光/流动效果
- 新增主循环自适应降帧：默认 60 FPS，在压力升高时自动切换到 30/20 FPS
- 当前优化目标是“小巧、灵活、自然，不明显影响系统性能”

## 3. 当前实现范围

### 3.1 已实现能力

当前仓库已经实现：

- Electron 桌面应用壳
- 透明置顶桌面窗口
- 鼠标穿透与交互区转发
- 角色系统
- 多角色资源加载
- 情绪系统
- 照顾系统：喂食、抚摸、清洁
- 成长系统：等级、阶段、能力
- 天气联动
- 系统状态联动
- 聊天气泡
- 命令系统
- 语音输入与回复朗读
- 快捷操作条
- 状态指示条（饱食/清洁/亲密）
- 双击、拖拽、抚摸等交互反馈
- 首次启动引导流程
- 空闲微行为
- 主动提醒行为
- 番茄钟 / 专注模式
- 成长日记（升级/进化自动记录，可从右键菜单查看）
- 多宠物管理
- 系统托盘
- 托盘显隐出入场动画
- 全局热键唤醒并自动激活语音输入
- 内置 AI 零配置聊天与每日限流
- 跨会话对话持久化（最近 20 条）
- 长期记忆提取与注入（最多 30 条事实）
- 内置免费天气（IP 定位 + Open-Meteo）
- 开机自启动接入
- 自动更新接入位
- 本地桌面打包脚本

### 3.2 当前未完成或仍需收口

当前仍需继续优化：

- 巡游轨迹自然度
- 启动后的资源占用
- 不同角色之间的运动手感差异化
- macOS 正式签名与 notarization
- 更系统的桌面端手工回归验证

## 4. 技术栈

### 4.1 桌面框架
- `Electron`

### 4.2 渲染层技术
- `HTML`
- `CSS`
- `JavaScript`
- `requestAnimationFrame`
- `CSS animations`

### 4.3 当前主要依赖
- `electron-store`
- `electron-updater`
- `electron-builder`

### 4.4 语音能力
- `Web Speech API`
  - `SpeechRecognition / webkitSpeechRecognition`
  - `speechSynthesis`

### 4.5 开发启动保护
- `npm start` / `npm run dev` 通过 `scripts/start-electron.mjs` 启动 Electron。
- 启动脚本会清理 `ELECTRON_RUN_AS_NODE`，避免被环境变量污染后 Electron 退化为 Node 进程。

## 5. 目录与核心文件

### 5.1 主进程
- `src/main/index.js`
  - 创建桌面窗口
  - 处理窗口配置、托盘、系统集成、IPC
  - 内置 LLM 回退与每日限流
  - 托盘显隐动画事件与全局热键
  - IP 定位缓存与天气定位 IPC

### 5.2 渲染入口
- `src/renderer/index.html`
  - 页面入口
  - 宠物实例化
  - 组件初始化
  - 全局事件编排

### 5.3 核心控制器
- `src/renderer/components/Caterpillar.js`
  - 桌宠基础控制器
  - 运动、拖拽、交互状态、手势、临时动画
- `src/renderer/components/PetController.js`
  - 多角色宠物控制器
  - 角色装载、成长同步、天气同步、系统状态同步

### 5.4 UI / 行为组件
- `src/renderer/components/ChatBubble.js`
- `src/renderer/components/Settings.js`
- `src/renderer/components/CharacterPicker.js`
- `src/renderer/components/PetManager.js`
- `src/renderer/components/QuickActions.js`
- `src/renderer/components/VoiceManager.js`
- `src/renderer/components/OnboardingGuide.js`
- `src/renderer/components/IdleBehavior.js`
- `src/renderer/components/ProactiveBehavior.js`
- `src/renderer/components/PomodoroTimer.js`
- `src/renderer/components/FocusMode.js`

### 5.5 系统 / 养成组件
- `src/renderer/components/CareSystem.js`
- `src/renderer/components/GrowthSystem.js`

### 5.6 角色与特效
- `src/renderer/characters/base-character.js`
- `src/renderer/characters/rainbow-bot-character.js`
- `src/renderer/characters/character-registry.js`
- `src/renderer/characters/caterpillar/*`
- `src/renderer/characters/cyber-bot/*`
- `src/renderer/characters/pixel-pet/*`
- `src/renderer/characters/rainbow-bot/*`
- `src/renderer/effects/WeatherEffects.js`
- `src/renderer/effects/PetParticles.js`

### 5.7 工具模块
- `src/renderer/utils/animation.js`
- `src/renderer/utils/collision.js`
- `src/renderer/utils/pathfinding.js`
- `src/renderer/utils/character-animator.js`

### 5.8 AI / 对话
- `src/renderer/ai/chat.js`
- `src/renderer/ai/commands.js`
- `src/renderer/ai/memory.js`
  - 内置 LLM 错误分流（含 `daily_limit`）

## 6. 当前架构说明

### 6.1 整体结构

当前架构可以概括为：
- 主进程负责桌面壳、系统能力、持久化桥接、打包能力
- 渲染进程负责桌宠行为、动画、交互、聊天 UI 和状态展示
- 角色资源按目录组织，通过注册表动态加载

### 6.2 宠物实例模型

当前主宠物由 `PetController` 实例承载。

`PetController` 基于 `Caterpillar` 扩展，负责：
- 将“基础桌宠行为”与“多角色资源”解耦
- 根据当前角色配置切换动画策略与移动参数
- 在切角色时保留成长、天气、系统状态等上下文

### 6.3 状态来源

当前状态主要来自以下几类：
- 本地持久化状态：`electron-store` 或 `localStorage`
- 交互状态：点击、拖拽、双击、抚摸、输入
- 环境状态：天气、昼夜、系统 CPU / 内存
- 养成状态：饥饿、清洁、亲密度、成长等级

## 7. 当前角色系统

### 7.1 当前角色

当前支持 4 个角色：
- `caterpillar`
- `cyber-bot`
- `pixel-pet`
- `rainbow-bot`（默认）

`caterpillar` 当前为 3D 质感 CSS 版本：
- 身体段体采用高光+暗面的体积渐变
- 头部增加球面高光与接地投影，避免“贴纸感”
- 斑点、触角、腿部均使用分层阴影增强立体感

`rainbow-bot` 当前为 Sprite 帧序列 2.5D 版本：
- 角色主体为单 `img` 渲染，播放轻量帧序列，减少运行时 DOM/SVG 节点与滤镜开销
- 帧序列按状态驱动：`walk` 优先，其余由 `data-mood` 映射（`idle/happy/talking/sleepy/confused/dizzy/sad`）
- `hungry` 复用 `idle` 序列，`excited` 复用 `happy` 序列
- 帧播放频率由状态基准 FPS + `data-fps-cap` + `data-low-power` 共同约束
- 保留原有状态机和动作触发语义（`data-mood` / `data-animation='walk'`）
- 行走节奏继续跟随 `--pet-walk-speed`，朝向翻转仍由根节点 `--pet-facing` 控制

### 7.2 角色资源组成

每个角色目录包含：
- `config.json`
- `template.html`
- `style.css`
- `assets/`（角色图片/帧序列资源）

### 7.3 角色配置内容

当前角色配置至少包含：
- `id`
- `name`
- `description`
- `dimensions`
- `animations`
- `moveParts`
- `growth`
- `animationStrategy`
- `movement`

### 7.4 movement 配置含义

`movement` 是当前运动调参的关键字段，支持：
- `maxSpeedMultiplier`: 最大速度倍率
- `acceleration`: 加速度
- `turnResponsiveness`: 转向响应强度
- `turnSlowdown`: 转向减速程度
- `decelerationDistance`: 开始减速的距离
- `arrivalRadius`: 到点判定半径
- `minTravelDistance`: 随机巡游最短距离
- `roamPadding`: 巡游边距

这是当前区分不同角色“运动气质”的主要手段。

## 8. 当前移动系统

### 8.1 当前设计目标

运动系统当前追求：
- 自然
- 连续
- 不抽动
- 不频繁短距离折返
- 尽量低开销

### 8.2 当前实现方式

当前移动系统位于 `src/renderer/components/Caterpillar.js`，实现逻辑为：

- 当无路径或路径耗尽时，生成新的随机巡游目标
- 随机目标必须满足最短移动距离要求
- 通过 `PathfindingUtils.generateTargetPath()` 生成带中间弯曲点的路径
- 再通过 `PathfindingUtils.smoothPath()` 做平滑插值
- 每帧根据目标点方向、当前速度、转向惩罚、减速距离计算下一步速度
- 快到目标点时提前减速
- 触边时重新生成路径

### 8.3 关键变更历史

当前代码已经经历过以下方向修正：
- 从“简单随机方向”改为“路径目标巡游”
- 从“分段缓动 waypoint”改为“连续速度控制”
- 从“统一运动参数”改为“角色独立 movement 参数”
- 从“双循环”改为“单 RAF 主循环”

### 8.4 当前已知问题

虽然结构已经比初版更好，但仍可能出现：
- 某些角色转向仍不够自然
- 某些情况下巡游路径仍显得过于程序化
- 长时间运行下还需要继续观察资源占用

## 9. 当前动画系统

### 9.1 当前动画分层

当前动画分为两层：

- 根级行为动画
  - 庆祝
  - 掉落
  - 打哈欠
  - 倾听
  - 发呆
- 角色局部动画
  - 身体波动
  - 腿部动作
  - 头部 / 触角 / 履带 / 耳朵细节变化

### 9.2 动画策略系统

`src/renderer/utils/character-animator.js` 提供角色独立动画策略。

当前策略：
- `caterpillar`
- `cyber-bot`
- `pixel-pet`
- `rainbow-bot`

不同角色在以下方面存在差异：
- 身体运动方式
- 腿部或履带响应方式
- 头部 / 触角 / 耳朵变化
- 离散像素抖动或机械倾斜等风格差异

### 9.3 当前动画主循环

当前动画与运动已统一进入单一 `requestAnimationFrame` 主循环。

目标是：
- 降低持续调度开销
- 避免运动与动画节奏不一致
- 降低透明桌面窗口中的长期性能消耗

补充：
- 动画频率已接入速度倍率映射（速度快时步频更快，停下时自然减弱）
- 转向加入“短暂停顿 + 再加速”的过渡，减少急拐生硬感

## 10. 当前交互系统

### 10.1 基础交互

当前支持：
- 单击
- 双击
- 拖拽
- 放下
- 悬停
- 抚摸手势
- 文本输入
- 语音输入

### 10.2 单击交互

当前单击宠物时：
- 宠物执行轻量反馈动画
- 直接展开环形动作菜单（聊天/喂食/抚摸/清洁）
- 不直接打开聊天输入框

这是最近明确做出的交互调整，用于减少“点击就强打断”的感觉。

### 10.2.1 输入面板模式

当前输入面板已调整为：
- 默认隐藏，不在启动后自动出现
- 通过快捷操作 `聊天` 或热键语音唤醒后展开完整输入面板（约 340px）
- 输入框为 `textarea`，支持 `Shift+Enter` 换行、`Enter` 发送
- 输入中会自动增高（最多约 3 行）并触发宠物“倾听中”反馈
- 输入为空且失焦、点空白区域或窗口失焦后自动隐藏
- 麦克风图标使用 SVG，不再使用 emoji

### 10.2.2 Rainbow Bot 对话情绪联动

当当前角色为 `rainbow-bot` 时，对话链路会驱动情绪切换：
- 用户发送后（等待中）：`confused`
- 流式回复开始：`talking`
- 回复完成：`happy`，约 3 秒后回到 `idle`
- 回复异常：`confused`，约 2 秒后回到 `idle`

### 10.3 快捷操作条

当前快捷交互由 `QuickActions.js` 管理，形态为单级：
- 鼠标悬停在宠物上约 300ms，直接展开环形动作菜单
- 单击宠物同样可以直接展开环形动作菜单
- 菜单中心优先布局在宠物外侧，避免遮挡宠物本体
- 菜单容器为 `156px`，按钮为 `48px`，采用更紧凑的十字布局

当前动作：
- `聊天`
- `喂食`
- `抚摸`
- `清洁`

当前行为约束：
- 展开后有约 2.2 秒锁定期，避免移动鼠标时误收起
- 鼠标进入菜单区域不会隐藏
- 仅当离开宠物与菜单后延迟约 380ms 收起
- 点击触发打开后约 5 秒自动收起
- 展开动效为 4 按钮中心依次弹出（约 50ms 级联），并带轻微呼吸浮动
- hover 按钮放大至约 `1.1x` 且暂停呼吸动效，减少冲突感
- 当饱食/清洁/亲密任一低于 30 时，对应按钮 icon 会脉冲提示
- 菜单打开支持键盘 `1/2/3/4` 快捷触发动作
- 启动后默认隐藏，且不允许出现在左上角

### 10.4 双击交互

当前双击宠物会：
- 触发庆祝动画
- 触发粒子反馈
- 触发气泡反馈

### 10.5 拖拽与抚摸

当前拖拽放下会触发：
- 掉落反馈动画
- 短暂状态变化

当前抚摸检测基于：
- 鼠标在宠物上的来回滑动方向变化
- 达到阈值后触发开心反馈和照顾动作

### 10.6 显隐与唤醒

当前显隐不再是直接 `show/hide`：
- 主进程点击托盘或热键后，先发送 `pet:show` / `pet:hide` 事件
- 渲染层执行入场或离场移动动画
- 入场移动超时会强制落位到目标点，避免宠物停在屏幕外
- 离场完成后通过 `pet:hide-done` 回执，主进程再执行真正 `hide`
- 启动 500ms 保护期内，忽略离场请求，避免初始化阶段误触发“出现后立即消失”

当前还支持全局热键：
- `CommandOrControl+Shift+P`
- 无论当前是否显示：都会执行“唤醒并激活语音输入”
- 隐藏动作改为仅由托盘菜单 `隐藏宠物` 或窗口关闭触发，避免误触切换

## 11. 当前对话与语音系统

### 11.1 文本对话

当前文本对话支持：
- 普通聊天
- 命令分流
- 内置 LLM 零配置开箱
- 用户自定义 Key 覆盖
- 内置 Key 每日限流
- 回退回复
- 性格化 system prompt（温暖 / 活泼 / 冷静 / 幽默）
- 错误提示人格化随机文案（失败时不再展示生硬技术错误）

### 11.2 语音输入输出

当前 `VoiceManager.js` 已实现：
- 点击麦克风进行语音识别
- 识别结果写入输入框并提交
- 回复朗读
- 识别状态提示

当前技术路线：
- `SpeechRecognition / webkitSpeechRecognition`
- `speechSynthesis`

### 11.3 对话记忆

当前新增 `ai/memory.js`：
- 记录最近互动事件（喂食/抚摸/清洁/聊天/专注）
- 本地持久化并带时间衰减
- 聊天系统会把记忆摘要注入 system prompt，回复可引用近期互动上下文
- 记忆上下文包含：相处天数、最近 3 条用户发言、当日互动统计
- 长期记忆提取：每轮对话结束后异步提取关键事实并落库（失败静默）
- 长期记忆注入：`buildSystemPrompt` 使用缓存上下文注入最近长期记忆事实

### 11.4 当前注意事项

语音能力依赖运行环境：
- 某些环境可能不支持语音识别
- 当前实现已经包含不支持时的提示分支

### 11.5 当前对话上下文持久化

`ChatManager` 当前已接入：
- 启动时自动加载持久化聊天历史（最多 20 条）
- 新消息自动持久化到 `electron-store` / `localStorage`
- 保留现有历史接口作为兼容层

## 12. 当前养成与主动行为系统

### 12.1 照顾系统

`CareSystem.js` 当前负责：
- 饥饿度
- 清洁度
- 亲密度
- 状态衰减
- 状态持久化
- 低状态阈值变化事件（含 changedFlags）
- 状态变化自动提示文案
- 派发 `derivedMood` 供渲染层映射 `data-care-mood` 视觉反馈

### 12.2 成长系统

`GrowthSystem.js` 当前负责：
- 交互积累成长值
- 等级与阶段变化
- 角色成长能力解锁
- 升级粒子特效与进化全屏光晕触发
- 升级/进化事件回调供成长日记记录（本地最多保留 50 条）

### 12.3 空闲微行为

`IdleBehavior.js` 当前负责：
- 30 秒以上挂机时的轻微反馈
- 2 分钟左右的靠近鼠标 / 换位行为
- 5 分钟以上的边缘休息行为

### 12.4 主动行为

`ProactiveBehavior.js` 当前负责：
- 低状态提醒（饥饿 / 清洁 / 亲密度）
- 分时段问候（早晨 / 午间 / 晚间 / 深夜）
- 回归问候（离开 4 小时以上优先触发）
- 天气评论（雨天 / 高温 / 低温）
- 工作太久提醒
- 高亲密度靠近用户
- 随机念头（按时段池 + 长时间未互动池）
- 专注完成专属文案

当前约束：
- 单类低状态提醒 30 分钟冷却
- 全局主动行为 2 分钟冷却
- 输入框开启、设置面板开启、用户正在输入时不打断

### 12.5 新手引导命名流程

`OnboardingGuide.js` 当前引导流程新增：
- 首次点击宠物后弹出临时命名输入层
- 名字写入 `petName`（store + localStorage）
- 超时或取消时可跳过，并在设置面板补填

### 12.6 专注模式统计

当前专注链路由 `PomodoroTimer.js + FocusMode.js` 协同实现：
- 番茄钟工作阶段自动进入安静模式
- 完成工作阶段后给出专注报告（本次/今日/本周）
- 统计数据持久化，可通过命令 `专注报告` 或 `状态` 查看

## 13. 当前环境联动

### 13.1 天气联动

当前已实现：
- 零配置天气：通过主进程 IP 定位缓存（24h）获取经纬度
- 内置 Open-Meteo 实时天气
- 兼容和风天气 API 覆盖（用户填 Key 时优先）
- 根据天气切换视觉效果与情绪状态
- 渲染天气粒子

当前考虑到性能：
- 粒子数量已下调
- 请求频率固定为 15 分钟一次
- 高负载时自动降载到低粒子/部分天气无粒子
- 仍需继续观察透明窗口下的长期成本

### 13.2 系统联动

当前已实现：
- CPU 使用率响应
- 内存压力响应
- 系统紧张状态反馈
- 系统负载驱动的动画帧率治理（60/30/20 FPS）

## 14. 当前多宠物与管理能力

### 14.1 多宠物

当前项目已具备多宠物管理能力：
- 可以创建额外宠物实例
- 可同步天气与系统状态
- 可分别维护角色状态

### 14.2 角色与宠物管理

当前 UI 已包含：
- 设置面板
- 角色选择器
- 多宠物管理面板

## 15. 当前打包与发布

### 15.1 当前本地打包

当前支持：
- `npm run build:mac:local`
- `npm run build:win`
- `npm run build:linux`

当前已多次在本机生成：
- `dist/AI桌宠-1.0.0-x64.dmg`

### 15.2 当前发布状态

当前适合：
- 本地验证
- 内部测试

当前不适合：
- 正式 macOS 外部分发

原因：
- 尚未补齐 `Developer ID Application` 签名
- 尚未完成 notarization

## 16. 当前工程约束

### 16.1 已确认约束

- v1.0 只做桌面端，不做移动端兼容处理
- 当前实现继续使用原生 Electron + HTML/CSS/JS
- 不进行 React 重构
- 当前目标优先级是：核心功能可用、交互自然、性能可接受

### 16.2 对后续代理的要求

如果 Claude 或其他代理继续在本仓库工作，应默认接受以下事实：
- 当前交互模型已经不是“点击即聊天”
- 当前快捷操作条必须默认隐藏
- 当前优化方向明确偏向低开销常驻，而不是堆砌特效
- 当前应继续围绕桌面端 v1.0 收口，而不是引入移动端或大规模技术迁移

## 17. 当前待办建议

如果需要继续推进，建议按以下顺序：

1. 继续优化巡游轨迹自然度
2. 继续降低启动和常驻资源占用
3. 做更系统的桌面端回归测试
4. 完成 macOS 正式签名与 notarization

## 18. 总结

当前仓库已经不是“概念原型”，而是一个桌面端 v1.0 可验证产品基线。

它当前具备：
- 桌面常驻能力
- 角色系统
- 养成能力
- 环境联动
- 对话与语音
- 主动行为
- 多宠物扩展
- 基础打包链路

接下来的工作重点不再是“从 0 到 1 补齐功能名词”，而是：
- 把交互变得更顺手
- 把运动变得更自然
- 把性能继续压轻
- 把发布链路补完整
