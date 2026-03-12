class ChatManager {
  constructor() {
    this.messages = [];
    this.context = [];
    this.maxContextLength = 20;
    this.careSystem = null;
    this.growthSystem = null;
    this.memoryManager = null;
    this.longTermContext = '';
    this.streamCounter = 0;
    this.streamListenerBound = false;
    this.pendingStreams = new Map();
  }

  async init(careSystem, growthSystem = null, memoryManager = null) {
    this.careSystem = careSystem;
    this.growthSystem = growthSystem;
    this.memoryManager = memoryManager;

    if (!this.streamListenerBound && window.electronAPI && window.electronAPI.onLlmStreamEvent) {
      this.streamListenerBound = true;
      window.electronAPI.onLlmStreamEvent((payload) => {
        const pending = this.pendingStreams.get(payload.requestId);
        if (!pending) {
          return;
        }

        if (payload.type === 'chunk') {
          pending.content += payload.chunk;
          pending.onChunk(payload.chunk);
          return;
        }

        if (payload.type === 'done') {
          this.pendingStreams.delete(payload.requestId);
          pending.resolve(pending.content);
          return;
        }

        if (payload.type === 'error') {
          this.pendingStreams.delete(payload.requestId);
          pending.reject(payload);
        }
      });
    }

    await this.loadPersistedHistory();
    await this.refreshLongTermContext();
  }

  buildSystemPrompt() {
    const petName = localStorage.getItem('petName') || '';
    const longerChat = this.growthSystem && this.growthSystem.hasAbility('longer_chat');
    const maxWords = longerChat ? 100 : 60;
    const personalityMap = {
      warm: '你性格温暖体贴，说话轻柔，善于共情，让人感到被关心。',
      lively: '你性格活泼开朗，说话带劲，喜欢用感叹号，充满正能量。',
      cool: '你性格冷静克制，说话简洁，不废话，但关键时刻很靠谱。',
      witty: '你性格毒舌幽默，说话带点调侃，但不伤人，让人忍不住笑。'
    };
    const personality = localStorage.getItem('petPersonality') || 'warm';
    const personalityDesc = personalityMap[personality] || personalityMap.warm;
    const nameDesc = petName ? `你的名字叫"${petName}"，这是用户给你起的名字，你很喜欢这个名字。` : '';
    let prompt = `你是一只可爱的桌面宠物，陪伴在用户的电脑桌面上。${nameDesc}${personalityDesc}回复要简短，不超过${maxWords}个字。不要用"主人"称呼用户，用"你"就好。`;

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
      const memoryContext = this.memoryManager.getPromptContext();
      if (memoryContext) {
        prompt += memoryContext;
      }
    }

    if (this.longTermContext) {
      prompt += this.longTermContext;
    }

    return prompt;
  }

  async processInput(input) {
    this.addMessage('user', input);
    this.recordMemory('chat:user', { text: input.slice(0, 120) });
    const response = await this.generateResponse(input);
    this.addMessage('assistant', response);
    this.recordMemory('chat:assistant', { text: response.slice(0, 160) });

    if (this.growthSystem) {
      this.growthSystem.addInteraction('chat');
    }

    this.extractAndSaveMemory(input, response);

    return response;
  }

  async processInputStream(input, handlers = {}) {
    this.addMessage('user', input);
    this.recordMemory('chat:user', { text: input.slice(0, 120) });

    const onStart = handlers.onStart || (() => {});
    const onChunk = handlers.onChunk || (() => {});
    const onDone = handlers.onDone || (() => {});
    const onError = handlers.onError || (() => {});

    if (!window.electronAPI || !window.electronAPI.startLlmStream) {
      const fallback = this.getMockResponse(input);
      onStart();
      onChunk(fallback);
      this.addMessage('assistant', fallback);
      if (this.growthSystem) {
        this.growthSystem.addInteraction('chat');
      }
      onDone(fallback);
      return fallback;
    }

    const requestId = `stream-${Date.now()}-${this.streamCounter++}`;
    onStart();

    try {
      const response = await new Promise((resolve, reject) => {
        this.pendingStreams.set(requestId, {
          content: '',
          onChunk,
          resolve,
          reject
        });

        window.electronAPI.startLlmStream(requestId, this.messages, {
          systemPrompt: this.buildSystemPrompt()
        });
      });

      const content = response || this.getMockResponse(input);
      this.addMessage('assistant', content);
      this.recordMemory('chat:assistant', { text: content.slice(0, 160) });
      if (this.growthSystem) {
        this.growthSystem.addInteraction('chat');
      }
      this.extractAndSaveMemory(input, content);
      onDone(content);
      return content;
    } catch (error) {
      onError(error);

      let fallback;
      if (error.error === 'daily_limit') {
        fallback = '今天聊得够多啦，明天再来找我玩吧～';
      } else {
        fallback = this.getMockResponse(input);
      }

      onChunk(fallback);
      this.addMessage('assistant', fallback);
      this.recordMemory('chat:assistant', { text: fallback.slice(0, 160), fallback: true });
      if (this.growthSystem) {
        this.growthSystem.addInteraction('chat');
      }
      this.extractAndSaveMemory(input, fallback);
      onDone(fallback);
      return fallback;
    }
  }

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
        this.messages = history.slice(-20);
      }
    } catch (_error) {
      // 加载失败静默处理，不影响正常使用
    }
  }

  async refreshLongTermContext() {
    if (this.memoryManager && typeof this.memoryManager.getLongTermContext === 'function') {
      this.longTermContext = await this.memoryManager.getLongTermContext();
    }
  }

  async extractAndSaveMemory(userInput, assistantReply) {
    if (!this.memoryManager || !window.electronAPI || !window.electronAPI.llmChat) {
      return;
    }

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
        await this.refreshLongTermContext();
      }
    } catch (_error) {
      // 提取失败静默处理
    }
  }

  recordMemory(type, payload = {}) {
    if (!this.memoryManager || typeof this.memoryManager.record !== 'function') {
      return;
    }

    this.memoryManager.record(type, payload);
  }

  async generateResponse(input) {
    if (!window.electronAPI || !window.electronAPI.llmChat) {
      return this.getMockResponse(input);
    }

    try {
      const result = await window.electronAPI.llmChat(this.messages, {
        systemPrompt: this.buildSystemPrompt()
      });

      if (result.error === 'daily_limit') {
        return '今天聊得够多啦，明天再来找我玩吧～';
      }

      if (result.error) {
        console.error('LLM error:', result.message);
        return this.getMockResponse(input);
      }

      return result.content || this.getMockResponse(input);
    } catch (error) {
      console.error('Error generating response:', error);
      return this.getMockResponse(input);
    }
  }

  getMockResponse(input) {
    const responses = {
      '你好': '你好，我会一直在桌面上陪着你。',
      '你是谁': '我是你的 AI 桌面伙伴，会慢慢成长，也会照顾你的节奏。',
      '天气': '如果你配置了天气 API，我就能感知外面的天气。',
      '时间': `现在的时间是 ${new Date().toLocaleTimeString()}`,
      '日期': `今天是 ${new Date().toLocaleDateString()}`,
      '帮助': '你可以问我状态、天气、时间，也可以直接聊天。',
      '再见': '我会继续留在这里，等你回来。'
    };

    for (const [key, value] of Object.entries(responses)) {
      if (input.includes(key)) {
        return value;
      }
    }

    return '我在认真听。你也可以问我天气、时间，或者继续和我聊。';
  }

  clearContext() {
    this.messages = [];
    this.context = [];
    this.persistHistory();
  }

  getChatHistory() {
    return this.messages;
  }

  saveChatHistory() {
    this.persistHistory();
  }

  loadChatHistory() {
    const history = localStorage.getItem('chatHistory');
    if (history) {
      this.messages = JSON.parse(history);
    }
  }
}
